#!/usr/bin/env python3
"""
CC-Tools Integration Hook for DevFlow

This module provides a hook that integrates cc-tools validators with the existing
DevFlow validation system using a gRPC bridge. It replaces existing validation
hooks while maintaining compatibility and providing performance tracking.
"""

import asyncio
import logging
import time
import sys
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Callable, Awaitable
from functools import wraps

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from bridge.grpc_bridge_manager import GRPCBridgeManager
from bridge.validation_coordinator import ValidationCoordinator
from bridge.lock_coordinator import LockCoordinator
from bridge.bridge_types import ValidationResult, ValidationRequest, BridgeConfig

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class CCValidationHookError(Exception):
    """Custom exception for CC validation hook errors"""
    pass

class DevFlowMemorySystem:
    """Simple memory system for storing validation results"""

    def __init__(self):
        self.memory_dir = Path(os.getenv('CLAUDE_PROJECT_DIR', os.getcwd())) / '.claude' / 'memory'
        self.memory_dir.mkdir(exist_ok=True)

    async def store_validation_result(self, session_id: str, request: ValidationRequest, result: ValidationResult):
        """Store validation result in memory"""
        try:
            memory_file = self.memory_dir / f'validation_{session_id}.json'
            import json
            data = {
                'timestamp': time.time(),
                'session_id': session_id,
                'request': {
                    'data_keys': list(request.data.keys()) if hasattr(request, 'data') else [],
                    'timestamp': request.timestamp if hasattr(request, 'timestamp') else time.time()
                },
                'result': {
                    'is_valid': result.is_valid,
                    'errors': result.errors,
                    'warnings': result.warnings,
                    'metadata': result.metadata
                }
            }
            with open(memory_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to store validation result: {e}")

    async def cleanup(self):
        """Cleanup memory system"""
        pass

class SessionManager:
    """Simple session manager"""

    def __init__(self):
        import uuid
        self.uuid = uuid

    def create_session(self) -> str:
        """Create a new session ID"""
        return str(self.uuid.uuid4())

class CCValidationHook:
    """
    CC-Tools integration hook that replaces existing validation logic
    with cc-tools validators via gRPC bridge.
    """

    def __init__(self):
        self.grpc_bridge = GRPCBridgeManager(BridgeConfig())
        self.lock_coordinator = LockCoordinator()
        self.validation_coordinator = ValidationCoordinator(self.grpc_bridge, self.lock_coordinator)
        self.memory_system = DevFlowMemorySystem()
        self.session_manager = SessionManager()
        self._original_hooks: List[Callable] = []
        self._performance_metrics: Dict[str, List[float]] = {
            'validation_time': [],
            'bridge_latency': [],
            'fallback_time': []
        }

    def register_original_hook(self, hook: Callable) -> None:
        """
        Register an original validation hook for fallback purposes.

        Args:
            hook: The original validation hook function
        """
        self._original_hooks.append(hook)
        logger.info(f"Registered original hook: {hook.__name__}")

    @staticmethod
    def performance_tracker(operation_name: str) -> Callable:
        """
        Decorator to track performance metrics for operations.

        Args:
            operation_name: Name of the operation to track

        Returns:
            Decorator function
        """
        def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
            @wraps(func)
            async def async_wrapper(instance_self, *args, **kwargs):
                start_time = time.perf_counter()
                try:
                    result = await func(instance_self, *args, **kwargs)
                    execution_time = time.perf_counter() - start_time
                    if operation_name not in instance_self._performance_metrics:
                        instance_self._performance_metrics[operation_name] = []
                    instance_self._performance_metrics[operation_name].append(execution_time)
                    return result
                except Exception as e:
                    execution_time = time.perf_counter() - start_time
                    error_key = f"{operation_name}_error"
                    if error_key not in instance_self._performance_metrics:
                        instance_self._performance_metrics[error_key] = []
                    instance_self._performance_metrics[error_key].append(execution_time)
                    raise e

            @wraps(func)
            def sync_wrapper(instance_self, *args, **kwargs):
                start_time = time.perf_counter()
                try:
                    result = func(instance_self, *args, **kwargs)
                    execution_time = time.perf_counter() - start_time
                    if operation_name not in instance_self._performance_metrics:
                        instance_self._performance_metrics[operation_name] = []
                    instance_self._performance_metrics[operation_name].append(execution_time)
                    return result
                except Exception as e:
                    execution_time = time.perf_counter() - start_time
                    error_key = f"{operation_name}_error"
                    if error_key not in instance_self._performance_metrics:
                        instance_self._performance_metrics[error_key] = []
                    instance_self._performance_metrics[error_key].append(execution_time)
                    raise e

            return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        return decorator

    @performance_tracker("bridge_latency")
    async def _establish_grpc_connection(self) -> bool:
        """
        Establish connection to cc-tools gRPC bridge.

        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            if not self.grpc_bridge.is_connected():
                await self.grpc_bridge.connect()
            return self.grpc_bridge.is_connected()
        except Exception as e:
            logger.error(f"Failed to establish gRPC connection: {e}")
            return False

    @performance_tracker("validation_time")
    async def _perform_cc_validation(self, data: Dict[str, Any],
                                   session_id: str) -> ValidationResult:
        """
        Perform validation using cc-tools via gRPC bridge.

        Args:
            data: Data to validate
            session_id: Current session identifier

        Returns:
            ValidationResult: Validation result from cc-tools

        Raises:
            CCValidationHookError: If validation fails
        """
        if not await self._establish_grpc_connection():
            raise CCValidationHookError("Cannot establish connection to cc-tools bridge")

        try:
            # Create validation request
            request = ValidationRequest(
                data=data,
                session_id=session_id,
                timestamp=time.time()
            )

            # Acquire lock for this session
            async with self.lock_coordinator.acquire_lock(session_id):
                # Perform validation through coordinator
                result = await self.validation_coordinator.validate(request)

                # Store result in memory system
                await self.memory_system.store_validation_result(
                    session_id, request, result
                )

                return result

        except Exception as e:
            logger.error(f"CC validation failed: {e}")
            raise CCValidationHookError(f"Validation failed: {str(e)}")

    async def _execute_fallback_validation(self, data: Dict[str, Any],
                                         session_id: str) -> Dict[str, Any]:
        """
        Execute original validation hooks as fallback.

        Args:
            data: Data to validate
            session_id: Current session identifier

        Returns:
            Dict[str, Any]: Validation results from original hooks
        """
        logger.info("Falling back to original validation hooks")

        results = {}
        for hook in self._original_hooks:
            try:
                if asyncio.iscoroutinefunction(hook):
                    result = await hook(data, session_id)
                else:
                    result = hook(data, session_id)
                results[hook.__name__] = result
            except Exception as e:
                logger.warning(f"Original hook {hook.__name__} failed: {e}")
                results[hook.__name__] = {"error": str(e)}

        return results

    async def validate(self, data: Dict[str, Any],
                      session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Main validation method that integrates with cc-tools.

        Args:
            data: Data to validate
            session_id: Optional session identifier

        Returns:
            Dict[str, Any]: Validation results
        """
        # Generate session ID if not provided
        if not session_id:
            session_id = self.session_manager.create_session()

        try:
            # Try cc-tools validation first
            cc_result = await self._perform_cc_validation(data, session_id)

            # Convert ValidationResult to dictionary for compatibility
            return {
                "valid": cc_result.is_valid,
                "errors": cc_result.errors,
                "warnings": cc_result.warnings,
                "metadata": cc_result.metadata,
                "source": "cc-tools"
            }

        except CCValidationHookError as e:
            logger.warning(f"CC validation failed, falling back: {e}")

            # Track fallback performance
            start_time = time.perf_counter()
            try:
                fallback_result = await self._execute_fallback_validation(data, session_id)
                execution_time = time.perf_counter() - start_time
                self._performance_metrics["fallback_time"].append(execution_time)

                return {
                    "results": fallback_result,
                    "source": "fallback",
                    "cc_tools_error": str(e)
                }
            except Exception as fallback_error:
                execution_time = time.perf_counter() - start_time
                self._performance_metrics["fallback_time"].append(execution_time)

                logger.error(f"Fallback validation also failed: {fallback_error}")
                raise CCValidationHookError(
                    f"Both cc-tools and fallback validation failed: {e}, {fallback_error}"
                )

    def get_performance_metrics(self) -> Dict[str, Dict[str, float]]:
        """
        Get performance metrics for validation operations.

        Returns:
            Dict containing performance statistics
        """
        metrics = {}
        for operation, times in self._performance_metrics.items():
            if times:
                metrics[operation] = {
                    "avg_time": sum(times) / len(times),
                    "min_time": min(times),
                    "max_time": max(times),
                    "total_calls": len(times)
                }
            else:
                metrics[operation] = {
                    "avg_time": 0,
                    "min_time": 0,
                    "max_time": 0,
                    "total_calls": 0
                }
        return metrics

    async def cleanup(self) -> None:
        """
        Cleanup resources and connections.
        """
        try:
            await self.grpc_bridge.disconnect()
            await self.memory_system.cleanup()
            logger.info("CC validation hook cleanup completed")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

# Global instance for hook integration
cc_validation_hook = CCValidationHook()

# Hook functions for integration with DevFlow
async def cc_validation_hook_async(data: Dict[str, Any],
                                  session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Async hook function for DevFlow integration.

    Args:
        data: Data to validate
        session_id: Optional session identifier

    Returns:
        Dict[str, Any]: Validation results
    """
    return await cc_validation_hook.validate(data, session_id)

def cc_validation_hook_sync(data: Dict[str, Any],
                           session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Sync hook function for DevFlow integration.

    Args:
        data: Data to validate
        session_id: Optional session identifier

    Returns:
        Dict[str, Any]: Validation results
    """
    # Run async function in event loop
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    return loop.run_until_complete(cc_validation_hook.validate(data, session_id))

# Example of how to register original hooks for fallback
def register_fallback_hooks(hooks: List[Callable]) -> None:
    """
    Register original validation hooks for fallback operation.

    Args:
        hooks: List of original validation hook functions
    """
    for hook in hooks:
        cc_validation_hook.register_original_hook(hook)

# Cleanup function for graceful shutdown
async def cleanup_hook() -> None:
    """
    Cleanup function to be called on application shutdown.
    """
    await cc_validation_hook.cleanup()

if __name__ == "__main__":
    # Test the hook system
    import json

    async def test_validation():
        test_data = {
            "tool_name": "Write",
            "file_path": "/test/file.py",
            "content": "print('hello world')"
        }

        result = await cc_validation_hook.validate(test_data)
        print(json.dumps(result, indent=2))

        metrics = cc_validation_hook.get_performance_metrics()
        print("Performance metrics:")
        print(json.dumps(metrics, indent=2))

        await cc_validation_hook.cleanup()

    asyncio.run(test_validation())