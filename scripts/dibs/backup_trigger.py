#!/usr/bin/env python3
"""
DevFlow Dynamic Incremental Backup System (DIBS)
Backup Trigger - Context7 Compliant

Intelligente trigger system per backup incrementali basato su:
- Dynamic interval calculator
- WAL monitoring
- Activity thresholds
- Priority-based execution
"""

import os
import sys
import time
import threading
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
import subprocess
import json

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dynamic_interval_calculator import DynamicIntervalCalculator

class BackupTrigger:
    """Context7-compliant intelligent backup trigger system"""

    def __init__(self, db_path="./data/devflow_unified.sqlite"):
        self.db_path = db_path
        self.calculator = DynamicIntervalCalculator(db_path)
        self.last_backup_time = None
        self.monitoring_active = False
        self.backup_lock = threading.Lock()
        self.state_file = "./data/backups/.dibs_state.json"

    def load_state(self):
        """Load previous trigger state"""
        try:
            if os.path.exists(self.state_file):
                with open(self.state_file, 'r') as f:
                    state = json.load(f)
                    self.last_backup_time = datetime.fromisoformat(state.get('last_backup', ''))
        except Exception as e:
            print(f"Warning: Could not load trigger state: {e}")
            self.last_backup_time = None

    def save_state(self):
        """Save current trigger state"""
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
            state = {
                'last_backup': self.last_backup_time.isoformat() if self.last_backup_time else None,
                'last_update': datetime.now().isoformat()
            }
            with open(self.state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save trigger state: {e}")

    def should_trigger_backup(self):
        """Determine if backup should be triggered based on dynamic interval"""
        if not self.last_backup_time:
            return True, "Initial backup required"

        report = self.calculator.generate_report()
        interval_seconds = report['interval_seconds']
        priority = report['priority_level']

        time_since_backup = (datetime.now() - self.last_backup_time).total_seconds()

        if time_since_backup >= interval_seconds:
            return True, f"Interval reached: {int(time_since_backup)}s >= {interval_seconds}s (Priority: {priority})"

        return False, f"Too early: {int(time_since_backup)}s < {interval_seconds}s (Priority: {priority})"

    def execute_backup(self, backup_type="incremental"):
        """Execute the actual backup operation"""
        with self.backup_lock:
            try:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_dir = f"./data/backups/{backup_type}"
                os.makedirs(backup_dir, exist_ok=True)

                backup_file = f"{backup_dir}/devflow_unified_{timestamp}.sqlite"

                # Use sqlite-utils for Context7-compliant backup
                result = subprocess.run([
                    "sqlite-utils", "insert", backup_file, "backup_info",
                    "--jsonl", "-"
                ], input=json.dumps({
                    "timestamp": timestamp,
                    "source_db": self.db_path,
                    "backup_type": backup_type,
                    "priority": self.calculator.get_priority_level(),
                    "wal_size_mb": self.calculator.get_wal_size_mb()
                }), text=True, capture_output=True)

                # Copy main database
                subprocess.run([
                    "cp", self.db_path, backup_file
                ], check=True)

                # Verify backup integrity
                verify_result = subprocess.run([
                    "sqlite-utils", "query", backup_file,
                    "SELECT COUNT(*) as total_tables FROM sqlite_master WHERE type='table'"
                ], capture_output=True, text=True)

                if verify_result.returncode == 0:
                    self.last_backup_time = datetime.now()
                    self.save_state()
                    print(f"✅ Backup completed: {backup_file}")
                    return True
                else:
                    print(f"❌ Backup verification failed: {backup_file}")
                    os.remove(backup_file)
                    return False

            except Exception as e:
                print(f"❌ Backup execution failed: {e}")
                return False

    def monitor_wal_threshold(self, threshold_mb=50):
        """Monitor WAL file size for emergency backups"""
        wal_size_mb = self.calculator.get_wal_size_mb()

        if wal_size_mb > threshold_mb:
            print(f"🚨 WAL size emergency: {wal_size_mb:.2f}MB > {threshold_mb}MB")
            return self.execute_backup("emergency")

        return False

    def start_monitoring(self, check_interval=60):
        """Start continuous monitoring for backup triggers"""
        self.load_state()
        self.monitoring_active = True

        print(f"🔄 DIBS Monitoring started (check every {check_interval}s)")

        while self.monitoring_active:
            try:
                # Check dynamic interval trigger
                should_backup, reason = self.should_trigger_backup()
                if should_backup:
                    print(f"⏰ Backup triggered: {reason}")
                    self.execute_backup()

                # Check WAL emergency threshold
                self.monitor_wal_threshold()

                # Sleep for check interval
                time.sleep(check_interval)

            except KeyboardInterrupt:
                print("\n🛑 Monitoring stopped by user")
                break
            except Exception as e:
                print(f"❌ Monitoring error: {e}")
                time.sleep(check_interval)

    def stop_monitoring(self):
        """Stop the monitoring system"""
        self.monitoring_active = False

    def status_report(self):
        """Generate comprehensive trigger status report"""
        report = self.calculator.generate_report()
        should_backup, reason = self.should_trigger_backup()

        status = {
            'timestamp': datetime.now().isoformat(),
            'monitoring_active': self.monitoring_active,
            'last_backup': self.last_backup_time.isoformat() if self.last_backup_time else None,
            'should_trigger': should_backup,
            'trigger_reason': reason,
            'calculator_report': report
        }

        return status

def main():
    """CLI interface for backup trigger management"""
    if len(sys.argv) < 2:
        print("Usage: python backup_trigger.py [start|stop|status|force|test]")
        sys.exit(1)

    command = sys.argv[1].lower()
    trigger = BackupTrigger()

    if command == "start":
        trigger.start_monitoring()
    elif command == "status":
        status = trigger.status_report()
        print("=== DIBS TRIGGER STATUS ===")
        for key, value in status.items():
            print(f"{key}: {value}")
    elif command == "force":
        print("🔄 Forcing backup execution...")
        result = trigger.execute_backup("manual")
        print(f"Result: {'✅ Success' if result else '❌ Failed'}")
    elif command == "test":
        should_backup, reason = trigger.should_trigger_backup()
        print(f"Should backup: {should_backup}")
        print(f"Reason: {reason}")
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()