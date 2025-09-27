#!/usr/bin/env python3
"""
DevFlow Dynamic Incremental Backup System (DIBS)
Storage Manager - Context7 Compliant

Gestisce strategia di storage con rotazione automatica:
- Hourly backups (24 ore retention)
- Daily backups (7 giorni retention)
- Weekly backups (4 settimane retention)
- Monthly backups (12 mesi retention)
"""

import os
import shutil
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
import json
import glob

class StorageManager:
    """Context7-compliant backup storage with intelligent rotation"""

    def __init__(self, base_backup_dir="./data/backups"):
        self.base_dir = Path(base_backup_dir)
        self.retention_config = {
            'hourly': {'count': 24, 'interval': 'hours'},
            'daily': {'count': 7, 'interval': 'days'},
            'weekly': {'count': 4, 'interval': 'weeks'},
            'monthly': {'count': 12, 'interval': 'months'}
        }

    def ensure_directories(self):
        """Create all required backup directories"""
        for backup_type in ['incremental', 'hourly', 'daily', 'weekly', 'monthly', 'emergency']:
            backup_dir = self.base_dir / backup_type
            backup_dir.mkdir(parents=True, exist_ok=True)

    def get_backup_files(self, backup_type):
        """Get list of backup files for specific type"""
        backup_dir = self.base_dir / backup_type
        pattern = f"{backup_dir}/devflow_unified_*.sqlite"
        files = glob.glob(str(pattern))

        # Sort by modification time (newest first)
        return sorted(files, key=os.path.getmtime, reverse=True)

    def parse_backup_timestamp(self, filename):
        """Extract timestamp from backup filename"""
        try:
            basename = os.path.basename(filename)
            # Extract timestamp from pattern: devflow_unified_YYYYMMDD_HHMMSS.sqlite
            timestamp_str = basename.replace('devflow_unified_', '').replace('.sqlite', '')
            return datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
        except Exception:
            return None

    def should_promote_backup(self, source_backup, target_type):
        """Determine if backup should be promoted to higher tier"""
        timestamp = self.parse_backup_timestamp(source_backup)
        if not timestamp:
            return False

        now = datetime.now()

        if target_type == 'daily':
            # Promote if backup is from previous day and no daily backup exists for that day
            if timestamp.date() < now.date():
                daily_files = self.get_backup_files('daily')
                for daily_file in daily_files:
                    daily_timestamp = self.parse_backup_timestamp(daily_file)
                    if daily_timestamp and daily_timestamp.date() == timestamp.date():
                        return False
                return True

        elif target_type == 'weekly':
            # Promote if backup is from previous week
            week_ago = now - timedelta(weeks=1)
            if timestamp < week_ago:
                weekly_files = self.get_backup_files('weekly')
                for weekly_file in weekly_files:
                    weekly_timestamp = self.parse_backup_timestamp(weekly_file)
                    if weekly_timestamp and weekly_timestamp.isocalendar()[:2] == timestamp.isocalendar()[:2]:
                        return False
                return True

        elif target_type == 'monthly':
            # Promote if backup is from previous month
            if timestamp.month != now.month or timestamp.year != now.year:
                monthly_files = self.get_backup_files('monthly')
                for monthly_file in monthly_files:
                    monthly_timestamp = self.parse_backup_timestamp(monthly_file)
                    if monthly_timestamp and (monthly_timestamp.year, monthly_timestamp.month) == (timestamp.year, timestamp.month):
                        return False
                return True

        return False

    def promote_backup(self, source_file, target_type):
        """Promote backup to higher tier"""
        try:
            target_dir = self.base_dir / target_type
            target_dir.mkdir(parents=True, exist_ok=True)

            target_file = target_dir / os.path.basename(source_file)
            shutil.copy2(source_file, target_file)

            print(f"✅ Promoted backup: {os.path.basename(source_file)} → {target_type}/")
            return True
        except Exception as e:
            print(f"❌ Failed to promote backup: {e}")
            return False

    def cleanup_old_backups(self, backup_type):
        """Remove old backups based on retention policy"""
        if backup_type not in self.retention_config:
            return

        retention = self.retention_config[backup_type]
        files = self.get_backup_files(backup_type)

        # Keep only the specified number of backups
        if len(files) > retention['count']:
            files_to_remove = files[retention['count']:]

            for file_path in files_to_remove:
                try:
                    os.remove(file_path)
                    print(f"🗑️ Removed old backup: {os.path.basename(file_path)}")
                except Exception as e:
                    print(f"❌ Failed to remove {file_path}: {e}")

    def execute_rotation_strategy(self):
        """Execute complete backup rotation strategy"""
        self.ensure_directories()

        # 1. Promote hourly → daily
        hourly_files = self.get_backup_files('hourly')
        for hourly_file in hourly_files:
            if self.should_promote_backup(hourly_file, 'daily'):
                self.promote_backup(hourly_file, 'daily')

        # 2. Promote daily → weekly
        daily_files = self.get_backup_files('daily')
        for daily_file in daily_files:
            if self.should_promote_backup(daily_file, 'weekly'):
                self.promote_backup(daily_file, 'weekly')

        # 3. Promote weekly → monthly
        weekly_files = self.get_backup_files('weekly')
        for weekly_file in weekly_files:
            if self.should_promote_backup(weekly_file, 'monthly'):
                self.promote_backup(weekly_file, 'monthly')

        # 4. Cleanup old backups
        for backup_type in ['hourly', 'daily', 'weekly', 'monthly']:
            self.cleanup_old_backups(backup_type)

    def create_scheduled_backup(self, source_db, backup_type='hourly'):
        """Create a new scheduled backup"""
        self.ensure_directories()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = self.base_dir / backup_type
        backup_file = backup_dir / f"devflow_unified_{timestamp}.sqlite"

        try:
            # Copy database file
            shutil.copy2(source_db, backup_file)

            # Verify backup integrity
            conn = sqlite3.connect(str(backup_file))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            table_count = cursor.fetchone()[0]
            conn.close()

            if table_count > 0:
                print(f"✅ Created {backup_type} backup: {backup_file.name}")
                return str(backup_file)
            else:
                os.remove(backup_file)
                print(f"❌ Invalid backup created, removed: {backup_file.name}")
                return None

        except Exception as e:
            print(f"❌ Failed to create {backup_type} backup: {e}")
            if backup_file.exists():
                os.remove(backup_file)
            return None

    def get_storage_stats(self):
        """Generate comprehensive storage statistics"""
        stats = {
            'timestamp': datetime.now().isoformat(),
            'directories': {},
            'total_size_mb': 0,
            'total_files': 0
        }

        for backup_type in ['incremental', 'hourly', 'daily', 'weekly', 'monthly', 'emergency']:
            backup_dir = self.base_dir / backup_type

            if backup_dir.exists():
                files = self.get_backup_files(backup_type)
                total_size = sum(os.path.getsize(f) for f in files)

                stats['directories'][backup_type] = {
                    'file_count': len(files),
                    'size_mb': round(total_size / (1024 * 1024), 2),
                    'newest': os.path.basename(files[0]) if files else None,
                    'oldest': os.path.basename(files[-1]) if files else None
                }

                stats['total_size_mb'] += total_size / (1024 * 1024)
                stats['total_files'] += len(files)

        stats['total_size_mb'] = round(stats['total_size_mb'], 2)
        return stats

    def emergency_cleanup(self, max_size_gb=10):
        """Emergency cleanup when storage space is critical"""
        current_size_gb = self.get_storage_stats()['total_size_mb'] / 1024

        if current_size_gb > max_size_gb:
            print(f"🚨 Emergency cleanup triggered: {current_size_gb:.2f}GB > {max_size_gb}GB")

            # Remove oldest files from each category until under limit
            for backup_type in ['incremental', 'hourly', 'daily', 'weekly']:
                files = self.get_backup_files(backup_type)

                # Keep only newest 25% of files
                keep_count = max(1, len(files) // 4)
                files_to_remove = files[keep_count:]

                for file_path in files_to_remove:
                    try:
                        os.remove(file_path)
                        print(f"🗑️ Emergency removed: {os.path.basename(file_path)}")
                    except Exception as e:
                        print(f"❌ Failed emergency removal: {e}")

def main():
    """CLI interface for storage management"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python storage_manager.py [rotate|stats|cleanup|create]")
        sys.exit(1)

    command = sys.argv[1].lower()
    manager = StorageManager()

    if command == "rotate":
        print("🔄 Executing rotation strategy...")
        manager.execute_rotation_strategy()
    elif command == "stats":
        stats = manager.get_storage_stats()
        print("=== DIBS STORAGE STATISTICS ===")
        print(json.dumps(stats, indent=2))
    elif command == "cleanup":
        print("🚨 Executing emergency cleanup...")
        manager.emergency_cleanup()
    elif command == "create":
        backup_type = sys.argv[2] if len(sys.argv) > 2 else "hourly"
        result = manager.create_scheduled_backup("./data/devflow_unified.sqlite", backup_type)
        print(f"Result: {result}")
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()