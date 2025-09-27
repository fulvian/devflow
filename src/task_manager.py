"""
Task Manager - Core module for task management and lifecycle
"""
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from enum import Enum
from datetime import datetime
import uuid

class TaskStatus(Enum):
    CREATED = "created"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskPriority(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class Task:
    """Represents a task in the system"""
    id: str
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.CREATED
    priority: TaskPriority = TaskPriority.MEDIUM
    assignee: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        self.updated_at = datetime.now()

class TaskManager:
    """Manages tasks and their lifecycle"""

    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.task_history: List[Dict[str, Any]] = []

    def create_task(self, title: str, description: str = "",
                   priority: TaskPriority = TaskPriority.MEDIUM,
                   assignee: Optional[str] = None,
                   tags: List[str] = None,
                   metadata: Dict[str, Any] = None) -> Task:
        """Create a new task"""
        task = Task(
            id=str(uuid.uuid4()),
            title=title,
            description=description,
            priority=priority,
            assignee=assignee,
            tags=tags or [],
            metadata=metadata or {}
        )

        self.tasks[task.id] = task
        self._record_history(task.id, "created", {"title": title})
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID"""
        return self.tasks.get(task_id)

    def update_task(self, task_id: str, **updates) -> bool:
        """Update task with provided fields"""
        if task_id not in self.tasks:
            return False

        task = self.tasks[task_id]
        old_status = task.status

        # Update fields
        for field, value in updates.items():
            if hasattr(task, field):
                setattr(task, field, value)

        task.updated_at = datetime.now()

        # Handle status transitions
        if "status" in updates and updates["status"] != old_status:
            self._handle_status_transition(task, old_status, updates["status"])

        self._record_history(task_id, "updated", updates)
        return True

    def delete_task(self, task_id: str) -> bool:
        """Delete a task"""
        if task_id not in self.tasks:
            return False

        task = self.tasks.pop(task_id)
        self._record_history(task_id, "deleted", {"title": task.title})
        return True

    def assign_task(self, task_id: str, assignee: str) -> bool:
        """Assign task to user"""
        return self.update_task(task_id,
                               assignee=assignee,
                               status=TaskStatus.ASSIGNED)

    def start_task(self, task_id: str) -> bool:
        """Start working on a task"""
        return self.update_task(task_id, status=TaskStatus.IN_PROGRESS)

    def complete_task(self, task_id: str) -> bool:
        """Complete a task"""
        result = self.update_task(task_id, status=TaskStatus.COMPLETED)
        if result and task_id in self.tasks:
            self.tasks[task_id].completed_at = datetime.now()
        return result

    def list_tasks(self, status_filter: Optional[TaskStatus] = None,
                   assignee_filter: Optional[str] = None,
                   priority_filter: Optional[TaskPriority] = None) -> List[Task]:
        """List tasks with optional filters"""
        tasks = list(self.tasks.values())

        if status_filter:
            tasks = [t for t in tasks if t.status == status_filter]

        if assignee_filter:
            tasks = [t for t in tasks if t.assignee == assignee_filter]

        if priority_filter:
            tasks = [t for t in tasks if t.priority == priority_filter]

        return sorted(tasks, key=lambda t: t.created_at, reverse=True)

    def get_task_dependencies(self, task_id: str) -> List[Task]:
        """Get all dependency tasks for a given task"""
        if task_id not in self.tasks:
            return []

        task = self.tasks[task_id]
        dependencies = []

        for dep_id in task.dependencies:
            if dep_id in self.tasks:
                dependencies.append(self.tasks[dep_id])

        return dependencies

    def can_start_task(self, task_id: str) -> bool:
        """Check if task can be started based on dependencies"""
        dependencies = self.get_task_dependencies(task_id)
        return all(dep.status == TaskStatus.COMPLETED for dep in dependencies)

    def add_dependency(self, task_id: str, dependency_id: str) -> bool:
        """Add a dependency to a task"""
        if task_id not in self.tasks or dependency_id not in self.tasks:
            return False

        if dependency_id not in self.tasks[task_id].dependencies:
            self.tasks[task_id].dependencies.append(dependency_id)
            self.tasks[task_id].updated_at = datetime.now()
            self._record_history(task_id, "dependency_added",
                               {"dependency_id": dependency_id})

        return True

    def remove_dependency(self, task_id: str, dependency_id: str) -> bool:
        """Remove a dependency from a task"""
        if task_id not in self.tasks:
            return False

        task = self.tasks[task_id]
        if dependency_id in task.dependencies:
            task.dependencies.remove(dependency_id)
            task.updated_at = datetime.now()
            self._record_history(task_id, "dependency_removed",
                               {"dependency_id": dependency_id})

        return True

    def get_statistics(self) -> Dict[str, Any]:
        """Get task statistics"""
        total_tasks = len(self.tasks)
        status_counts = {}

        for status in TaskStatus:
            status_counts[status.value] = sum(1 for t in self.tasks.values()
                                            if t.status == status)

        priority_counts = {}
        for priority in TaskPriority:
            priority_counts[priority.name.lower()] = sum(1 for t in self.tasks.values()
                                                        if t.priority == priority)

        return {
            "total_tasks": total_tasks,
            "status_breakdown": status_counts,
            "priority_breakdown": priority_counts,
            "completion_rate": status_counts.get("completed", 0) / max(total_tasks, 1) * 100
        }

    def _handle_status_transition(self, task: Task, old_status: TaskStatus,
                                new_status: TaskStatus):
        """Handle task status transitions"""
        if new_status == TaskStatus.COMPLETED:
            task.completed_at = datetime.now()
        elif new_status == TaskStatus.IN_PROGRESS and old_status == TaskStatus.CREATED:
            # Auto-assign if not already assigned
            if not task.assignee:
                task.assignee = "system"

    def _record_history(self, task_id: str, action: str, details: Dict[str, Any]):
        """Record task history"""
        self.task_history.append({
            "task_id": task_id,
            "action": action,
            "details": details,
            "timestamp": datetime.now()
        })

    def get_task_history(self, task_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get task history, optionally filtered by task ID"""
        if task_id:
            return [h for h in self.task_history if h["task_id"] == task_id]
        return self.task_history.copy()