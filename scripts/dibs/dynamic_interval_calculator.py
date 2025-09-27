#!/usr/bin/env python3
"""
DevFlow Dynamic Incremental Backup System (DIBS)
Dynamic Interval Calculator - Context7 Compliant

Calcola intervalli di backup dinamici basati su:
- Record count (tasks, sessions, memory_blocks)
- WAL file size
- Activity score (recent changes)
"""

import os
import sqlite3
import time
import math
from datetime import datetime, timedelta
from pathlib import Path

class DynamicIntervalCalculator:
    """Context7-compliant dynamic backup interval calculator"""

    def __init__(self, db_path="./data/devflow_unified.sqlite"):
        self.db_path = db_path
        self.base_interval = 300  # 5 minutes base
        self.min_interval = 30    # 30 seconds minimum
        self.max_interval = 3600  # 1 hour maximum

    def get_database_metrics(self):
        """Collect real-time database metrics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Record counts
            cursor.execute("SELECT COUNT(*) FROM tasks")
            tasks_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM sessions")
            sessions_count = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM memory_blocks")
            memory_blocks_count = cursor.fetchone()[0]

            # Recent activity (last hour)
            hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
            cursor.execute("SELECT COUNT(*) FROM tasks WHERE created_at > ?", (hour_ago,))
            recent_tasks = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM sessions WHERE created_at > ?", (hour_ago,))
            recent_sessions = cursor.fetchone()[0]

            conn.close()

            return {
                'total_records': tasks_count + sessions_count + memory_blocks_count,
                'tasks_count': tasks_count,
                'sessions_count': sessions_count,
                'memory_blocks_count': memory_blocks_count,
                'recent_activity': recent_tasks + recent_sessions
            }

        except Exception as e:
            print(f"Error collecting database metrics: {e}")
            return None

    def get_wal_size_mb(self):
        """Get current WAL file size in MB"""
        try:
            wal_path = f"{self.db_path}-wal"
            if os.path.exists(wal_path):
                size_bytes = os.path.getsize(wal_path)
                return size_bytes / (1024 * 1024)  # Convert to MB
            return 0
        except Exception as e:
            print(f"Error getting WAL size: {e}")
            return 0

    def calculate_activity_score(self, metrics):
        """Calculate activity score (0-10)"""
        if not metrics:
            return 1.0

        # Base activity from record counts
        record_activity = min(metrics['total_records'] / 100, 5.0)

        # Recent activity boost
        recent_activity = min(metrics['recent_activity'] * 2, 5.0)

        return max(1.0, record_activity + recent_activity)

    def calculate_dynamic_interval(self):
        """Calculate dynamic backup interval using Context7 algorithm"""
        metrics = self.get_database_metrics()
        if not metrics:
            return self.base_interval

        wal_size_mb = self.get_wal_size_mb()
        activity_score = self.calculate_activity_score(metrics)

        # Dynamic factors
        record_factor = min(metrics['total_records'] / 100, 5.0)
        wal_factor = max(wal_size_mb / 50, 0.1)  # WAL size impact
        activity_factor = activity_score / 10

        # Formula: interval inversely proportional to activity
        combined_factor = record_factor * wal_factor * activity_factor
        dynamic_interval = self.base_interval / max(combined_factor, 0.1)

        # Apply bounds
        interval = max(self.min_interval, min(dynamic_interval, self.max_interval))

        return int(interval)

    def get_priority_level(self):
        """Determine backup priority level"""
        wal_size_mb = self.get_wal_size_mb()
        metrics = self.get_database_metrics()

        if wal_size_mb > 50 or (metrics and metrics['recent_activity'] > 5):
            return "HIGH"
        elif wal_size_mb > 10 or (metrics and metrics['sessions_count'] > 3):
            return "MEDIUM"
        else:
            return "LOW"

    def generate_report(self):
        """Generate comprehensive backup interval report"""
        metrics = self.get_database_metrics()
        wal_size_mb = self.get_wal_size_mb()
        interval = self.calculate_dynamic_interval()
        priority = self.get_priority_level()
        activity_score = self.calculate_activity_score(metrics)

        report = {
            'timestamp': datetime.now().isoformat(),
            'interval_seconds': interval,
            'interval_minutes': round(interval / 60, 2),
            'priority_level': priority,
            'wal_size_mb': round(wal_size_mb, 2),
            'activity_score': round(activity_score, 2),
            'metrics': metrics
        }

        return report

def main():
    """CLI interface for testing"""
    calculator = DynamicIntervalCalculator()
    report = calculator.generate_report()

    print("=== DEVFLOW DIBS - DYNAMIC INTERVAL REPORT ===")
    print(f"Timestamp: {report['timestamp']}")
    print(f"Recommended Interval: {report['interval_seconds']}s ({report['interval_minutes']} min)")
    print(f"Priority Level: {report['priority_level']}")
    print(f"WAL Size: {report['wal_size_mb']} MB")
    print(f"Activity Score: {report['activity_score']}/10")
    print(f"Database Metrics: {report['metrics']}")

if __name__ == "__main__":
    main()