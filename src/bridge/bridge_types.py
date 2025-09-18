from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime
import time

@dataclass
class BridgeConfig:
    host: str = "localhost"
    port: int = 50051
    connection_timeout: float = 10.0
    max_retries: int = 3
    retry_delay: float = 1.0
    enable_health_checks: bool = True
    health_check_interval: float = 30.0

@dataclass
class PerformanceMetrics:
    requests_sent: int = 0
    requests_success: int = 0
    requests_failed: int = 0
    average_response_time: float = 0.0
    last_request_time: float = 0.0
    errors: List[str] = field(default_factory=list)

@dataclass
class BridgeState:
    status: str = "disconnected"
    last_connected: Optional[float] = None
    last_error: Optional[str] = None
    metrics: PerformanceMetrics = field(default_factory=PerformanceMetrics)

@dataclass
class BatchConfig:
    max_batch_size: int = 10
    batch_timeout: float = 5.0
    max_concurrent_batches: int = 3

@dataclass
class ValidationRequest:
    request_id: str = ""
    data: Dict[str, Any] = field(default_factory=dict)
    schema: str = ""
    submitted_at: Optional[datetime] = None
    timeout: float = 30.0
    priority: int = 0

@dataclass
class ValidationResult:
    request_id: str = ""
    is_valid: bool = False
    processed_at: Optional[datetime] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class LockInfo:
    lock_id: str
    resource: str
    lock_type: Any  # This will be LockType enum
    owner_pid: int
    acquired_at: float
    ttl: Optional[float] = None  # Time to live in seconds

@dataclass
class ProcessHealth:
    pid: int
    is_alive: bool
    last_checked: float = field(default_factory=time.time)

# Enums
class LockType(Enum):
    VALIDATION = "validation"
    RESOURCE = "resource"
    COORDINATION = "coordination"
