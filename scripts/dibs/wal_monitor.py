#!/usr/bin/env python3
"""
DevFlow Dynamic Incremental Backup System (DIBS)
WAL Monitor - Context7 Compliant

Real-time monitoring sistema per WAL file:
- Continuous size monitoring
- Activity detection
- Threshold alerts
- Auto-trigger backup system
"""

import os
import time
import threading
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
import json

class WALMonitor:
    """Context7-compliant real-time WAL monitoring system"""

    def __init__(self, db_path="./data/devflow_unified.sqlite"):
        self.db_path = db_path
        self.wal_path = f"{db_path}-wal"
        self.monitoring_active = False
        self.monitor_thread = None
        self.stats_file = "./data/backups/.wal_monitor_stats.json"

        # Thresholds
        self.size_threshold_mb = 50
        self.growth_rate_threshold_mb_min = 5  # MB per minute
        self.activity_check_interval = 30  # seconds

        # Statistics
        self.stats = {
            'start_time': None,
            'last_check': None,
            'size_history': [],
            'growth_alerts': 0,
            'size_alerts': 0,
            'max_size_mb': 0,
            'average_growth_rate': 0
        }

    def get_wal_info(self):
        """Get comprehensive WAL file information"""
        try:
            if os.path.exists(self.wal_path):
                stat = os.stat(self.wal_path)
                size_mb = stat.st_size / (1024 * 1024)

                return {
                    'exists': True,
                    'size_bytes': stat.st_size,
                    'size_mb': round(size_mb, 2),
                    'modified_time': datetime.fromtimestamp(stat.st_mtime),
                    'access_time': datetime.fromtimestamp(stat.st_atime)
                }
            else:
                return {
                    'exists': False,
                    'size_bytes': 0,
                    'size_mb': 0,
                    'modified_time': None,
                    'access_time': None
                }
        except Exception as e:
            print(f"Error getting WAL info: {e}")
            return None

    def get_database_activity(self):
        """Check database activity and connection count"""
        try:
            # Check if database is being accessed
            conn = sqlite3.connect(self.db_path, timeout=1.0)
            cursor = conn.cursor()

            # Get recent activity indicators
            cursor.execute("SELECT COUNT(*) FROM tasks WHERE created_at > datetime('now', '-1 minute')")
            recent_tasks = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM sessions WHERE created_at > datetime('now', '-1 minute')")
            recent_sessions = cursor.fetchone()[0]

            # Check for any write activity in the past minute
            cursor.execute("PRAGMA wal_checkpoint(PASSIVE)")
            checkpoint_result = cursor.fetchone()

            conn.close()

            return {
                'recent_tasks': recent_tasks,
                'recent_sessions': recent_sessions,
                'checkpoint_result': checkpoint_result,
                'activity_score': recent_tasks + recent_sessions
            }

        except Exception as e:
            print(f"Error checking database activity: {e}")
            return None

    def calculate_growth_rate(self):
        """Calculate WAL growth rate from historical data"""
        if len(self.stats['size_history']) < 2:
            return 0

        # Take last 5 measurements for average
        recent_measurements = self.stats['size_history'][-5:]

        if len(recent_measurements) < 2:
            return 0

        # Calculate growth per minute
        time_diff = (recent_measurements[-1]['timestamp'] - recent_measurements[0]['timestamp']).total_seconds() / 60
        size_diff = recent_measurements[-1]['size_mb'] - recent_measurements[0]['size_mb']

        if time_diff > 0:
            return size_diff / time_diff
        return 0

    def check_thresholds(self, wal_info):
        """Check if any thresholds are exceeded"""
        alerts = []

        if wal_info and wal_info['exists']:
            # Size threshold check
            if wal_info['size_mb'] > self.size_threshold_mb:
                alerts.append({
                    'type': 'SIZE_THRESHOLD',
                    'level': 'WARNING',
                    'message': f"WAL size {wal_info['size_mb']}MB exceeds threshold {self.size_threshold_mb}MB",
                    'size_mb': wal_info['size_mb']
                })
                self.stats['size_alerts'] += 1

            # Growth rate threshold check
            growth_rate = self.calculate_growth_rate()
            if growth_rate > self.growth_rate_threshold_mb_min:
                alerts.append({
                    'type': 'GROWTH_RATE',
                    'level': 'WARNING',
                    'message': f"WAL growth rate {growth_rate:.2f}MB/min exceeds threshold {self.growth_rate_threshold_mb_min}MB/min",
                    'growth_rate': growth_rate
                })
                self.stats['growth_alerts'] += 1

            # Critical size check (100MB)
            if wal_info['size_mb'] > 100:
                alerts.append({
                    'type': 'CRITICAL_SIZE',
                    'level': 'CRITICAL',
                    'message': f"WAL size {wal_info['size_mb']}MB is critically high",
                    'size_mb': wal_info['size_mb']
                })

        return alerts

    def trigger_backup_if_needed(self, alerts):
        """Trigger backup system if alerts require it"""
        for alert in alerts:
            if alert['level'] in ['WARNING', 'CRITICAL']:
                try:
                    # Import backup trigger locally to avoid circular imports
                    import sys
                    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
                    from backup_trigger import BackupTrigger

                    trigger = BackupTrigger()
                    backup_type = "emergency" if alert['level'] == 'CRITICAL' else "wal_threshold"

                    result = trigger.execute_backup(backup_type)
                    if result:
                        print(f"✅ Auto-triggered backup due to: {alert['message']}")
                    else:
                        print(f"❌ Failed to auto-trigger backup for: {alert['message']}")

                except Exception as e:
                    print(f"❌ Error triggering backup: {e}")

    def update_statistics(self, wal_info, activity_info):
        """Update monitoring statistics"""
        now = datetime.now()

        if wal_info and wal_info['exists']:
            # Add to size history
            self.stats['size_history'].append({
                'timestamp': now,
                'size_mb': wal_info['size_mb'],
                'activity_score': activity_info['activity_score'] if activity_info else 0
            })

            # Keep only last 100 measurements
            if len(self.stats['size_history']) > 100:
                self.stats['size_history'] = self.stats['size_history'][-100:]

            # Update max size
            if wal_info['size_mb'] > self.stats['max_size_mb']:
                self.stats['max_size_mb'] = wal_info['size_mb']

            # Update average growth rate
            self.stats['average_growth_rate'] = self.calculate_growth_rate()

        self.stats['last_check'] = now.isoformat()

    def save_statistics(self):
        """Save statistics to file"""
        try:
            os.makedirs(os.path.dirname(self.stats_file), exist_ok=True)

            # Convert datetime objects to ISO strings for JSON serialization
            serializable_stats = self.stats.copy()
            serializable_stats['size_history'] = [
                {
                    'timestamp': entry['timestamp'].isoformat(),
                    'size_mb': entry['size_mb'],
                    'activity_score': entry.get('activity_score', 0)
                }
                for entry in self.stats['size_history']
            ]

            with open(self.stats_file, 'w') as f:
                json.dump(serializable_stats, f, indent=2)

        except Exception as e:
            print(f"Warning: Could not save WAL monitor statistics: {e}")

    def load_statistics(self):
        """Load statistics from file"""
        try:
            if os.path.exists(self.stats_file):
                with open(self.stats_file, 'r') as f:
                    loaded_stats = json.load(f)

                # Convert ISO strings back to datetime objects
                if 'size_history' in loaded_stats:
                    loaded_stats['size_history'] = [
                        {
                            'timestamp': datetime.fromisoformat(entry['timestamp']),
                            'size_mb': entry['size_mb'],
                            'activity_score': entry.get('activity_score', 0)
                        }
                        for entry in loaded_stats['size_history']
                    ]

                self.stats.update(loaded_stats)

        except Exception as e:
            print(f"Warning: Could not load WAL monitor statistics: {e}")

    def monitoring_loop(self):
        """Main monitoring loop"""
        print(f"🔍 WAL Monitor started - checking every {self.activity_check_interval}s")

        while self.monitoring_active:
            try:
                # Get current WAL and database info
                wal_info = self.get_wal_info()
                activity_info = self.get_database_activity()

                # Check thresholds and generate alerts
                alerts = self.check_thresholds(wal_info)

                # Print alerts
                for alert in alerts:
                    print(f"🚨 {alert['level']}: {alert['message']}")

                # Trigger backups if needed
                if alerts:
                    self.trigger_backup_if_needed(alerts)

                # Update statistics
                self.update_statistics(wal_info, activity_info)

                # Save statistics periodically
                self.save_statistics()

                # Sleep until next check
                time.sleep(self.activity_check_interval)

            except Exception as e:
                print(f"❌ Error in monitoring loop: {e}")
                time.sleep(self.activity_check_interval)

    def start_monitoring(self):
        """Start the WAL monitoring system"""
        if self.monitoring_active:
            print("⚠️ WAL monitoring is already active")
            return False

        self.load_statistics()
        self.monitoring_active = True
        self.stats['start_time'] = datetime.now().isoformat()

        self.monitor_thread = threading.Thread(target=self.monitoring_loop, daemon=True)
        self.monitor_thread.start()

        return True

    def stop_monitoring(self):
        """Stop the WAL monitoring system"""
        self.monitoring_active = False

        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=5)

        self.save_statistics()
        print("🛑 WAL monitoring stopped")

    def get_status_report(self):
        """Generate comprehensive monitoring status report"""
        wal_info = self.get_wal_info()
        activity_info = self.get_database_activity()

        return {
            'timestamp': datetime.now().isoformat(),
            'monitoring_active': self.monitoring_active,
            'wal_info': wal_info,
            'activity_info': activity_info,
            'thresholds': {
                'size_mb': self.size_threshold_mb,
                'growth_rate_mb_min': self.growth_rate_threshold_mb_min
            },
            'statistics': self.stats,
            'current_alerts': self.check_thresholds(wal_info)
        }

def main():
    """CLI interface for WAL monitoring"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python wal_monitor.py [start|stop|status|info]")
        sys.exit(1)

    command = sys.argv[1].lower()
    monitor = WALMonitor()

    if command == "start":
        if monitor.start_monitoring():
            print("✅ WAL monitoring started")
            try:
                # Keep running until interrupted
                while monitor.monitoring_active:
                    time.sleep(1)
            except KeyboardInterrupt:
                monitor.stop_monitoring()
        else:
            print("❌ Failed to start WAL monitoring")

    elif command == "stop":
        monitor.stop_monitoring()

    elif command == "status":
        report = monitor.get_status_report()
        print("=== WAL MONITOR STATUS ===")
        print(json.dumps(report, indent=2, default=str))

    elif command == "info":
        wal_info = monitor.get_wal_info()
        print("=== WAL FILE INFO ===")
        print(json.dumps(wal_info, indent=2, default=str))

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()