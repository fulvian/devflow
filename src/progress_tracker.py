"""
Progress Tracker - Core module for tracking task progress and metrics
"""
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import statistics
import json

@dataclass
class ProgressMetric:
    name: str
    value: float
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class TaskProgress:
    task_id: str
    completion_percentage: float = 0.0
    status: str = "pending"
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    metrics: List[ProgressMetric] = field(default_factory=list)

class ProgressTracker:
    """Tracks progress and calculates metrics for tasks"""

    def __init__(self):
        self.tasks: Dict[str, TaskProgress] = {}
        self.global_metrics: List[ProgressMetric] = []

    def start_task(self, task_id: str) -> TaskProgress:
        """Start tracking a new task"""
        progress = TaskProgress(
            task_id=task_id,
            status="running",
            start_time=datetime.now()
        )
        self.tasks[task_id] = progress
        return progress

    def update_progress(self, task_id: str, completion_percentage: float,
                       status: Optional[str] = None) -> bool:
        """Update task progress"""
        if task_id not in self.tasks:
            return False

        task = self.tasks[task_id]
        task.completion_percentage = min(100.0, max(0.0, completion_percentage))

        if status:
            task.status = status

        if completion_percentage >= 100.0:
            task.end_time = datetime.now()
            task.status = "completed"

        return True

    def add_metric(self, task_id: str, metric_name: str, value: float,
                   metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Add a metric to a task"""
        if task_id not in self.tasks:
            return False

        metric = ProgressMetric(
            name=metric_name,
            value=value,
            metadata=metadata or {}
        )
        self.tasks[task_id].metrics.append(metric)
        return True

    def calculate_metrics(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        """Calculate comprehensive metrics"""
        if task_id:
            return self._calculate_task_metrics(task_id)
        else:
            return self._calculate_global_metrics()

    def _calculate_task_metrics(self, task_id: str) -> Dict[str, Any]:
        """Calculate metrics for a specific task"""
        if task_id not in self.tasks:
            return {}

        task = self.tasks[task_id]

        metrics = {
            "task_id": task_id,
            "completion_percentage": task.completion_percentage,
            "status": task.status,
            "duration": None,
            "metrics_count": len(task.metrics),
            "average_metric_value": 0.0,
            "metric_trend": "stable"
        }

        # Calculate duration
        if task.start_time:
            end_time = task.end_time or datetime.now()
            metrics["duration"] = (end_time - task.start_time).total_seconds()

        # Calculate average metric value
        if task.metrics:
            values = [m.value for m in task.metrics]
            metrics["average_metric_value"] = statistics.mean(values)

            # Calculate trend
            if len(values) >= 2:
                recent_avg = statistics.mean(values[-3:]) if len(values) >= 3 else values[-1]
                older_avg = statistics.mean(values[:-3]) if len(values) >= 6 else values[0]

                if recent_avg > older_avg * 1.1:
                    metrics["metric_trend"] = "improving"
                elif recent_avg < older_avg * 0.9:
                    metrics["metric_trend"] = "declining"

        return metrics

    def _calculate_global_metrics(self) -> Dict[str, Any]:
        """Calculate global metrics across all tasks"""
        completed_tasks = [t for t in self.tasks.values() if t.status == "completed"]
        running_tasks = [t for t in self.tasks.values() if t.status == "running"]

        metrics = {
            "total_tasks": len(self.tasks),
            "completed_tasks": len(completed_tasks),
            "running_tasks": len(running_tasks),
            "completion_rate": 0.0,
            "average_duration": 0.0,
            "total_metrics": sum(len(t.metrics) for t in self.tasks.values())
        }

        if self.tasks:
            metrics["completion_rate"] = len(completed_tasks) / len(self.tasks) * 100

        # Calculate average duration for completed tasks
        durations = []
        for task in completed_tasks:
            if task.start_time and task.end_time:
                duration = (task.end_time - task.start_time).total_seconds()
                durations.append(duration)

        if durations:
            metrics["average_duration"] = statistics.mean(durations)

        return metrics

    def analyze_trends(self, task_id: Optional[str] = None,
                      time_window: Optional[timedelta] = None) -> Dict[str, Any]:
        """Analyze trends in task progress"""
        time_window = time_window or timedelta(hours=24)
        cutoff_time = datetime.now() - time_window

        if task_id:
            return self._analyze_task_trends(task_id, cutoff_time)
        else:
            return self._analyze_global_trends(cutoff_time)

    def _analyze_task_trends(self, task_id: str, cutoff_time: datetime) -> Dict[str, Any]:
        """Analyze trends for a specific task"""
        if task_id not in self.tasks:
            return {}

        task = self.tasks[task_id]
        recent_metrics = [m for m in task.metrics if m.timestamp >= cutoff_time]

        analysis = {
            "task_id": task_id,
            "recent_metrics_count": len(recent_metrics),
            "trend_direction": "stable",
            "velocity": 0.0,
            "projected_completion": None
        }

        if len(recent_metrics) >= 2:
            values = [m.value for m in recent_metrics]
            # Simple linear trend calculation
            if values[-1] > values[0]:
                analysis["trend_direction"] = "improving"
            elif values[-1] < values[0]:
                analysis["trend_direction"] = "declining"

            # Calculate velocity (change per hour)
            time_span = (recent_metrics[-1].timestamp - recent_metrics[0].timestamp).total_seconds() / 3600
            if time_span > 0:
                analysis["velocity"] = (values[-1] - values[0]) / time_span

        return analysis

    def _analyze_global_trends(self, cutoff_time: datetime) -> Dict[str, Any]:
        """Analyze global trends across all tasks"""
        recent_tasks = [t for t in self.tasks.values()
                       if t.start_time and t.start_time >= cutoff_time]

        analysis = {
            "recent_tasks": len(recent_tasks),
            "completion_trend": "stable",
            "average_progress": 0.0,
            "productivity_score": 0.0
        }

        if recent_tasks:
            avg_progress = sum(t.completion_percentage for t in recent_tasks) / len(recent_tasks)
            analysis["average_progress"] = avg_progress

            completed_recent = [t for t in recent_tasks if t.status == "completed"]
            if recent_tasks:
                completion_rate = len(completed_recent) / len(recent_tasks)
                analysis["productivity_score"] = completion_rate * avg_progress

        return analysis

    def generate_natural_language_summary(self, task_id: Optional[str] = None) -> str:
        """Generate human-readable progress summary"""
        if task_id:
            return self._generate_task_summary(task_id)
        else:
            return self._generate_global_summary()

    def _generate_task_summary(self, task_id: str) -> str:
        """Generate natural language summary for a task"""
        if task_id not in self.tasks:
            return f"Task {task_id} not found."

        task = self.tasks[task_id]
        metrics = self._calculate_task_metrics(task_id)

        status_text = {
            "pending": "has not started yet",
            "running": "is currently in progress",
            "completed": "has been completed",
            "failed": "has failed"
        }.get(task.status, "has an unknown status")

        summary = f"Task {task_id} {status_text}"

        if task.completion_percentage > 0:
            summary += f" and is {task.completion_percentage:.1f}% complete"

        if metrics.get("duration"):
            duration = metrics["duration"]
            if duration < 60:
                summary += f" (running for {duration:.0f} seconds)"
            elif duration < 3600:
                summary += f" (running for {duration/60:.1f} minutes)"
            else:
                summary += f" (running for {duration/3600:.1f} hours)"

        if task.metrics:
            trend = metrics.get("metric_trend", "stable")
            summary += f". Performance trend is {trend}"

        return summary + "."

    def _generate_global_summary(self) -> str:
        """Generate natural language summary for all tasks"""
        metrics = self._calculate_global_metrics()

        summary = f"Currently tracking {metrics['total_tasks']} tasks"

        if metrics['completed_tasks'] > 0:
            summary += f", with {metrics['completed_tasks']} completed"

        if metrics['running_tasks'] > 0:
            summary += f" and {metrics['running_tasks']} currently running"

        if metrics['completion_rate'] > 0:
            summary += f". Overall completion rate is {metrics['completion_rate']:.1f}%"

        if metrics['average_duration'] > 0:
            duration = metrics['average_duration']
            if duration < 3600:
                summary += f", with average task duration of {duration/60:.1f} minutes"
            else:
                summary += f", with average task duration of {duration/3600:.1f} hours"

        return summary + "."

    def get_task(self, task_id: str) -> Optional[TaskProgress]:
        """Get task progress object"""
        return self.tasks.get(task_id)

    def list_tasks(self, status_filter: Optional[str] = None) -> List[TaskProgress]:
        """List all tasks, optionally filtered by status"""
        tasks = list(self.tasks.values())
        if status_filter:
            tasks = [t for t in tasks if t.status == status_filter]
        return tasks

    def export_metrics(self, format: str = "json") -> str:
        """Export metrics in specified format"""
        data = {
            "global_metrics": self._calculate_global_metrics(),
            "tasks": {
                task_id: self._calculate_task_metrics(task_id)
                for task_id in self.tasks.keys()
            },
            "export_timestamp": datetime.now().isoformat()
        }

        if format.lower() == "json":
            return json.dumps(data, indent=2, default=str)
        else:
            raise ValueError(f"Unsupported export format: {format}")