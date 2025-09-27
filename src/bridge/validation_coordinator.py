import asyncio
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import uuid
from .lock_coordinator import LockCoordinator
from .grpc_bridge_manager import GRPCBridgeManager
from .bridge_types import ValidationRequest, ValidationResult, BatchConfig

logger = logging.getLogger(__name__)

class ValidationCoordinator:
    def __init__(self, bridge_manager: GRPCBridgeManager, lock_coordinator: LockCoordinator):
        self.bridge_manager = bridge_manager
        self.lock_coordinator = lock_coordinator
        self.pending_validations: Dict[str, ValidationRequest] = {}
        self.batch_config = BatchConfig()
        self._batch_queue: List[ValidationRequest] = []
        self._batch_timer: Optional[asyncio.TimerHandle] = None
        self._processing_lock = asyncio.Lock()
    
    async def submit_validation(self, request: ValidationRequest) -> str:
        """Submit a validation request for processing"""
        request_id = str(uuid.uuid4())
        request.request_id = request_id
        request.submitted_at = datetime.now()
        
        # Add to pending validations
        self.pending_validations[request_id] = request
        
        # Add to batch queue
        self._batch_queue.append(request)
        
        # Schedule batch processing
        if len(self._batch_queue) >= self.batch_config.max_batch_size:
            await self._process_batch()
        elif not self._batch_timer:
            self._batch_timer = asyncio.get_event_loop().call_later(
                self.batch_config.batch_timeout, 
                lambda: asyncio.create_task(self._process_batch())
            )
        
        return request_id
    
    async def _process_batch(self):
        """Process a batch of validation requests"""
        async with self._processing_lock:
            if self._batch_timer:
                self._batch_timer.cancel()
                self._batch_timer = None
            
            if not self._batch_queue:
                return
            
            batch = self._batch_queue[:self.batch_config.max_batch_size]
            self._batch_queue = self._batch_queue[self.batch_config.max_batch_size:]
            
            try:
                # Acquire lock for batch processing
                lock_id = await self.lock_coordinator.acquire_lock("validation_batch")
                
                # Process batch through gRPC bridge
                results = await self._send_batch_to_go_server(batch)
                
                # Release lock
                await self.lock_coordinator.release_lock(lock_id)
                
                # Emit events for results
                await self._emit_validation_events(results)
                
            except Exception as e:
                logger.error(f"Batch validation failed: {e}")
                # Handle error - possibly retry or mark as failed
                await self._handle_batch_error(batch, e)
    
    async def _send_batch_to_go_server(self, batch: List[ValidationRequest]) -> List[ValidationResult]:
        """Send validation batch to Go server via gRPC"""
        try:
            stub = await self.bridge_manager.get_stub()
            if not stub:
                raise ConnectionError("Bridge not available")
            
            # In a real implementation, this would call the actual gRPC method
            # response = await stub.ValidateBatch(batch)
            # return response.results
            
            # Mock implementation for now
            results = []
            for request in batch:
                result = ValidationResult(
                    request_id=request.request_id,
                    is_valid=True,
                    processed_at=datetime.now(),
                    metadata={"mock": True}
                )
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"Failed to send batch to Go server: {e}")
            raise
    
    async def _emit_validation_events(self, results: List[ValidationResult]):
        """Emit DevFlow events for validation results"""
        # This would integrate with the DevFlow event system
        for result in results:
            logger.info(f"Validation completed for {result.request_id}: {result.is_valid}")
            # event_bus.emit("validation.completed", result)
    
    async def _handle_batch_error(self, batch: List[ValidationRequest], error: Exception):
        """Handle batch processing errors"""
        # Mark requests as failed
        for request in batch:
            if request.request_id in self.pending_validations:
                # Create failed result
                failed_result = ValidationResult(
                    request_id=request.request_id,
                    is_valid=False,
                    processed_at=datetime.now(),
                    error=str(error)
                )
                await self._emit_validation_events([failed_result])
                
                # Remove from pending
                del self.pending_validations[request.request_id]
    
    async def get_validation_result(self, request_id: str) -> Optional[ValidationResult]:
        """Get validation result by request ID"""
        # In a real implementation, this would check completed results
        # For now, we just check if it's still pending
        if request_id in self.pending_validations:
            return None  # Still processing
        return None  # Not found or completed
    
    def cleanup_expired_requests(self):
        """Clean up expired validation requests"""
        now = datetime.now()
        expired = [
            req_id for req_id, req in self.pending_validations.items()
            if (now - req.submitted_at).total_seconds() > self.batch_config.batch_timeout * 2
        ]
        
        for req_id in expired:
            del self.pending_validations[req_id]
            logger.warning(f"Cleaned up expired validation request: {req_id}")
