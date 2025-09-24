#!/usr/bin/env python3
"""
Cometa Brain Task Command Executor
Executes validated natural language commands against the task database
"""

import json
import sys
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
# import pysnooper  # Temporarily commented for testing

DB_PATH = Path('./data/devflow_unified.sqlite')

class TaskCommandExecutor:
    """Executes task management commands"""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def execute_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a validated command

        Args:
            command: Structured command from NLP processor

        Returns:
            Execution result with success status and data
        """
        try:
            action = command.get('action', {})
            action_type = action.get('type')
            operation = action.get('operation')

            if action_type == 'task_management':
                return self._execute_task_command(action, command)
            elif action_type == 'project_management':
                return self._execute_project_command(action, command)
            elif action_type == 'system':
                return self._execute_system_command(action, command)
            else:
                return self._error_response(f"Unknown action type: {action_type}")

        except Exception as e:
            return self._error_response(f"Execution error: {str(e)}")

    def _execute_task_command(self, action: Dict[str, Any], command: Dict[str, Any]) -> Dict[str, Any]:
        """Execute task management commands"""
        operation = action.get('operation')

        if operation == 'create':
            return self._create_task(action)
        elif operation == 'update':
            return self._update_task(action)
        elif operation == 'complete':
            return self._complete_task(action)
        elif operation == 'list':
            return self._list_tasks(action)
        elif operation == 'search':
            return self._search_tasks(action)
        elif operation == 'delete':
            return self._delete_task(action)
        else:
            return self._error_response(f"Unknown task operation: {operation}")

    # @pysnooper.snoop('/Users/fulvioventura/devflow/temp/task-executor-trace.log')
    def _create_task(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new task"""
        properties = action.get('properties', {})

        if not properties.get('title'):
            return self._error_response("Title is required for task creation")

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Insert new task
            cursor.execute("""
                INSERT INTO task_contexts (
                    title, description, priority, status,
                    complexity_score, estimated_duration_minutes,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                properties.get('title'),
                properties.get('description', properties.get('title')),
                properties.get('priority', 'm-'),
                properties.get('status', 'pending'),
                properties.get('complexity_score', 5),
                properties.get('estimated_duration_minutes', 60),
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))

            task_id = cursor.lastrowid
            conn.commit()

            # Retrieve created task
            created_task = self._get_task_by_id(cursor, task_id)

            return {
                'success': True,
                'message': f"Task '{properties.get('title')}' created successfully",
                'data': {
                    'task': created_task,
                    'task_id': task_id
                },
                'affected_tasks': 1
            }

        except Exception as e:
            conn.rollback()
            return self._error_response(f"Failed to create task: {str(e)}")
        finally:
            conn.close()

    def _update_task(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing task"""
        target = action.get('target', {})
        properties = action.get('properties', {})

        if not target:
            return self._error_response("Target task not specified")

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Find task to update
            task_id = self._find_task_id(cursor, target)
            if not task_id:
                return self._error_response(f"Task not found: {target}")

            # Build update query
            update_fields = []
            update_values = []

            for field, value in properties.items():
                if field in ['title', 'description', 'priority', 'status', 'complexity_score', 'estimated_duration_minutes']:
                    update_fields.append(f"{field} = ?")
                    update_values.append(value)

            if not update_fields:
                return self._error_response("No valid fields to update")

            update_fields.append("updated_at = ?")
            update_values.append(datetime.now().isoformat())
            update_values.append(task_id)

            # Execute update
            cursor.execute(f"""
                UPDATE task_contexts
                SET {', '.join(update_fields)}
                WHERE id = ?
            """, update_values)

            conn.commit()

            # Get updated task
            updated_task = self._get_task_by_id(cursor, task_id)

            return {
                'success': True,
                'message': f"Task updated successfully",
                'data': {
                    'task': updated_task,
                    'updated_fields': list(properties.keys())
                },
                'affected_tasks': 1
            }

        except Exception as e:
            conn.rollback()
            return self._error_response(f"Failed to update task: {str(e)}")
        finally:
            conn.close()

    def _complete_task(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Mark task as completed"""
        target = action.get('target', {})

        if not target:
            return self._error_response("Target task not specified")

        # Update with completed status
        modified_action = {
            'target': target,
            'properties': {
                'status': 'completed',
                'completed_at': datetime.now().isoformat()
            }
        }

        return self._update_task(modified_action)

    def _list_tasks(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """List tasks with optional filters"""
        filters = action.get('filters', {})

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Build query with filters
            query = "SELECT * FROM task_contexts WHERE 1=1"
            params = []

            if filters.get('status'):
                status_placeholders = ','.join(['?' for _ in filters['status']])
                query += f" AND status IN ({status_placeholders})"
                params.extend(filters['status'])

            if filters.get('priority'):
                priority_placeholders = ','.join(['?' for _ in filters['priority']])
                query += f" AND priority IN ({priority_placeholders})"
                params.extend(filters['priority'])

            if filters.get('search_text'):
                query += " AND (title LIKE ? OR description LIKE ?)"
                search_term = f"%{filters['search_text']}%"
                params.extend([search_term, search_term])

            if filters.get('created_after'):
                query += " AND created_at > ?"
                params.append(filters['created_after'])

            query += " ORDER BY updated_at DESC LIMIT 20"

            cursor.execute(query, params)
            tasks = cursor.fetchall()

            # Convert to dict format
            columns = [description[0] for description in cursor.description]
            task_list = [dict(zip(columns, task)) for task in tasks]

            return {
                'success': True,
                'message': f"Found {len(task_list)} tasks",
                'data': {
                    'tasks': task_list,
                    'count': len(task_list),
                    'filters_applied': filters
                },
                'affected_tasks': len(task_list)
            }

        except Exception as e:
            return self._error_response(f"Failed to list tasks: {str(e)}")
        finally:
            conn.close()

    def _search_tasks(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Search tasks by text"""
        filters = action.get('filters', {})
        search_text = filters.get('search_text', '')

        if not search_text:
            return self._error_response("Search text is required")

        # Use list_tasks with search filter
        modified_action = {
            'filters': {
                'search_text': search_text
            }
        }

        result = self._list_tasks(modified_action)
        if result['success']:
            result['message'] = f"Search results for '{search_text}'"

        return result

    def _delete_task(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Delete a task (soft delete by marking as archived)"""
        target = action.get('target', {})

        if not target:
            return self._error_response("Target task not specified")

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Find task
            task_id = self._find_task_id(cursor, target)
            if not task_id:
                return self._error_response(f"Task not found: {target}")

            # Get task details before deletion
            task = self._get_task_by_id(cursor, task_id)

            # Soft delete (mark as archived)
            cursor.execute("""
                UPDATE task_contexts
                SET status = 'archived', updated_at = ?
                WHERE id = ?
            """, (datetime.now().isoformat(), task_id))

            conn.commit()

            return {
                'success': True,
                'message': f"Task '{task['title']}' archived successfully",
                'data': {
                    'archived_task': task
                },
                'affected_tasks': 1
            }

        except Exception as e:
            conn.rollback()
            return self._error_response(f"Failed to archive task: {str(e)}")
        finally:
            conn.close()

    def _execute_project_command(self, action: Dict[str, Any], command: Dict[str, Any]) -> Dict[str, Any]:
        """Execute project management commands"""
        operation = action.get('operation')

        if operation == 'status':
            return self._get_project_status()
        elif operation == 'switch':
            return self._switch_project(action)
        else:
            return self._error_response(f"Project operation '{operation}' not yet implemented")

    def _get_project_status(self) -> Dict[str, Any]:
        """Get current project status"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Get active project
            cursor.execute("""
                SELECT id, name, description, status
                FROM projects
                WHERE status = 'active'
                ORDER BY updated_at DESC
                LIMIT 1
            """)

            project = cursor.fetchone()

            if project:
                project_dict = {
                    'id': project[0],
                    'name': project[1],
                    'description': project[2],
                    'status': project[3]
                }

                # Get task counts
                cursor.execute("""
                    SELECT status, COUNT(*) as count
                    FROM task_contexts
                    GROUP BY status
                """)

                task_counts = dict(cursor.fetchall())

                return {
                    'success': True,
                    'message': f"Current project: {project[1]}",
                    'data': {
                        'active_project': project_dict,
                        'task_summary': task_counts
                    }
                }
            else:
                return {
                    'success': True,
                    'message': "No active project",
                    'data': {
                        'active_project': None
                    }
                }

        except Exception as e:
            return self._error_response(f"Failed to get project status: {str(e)}")
        finally:
            conn.close()

    def _execute_system_command(self, action: Dict[str, Any], command: Dict[str, Any]) -> Dict[str, Any]:
        """Execute system commands"""
        operation = action.get('operation')

        if operation == 'status':
            return self._get_system_status()
        elif operation == 'metrics':
            return self._get_system_metrics(action)
        elif operation == 'help':
            return self._get_help()
        else:
            return self._error_response(f"System operation '{operation}' not yet implemented")

    def _get_system_status(self) -> Dict[str, Any]:
        """Get system status"""
        return {
            'success': True,
            'message': "Cometa Brain system is operational",
            'data': {
                'status': 'operational',
                'database_path': str(self.db_path),
                'timestamp': datetime.now().isoformat()
            }
        }

    def _get_system_metrics(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Get system metrics"""
        scope = action.get('parameters', {}).get('scope', 'all')

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            metrics = {}

            if scope in ['all', 'tasks']:
                cursor.execute("SELECT status, COUNT(*) FROM task_contexts GROUP BY status")
                metrics['task_counts'] = dict(cursor.fetchall())

            if scope in ['all', 'memory']:
                cursor.execute("SELECT COUNT(*) FROM cometa_memory_stream")
                metrics['memory_events'] = cursor.fetchone()[0]

            if scope in ['all', 'patterns']:
                cursor.execute("SELECT COUNT(*) FROM cometa_patterns")
                metrics['pattern_count'] = cursor.fetchone()[0]

            if scope in ['all', 'sessions']:
                cursor.execute("SELECT COUNT(*) FROM cometa_sessions")
                metrics['session_count'] = cursor.fetchone()[0]

            return {
                'success': True,
                'message': f"System metrics ({scope})",
                'data': {
                    'metrics': metrics,
                    'scope': scope,
                    'generated_at': datetime.now().isoformat()
                }
            }

        except Exception as e:
            return self._error_response(f"Failed to get metrics: {str(e)}")
        finally:
            conn.close()

    def _get_help(self) -> Dict[str, Any]:
        """Get help information"""
        help_info = {
            'available_commands': {
                'task_management': [
                    "create task for [description]",
                    "list [active/pending/completed] tasks",
                    "complete task [title]",
                    "update task [title] to [new status/priority]",
                    "search tasks about [keyword]"
                ],
                'project_management': [
                    "project status",
                    "switch to project [name]"
                ],
                'system': [
                    "system status",
                    "show metrics",
                    "help"
                ]
            },
            'examples': [
                "create task for implementing user authentication",
                "list active tasks",
                "complete task authentication",
                "show metrics",
                "project status"
            ]
        }

        return {
            'success': True,
            'message': "Available commands",
            'data': help_info
        }

    # Helper methods

    def _find_task_id(self, cursor, target: Dict[str, Any]) -> Optional[int]:
        """Find task ID by various criteria"""
        if target.get('id'):
            return int(target['id'])

        if target.get('title'):
            cursor.execute("""
                SELECT id FROM task_contexts
                WHERE title LIKE ?
                ORDER BY updated_at DESC
                LIMIT 1
            """, (f"%{target['title']}%",))

            result = cursor.fetchone()
            return result[0] if result else None

        return None

    def _get_task_by_id(self, cursor, task_id: int) -> Dict[str, Any]:
        """Get task details by ID"""
        cursor.execute("SELECT * FROM task_contexts WHERE id = ?", (task_id,))
        task = cursor.fetchone()

        if task:
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, task))

        # Return empty dict instead of None to prevent NoneType errors
        return {
            'id': task_id,
            'title': 'Task not found',
            'description': f'Task with ID {task_id} was not found in database',
            'status': 'unknown',
            'priority': 'm-',
            'created_at': '',
            'updated_at': ''
        }

    def _error_response(self, message: str) -> Dict[str, Any]:
        """Create error response"""
        return {
            'success': False,
            'error': message,
            'data': None
        }

def main():
    """Entry point for CLI testing"""
    if len(sys.argv) < 2:
        print("Usage: python cometa-task-executor.py '{\"command\": \"json\"}'")
        sys.exit(1)

    try:
        command = json.loads(sys.argv[1])
        executor = TaskCommandExecutor(DB_PATH)
        result = executor.execute_command(command)
        print(json.dumps(result, indent=2))
    except json.JSONDecodeError:
        print("Error: Invalid JSON command")
        sys.exit(1)

if __name__ == "__main__":
    main()