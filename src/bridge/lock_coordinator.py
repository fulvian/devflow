import asyncio
import logging
import os
import time
from typing import Dict, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
import uuid
from .bridge_types import LockInfo, ProcessHealth
nlogger = logging.getLogger(__name__)

class LockType(Enum):
    VALIDATION = "validation"
    RESOURCE = "resource"
    COORDINATION = "coordination"

class LockCoordinator:
    def __init__(self):
        self._locks: Dict[str, LockInfo] = {}
        self._process_locks: Dict[int, Set[str]] = {}
        self._lock = asyncio.Lock()
        self.current_pid = os.getpid()
        self._health_check_interval = 30  # seconds
        self._cleanup_task: Optional[asyncio.Task] = None
    
    async def initialize(self):
        """Initialize the lock coordinator"""
        self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
    
    async def acquire_lock(self, resource: str, lock_type: LockType = LockType.COORDINATION, 
                          timeout: float = 30.0) -> str:
        """Acquire a lock for a resource"""
        lock_id = str(uuid.uuid4())
        start_time = time.time()
        
        while True:
            async with self._lock:
                # Check if resource is already locked
                existing_lock = None
                for lock_info in self._locks.values():
                    if lock_info.resource == resource and lock_info.lock_type == lock_type:
                        existing_lock = lock_info
                        break
                
                if not existing_lock:
                    # Acquire the lock
                    lock_info = LockInfo(
                        lock_id=lock_id,
                        resource=resource,
                        lock_type=lock_type,
                        owner_pid=self.current_pid,
                        acquired_at=time.time()
                    )
                    self._locks[lock_id] = lock_info
                    
                    # Track process locks
                    if self.current_pid not in self._process_locks:
                        self._process_locks[self.current_pid] = set()
                    self._process_locks[self.current_pid].add(lock_id)
                    
                    logger.debug(f"Lock acquired: {lock_id} for {resource}")
                    return lock_id
            
            # Check timeout
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Failed to acquire lock for {resource} within {timeout} seconds")
            
            # Wait before retrying
            await asyncio.sleep(0.1)
    
    async def release_lock(self, lock_id: str) -> bool:
        """Release a previously acquired lock"""
        async with self._lock:
            if lock_id in self._locks:
                lock_info = self._locks[lock_id]
                
                # Remove from process tracking
                if lock_info.owner_pid in self._process_locks:
                    self._process_locks[lock_info.owner_pid].discard(lock_id)
                    if not self._process_locks[lock_info.owner_pid]:
                        del self._process_locks[lock_info.owner_pid]
                
                # Remove the lock
                del self._locks[lock_id]
                logger.debug(f"Lock released: {lock_id}")
                return True
            
            logger.warning(f"Attempted to release non-existent lock: {lock_id}")
            return False
    
    async def is_locked(self, resource: str, lock_type: LockType = LockType.COORDINATION) -> bool:
        """Check if a resource is currently locked"""
        async with self._lock:
            for lock_info in self._locks.values():
                if lock_info.resource == resource and lock_info.lock_type == lock_type:
                    return True
            return False
    
    async def get_lock_info(self, lock_id: str) -> Optional[LockInfo]:
        """Get information about a specific lock"""
        async with self._lock:
            return self._locks.get(lock_id)
    
    async def check_process_health(self, pid: int) -> ProcessHealth:
        """Check if a process is still healthy"""
        try:
            # Check if process exists
            os.kill(pid, 0)  # Doesn't actually send a signal
            return ProcessHealth(pid=pid, is_alive=True)
        except OSError:
            return ProcessHealth(pid=pid, is_alive=False)
    
    async def _periodic_cleanup(self):
        """Periodically clean up stale locks"""
        while True:
            try:
                await asyncio.sleep(self._health_check_interval)
                await self._cleanup_stale_locks()
            except Exception as e:
                logger.error(f"Error during lock cleanup: {e}")
    
    async def _cleanup_stale_locks(self):
        """Clean up locks held by dead processes"""
        async with self._lock:
            current_time = time.time()
            stale_locks = []
            
            for lock_id, lock_info in self._locks.items():
                # Check if process is still alive
                health = await self.check_process_health(lock_info.owner_pid)
                if not health.is_alive:
                    stale_locks.append(lock_id)
                # Also check for expired locks (optional)
                elif lock_info.ttl and (current_time - lock_info.acquired_at) > lock_info.ttl:
                    stale_locks.append(lock_id)
            
            # Remove stale locks
            for lock_id in stale_locks:
                del self._locks[lock_id]
                logger.info(f"Cleaned up stale lock: {lock_id}")
    
    async def force_release_process_locks(self, pid: int) -> int:
        """Force release all locks held by a process (use with caution)"""
        async with self._lock:
            if pid not in self._process_locks:
                return 0
            
            lock_ids = list(self._process_locks[pid])
            count = 0
            
            for lock_id in lock_ids:
                if lock_id in self._locks:
                    del self._locks[lock_id]
                    count += 1
            
            del self._process_locks[pid]
            logger.warning(f"Force released {count} locks for process {pid}")
            return count
    
    async def get_lock_statistics(self) -> Dict[str, int]:
        """Get statistics about current locks"""
        async with self._lock:
            stats = {
                "total_locks": len(self._locks),
                "processes_with_locks": len(self._process_locks)
            }
            
            # Count by type
            type_counts = {}
            for lock_info in self._locks.values():
                type_name = lock_info.lock_type.value
                type_counts[type_name] = type_counts.get(type_name, 0) + 1
            
            stats["by_type"] = type_counts
            return stats
    
    async def shutdown(self):
        """Shutdown the lock coordinator"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Release all locks owned by this process
        await self.force_release_process_locks(self.current_pid)
