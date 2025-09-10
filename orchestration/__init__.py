"""
Orchestration package for DevFlow Task Manager System.

This package provides a comprehensive task management and orchestration system
compatible with the cc-sessions storage system and Zero Touch Architecture.
"""

from .task_manager import TaskManagerSystem, Task, TaskState, TaskPriority
from .task_state import TaskStateValidator, TASK_STATES
from .progress_tracker import ProgressTracker, ProgressSnapshot, ResourceUtilization
from .failure_recovery import FailureRecoverySystem, FailureType, RecoveryStrategy

__all__ = [
    'TaskManagerSystem',
    'Task',
    'TaskState', 
    'TaskPriority',
    'TaskStateValidator',
    'TASK_STATES',
    'ProgressTracker',
    'ProgressSnapshot',
    'ResourceUtilization',
    'FailureRecoverySystem',
    'FailureType',
    'RecoveryStrategy'
]

__version__ = "1.0.0"