from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
import json
from datetime import datetime


def _current_timestamp() -> str:
    """Get current timestamp as ISO format string"""
    return datetime.now().isoformat()


def _from_json(json_str: str, default=None):
    """Safely parse JSON string"""
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError):
        return default


@dataclass
class ValidationRequest:
    """Python representation of ValidationRequest protobuf message"""
    project_root: str
    hook_type: str
    file_paths: List[str] = field(default_factory=list)
    env_vars: Dict[str, str] = field(default_factory=dict)
    
    @classmethod
    def from_proto(cls, proto_obj):
        """Create ValidationRequest from protobuf object"""
        return cls(
            project_root=proto_obj.project_root,
            hook_type=proto_obj.hook_type,
            file_paths=list(proto_obj.file_paths),
            env_vars=dict(proto_obj.env_vars)
        )
    
    def to_proto(self):
        """Convert ValidationRequest to protobuf object"""
        import cc_tools_integration_pb2 as pb2
        return pb2.ValidationRequest(
            project_root=self.project_root,
            hook_type=self.hook_type,
            file_paths=self.file_paths,
            env_vars=self.env_vars
        )
    
    def validate(self) -> bool:
        """Validate the request data"""
        if not self.project_root:
            raise ValueError("project_root is required")
        if not self.hook_type:
            raise ValueError("hook_type is required")
        return True


@dataclass
class ProjectMetadata:
    """Python representation of ProjectMetadata protobuf message"""
    project_id: str
    project_root: str
    project_type: str
    config_files: List[str] = field(default_factory=list)
    properties: Dict[str, str] = field(default_factory=dict)
    
    @classmethod
    def from_proto(cls, proto_obj):
        """Create ProjectMetadata from protobuf object"""
        return cls(
            project_id=proto_obj.project_id,
            project_root=proto_obj.project_root,
            project_type=proto_obj.project_type,
            config_files=list(proto_obj.config_files),
            properties=dict(proto_obj.properties)
        )
    
    def to_proto(self):
        """Convert ProjectMetadata to protobuf object"""
        import cc_tools_integration_pb2 as pb2
        return pb2.ProjectMetadata(
            project_id=self.project_id,
            project_root=self.project_root,
            project_type=self.project_type,
            config_files=self.config_files,
            properties=self.properties
        )
    
    def get_property(self, key: str, default: Any = None) -> Any:
        """Get a property with optional default"""
        return self.properties.get(key, default)
    
    def has_config_file(self, filename: str) -> bool:
        """Check if a config file exists in the project"""
        return filename in self.config_files


@dataclass
class LockStatus:
    """Python representation of LockStatus protobuf message"""
    project_id: str
    is_locked: bool
    lock_pid: Optional[int] = None
    lock_timestamp: Optional[str] = None
    
    def __post_init__(self):
        if self.is_locked and (self.lock_pid is None or self.lock_timestamp is None):
            raise ValueError("lock_pid and lock_timestamp are required when is_locked is True")
    
    @classmethod
    def from_proto(cls, proto_obj):
        """Create LockStatus from protobuf object"""
        return cls(
            project_id=proto_obj.project_id,
            is_locked=proto_obj.is_locked,
            lock_pid=proto_obj.lock_pid if proto_obj.is_locked else None,
            lock_timestamp=proto_obj.lock_timestamp if proto_obj.is_locked else None
        )
    
    def to_proto(self):
        """Convert LockStatus to protobuf object"""
        import cc_tools_integration_pb2 as pb2
        return pb2.LockStatus(
            project_id=self.project_id,
            is_locked=self.is_locked,
            lock_pid=self.lock_pid or 0,
            lock_timestamp=self.lock_timestamp or ""
        )
    
    def is_expired(self, timeout_seconds: int = 300) -> bool:
        """Check if the lock has expired"""
        if not self.is_locked or not self.lock_timestamp:
            return False
        
        try:
            lock_time = datetime.fromisoformat(self.lock_timestamp)
            return (datetime.now() - lock_time).total_seconds() > timeout_seconds
        except ValueError:
            # If parsing fails, assume not expired
            return False


@dataclass
class Response:
    """Python representation of Response protobuf message"""
    success: bool
    message: str = ""
    details: List[str] = field(default_factory=list)
    
    @classmethod
    def from_proto(cls, proto_obj):
        """Create Response from protobuf object"""
        return cls(
            success=proto_obj.success,
            message=proto_obj.message,
            details=list(proto_obj.details)
        )
    
    def to_proto(self):
        """Convert Response to protobuf object"""
        import cc_tools_integration_pb2 as pb2
        return pb2.Response(
            success=self.success,
            message=self.message,
            details=self.details
        )


