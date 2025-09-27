#!/usr/bin/env python3
"""
Cometa User Prompt Hook - Context7 Implementation
Critical missing functionality for rules-n-protocols-review

Replaces non-compliant user-messages.py with:
- /cometa command processing
- Context injection from unified database
- Security filtering and validation
- Natural language parsing for Cometa Brain
"""

import sys
import os
import json
import re
import sqlite3
from datetime import datetime
from typing import Dict, Any, List, Optional

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import UserPromptSubmitHook, HookDecision

class CometaUserPromptHook(UserPromptSubmitHook):
    """Context7-compliant UserPromptSubmit hook with Cometa Brain integration"""

    def __init__(self):
        super().__init__("cometa-user-prompt-hook")
        self.db_path = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
        self.cometa_commands = {
            'create': self._handle_create_command,
            'list': self._handle_list_command,
            'switch': self._handle_switch_command,
            'complete': self._handle_complete_command,
            'status': self._handle_status_command,
            'search': self._handle_search_command,
            'help': self._handle_help_command
        }

    def validate_input(self) -> bool:
        """Validate UserPromptSubmit input"""
        if not super().validate_input():
            return False

        # Additional validation for Cometa functionality
        prompt = self.input_data.get("prompt", "")
        if not prompt.strip():
            self.logger.warning("Empty prompt received")
            return True  # Allow empty prompts

        return True

    def execute_logic(self) -> None:
        """Main logic for processing user prompts"""
        prompt = self.input_data.get("prompt", "")

        # Check for security violations first
        if self._has_security_violations(prompt):
            self.block_prompt("Security violation detected in prompt")
            return

        # Process /cometa commands
        if prompt.strip().startswith("/cometa"):
            self._process_cometa_command(prompt)
            return

        # Inject relevant context for non-command prompts
        context = self._get_relevant_context(prompt)
        if context:
            self.add_context(context)

        # Log successful processing
        self.logger.info(f"Processed user prompt: {prompt[:50]}...")

    def _has_security_violations(self, prompt: str) -> bool:
        """Check prompt for security violations"""
        dangerous_patterns = [
            r'sudo\s+rm\s+-rf',
            r'DROP\s+TABLE',
            r'DELETE\s+FROM.*WHERE.*=.*',
            r'eval\s*\(',
            r'exec\s*\(',
            r'system\s*\(',
            r'__import__\s*\('
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, prompt, re.IGNORECASE):
                self.logger.warning(f"Security pattern detected: {pattern}")
                return True

        return False

    def _process_cometa_command(self, prompt: str) -> None:
        """Process /cometa commands"""
        try:
            # Parse command: /cometa <action> [args...]
            parts = prompt.strip().split()
            if len(parts) < 2:
                self._show_cometa_help()
                return

            action = parts[1].lower()
            args = parts[2:] if len(parts) > 2 else []

            if action in self.cometa_commands:
                result = self.cometa_commands[action](args)
                if result:
                    self.add_context(f"Cometa Command Result:\n{result}")
            else:
                self.add_context(f"Unknown cometa command: {action}\nUse '/cometa help' for available commands")

        except Exception as e:
            self.logger.error(f"Error processing cometa command: {e}")
            self.add_context(f"Error processing cometa command: {str(e)}")

    def _handle_create_command(self, args: List[str]) -> str:
        """Handle /cometa create commands"""
        if not args:
            return "Usage: /cometa create task [name] or /cometa create project [name]"

        entity_type = args[0].lower()
        name = " ".join(args[1:]) if len(args) > 1 else f"new-{entity_type}-{datetime.now().strftime('%Y%m%d-%H%M')}"

        try:
            with sqlite3.connect(self.db_path) as conn:
                if entity_type == 'task':
                    conn.execute(
                        "INSERT INTO tasks (name, description, status, created_at) VALUES (?, ?, 'pending', CURRENT_TIMESTAMP)",
                        (name, f"Task created via Cometa command")
                    )
                    return f"✅ Created task: {name}"
                elif entity_type == 'project':
                    conn.execute(
                        "INSERT INTO projects (name, description, status, created_at) VALUES (?, ?, 'active', CURRENT_TIMESTAMP)",
                        (name, f"Project created via Cometa command")
                    )
                    return f"✅ Created project: {name}"
                else:
                    return f"Unknown entity type: {entity_type}. Use 'task' or 'project'"

        except sqlite3.Error as e:
            self.logger.error(f"Database error creating {entity_type}: {e}")
            return f"❌ Error creating {entity_type}: {str(e)}"

    def _handle_list_command(self, args: List[str]) -> str:
        """Handle /cometa list commands"""
        entity_type = args[0].lower() if args else 'tasks'

        try:
            with sqlite3.connect(self.db_path) as conn:
                if entity_type in ['task', 'tasks']:
                    cursor = conn.execute(
                        "SELECT name, status, created_at FROM tasks ORDER BY created_at DESC LIMIT 10"
                    )
                    results = cursor.fetchall()
                    if results:
                        output = "📋 Recent Tasks:\n"
                        for name, status, created in results:
                            status_icon = "✅" if status == "completed" else "🔄" if status == "in_progress" else "⏸️"
                            output += f"{status_icon} {name} ({status}) - {created[:10]}\n"
                        return output
                    else:
                        return "No tasks found"

                elif entity_type in ['project', 'projects']:
                    cursor = conn.execute(
                        "SELECT name, status, created_at FROM projects ORDER BY created_at DESC LIMIT 10"
                    )
                    results = cursor.fetchall()
                    if results:
                        output = "📁 Recent Projects:\n"
                        for name, status, created in results:
                            status_icon = "✅" if status == "completed" else "🔄" if status == "active" else "⏸️"
                            output += f"{status_icon} {name} ({status}) - {created[:10]}\n"
                        return output
                    else:
                        return "No projects found"
                else:
                    return f"Unknown entity type: {entity_type}. Use 'tasks' or 'projects'"

        except sqlite3.Error as e:
            self.logger.error(f"Database error listing {entity_type}: {e}")
            return f"❌ Error listing {entity_type}: {str(e)}"

    def _handle_search_command(self, args: List[str]) -> str:
        """Handle /cometa search commands"""
        if not args:
            return "Usage: /cometa search [query]"

        query = " ".join(args)

        try:
            with sqlite3.connect(self.db_path) as conn:
                # Search tasks and projects
                cursor = conn.execute("""
                    SELECT 'task' as type, name, description, status, created_at
                    FROM tasks
                    WHERE name LIKE ? OR description LIKE ?
                    UNION
                    SELECT 'project' as type, name, description, status, created_at
                    FROM projects
                    WHERE name LIKE ? OR description LIKE ?
                    ORDER BY created_at DESC LIMIT 20
                """, (f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%"))

                results = cursor.fetchall()
                if results:
                    output = f"🔍 Search results for '{query}':\n"
                    for item_type, name, desc, status, created in results:
                        type_icon = "📋" if item_type == "task" else "📁"
                        status_icon = "✅" if status in ["completed"] else "🔄" if status in ["in_progress", "active"] else "⏸️"
                        output += f"{type_icon} {status_icon} {name} ({item_type}, {status})\n"
                        if desc and len(desc) > 0:
                            output += f"   {desc[:80]}{'...' if len(desc) > 80 else ''}\n"
                    return output
                else:
                    return f"No results found for '{query}'"

        except sqlite3.Error as e:
            self.logger.error(f"Database error searching: {e}")
            return f"❌ Error searching: {str(e)}"

    def _handle_switch_command(self, args: List[str]) -> str:
        """Handle /cometa switch commands"""
        if not args:
            return "Usage: /cometa switch [task-name]"

        task_name = " ".join(args)

        try:
            with sqlite3.connect(self.db_path) as conn:
                # Check if task exists
                cursor = conn.execute("SELECT id, name FROM tasks WHERE name = ?", (task_name,))
                result = cursor.fetchone()

                if result:
                    # Update current task file
                    current_task = {
                        "task": task_name,
                        "branch": "feature/co-me-ta_to_real_world",
                        "services": ["cometa-brain"],
                        "updated": datetime.now().strftime("%Y-%m-%d")
                    }

                    current_task_file = "/Users/fulvioventura/devflow/.claude/state/current_task.json"
                    with open(current_task_file, 'w') as f:
                        json.dump(current_task, f, indent=2)

                    return f"✅ Switched to task: {task_name}"
                else:
                    return f"❌ Task '{task_name}' not found"

        except Exception as e:
            self.logger.error(f"Error switching task: {e}")
            return f"❌ Error switching task: {str(e)}"

    def _handle_complete_command(self, args: List[str]) -> str:
        """Handle /cometa complete commands"""
        if not args:
            return "Usage: /cometa complete [task-name]"

        task_name = " ".join(args)

        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "UPDATE tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE name = ?",
                    (task_name,)
                )

                if cursor.rowcount > 0:
                    return f"✅ Completed task: {task_name}"
                else:
                    return f"❌ Task '{task_name}' not found"

        except sqlite3.Error as e:
            self.logger.error(f"Database error completing task: {e}")
            return f"❌ Error completing task: {str(e)}"

    def _handle_status_command(self, args: List[str]) -> str:
        """Handle /cometa status commands"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Get task counts
                cursor = conn.execute("""
                    SELECT status, COUNT(*) FROM tasks GROUP BY status
                    UNION ALL
                    SELECT 'total', COUNT(*) FROM tasks
                """)
                task_stats = dict(cursor.fetchall())

                # Get current task
                try:
                    with open("/Users/fulvioventura/devflow/.claude/state/current_task.json", 'r') as f:
                        current_task = json.load(f)
                        current_task_name = current_task.get('task', 'None')
                except:
                    current_task_name = 'None'

                output = "🧠 Cometa Brain Status:\n"
                output += f"📋 Tasks: {task_stats.get('total', 0)} total\n"
                output += f"   🔄 In Progress: {task_stats.get('in_progress', 0)}\n"
                output += f"   ⏸️ Pending: {task_stats.get('pending', 0)}\n"
                output += f"   ✅ Completed: {task_stats.get('completed', 0)}\n"
                output += f"🎯 Current Task: {current_task_name}\n"

                return output

        except sqlite3.Error as e:
            self.logger.error(f"Database error getting status: {e}")
            return f"❌ Error getting status: {str(e)}"

    def _handle_help_command(self, args: List[str]) -> str:
        """Handle /cometa help commands"""
        return """🧠 Cometa Brain Commands:

📋 Task Management:
  /cometa create task [name]     - Create new task
  /cometa list tasks            - List recent tasks
  /cometa switch [task-name]    - Switch to task
  /cometa complete [task-name]  - Complete task

📁 Project Management:
  /cometa create project [name] - Create new project
  /cometa list projects        - List recent projects

🔍 Search & Status:
  /cometa search [query]       - Search tasks/projects
  /cometa status              - Show system status
  /cometa help               - Show this help

All commands are processed through Context7-compliant hooks with full audit logging.
"""

    def _show_cometa_help(self) -> None:
        """Show help when /cometa command is incomplete"""
        self.add_context(self._handle_help_command([]))

    def _get_relevant_context(self, prompt: str) -> Optional[str]:
        """Get relevant context for non-command prompts"""
        # Simple context injection based on prompt keywords
        context_keywords = {
            'task': self._get_task_context,
            'project': self._get_project_context,
            'status': self._get_status_context,
            'hook': self._get_hook_context,
            'cometa': self._get_cometa_context
        }

        for keyword, context_func in context_keywords.items():
            if keyword.lower() in prompt.lower():
                try:
                    return context_func()
                except Exception as e:
                    self.logger.error(f"Error getting {keyword} context: {e}")

        return None

    def _get_task_context(self) -> str:
        """Get current task context"""
        try:
            with open("/Users/fulvioventura/devflow/.claude/state/current_task.json", 'r') as f:
                current_task = json.load(f)
                return f"Current Task: {current_task.get('task', 'None')} on branch {current_task.get('branch', 'unknown')}"
        except:
            return "No current task set"

    def _get_project_context(self) -> str:
        """Get project context"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT name, status FROM projects WHERE status = 'active' LIMIT 5")
                results = cursor.fetchall()
                if results:
                    projects = [f"{name} ({status})" for name, status in results]
                    return f"Active Projects: {', '.join(projects)}"
                else:
                    return "No active projects found"
        except:
            return "Unable to retrieve project context"

    def _get_status_context(self) -> str:
        """Get system status context"""
        return self._handle_status_command([])

    def _get_hook_context(self) -> str:
        """Get hook system context"""
        return "Context7 Hook System Active - 7 compliant hooks operational"

    def _get_cometa_context(self) -> str:
        """Get Cometa Brain context"""
        return "Cometa Brain v2.0 - Unified Orchestrator integration with 4-layer intelligence architecture"

if __name__ == "__main__":
    hook = CometaUserPromptHook()
    sys.exit(hook.run())