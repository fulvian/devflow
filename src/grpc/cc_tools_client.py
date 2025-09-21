import asyncio
import logging
from typing import Optional, Dict, List
import grpc
from google.protobuf.empty_pb2 import Empty

# Import generated protobuf classes
import cc_tools_integration_pb2 as pb2
import cc_tools_integration_pb2_grpc as pb2_grpc

logger = logging.getLogger(__name__)


class CCToolsClient:
    """Python gRPC client for DevFlow to communicate with cc-tools Go server"""
    
    def __init__(self, server_address: str = "localhost:50051", max_workers: int = 10):
        self.server_address = server_address
        self.channel = None
        self.stub = None
        self.max_workers = max_workers
        self._connection_lock = asyncio.Lock()
    
    async def connect(self):
        """Establish connection to the gRPC server"""
        async with self._connection_lock:
            if self.channel is None or self.channel._channel.closed():
                self.channel = grpc.aio.insecure_channel(self.server_address)
                self.stub = pb2_grpc.CCToolsIntegrationStub(self.channel)
                logger.info(f"Connected to gRPC server at {self.server_address}")
    
    async def disconnect(self):
        """Close the connection to the gRPC server"""
        async with self._connection_lock:
            if self.channel:
                await self.channel.close()
                self.channel = None
                self.stub = None
                logger.info("Disconnected from gRPC server")
    
    async def _ensure_connected(self):
        """Ensure client is connected before making requests"""
        if self.stub is None:
            await self.connect()
    
    async def _make_request(self, method, request, retries: int = 3):
        """Make a gRPC request with retry logic"""
        await self._ensure_connected()
        
        for attempt in range(retries + 1):
            try:
                response = await method(request)
                return response
            except grpc.aio.AioRpcError as e:
                if attempt == retries:
                    logger.error(f"gRPC request failed after {retries} retries: {e}")
                    raise
                logger.warning(f"gRPC request failed (attempt {attempt + 1}): {e}")
                await asyncio.sleep(0.1 * (2 ** attempt))  # Exponential backoff
            except Exception as e:
                logger.error(f"Unexpected error during gRPC request: {e}")
                raise
    
    async def validate(
        self, 
        project_root: str, 
        hook_type: str, 
        file_paths: List[str], 
        env_vars: Optional[Dict[str, str]] = None
    ) -> pb2.ValidationResponse:
        """Send validation request to cc-tools server"""
        request = pb2.ValidationRequest(
            project_root=project_root,
            hook_type=hook_type,
            file_paths=file_paths,
            env_vars=env_vars or {}
        )
        
        return await self._make_request(self.stub.Validate, request)
    
    async def get_metadata(
        self, 
        project_id: str, 
        project_root: str
    ) -> pb2.ProjectMetadata:
        """Get project metadata from cc-tools server"""
        request = pb2.ValidationRequest(
            project_root=project_root,
            hook_type="metadata"
        )
        
        return await self._make_request(self.stub.GetProjectMetadata, request)
    
    async def acquire_lock(
        self, 
        project_id: str, 
        requester_pid: int
    ) -> pb2.LockStatus:
        """Acquire project lock"""
        request = pb2.LockRequest(
            project_id=project_id,
            requester_pid=requester_pid
        )
        
        return await self._make_request(self.stub.AcquireLock, request)
    
    async def release_lock(
        self, 
        project_id: str, 
        requester_pid: int
    ) -> pb2.LockStatus:
        """Release project lock"""
        request = pb2.LockRequest(
            project_id=project_id,
            requester_pid=requester_pid
        )
        
        return await self._make_request(self.stub.ReleaseLock, request)
    
    async def check_lock(
        self, 
        project_id: str, 
        requester_pid: int
    ) -> pb2.LockStatus:
        """Check project lock status"""
        request = pb2.LockRequest(
            project_id=project_id,
            requester_pid=requester_pid
        )
        
        return await self._make_request(self.stub.CheckLock, request)


# Example usage with DevFlow event system integration
class DevFlowEventHandler:
    """Integration with DevFlow event system"""
    
    def __init__(self, grpc_client: CCToolsClient):
        self.client = grpc_client
    
    async def on_pre_commit(self, project_root: str, changed_files: List[str]):
        """Handle pre-commit event"""
        try:
            response = await self.client.validate(
                project_root=project_root,
                hook_type="pre-commit",
                file_paths=changed_files
            )
            
            if not response.response.success:
                logger.error(f"Validation failed: {response.response.message}")
                return False
            
            if response.should_abort:
                logger.warning("Validation suggests aborting the commit")
                return False
                
            logger.info("Pre-commit validation passed")
            return True
            
        except Exception as e:
            logger.error(f"Error during pre-commit validation: {e}")
            return False
    
    async def on_project_load(self, project_id: str, project_root: str):
        """Handle project load event"""
        try:
            response = await self.client.get_metadata(
                project_id=project_id,
                project_root=project_root
            )
            
            if not response.response.success:
                logger.error(f"Failed to get project metadata: {response.response.message}")
                return None
            
            logger.info(f"Loaded project {project_id} of type {response.metadata.project_type}")
            return response.metadata
            
        except Exception as e:
            logger.error(f"Error during project load: {e}")
            return None


# Context manager for easier client usage
class CCToolsClientContext:
    """Context manager for CCToolsClient"""
    
    def __init__(self, server_address: str = "localhost:50051"):
        self.client = CCToolsClient(server_address)
    
    async def __aenter__(self):
        await self.client.connect()
        return self.client
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.disconnect()