@dataclass
class Error:
    """Python representation of Error protobuf message"""
    code: int
    message: str = ""
    details: str = ""
    
    @classmethod
    def from_proto(cls, proto_obj):
        """Create Error from protobuf object"""
        return cls(
            code=proto_obj.code,
            message=proto_obj.message,
            details=proto_obj.details
        )
    
    def to_proto(self):
        """Convert Error to protobuf object"""
        import cc_tools_integration_pb2 as pb2
        return pb2.Error(
            code=self.code,
            message=self.message,
            details=self.details
        )
    
    def is_retryable(self) -> bool:
        """Determine if error is retryable"""
        # Define retryable error codes (example values)
        retryable_codes = {500, 503, 504}  # Internal error, service unavailable, gateway timeout
        return self.code in retryable_codes


@dataclass
class ValidationResponse:
    """Python representation of ValidationResponse protobuf message"""
    response: Response
    error: Optional[Error] = None
    should_abort: bool = False
    
    @classmethod
    def from_proto(cls, proto_obj):
        """Create ValidationResponse from protobuf object"""
        return cls(
            response=Response.from_proto(proto_obj.response),
            error=Error.from_proto(proto_obj.error) if proto_obj.HasField('error') else None,
            should_abort=proto_obj.should_abort
        )
    
    def to_proto(self):
        """Convert ValidationResponse to protobuf object"""
        import cc_tools_integration_pb2 as pb2
        proto = pb2.ValidationResponse(
            response=self.response.to_proto(),
            should_abort=self.should_abort
        )
        if self.error:
            proto.error.CopyFrom(self.error.to_proto())
        return proto
    
    def is_successful(self) -> bool:
        """Check if validation was successful"""
        return self.response.success and not self.should_abort


@dataclass
class MetadataResponse:
    """Python representation of MetadataResponse protobuf message"""
    response: Response
    error: Optional[Error] = None
    metadata: Optional[ProjectMetadata] = None
    
    @classmethod
    def from_proto(cls, proto_obj):
        """Create MetadataResponse from protobuf object"""
        return cls(
            response=Response.from_proto(proto_obj.response),
            error=Error.from_proto(proto_obj.error) if proto_obj.HasField('error') else None,
            metadata=ProjectMetadata.from_proto(proto_obj.metadata) if proto_obj.HasField('metadata') else None
        )
    
    def to_proto(self):
        """Convert MetadataResponse to protobuf object"""
        import cc_tools_integration_pb2 as pb2
        proto = pb2.MetadataResponse(
            response=self.response.to_proto()
        )
        if self.error:
            proto.error.CopyFrom(self.error.to_proto())
        if self.metadata:
            proto.metadata.CopyFrom(self.metadata.to_proto())
        return proto


@dataclass
class LockStatusResponse:
    """Python representation of LockStatusResponse protobuf message"""
    response: Response
    error: Optional[Error] = None
    status: Optional[LockStatus] = None
    
    @classmethod
    def from_proto(cls, proto_obj):
        """Create LockStatusResponse from protobuf object"""
        return cls(
            response=Response.from_proto(proto_obj.response),
            error=Error.from_proto(proto_obj.error) if proto_obj.HasField('error') else None,
            status=LockStatus.from_proto(proto_obj.status) if proto_obj.HasField('status') else None
        )
    
    def to_proto(self):
        """Convert LockStatusResponse to protobuf object"""
        import cc_tools_integration_pb2 as pb2
        proto = pb2.LockStatusResponse(
            response=self.response.to_proto()
        )
        if self.error:
            proto.error.CopyFrom(self.error.to_proto())
        if self.status:
            proto.status.CopyFrom(self.status.to_proto())
        return proto


# Exception classes for error handling
class CCToolsError(Exception):
    """Base exception for cc-tools integration errors"""
    def __init__(self, message: str, error: Optional[Error] = None):
        super().__init__(message)
        self.error = error


class ValidationError(CCToolsError):
    """Exception for validation errors"""
    pass


class LockError(CCToolsError):
    """Exception for lock-related errors"""
    pass


class MetadataError(CCToolsError):
    """Exception for metadata-related errors"""
    pass
