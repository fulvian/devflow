"""
Batch Manager - Core module for batch operations management
"""
import asyncio
from typing import List, Dict, Any, Optional, Union
from enum import Enum
from dataclasses import dataclass
import logging

class ExecutionMode(Enum):
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    CONDITIONAL = "conditional"

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class BatchTask:
    id: str
    command: str
    parameters: Dict[str, Any]
    dependencies: List[str] = None
    status: TaskStatus = TaskStatus.PENDING
    result: Any = None
    error: str = None

class BatchManager:
    """Manages batch operations with different execution modes"""

    def __init__(self):
        self.tasks: Dict[str, BatchTask] = {}
        self.logger = logging.getLogger(__name__)

    def add_task(self, task: BatchTask) -> str:
        """Add a task to the batch queue"""
        self.tasks[task.id] = task
        return task.id

    def execute_batch(self, mode: ExecutionMode = ExecutionMode.SEQUENTIAL) -> Dict[str, Any]:
        """Execute batch of tasks in specified mode"""
        if mode == ExecutionMode.SEQUENTIAL:
            return self._execute_sequential()
        elif mode == ExecutionMode.PARALLEL:
            return self._execute_parallel()
        elif mode == ExecutionMode.CONDITIONAL:
            return self._execute_conditional()
        else:
            raise ValueError(f"Unsupported execution mode: {mode}")

    def _execute_sequential(self) -> Dict[str, Any]:
        """Execute tasks sequentially"""
        results = {}
        for task_id, task in self.tasks.items():
            try:
                task.status = TaskStatus.RUNNING
                # Simulate task execution
                task.result = f"Result for {task.command}"
                task.status = TaskStatus.COMPLETED
                results[task_id] = task.result
            except Exception as e:
                task.status = TaskStatus.FAILED
                task.error = str(e)
                results[task_id] = {"error": str(e)}
        return results

    async def _execute_parallel(self) -> Dict[str, Any]:
        """Execute tasks in parallel"""
        async def run_task(task: BatchTask):
            try:
                task.status = TaskStatus.RUNNING
                await asyncio.sleep(0.1)  # Simulate async work
                task.result = f"Parallel result for {task.command}"
                task.status = TaskStatus.COMPLETED
                return task.id, task.result
            except Exception as e:
                task.status = TaskStatus.FAILED
                task.error = str(e)
                return task.id, {"error": str(e)}

        tasks = [run_task(task) for task in self.tasks.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return dict(results)

    def _execute_conditional(self) -> Dict[str, Any]:
        """Execute tasks with conditional logic"""
        results = {}
        for task_id, task in self.tasks.items():
            # Check dependencies
            if task.dependencies:
                if not self._dependencies_satisfied(task.dependencies):
                    task.status = TaskStatus.FAILED
                    task.error = "Dependencies not satisfied"
                    continue

            try:
                task.status = TaskStatus.RUNNING
                task.result = f"Conditional result for {task.command}"
                task.status = TaskStatus.COMPLETED
                results[task_id] = task.result
            except Exception as e:
                task.status = TaskStatus.FAILED
                task.error = str(e)
                results[task_id] = {"error": str(e)}
        return results

    def _dependencies_satisfied(self, dependencies: List[str]) -> bool:
        """Check if all dependencies are satisfied"""
        for dep_id in dependencies:
            if dep_id not in self.tasks:
                return False
            if self.tasks[dep_id].status != TaskStatus.COMPLETED:
                return False
        return True

    def get_task_status(self, task_id: str) -> Optional[TaskStatus]:
        """Get status of a specific task"""
        task = self.tasks.get(task_id)
        return task.status if task else None

    def clear_tasks(self):
        """Clear all tasks"""
        self.tasks.clear()