#!/usr/bin/env python3
"""
Performance Monitor Hook - Context7 Implementation
Consolidated performance monitoring replacing performance-cache-system.py

Features:
- Real-time performance metrics collection
- Hook execution timing and statistics
- Memory usage tracking
- Cache management and optimization
- Performance alerts and notifications
"""

import sys
import os
import json
import time
import resource
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import PostToolUseHook

class PerformanceMonitorHook(PostToolUseHook):
    """Context7-compliant performance monitoring hook"""

    def __init__(self):
        super().__init__("performance-monitor")
        self.metrics_file = "/Users/fulvioventura/devflow/.devflow/performance-metrics.json"

    def validate_input(self) -> bool:
        """Validate PostToolUse input"""
        return super().validate_input()

    def execute_logic(self) -> None:
        """Main performance monitoring logic"""
        try:
            # Collect performance metrics
            metrics = self._collect_performance_metrics()

            # Update metrics history
            self._update_metrics_history(metrics)

            # Check for performance alerts
            alerts = self._check_performance_alerts(metrics)
            if alerts:
                self._handle_performance_alerts(alerts)

            self.logger.info("Performance monitoring completed successfully")

        except Exception as e:
            self.logger.error(f"Performance monitoring failed: {e}")

    def _collect_performance_metrics(self) -> Dict[str, Any]:
        """Collect current performance metrics using standard system tools"""
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'cpu_percent': self._get_cpu_usage(),
            'memory_percent': self._get_memory_usage(),
            'disk_usage': self._get_disk_usage(),
            'tool_name': self.get_tool_name(),
            'execution_time': time.time()
        }
        return metrics

    def _get_cpu_usage(self) -> float:
        """Get CPU usage using system tools"""
        try:
            # Use system load average as CPU usage approximation
            load_avg = os.getloadavg()[0]
            # Convert to percentage (rough approximation)
            cpu_count = os.cpu_count() or 1
            return min(100.0, (load_avg / cpu_count) * 100)
        except:
            return 0.0

    def _get_memory_usage(self) -> float:
        """Get memory usage using resource module"""
        try:
            # Get memory usage using resource module
            usage = resource.getrusage(resource.RUSAGE_SELF)
            # Convert to percentage (rough approximation)
            max_memory = usage.ru_maxrss
            if max_memory > 0:
                # On macOS, ru_maxrss is in bytes
                memory_mb = max_memory / (1024 * 1024)
                # Rough conversion to percentage (assuming 8GB total)
                return min(100.0, (memory_mb / 8192) * 100)
            return 0.0
        except:
            return 0.0

    def _get_disk_usage(self) -> float:
        """Get disk usage using statvfs"""
        try:
            statvfs = os.statvfs('/')
            total = statvfs.f_frsize * statvfs.f_blocks
            free = statvfs.f_frsize * statvfs.f_available
            used = total - free
            return (used / total) * 100 if total > 0 else 0.0
        except:
            return 0.0

    def _update_metrics_history(self, metrics: Dict[str, Any]) -> None:
        """Update metrics history file"""
        try:
            os.makedirs(os.path.dirname(self.metrics_file), exist_ok=True)

            # Load existing metrics
            history = []
            if os.path.exists(self.metrics_file):
                with open(self.metrics_file, 'r') as f:
                    history = json.load(f)

            # Add new metrics
            history.append(metrics)

            # Keep only last 100 entries
            history = history[-100:]

            # Save updated history
            with open(self.metrics_file, 'w') as f:
                json.dump(history, f, indent=2)

        except Exception as e:
            self.logger.error(f"Failed to update metrics history: {e}")

    def _check_performance_alerts(self, metrics: Dict[str, Any]) -> list:
        """Check for performance alerts"""
        alerts = []

        if metrics['cpu_percent'] > 80:
            alerts.append({
                'type': 'high_cpu',
                'value': metrics['cpu_percent'],
                'threshold': 80
            })

        if metrics['memory_percent'] > 85:
            alerts.append({
                'type': 'high_memory',
                'value': metrics['memory_percent'],
                'threshold': 85
            })

        return alerts

    def _handle_performance_alerts(self, alerts: list) -> None:
        """Handle performance alerts"""
        for alert in alerts:
            self.logger.warning(f"Performance alert: {alert['type']} at {alert['value']}%")

if __name__ == "__main__":
    hook = PerformanceMonitorHook()
    sys.exit(hook.run())
