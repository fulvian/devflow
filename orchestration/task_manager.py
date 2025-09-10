from typing import Dict, List, Optional, Any, Callable
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
import json
import asyncio
import logging

logger = logging.getLogger(__name__)

class TaskState(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"

class TaskPriority(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class Task:
    id: str
    name: str
    description: str
    state: TaskState
    priority: TaskPriority
    created_at: datetime
    updated_at: datetime
    assigned_agent: Optional[str] = None
    dependencies: List[str] = None
    progress: float = 0.0
    estimated_duration: Optional[int] = None  # in seconds
    actual_duration: Optional[int] = None  # in seconds
    failure_reason: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []
        if self.metadata is None:
            self.metadata = {}

@dataclass
class TaskProgress:
    task_id: str
    progress: float
    timestamp: datetime
    message: Optional[str] = None
    resource_utilization: Optional[Dict[str, Any]] = None

@dataclass
class Workflow:
    id: str
    name: str
    description: str
    tasks: List[Task]
    created_at: datetime
    updated_at: datetime
    status: TaskState

@dataclass
class AuditTrailEntry:
    task_id: str
    timestamp: datetime
    action: str
    details: Dict[str, Any]
    actor: Optional[str] = None

class TaskManagerSystem:
    def __init__(self, state_file: str = "/Users/fulvioventura/devflow/.claude/state/current_task.json"):
        self.state_file = state_file
        self.tasks: Dict[str, Task] = {}
        self.workflows: Dict[str, Workflow] = {}
        self.audit_trail: List[AuditTrailEntry] = []
        self.progress_trackers: Dict[str, List[TaskProgress]] = {}
        self._load_state()
    
    def _load_state(self):
        """Load task state from file"""
        try:
            with open(self.state_file, 'r') as f:
                data = json.load(f)
                # Convert loaded data to Task objects
                for task_id, task_data in data.get('tasks', {}).items():
                    task_data['state'] = TaskState(task_data['state'])
                    task_data['priority'] = TaskPriority(task_data['priority'])
                    task_data['created_at'] = datetime.fromisoformat(task_data['created_at'])
                    task_data['updated_at'] = datetime.fromisoformat(task_data['updated_at'])
                    self.tasks[task_id] = Task(**task_data)
                
                # Load workflows
                for workflow_id, workflow_data in data.get('workflows', {}).items():
                    workflow_data['status'] = TaskState(workflow_data['status'])
                    workflow_data['created_at'] = datetime.fromisoformat(workflow_data['created_at'])
                    workflow_data['updated_at'] = datetime.fromisoformat(workflow_data['updated_at'])
                    workflow_data['tasks'] = [self.tasks[tid] for tid in workflow_data['task_ids'] if tid in self.tasks]
                    self.workflows[workflow_id] = Workflow(**workflow_data)
                    
        except FileNotFoundError:
            logger.info("No existing state file found, starting fresh")
        except Exception as e:
            logger.error(f"Error loading state: {e}")
    
    def _save_state(self):
        """Save current task state to file"""
        try:
            state_data = {
                'tasks': {tid: asdict(task) for tid, task in self.tasks.items()},
                'workflows': {wid: {
                    'id': workflow.id,
                    'name': workflow.name,
                    'description': workflow.description,
                    'task_ids': [t.id for t in workflow.tasks],
                    'created_at': workflow.created_at.isoformat(),
                    'updated_at': workflow.updated_at.isoformat(),
                    'status': workflow.status.value
                } for wid, workflow in self.workflows.items()},
                'audit_trail': [asdict(entry) for entry in self.audit_trail],
                'progress_trackers': {tid: [asdict(p) for p in progress] for tid, progress in self.progress_trackers.items()}
            }
            
            with open(self.state_file, 'w') as f:
                json.dump(state_data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving state: {e}")
    
    def create_task(self, task_id: str, name: str, description: str, 
                   priority: TaskPriority = TaskPriority.MEDIUM,
                   dependencies: List[str] = None,
                   estimated_duration: Optional[int] = None,
                   metadata: Dict[str, Any] = None) -> Task:
        """Create a new task"""
        task = Task(
            id=task_id,
            name=name,
            description=description,
            state=TaskState.PENDING,
            priority=priority,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            dependencies=dependencies or [],
            estimated_duration=estimated_duration,
            metadata=metadata or {}
        )
        
        self.tasks[task_id] = task
        self.progress_trackers[task_id] = []
        self._add_audit_entry(task_id, "task_created", {"name": name, "priority": priority.value})
        self._save_state()
        
        return task
    
    def create_workflow(self, workflow_id: str, name: str, description: str, task_ids: List[str]) -> Workflow:
        """Create a workflow from existing tasks"""
        tasks = [self.tasks[tid] for tid in task_ids if tid in self.tasks]
        workflow = Workflow(
            id=workflow_id,
            name=name,
            description=description,
            tasks=tasks,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            status=TaskState.PENDING
        )
        
        self.workflows[workflow_id] = workflow
        self._add_audit_entry(workflow_id, "workflow_created", {"name": name, "task_count": len(tasks)})
        self._save_state()
        
        return workflow
    
    def update_task_state(self, task_id: str, new_state: TaskState, 
                         failure_reason: Optional[str] = None) -> bool:
        """Update task state with validation"""
        if task_id not in self.tasks:
            logger.error(f"Task {task_id} not found")
            return False
        
        task = self.tasks[task_id]
        old_state = task.state
        
        # Validate state transition
        if not self._is_valid_transition(old_state, new_state):
            logger.error(f"Invalid state transition from {old_state} to {new_state} for task {task_id}")
            return False
        
        # Update task
        task.state = new_state
        task.updated_at = datetime.now()
        
        if new_state == TaskState.FAILED and failure_reason:
            task.failure_reason = failure_reason
        
        # Update workflow status if this task is part of a workflow
        self._update_workflow_status(task_id)
        
        self._add_audit_entry(task_id, "state_changed", {
            "from": old_state.value,
            "to": new_state.value,
            "failure_reason": failure_reason
        })
        self._save_state()
        
        return True
    
    def _is_valid_transition(self, from_state: TaskState, to_state: TaskState) -> bool:
        """Validate task state transitions"""
        valid_transitions = {
            TaskState.PENDING: [TaskState.IN_PROGRESS, TaskState.BLOCKED],
            TaskState.IN_PROGRESS: [TaskState.COMPLETED, TaskState.FAILED, TaskState.BLOCKED],
            TaskState.BLOCKED: [TaskState.PENDING, TaskState.IN_PROGRESS],
            TaskState.COMPLETED: [],
            TaskState.FAILED: [TaskState.PENDING]  # Allow retry
        }
        
        return to_state in valid_transitions.get(from_state, [])
    
    def update_task_progress(self, task_id: str, progress: float, message: Optional[str] = None,
                            resource_utilization: Optional[Dict[str, Any]] = None) -> bool:
        """Update task progress"""
        if task_id not in self.tasks:
            logger.error(f"Task {task_id} not found")
            return False
        
        task = self.tasks[task_id]
        task.progress = max(0.0, min(100.0, progress))
        task.updated_at = datetime.now()
        
        # Record progress
        progress_entry = TaskProgress(
            task_id=task_id,
            progress=progress,
            timestamp=datetime.now(),
            message=message,
            resource_utilization=resource_utilization
        )
        
        if task_id not in self.progress_trackers:
            self.progress_trackers[task_id] = []
        self.progress_trackers[task_id].append(progress_entry)
        
        self._add_audit_entry(task_id, "progress_updated", {
            "progress": progress,
            "message": message
        })
        self._save_state()
        
        return True
    
    def assign_task(self, task_id: str, agent_id: str) -> bool:
        """Assign task to an agent"""
        if task_id not in self.tasks:
            logger.error(f"Task {task_id} not found")
            return False
        
        task = self.tasks[task_id]
        task.assigned_agent = agent_id
        task.updated_at = datetime.now()
        
        self._add_audit_entry(task_id, "task_assigned", {"agent": agent_id})
        self._save_state()
        
        return True
    
    def get_task_dependencies(self, task_id: str) -> List[str]:
        """Get task dependencies that are not completed"""
        if task_id not in self.tasks:
            return []
        
        task = self.tasks[task_id]
        incomplete_deps = []
        
        for dep_id in task.dependencies:
            if dep_id in self.tasks and self.tasks[dep_id].state != TaskState.COMPLETED:
                incomplete_deps.append(dep_id)
        
        return incomplete_deps
    
    def can_execute_task(self, task_id: str) -> bool:
        """Check if task can be executed (all dependencies completed)"""
        return len(self.get_task_dependencies(task_id)) == 0
    
    def get_tasks_by_state(self, state: TaskState) -> List[Task]:
        """Get all tasks with a specific state"""
        return [task for task in self.tasks.values() if task.state == state]
    
    def get_tasks_by_agent(self, agent_id: str) -> List[Task]:
        """Get all tasks assigned to an agent"""
        return [task for task in self.tasks.values() if task.assigned_agent == agent_id]
    
    def get_task_progress_history(self, task_id: str) -> List[TaskProgress]:
        """Get progress history for a task"""
        return self.progress_trackers.get(task_id, [])
    
    def _update_workflow_status(self, task_id: str):
        """Update workflow status based on task completion"""
        for workflow in self.workflows.values():
            if any(t.id == task_id for t in workflow.tasks):
                # Check if all tasks in workflow are completed
                all_completed = all(t.state == TaskState.COMPLETED for t in workflow.tasks)
                any_failed = any(t.state == TaskState.FAILED for t in workflow.tasks)
                
                if all_completed:
                    workflow.status = TaskState.COMPLETED
                elif any_failed:
                    workflow.status = TaskState.FAILED
                else:
                    workflow.status = TaskState.IN_PROGRESS
                
                workflow.updated_at = datetime.now()
                self._add_audit_entry(workflow.id, "workflow_status_updated", {"status": workflow.status.value})
    
    def _add_audit_entry(self, task_id: str, action: str, details: Dict[str, Any], actor: Optional[str] = None):
        """Add entry to audit trail"""
        entry = AuditTrailEntry(
            task_id=task_id,
            timestamp=datetime.now(),
            action=action,
            details=details,
            actor=actor
        )
        self.audit_trail.append(entry)
    
    def get_audit_trail(self, task_id: Optional[str] = None) -> List[AuditTrailEntry]:
        """Get audit trail for a task or all tasks"""
        if task_id:
            return [entry for entry in self.audit_trail if entry.task_id == task_id]
        return self.audit_trail
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for tasks"""
        total_tasks = len(self.tasks)
        if total_tasks == 0:
            return {}
        
        completed_tasks = len(self.get_tasks_by_state(TaskState.COMPLETED))
        failed_tasks = len(self.get_tasks_by_state(TaskState.FAILED))
        in_progress_tasks = len(self.get_tasks_by_state(TaskState.IN_PROGRESS))
        
        success_rate = completed_tasks / total_tasks if total_tasks > 0 else 0
        failure_rate = failed_tasks / total_tasks if total_tasks > 0 else 0
        
        # Calculate average completion time
        completed_with_duration = [t for t in self.get_tasks_by_state(TaskState.COMPLETED) 
                                 if t.actual_duration is not None]
        avg_completion_time = sum(t.actual_duration for t in completed_with_duration) / len(completed_with_duration) \
                             if completed_with_duration else 0
        
        return {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "failed_tasks": failed_tasks,
            "in_progress_tasks": in_progress_tasks,
            "success_rate": success_rate,
            "failure_rate": failure_rate,
            "average_completion_time": avg_completion_time
        }
    
    def retry_failed_task(self, task_id: str) -> bool:
        """Retry a failed task"""
        if task_id not in self.tasks:
            logger.error(f"Task {task_id} not found")
            return False
        
        task = self.tasks[task_id]
        if task.state != TaskState.FAILED:
            logger.error(f"Task {task_id} is not in failed state")
            return False
        
        if task.retry_count >= task.max_retries:
            logger.error(f"Task {task_id} has reached maximum retries")
            return False
        
        task.retry_count += 1
        task.failure_reason = None
        self.update_task_state(task_id, TaskState.PENDING)
        
        self._add_audit_entry(task_id, "task_retried", {"retry_count": task.retry_count})
        self._save_state()
        
        return True