from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import json
import logging

logger = logging.getLogger(__name__)

@dataclass
class ProgressSnapshot:
    timestamp: datetime
    progress: float
    message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@dataclass
class ResourceUtilization:
    cpu_percent: Optional[float] = None
    memory_mb: Optional[float] = None
    disk_io: Optional[Dict[str, float]] = None
    network_io: Optional[Dict[str, float]] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class PerformanceMetrics:
    task_id: str
    total_duration: Optional[float] = None  # in seconds
    estimated_vs_actual: Optional[float] = None  # difference in seconds
    resource_peaks: Optional[Dict[str, float]] = None
    progress_consistency: Optional[float] = None  # 0-1 scale

class ProgressTracker:
    def __init__(self):
        self.progress_history: Dict[str, List[ProgressSnapshot]] = {}
        self.resource_history: Dict[str, List[ResourceUtilization]] = {}
        self.performance_metrics: Dict[str, PerformanceMetrics] = {}
    
    def record_progress(self, task_id: str, progress: float, 
                       message: Optional[str] = None,
                       metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Record progress for a task"""
        try:
            if task_id not in self.progress_history:
                self.progress_history[task_id] = []
            
            snapshot = ProgressSnapshot(
                timestamp=datetime.now(),
                progress=max(0.0, min(100.0, progress)),
                message=message,
                metadata=metadata or {}
            )
            
            self.progress_history[task_id].append(snapshot)
            return True
        except Exception as e:
            logger.error(f"Error recording progress for task {task_id}: {e}")
            return False
    
    def record_resource_utilization(self, task_id: str, 
                                  cpu_percent: Optional[float] = None,
                                  memory_mb: Optional[float] = None,
                                  disk_io: Optional[Dict[str, float]] = None,
                                  network_io: Optional[Dict[str, float]] = None) -> bool:
        """Record resource utilization for a task"""
        try:
            if task_id not in self.resource_history:
                self.resource_history[task_id] = []
            
            utilization = ResourceUtilization(
                cpu_percent=cpu_percent,
                memory_mb=memory_mb,
                disk_io=disk_io,
                network_io=network_io
            )
            
            self.resource_history[task_id].append(utilization)
            return True
        except Exception as e:
            logger.error(f"Error recording resource utilization for task {task_id}: {e}")
            return False
    
    def get_progress_history(self, task_id: str) -> List[ProgressSnapshot]:
        """Get complete progress history for a task"""
        return self.progress_history.get(task_id, [])
    
    def get_current_progress(self, task_id: str) -> float:
        """Get current progress percentage for a task"""
        history = self.get_progress_history(task_id)
        if not history:
            return 0.0
        
        return history[-1].progress
    
    def get_resource_history(self, task_id: str) -> List[ResourceUtilization]:
        """Get resource utilization history for a task"""
        return self.resource_history.get(task_id, [])
    
    def calculate_eta(self, task_id: str) -> Optional[timedelta]:
        """Calculate estimated time to completion"""
        history = self.get_progress_history(task_id)
        if len(history) < 2:
            return None
        
        # Use last 10 points for calculation
        recent_points = history[-10:] if len(history) > 10 else history
        
        # Calculate progress rate
        first_point = recent_points[0]
        last_point = recent_points[-1]
        
        progress_diff = last_point.progress - first_point.progress
        time_diff = (last_point.timestamp - first_point.timestamp).total_seconds()
        
        if time_diff <= 0 or progress_diff <= 0:
            return None
        
        progress_rate = progress_diff / time_diff  # progress per second
        remaining_progress = 100.0 - last_point.progress
        
        if progress_rate > 0:
            eta_seconds = remaining_progress / progress_rate
            return timedelta(seconds=eta_seconds)
        
        return None
    
    def calculate_performance_metrics(self, task_id: str) -> Optional[PerformanceMetrics]:
        """Calculate performance metrics for a completed task"""
        progress_history = self.get_progress_history(task_id)
        if len(progress_history) < 2:
            return None
        
        # Calculate total duration
        first_timestamp = progress_history[0].timestamp
        last_timestamp = progress_history[-1].timestamp
        total_duration = (last_timestamp - first_timestamp).total_seconds()
        
        # Calculate resource peaks
        resource_history = self.get_resource_history(task_id)
        resource_peaks = {}
        
        if resource_history:
            cpu_values = [r.cpu_percent for r in resource_history if r.cpu_percent is not None]
            memory_values = [r.memory_mb for r in resource_history if r.memory_mb is not None]
            
            if cpu_values:
                resource_peaks["cpu_peak"] = max(cpu_values)
            if memory_values:
                resource_peaks["memory_peak_mb"] = max(memory_values)
        
        # Calculate progress consistency (how smooth the progress was)
        progress_values = [p.progress for p in progress_history]
        if len(progress_values) > 1:
            # Calculate standard deviation of progress increments
            increments = [progress_values[i] - progress_values[i-1] 
                         for i in range(1, len(progress_values))]
            if increments:
                avg_increment = sum(increments) / len(increments)
                variance = sum((inc - avg_increment) ** 2 for inc in increments) / len(increments)
                std_dev = variance ** 0.5
                # Convert to consistency score (0-1, higher is better)
                consistency = max(0, 1 - (std_dev / 50))  # Normalize assuming 50% std dev is bad
            else:
                consistency = 1.0
        else:
            consistency = 1.0
        
        metrics = PerformanceMetrics(
            task_id=task_id,
            total_duration=total_duration,
            resource_peaks=resource_peaks or {},
            progress_consistency=consistency
        )
        
        self.performance_metrics[task_id] = metrics
        return metrics
    
    def get_performance_metrics(self, task_id: str) -> Optional[PerformanceMetrics]:
        """Get cached performance metrics for a task"""
        return self.performance_metrics.get(task_id)
    
    def get_progress_trend(self, task_id: str, window_size: int = 5) -> Optional[float]:
        """Calculate progress trend (positive = accelerating, negative = decelerating)"""
        history = self.get_progress_history(task_id)
        if len(history) < window_size * 2:
            return None
        
        # Compare recent progress rate to earlier rate
        recent_points = history[-window_size:]
        earlier_points = history[-window_size*2:-window_size]
        
        # Calculate recent rate
        recent_time_diff = (recent_points[-1].timestamp - recent_points[0].timestamp).total_seconds()
        recent_progress_diff = recent_points[-1].progress - recent_points[0].progress
        recent_rate = recent_progress_diff / recent_time_diff if recent_time_diff > 0 else 0
        
        # Calculate earlier rate
        earlier_time_diff = (earlier_points[-1].timestamp - earlier_points[0].timestamp).total_seconds()
        earlier_progress_diff = earlier_points[-1].progress - earlier_points[0].progress
        earlier_rate = earlier_progress_diff / earlier_time_diff if earlier_time_diff > 0 else 0
        
        return recent_rate - earlier_rate  # Positive = acceleration
    
    def export_progress_data(self, task_id: str) -> Dict[str, Any]:
        """Export all progress data for a task as a serializable dict"""
        return {
            "progress_history": [
                {
                    "timestamp": p.timestamp.isoformat(),
                    "progress": p.progress,
                    "message": p.message,
                    "metadata": p.metadata
                }
                for p in self.get_progress_history(task_id)
            ],
            "resource_history": [
                {
                    "timestamp": r.timestamp.isoformat(),
                    "cpu_percent": r.cpu_percent,
                    "memory_mb": r.memory_mb,
                    "disk_io": r.disk_io,
                    "network_io": r.network_io
                }
                for r in self.get_resource_history(task_id)
            ],
            "performance_metrics": asdict(self.get_performance_metrics(task_id)) if task_id in self.performance_metrics else None
        }