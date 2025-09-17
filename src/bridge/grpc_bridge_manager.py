import asyncio
import logging
from typing import Dict, Optional, Any
from dataclasses import dataclass
from enum import Enum
import grpc
from .bridge_types import BridgeConfig, BridgeState, PerformanceMetrics

logger = logging.getLogger(__name__)

class BridgeStatus(Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    ERROR = "error"

class GRPCBridgeManager:
    def __init__(self, config: BridgeConfig):
        self.config = config
        self.channel: Optional[grpc.aio.Channel] = None
        self.stub: Optional[Any] = None
        self.state = BridgeState(status=BridgeStatus.DISCONNECTED)
        self.metrics = PerformanceMetrics()
        self._reconnect_task: Optional[asyncio.Task] = None
        self._connection_lock = asyncio.Lock()
    
    async def initialize(self) -> bool:
        """Initialize the gRPC connection"""
        try:
            async with self._connection_lock:
                return await self._connect()
        except Exception as e:
            logger.error(f"Failed to initialize bridge: {e}")
            return False
    
    async def _connect(self) -> bool:
        """Internal connection method"""
        try:
            self.state.status = BridgeStatus.CONNECTING
            self.channel = grpc.aio.insecure_channel(
                f"{self.config.host}:{self.config.port}",
                options=[
                    ('grpc.keepalive_time_ms', 10000),
                    ('grpc.keepalive_timeout_ms', 5000),
                    ('grpc.keepalive_permit_without_calls', True),
                    ('grpc.http2.max_pings_without_data', 0)
                ]
            )
            
            # Wait for connection
            await asyncio.wait_for(
                self.channel.channel_ready(), 
                timeout=self.config.connection_timeout
            )
            
            self.state.status = BridgeStatus.CONNECTED
            self.state.last_connected = asyncio.get_event_loop().time()
            logger.info("gRPC bridge connected successfully")
            return True
            
        except Exception as e:
            self.state.status = BridgeStatus.ERROR
            self.state.last_error = str(e)
            logger.error(f"Bridge connection failed: {e}")
            return False
    
    async def health_check(self) -> bool:
        """Perform health check on the bridge"""
        if self.state.status != BridgeStatus.CONNECTED or not self.channel:
            return False
            
        try:
            # Implement health check RPC call
            # This would call a health check endpoint on the Go server
            return True
        except Exception:
            return False
    
    async def ensure_connection(self) -> bool:
        """Ensure bridge is connected, reconnect if needed"""
        if self.state.status == BridgeStatus.CONNECTED:
            if await self.health_check():
                return True
        
        return await self.initialize()
    
    async def get_stub(self):
        """Get the gRPC stub, ensuring connection"""
        if not await self.ensure_connection():
            raise ConnectionError("Cannot establish bridge connection")
        
        # In a real implementation, you would return the actual stub
        # return self.stub
        return None
    
    async def close(self):
        """Close the bridge connection"""
        if self._reconnect_task:
            self._reconnect_task.cancel()
            
        if self.channel:
            await self.channel.close()
            self.channel = None
            
        self.state.status = BridgeStatus.DISCONNECTED
    
    def get_metrics(self) -> PerformanceMetrics:
        """Get current performance metrics"""
        return self.metrics
