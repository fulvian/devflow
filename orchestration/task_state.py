from enum import Enum
from dataclasses import dataclass
from typing import Dict, List, Optional, Any
from datetime import datetime

@dataclass
class TaskStateInfo:
    state: str
    description: str
    allowed_transitions: List[str]
    is_terminal: bool = False

# Define all possible task states with their properties
TASK_STATES = {
    "pending": TaskStateInfo(
        state="pending",
        description="Task is waiting to be executed",
        allowed_transitions=["in_progress", "blocked"],
        is_terminal=False
    ),
    "in_progress": TaskStateInfo(
        state="in_progress",
        description="Task is currently being executed",
        allowed_transitions=["completed", "failed", "blocked"],
        is_terminal=False
    ),
    "completed": TaskStateInfo(
        state="completed",
        description="Task has been successfully completed",
        allowed_transitions=[],
        is_terminal=True
    ),
    "failed": TaskStateInfo(
        state="failed",
        description="Task execution failed",
        allowed_transitions=["pending"],  # Allow retry
        is_terminal=True
    ),
    "blocked": TaskStateInfo(
        state="blocked",
        description="Task is blocked and cannot proceed",
        allowed_transitions=["pending", "in_progress"],
        is_terminal=False
    )
}

class TaskStateValidator:
    @staticmethod
    def is_valid_transition(from_state: str, to_state: str) -> bool:
        """Validate if a state transition is allowed"""
        if from_state not in TASK_STATES:
            return False
        
        return to_state in TASK_STATES[from_state].allowed_transitions
    
    @staticmethod
    def is_terminal_state(state: str) -> bool:
        """Check if a state is terminal (cannot transition further)"""
        if state not in TASK_STATES:
            return False
        
        return TASK_STATES[state].is_terminal
    
    @staticmethod
    def get_state_description(state: str) -> str:
        """Get human-readable description of a state"""
        if state not in TASK_STATES:
            return "Unknown state"
        
        return TASK_STATES[state].description
    
    @staticmethod
    def get_allowed_transitions(state: str) -> List[str]:
        """Get list of allowed transitions from a state"""
        if state not in TASK_STATES:
            return []
        
        return TASK_STATES[state].allowed_transitions

class TaskProgressTracker:
    def __init__(self):
        self.progress_history: Dict[str, List[Dict[str, Any]]] = {}
    
    def record_progress(self, task_id: str, progress: float, 
                       message: Optional[str] = None,
                       metadata: Optional[Dict[str, Any]] = None):
        """Record progress for a task"""
        if task_id not in self.progress_history:
            self.progress_history[task_id] = []
        
        record = {
            "timestamp": datetime.now().isoformat(),
            "progress": progress,
            "message": message,
            "metadata": metadata or {}
        }
        
        self.progress_history[task_id].append(record)
    
    def get_progress_history(self, task_id: str) -> List[Dict[str, Any]]:
        """Get progress history for a task"""
        return self.progress_history.get(task_id, [])
    
    def get_current_progress(self, task_id: str) -> float:
        """Get current progress for a task"""
        history = self.get_progress_history(task_id)
        if not history:
            return 0.0
        
        return history[-1]["progress"]
    
    def calculate_eta(self, task_id: str) -> Optional[float]:
        """Calculate estimated time to completion based on progress history"""
        history = self.get_progress_history(task_id)
        if len(history) < 2:
            return None
        
        # Simple linear estimation based on last few points
        recent_points = history[-5:] if len(history) > 5 else history
        
        # Calculate progress rate (progress per second)
        first_point = recent_points[0]
        last_point = recent_points[-1]
        
        progress_diff = last_point["progress"] - first_point["progress"]
        time_diff = datetime.fromisoformat(last_point["timestamp"]) - datetime.fromisoformat(first_point["timestamp"])
        
        if time_diff.total_seconds() <= 0 or progress_diff <= 0:
            return None
        
        progress_rate = progress_diff / time_diff.total_seconds()
        remaining_progress = 100.0 - last_point["progress"]
        
        return remaining_progress / progress_rate if progress_rate > 0 else None