#!/usr/bin/env python3
"""
Cometa System Status Hook - Context7 Implementation
Critical missing functionality for rules-n-protocols-review

Replaces non-compliant footer-display.py and footer-details.py with:
- System status display and management
- Task progress tracking in footer
- Real-time metrics collection
- User feedback and notifications
- Unified status across all DevFlow components
"""

import sys
import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import PostToolUseHook, HookDecision

class CometaSystemStatusHook(PostToolUseHook):
    """Context7-compliant PostToolUse hook for system status management"""

    def __init__(self):
        super().__init__("cometa-system-status-hook")
        self.db_path = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
        self.footer_state_file = "/Users/fulvioventura/devflow/.devflow/footer-state.json"
        self.footer_line_file = "/Users/fulvioventura/devflow/.devflow/footer-line.txt"

    def validate_input(self) -> bool:
        """Validate PostToolUse input"""
        if not super().validate_input():
            return False

        return True

    def execute_logic(self) -> None:
        """Main logic for system status management"""
        try:
            # Collect system metrics
            metrics = self._collect_system_metrics()

            # Update footer status
            self._update_footer_status(metrics)

            # Check for status alerts
            alerts = self._check_system_alerts(metrics)
            if alerts:
                self._handle_system_alerts(alerts)

            # Store status history
            self._store_status_history(metrics)

            self.logger.info("System status updated successfully")

        except Exception as e:
            self.logger.error(f"System status update failed: {e}")
            # Continue execution even if status fails

    def _collect_system_metrics(self) -> Dict[str, Any]:
        """Collect comprehensive system metrics"""
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'session_id': self.input_data.get('session_id'),
            'hook_system': self._get_hook_system_status(),
            'database': self._get_database_status(),
            'tasks': self._get_task_status(),
            'memory_usage': self._get_memory_usage(),
            'performance': self._get_performance_metrics(),
            'orchestrator': self._get_orchestrator_status()
        }

        return metrics

    def _get_hook_system_status(self) -> Dict[str, Any]:
        """Get hook system status"""
        try:
            # Count active hooks
            hooks_dir = "/Users/fulvioventura/devflow/.claude/hooks"
            hook_files = [f for f in os.listdir(hooks_dir) if f.endswith('.py') and not f.startswith('.')]

            # Check Context7 compliance
            context7_hooks = [
                'cometa-user-prompt-hook.py',
                'cometa-memory-stream-hook.py',
                'unified-cometa-processor.py',
                'cometa-system-status-hook.py',
                'session-start.py',
                'post-tool-use.py',
                'cometa-brain-sync.py'
            ]

            compliant_count = sum(1 for hook in context7_hooks if hook in hook_files)

            return {
                'total_hooks': len(hook_files),
                'context7_compliant': compliant_count,
                'compliance_rate': round((compliant_count / len(hook_files)) * 100, 1) if hook_files else 0,
                'status': 'healthy' if compliant_count >= 7 else 'warning'
            }

        except Exception as e:
            self.logger.error(f"Error getting hook system status: {e}")
            return {'status': 'error', 'error': str(e)}

    def _get_database_status(self) -> Dict[str, Any]:
        """Get database system status"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Check database connectivity
                cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = [row[0] for row in cursor.fetchall()]

                # Get record counts
                record_counts = {}
                for table in ['tasks', 'projects', 'memory_streams', 'sessions']:
                    if table in tables:
                        cursor = conn.execute(f"SELECT COUNT(*) FROM {table}")
                        record_counts[table] = cursor.fetchone()[0]

                # Check recent activity
                cursor = conn.execute("""
                    SELECT COUNT(*) FROM memory_streams
                    WHERE created_at > datetime('now', '-1 hour')
                """)
                recent_activity = cursor.fetchone()[0]

                return {
                    'status': 'connected',
                    'tables_count': len(tables),
                    'record_counts': record_counts,
                    'recent_activity': recent_activity,
                    'last_activity': datetime.now().isoformat()
                }

        except Exception as e:
            self.logger.error(f"Database status check failed: {e}")
            return {'status': 'error', 'error': str(e)}

    def _get_task_status(self) -> Dict[str, Any]:
        """Get task management status"""
        try:
            # Get current task
            current_task = self._get_current_task()

            # Get task statistics
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT status, COUNT(*) FROM tasks GROUP BY status
                """)
                task_stats = dict(cursor.fetchall())

                # Get recent task activity
                cursor = conn.execute("""
                    SELECT COUNT(*) FROM tasks
                    WHERE created_at > datetime('now', '-24 hours')
                """)
                tasks_today = cursor.fetchone()[0]

            return {
                'current_task': current_task,
                'total_tasks': sum(task_stats.values()),
                'in_progress': task_stats.get('in_progress', 0),
                'pending': task_stats.get('pending', 0),
                'completed': task_stats.get('completed', 0),
                'tasks_today': tasks_today,
                'status': 'active' if current_task else 'idle'
            }

        except Exception as e:
            self.logger.error(f"Error getting task status: {e}")
            return {'status': 'error', 'error': str(e)}

    def _get_current_task(self) -> Optional[str]:
        """Get current active task"""
        try:
            with open("/Users/fulvioventura/devflow/.claude/state/current_task.json", 'r') as f:
                current_task = json.load(f)
                return current_task.get('task')
        except:
            return None

    def _get_memory_usage(self) -> Dict[str, Any]:
        """Get memory usage statistics"""
        try:
            session_id = self.input_data.get('session_id')

            with sqlite3.connect(self.db_path) as conn:
                # Session memory usage
                cursor = conn.execute("""
                    SELECT COUNT(*),
                           SUM(LENGTH(tool_input) + LENGTH(tool_response)) as total_size
                    FROM memory_streams
                    WHERE session_id = ?
                """, (session_id,))
                session_count, session_size = cursor.fetchone()

                # Recent memory growth
                cursor = conn.execute("""
                    SELECT COUNT(*) FROM memory_streams
                    WHERE created_at > datetime('now', '-1 hour')
                """)
                recent_entries = cursor.fetchone()[0]

                return {
                    'session_entries': session_count or 0,
                    'session_size_bytes': session_size or 0,
                    'recent_growth': recent_entries,
                    'status': 'normal' if (session_size or 0) < 10000000 else 'high'
                }

        except Exception as e:
            self.logger.error(f"Error getting memory usage: {e}")
            return {'status': 'error', 'error': str(e)}

    def _get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        try:
            session_id = self.input_data.get('session_id')

            with sqlite3.connect(self.db_path) as conn:
                # Tool execution frequency
                cursor = conn.execute("""
                    SELECT tool_name, COUNT(*) as frequency
                    FROM memory_streams
                    WHERE session_id = ? AND created_at > datetime('now', '-1 hour')
                    GROUP BY tool_name
                    ORDER BY frequency DESC LIMIT 5
                """, (session_id,))
                tool_frequency = dict(cursor.fetchall())

                # Average operations per minute
                cursor = conn.execute("""
                    SELECT COUNT(*) FROM memory_streams
                    WHERE session_id = ? AND created_at > datetime('now', '-30 minutes')
                """, (session_id,))
                recent_ops = cursor.fetchone()[0]
                ops_per_minute = round(recent_ops / 30, 2)

                return {
                    'top_tools': tool_frequency,
                    'ops_per_minute': ops_per_minute,
                    'activity_level': 'high' if ops_per_minute > 2 else 'normal' if ops_per_minute > 0.5 else 'low'
                }

        except Exception as e:
            self.logger.error(f"Error getting performance metrics: {e}")
            return {'status': 'error', 'error': str(e)}

    def _get_orchestrator_status(self) -> Dict[str, Any]:
        """Get Unified Orchestrator status"""
        try:
            # Check if orchestrator is responsive (placeholder)
            # In real implementation, this would ping the orchestrator service

            return {
                'status': 'active',
                'endpoint': 'localhost:3005',
                'last_check': datetime.now().isoformat(),
                'mode': 'all-mode'  # Default mode
            }

        except Exception as e:
            self.logger.error(f"Error getting orchestrator status: {e}")
            return {'status': 'unknown', 'error': str(e)}

    def _update_footer_status(self, metrics: Dict[str, Any]) -> None:
        """Update footer status display"""
        try:
            # Create footer line
            footer_line = self._format_footer_line(metrics)

            # Update footer files
            os.makedirs(os.path.dirname(self.footer_state_file), exist_ok=True)

            # Update footer state
            with open(self.footer_state_file, 'w') as f:
                json.dump({
                    'last_updated': metrics['timestamp'],
                    'status': self._get_overall_status(metrics),
                    'metrics': metrics
                }, f, indent=2)

            # Update footer line
            with open(self.footer_line_file, 'w') as f:
                f.write(footer_line)

        except Exception as e:
            self.logger.error(f"Error updating footer: {e}")

    def _format_footer_line(self, metrics: Dict[str, Any]) -> str:
        """Format footer line for display"""
        try:
            task_info = metrics.get('tasks', {})
            current_task = task_info.get('current_task', 'No Task')

            hook_info = metrics.get('hook_system', {})
            compliance_rate = hook_info.get('compliance_rate', 0)

            performance = metrics.get('performance', {})
            activity = performance.get('activity_level', 'unknown')

            # Format: [Task: task-name] [Context7: 85%] [Activity: high] [Status: healthy]
            footer_parts = [
                f"Task: {current_task[:20]}{'...' if len(current_task) > 20 else ''}",
                f"Context7: {compliance_rate}%",
                f"Activity: {activity}",
                f"Status: {self._get_overall_status(metrics)}"
            ]

            return " | ".join(footer_parts)

        except Exception as e:
            self.logger.error(f"Error formatting footer: {e}")
            return "DevFlow Status: Error"

    def _get_overall_status(self, metrics: Dict[str, Any]) -> str:
        """Determine overall system status"""
        try:
            statuses = []

            # Check each system component
            for component in ['hook_system', 'database', 'tasks', 'orchestrator']:
                comp_metrics = metrics.get(component, {})
                comp_status = comp_metrics.get('status', 'unknown')
                statuses.append(comp_status)

            # Determine overall status
            if 'error' in statuses:
                return 'error'
            elif 'warning' in statuses:
                return 'warning'
            elif all(s in ['healthy', 'active', 'connected', 'normal'] for s in statuses):
                return 'healthy'
            else:
                return 'unknown'

        except Exception as e:
            self.logger.error(f"Error determining overall status: {e}")
            return 'error'

    def _check_system_alerts(self, metrics: Dict[str, Any]) -> List[Dict[str, str]]:
        """Check for system alerts and warnings"""
        alerts = []

        try:
            # Hook system alerts
            hook_metrics = metrics.get('hook_system', {})
            compliance_rate = hook_metrics.get('compliance_rate', 0)
            if compliance_rate < 70:
                alerts.append({
                    'type': 'warning',
                    'component': 'hook_system',
                    'message': f'Context7 compliance at {compliance_rate}% - consider updating hooks'
                })

            # Database alerts
            db_metrics = metrics.get('database', {})
            if db_metrics.get('status') == 'error':
                alerts.append({
                    'type': 'error',
                    'component': 'database',
                    'message': 'Database connectivity issues detected'
                })

            # Memory usage alerts
            memory_metrics = metrics.get('memory_usage', {})
            if memory_metrics.get('status') == 'high':
                alerts.append({
                    'type': 'warning',
                    'component': 'memory',
                    'message': 'High memory usage detected - consider cleanup'
                })

            # Performance alerts
            performance_metrics = metrics.get('performance', {})
            ops_per_minute = performance_metrics.get('ops_per_minute', 0)
            if ops_per_minute > 10:
                alerts.append({
                    'type': 'info',
                    'component': 'performance',
                    'message': 'High activity level detected - system is very active'
                })

        except Exception as e:
            self.logger.error(f"Error checking system alerts: {e}")
            alerts.append({
                'type': 'error',
                'component': 'status_check',
                'message': f'Error checking system alerts: {str(e)}'
            })

        return alerts

    def _handle_system_alerts(self, alerts: List[Dict[str, str]]) -> None:
        """Handle system alerts and notifications"""
        try:
            # Log alerts
            for alert in alerts:
                level = alert['type']
                message = f"{alert['component']}: {alert['message']}"

                if level == 'error':
                    self.logger.error(message)
                elif level == 'warning':
                    self.logger.warning(message)
                else:
                    self.logger.info(message)

            # Store alerts in database for tracking
            self._store_system_alerts(alerts)

        except Exception as e:
            self.logger.error(f"Error handling system alerts: {e}")

    def _store_system_alerts(self, alerts: List[Dict[str, str]]) -> None:
        """Store system alerts in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                for alert in alerts:
                    conn.execute("""
                        INSERT INTO system_alerts (
                            session_id, alert_type, component, message, created_at
                        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """, (
                        self.input_data.get('session_id'),
                        alert['type'],
                        alert['component'],
                        alert['message']
                    ))

        except sqlite3.Error as e:
            self.logger.error(f"Error storing system alerts: {e}")

    def _store_status_history(self, metrics: Dict[str, Any]) -> None:
        """Store status history for trending"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO status_history (
                        session_id, metrics_data, overall_status, created_at
                    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    self.input_data.get('session_id'),
                    json.dumps(metrics),
                    self._get_overall_status(metrics)
                ))

                # Cleanup old status history (keep last 1000 entries)
                conn.execute("""
                    DELETE FROM status_history
                    WHERE id NOT IN (
                        SELECT id FROM status_history
                        ORDER BY created_at DESC LIMIT 1000
                    )
                """)

        except sqlite3.Error as e:
            self.logger.error(f"Error storing status history: {e}")

    def get_status_summary(self) -> Dict[str, Any]:
        """Get status summary for other components (utility method)"""
        try:
            with open(self.footer_state_file, 'r') as f:
                footer_state = json.load(f)
                return footer_state.get('metrics', {})
        except:
            return self._collect_system_metrics()

if __name__ == "__main__":
    hook = CometaSystemStatusHook()
    sys.exit(hook.run())