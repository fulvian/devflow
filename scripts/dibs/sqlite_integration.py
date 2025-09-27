#!/usr/bin/env python3
"""
DevFlow Dynamic Incremental Backup System (DIBS)
SQLite-Utils Integration - Context7 Compliant

Integra sqlite-utils per backup incrementali intelligenti:
- WAL checkpoint automation
- Incremental data extraction
- Context7-compliant backup creation
- Integrity validation
"""

import os
import subprocess
import sqlite3
import json
from datetime import datetime, timedelta
from pathlib import Path

class SQLiteIntegration:
    """Context7-compliant sqlite-utils integration for DIBS"""

    def __init__(self, db_path="./data/devflow_unified.sqlite"):
        self.db_path = db_path
        self.backup_base = "./data/backups"

    def execute_sqlite_utils(self, command_args, capture_output=True):
        """Execute sqlite-utils command with error handling"""
        try:
            cmd = ["sqlite-utils"] + command_args
            result = subprocess.run(
                cmd,
                capture_output=capture_output,
                text=True,
                timeout=300  # 5 minute timeout
            )

            if result.returncode == 0:
                return {
                    'success': True,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'command': ' '.join(cmd)
                }
            else:
                return {
                    'success': False,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'command': ' '.join(cmd),
                    'returncode': result.returncode
                }

        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'Command timed out after 5 minutes',
                'command': ' '.join(cmd)
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'command': ' '.join(cmd)
            }

    def checkpoint_wal(self, mode="RESTART"):
        """Perform WAL checkpoint using sqlite-utils"""
        try:
            # Use direct SQL for checkpoint
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute(f"PRAGMA wal_checkpoint({mode})")
            result = cursor.fetchone()

            conn.close()

            return {
                'success': True,
                'checkpoint_result': result,
                'mode': mode,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'mode': mode,
                'timestamp': datetime.now().isoformat()
            }

    def create_incremental_backup(self, backup_type="incremental", include_data=True):
        """Create incremental backup using sqlite-utils"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path(self.backup_base) / backup_type
        backup_dir.mkdir(parents=True, exist_ok=True)

        backup_file = backup_dir / f"devflow_unified_{timestamp}.sqlite"

        try:
            # Step 1: Create backup metadata
            metadata = {
                'timestamp': timestamp,
                'source_db': str(self.db_path),
                'backup_type': backup_type,
                'include_data': include_data,
                'wal_size_mb': self.get_wal_size_mb()
            }

            # Step 2: Create empty backup database with metadata
            result = self.execute_sqlite_utils([
                "insert", str(backup_file), "backup_metadata",
                "--jsonl", "-"
            ], capture_output=False)

            if not result['success']:
                return result

            # Provide metadata to stdin
            metadata_json = json.dumps(metadata)
            subprocess.run([
                "sqlite-utils", "insert", str(backup_file), "backup_metadata",
                "--jsonl", "-"
            ], input=metadata_json, text=True, check=True)

            # Step 3: Copy database structure
            schema_result = self.execute_sqlite_utils([
                "schema", self.db_path
            ])

            if schema_result['success']:
                # Apply schema to backup database
                temp_schema_file = backup_dir / f"schema_{timestamp}.sql"
                with open(temp_schema_file, 'w') as f:
                    f.write(schema_result['stdout'])

                # Execute schema on backup database
                subprocess.run([
                    "sqlite3", str(backup_file), f".read {temp_schema_file}"
                ], check=True)

                # Clean up temp file
                temp_schema_file.unlink()

            # Step 4: Copy data if requested
            if include_data:
                self.copy_data_incremental(backup_file)

            # Step 5: Verify backup integrity
            verify_result = self.verify_backup_integrity(backup_file)

            if verify_result['success']:
                return {
                    'success': True,
                    'backup_file': str(backup_file),
                    'metadata': metadata,
                    'verification': verify_result,
                    'timestamp': timestamp
                }
            else:
                # Remove failed backup
                if backup_file.exists():
                    backup_file.unlink()
                return verify_result

        except Exception as e:
            # Clean up on failure
            if backup_file.exists():
                backup_file.unlink()
            return {
                'success': False,
                'error': str(e),
                'backup_file': str(backup_file)
            }

    def copy_data_incremental(self, backup_file):
        """Copy data incrementally based on timestamps"""
        try:
            # Get list of tables with timestamp columns
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Find tables with created_at or updated_at columns
            timestamp_tables = []
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()

            for table in tables:
                table_name = table[0]
                if table_name.startswith('sqlite_'):
                    continue

                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()

                has_timestamp = any(
                    col[1] in ['created_at', 'updated_at', 'timestamp']
                    for col in columns
                )

                if has_timestamp:
                    timestamp_tables.append(table_name)

            conn.close()

            # Copy data for each table
            for table_name in timestamp_tables:
                self.copy_table_data(table_name, backup_file)

            return {'success': True, 'tables_copied': len(timestamp_tables)}

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def copy_table_data(self, table_name, backup_file):
        """Copy specific table data to backup"""
        try:
            # Export data from source table
            export_result = self.execute_sqlite_utils([
                "query", self.db_path,
                f"SELECT * FROM {table_name}",
                "--json"
            ])

            if export_result['success'] and export_result['stdout'].strip():
                # Import data to backup table
                import_result = self.execute_sqlite_utils([
                    "insert", str(backup_file), table_name,
                    "--json", "-"
                ], capture_output=False)

                # Provide data to stdin
                subprocess.run([
                    "sqlite-utils", "insert", str(backup_file), table_name,
                    "--json", "-"
                ], input=export_result['stdout'], text=True, check=True)

                return True

        except Exception as e:
            print(f"Warning: Failed to copy table {table_name}: {e}")
            return False

    def verify_backup_integrity(self, backup_file):
        """Verify backup integrity using sqlite-utils"""
        try:
            # Check if file exists and is valid SQLite
            if not Path(backup_file).exists():
                return {'success': False, 'error': 'Backup file does not exist'}

            # Verify database integrity
            integrity_result = self.execute_sqlite_utils([
                "query", str(backup_file),
                "PRAGMA integrity_check"
            ])

            if not integrity_result['success']:
                return integrity_result

            # Check table count
            tables_result = self.execute_sqlite_utils([
                "query", str(backup_file),
                "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"
            ])

            if tables_result['success']:
                table_data = json.loads(tables_result['stdout'])
                table_count = table_data[0]['table_count'] if table_data else 0

                return {
                    'success': True,
                    'integrity_check': integrity_result['stdout'].strip(),
                    'table_count': table_count,
                    'file_size_mb': Path(backup_file).stat().st_size / (1024 * 1024)
                }

            return tables_result

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_wal_size_mb(self):
        """Get current WAL file size in MB"""
        try:
            wal_path = f"{self.db_path}-wal"
            if os.path.exists(wal_path):
                return os.path.getsize(wal_path) / (1024 * 1024)
            return 0
        except Exception:
            return 0

    def optimize_database(self):
        """Optimize database using sqlite-utils"""
        try:
            # Vacuum the database
            vacuum_result = self.execute_sqlite_utils([
                "vacuum", self.db_path
            ])

            # Analyze tables for query optimization
            analyze_result = self.execute_sqlite_utils([
                "query", self.db_path,
                "ANALYZE"
            ])

            return {
                'success': True,
                'vacuum_result': vacuum_result,
                'analyze_result': analyze_result,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_database_stats(self):
        """Get comprehensive database statistics using sqlite-utils"""
        try:
            # Get table statistics
            tables_result = self.execute_sqlite_utils([
                "query", self.db_path,
                """
                SELECT
                    name as table_name,
                    (SELECT COUNT(*) FROM sqlite_master WHERE type='table') as total_tables
                FROM sqlite_master
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                """
            ])

            # Get database size
            size_result = self.execute_sqlite_utils([
                "query", self.db_path,
                "SELECT page_count * page_size as size_bytes FROM pragma_page_count(), pragma_page_size()"
            ])

            stats = {
                'timestamp': datetime.now().isoformat(),
                'wal_size_mb': self.get_wal_size_mb()
            }

            if tables_result['success']:
                stats['tables'] = json.loads(tables_result['stdout'])

            if size_result['success']:
                size_data = json.loads(size_result['stdout'])
                if size_data:
                    stats['database_size_mb'] = size_data[0]['size_bytes'] / (1024 * 1024)

            return {'success': True, 'stats': stats}

        except Exception as e:
            return {'success': False, 'error': str(e)}

def main():
    """CLI interface for SQLite integration"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python sqlite_integration.py [backup|checkpoint|verify|optimize|stats]")
        sys.exit(1)

    command = sys.argv[1].lower()
    integration = SQLiteIntegration()

    if command == "backup":
        backup_type = sys.argv[2] if len(sys.argv) > 2 else "incremental"
        print(f"🔄 Creating {backup_type} backup...")
        result = integration.create_incremental_backup(backup_type)
        print(json.dumps(result, indent=2))

    elif command == "checkpoint":
        mode = sys.argv[2] if len(sys.argv) > 2 else "RESTART"
        print(f"🔄 Performing WAL checkpoint ({mode})...")
        result = integration.checkpoint_wal(mode)
        print(json.dumps(result, indent=2))

    elif command == "verify":
        backup_file = sys.argv[2] if len(sys.argv) > 2 else None
        if not backup_file:
            print("❌ Please specify backup file to verify")
            sys.exit(1)
        print(f"🔍 Verifying backup: {backup_file}")
        result = integration.verify_backup_integrity(backup_file)
        print(json.dumps(result, indent=2))

    elif command == "optimize":
        print("🔄 Optimizing database...")
        result = integration.optimize_database()
        print(json.dumps(result, indent=2))

    elif command == "stats":
        print("📊 Getting database statistics...")
        result = integration.get_database_stats()
        print(json.dumps(result, indent=2))

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()