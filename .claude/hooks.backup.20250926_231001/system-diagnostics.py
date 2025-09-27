#!/usr/bin/env python3
"""
System Diagnostics Hook - Context7 Implementation
Comprehensive system health and diagnostics monitoring

Features:
- Complete system health assessment
- Database connectivity and performance testing
- Hook system validation and compliance checking
- DevFlow component status verification
- Automated diagnostic reporting
"""

import sys
import os
import json
import sqlite3
from datetime import datetime
from typing import Dict, Any, List

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import BaseDevFlowHook

class SystemDiagnosticsHook(BaseDevFlowHook):
    """Context7-compliant system diagnostics and health monitoring"""

    def __init__(self):
        super().__init__("system-diagnostics")
        self.db_path = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
        self.diagnostics_file = "/Users/fulvioventura/devflow/.devflow/system-diagnostics.json"

    def validate_input(self) -> bool:
        """Validate input for diagnostics"""
        return True  # Always valid for diagnostics

    def execute_logic(self) -> None:
        """Main diagnostics logic"""
        try:
            # Run comprehensive diagnostics
            diagnostics = {
                'timestamp': datetime.now().isoformat(),
                'database': self._check_database_health(),
                'hooks': self._check_hook_system(),
                'filesystem': self._check_filesystem_health(),
                'devflow': self._check_devflow_components()
            }

            # Generate health score
            diagnostics['overall_health'] = self._calculate_health_score(diagnostics)

            # Save diagnostics report
            self._save_diagnostics_report(diagnostics)

            self.logger.info(f"System diagnostics completed - Health: {diagnostics['overall_health']}")

        except Exception as e:
            self.logger.error(f"System diagnostics failed: {e}")

    def _check_database_health(self) -> Dict[str, Any]:
        """Check database connectivity and health"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Basic connectivity test
                cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]

                # Check key tables exist
                required_tables = ['tasks', 'projects', 'sessions', 'memory_streams']
                missing_tables = [t for t in required_tables if t not in tables]

                return {
                    'status': 'healthy' if not missing_tables else 'degraded',
                    'tables_count': len(tables),
                    'missing_tables': missing_tables,
                    'last_checked': datetime.now().isoformat()
                }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'last_checked': datetime.now().isoformat()
            }

    def _check_hook_system(self) -> Dict[str, Any]:
        """Check hook system health and compliance"""
        try:
            hooks_dir = os.path.dirname(__file__)
            hook_files = [f for f in os.listdir(hooks_dir)
                         if f.endswith('.py') and not f.startswith('.')]

            # Check for critical hooks
            critical_hooks = [
                'session-start.py',
                'post-tool-use.py',
                'user-prompt-submit-context7.py',
                'cometa-brain-sync.py'
            ]

            missing_critical = [h for h in critical_hooks
                              if h not in hook_files]

            return {
                'status': 'healthy' if not missing_critical else 'degraded',
                'total_hooks': len(hook_files),
                'critical_hooks_present': len(critical_hooks) - len(missing_critical),
                'missing_critical': missing_critical,
                'last_checked': datetime.now().isoformat()
            }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'last_checked': datetime.now().isoformat()
            }

    def _check_filesystem_health(self) -> Dict[str, Any]:
        """Check filesystem health and permissions"""
        try:
            # Check key directories exist and are writable
            key_dirs = [
                '/Users/fulvioventura/devflow/.claude/hooks',
                '/Users/fulvioventura/devflow/.devflow',
                '/Users/fulvioventura/devflow/data',
                '/Users/fulvioventura/devflow/logs'
            ]

            dir_status = {}
            for dir_path in key_dirs:
                dir_status[dir_path] = {
                    'exists': os.path.exists(dir_path),
                    'writable': os.access(dir_path, os.W_OK) if os.path.exists(dir_path) else False
                }

            all_healthy = all(status['exists'] and status['writable']
                            for status in dir_status.values())

            return {
                'status': 'healthy' if all_healthy else 'degraded',
                'directories': dir_status,
                'last_checked': datetime.now().isoformat()
            }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'last_checked': datetime.now().isoformat()
            }

    def _check_devflow_components(self) -> Dict[str, Any]:
        """Check DevFlow component status"""
        try:
            # Check for key DevFlow files
            key_files = [
                '/Users/fulvioventura/devflow/CLAUDE.md',
                '/Users/fulvioventura/devflow/.claude/settings.json',
                '/Users/fulvioventura/devflow/.claude/state/current_task.json'
            ]

            file_status = {}
            for file_path in key_files:
                file_status[file_path] = os.path.exists(file_path)

            files_present = sum(file_status.values())

            return {
                'status': 'healthy' if files_present == len(key_files) else 'degraded',
                'files_present': files_present,
                'total_files': len(key_files),
                'file_status': file_status,
                'last_checked': datetime.now().isoformat()
            }

        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'last_checked': datetime.now().isoformat()
            }

    def _calculate_health_score(self, diagnostics: Dict[str, Any]) -> str:
        """Calculate overall system health score"""
        components = ['database', 'hooks', 'filesystem', 'devflow']
        healthy_count = sum(1 for comp in components
                          if diagnostics[comp]['status'] == 'healthy')

        if healthy_count == len(components):
            return 'excellent'
        elif healthy_count >= len(components) * 0.75:
            return 'good'
        elif healthy_count >= len(components) * 0.5:
            return 'fair'
        else:
            return 'poor'

    def _save_diagnostics_report(self, diagnostics: Dict[str, Any]) -> None:
        """Save diagnostics report to file"""
        try:
            os.makedirs(os.path.dirname(self.diagnostics_file), exist_ok=True)

            with open(self.diagnostics_file, 'w') as f:
                json.dump(diagnostics, f, indent=2)

        except Exception as e:
            self.logger.error(f"Failed to save diagnostics report: {e}")

if __name__ == "__main__":
    diagnostics = SystemDiagnosticsHook()
    sys.exit(diagnostics.run())
