#!/usr/bin/env python3
"""
Cometa Brain Slash Command
Handles /cometa commands by processing natural language and executing tasks
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime

# Add hooks directory to Python path
sys.path.append(str(Path(__file__).parent))

# Import our NLP components
from cometa_nlp_processor import NaturalLanguageCommandProcessor
from cometa_task_executor import TaskCommandExecutor

DB_PATH = Path('./data/devflow_unified.sqlite')

class CometaSlashCommand:
    """Handles /cometa slash commands"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.nlp_processor = NaturalLanguageCommandProcessor(db_path)
        self.task_executor = TaskCommandExecutor(db_path)

    def execute_command(self, command_text: str) -> dict:
        """
        Execute a /cometa command

        Args:
            command_text: Text after /cometa

        Returns:
            Dictionary with success status and output
        """
        try:
            if not command_text.strip():
                return {
                    'success': False,
                    'error': 'No command provided',
                    'help': self._get_help_text()
                }

            # Process natural language command
            nlp_result = self.nlp_processor.process_command(command_text)

            if not nlp_result.get('success'):
                return {
                    'success': False,
                    'error': f"Could not understand command: {command_text}",
                    'suggestions': nlp_result.get('suggestions', []),
                    'help': self._get_help_text()
                }

            # Execute the structured command
            command_struct = nlp_result['command']
            execution_result = self.task_executor.execute_command(command_struct)

            # Format response for user
            if execution_result.get('success'):
                return {
                    'success': True,
                    'message': execution_result['message'],
                    'data': execution_result.get('data', {}),
                    'confidence': nlp_result.get('confidence', 0.0),
                    'affected_tasks': execution_result.get('affected_tasks', 0)
                }
            else:
                return {
                    'success': False,
                    'error': execution_result.get('error', 'Command execution failed'),
                    'help': self._get_help_text()
                }

        except Exception as e:
            return {
                'success': False,
                'error': f"Internal error: {str(e)}",
                'help': self._get_help_text()
            }

    def _get_help_text(self) -> str:
        """Get help text for /cometa commands"""
        return """
🧠 **Cometa Brain Commands:**

**Task Management:**
- `/cometa create task for [description]` - Create new task
- `/cometa list active tasks` - List active tasks
- `/cometa complete task [title]` - Mark task as completed
- `/cometa update task [title] to [status/priority]` - Update task
- `/cometa search tasks about [keyword]` - Search tasks

**Project Management:**
- `/cometa project status` - Show current project status
- `/cometa switch to project [name]` - Switch active project

**System:**
- `/cometa system status` - Show system status
- `/cometa show metrics` - Display system metrics
- `/cometa help` - Show this help

**Examples:**
- `/cometa create task for implementing user authentication`
- `/cometa list pending tasks`
- `/cometa complete task authentication`
- `/cometa show project status`
        """

    def format_output_for_claude(self, result: dict) -> str:
        """Format result for Claude Code display"""
        if result['success']:
            output = f"✅ **{result['message']}**\n"

            # Add task data if present
            if 'data' in result and result['data']:
                data = result['data']

                if 'task' in data:
                    task = data['task']
                    output += f"\n📋 **Task Details:**\n"
                    output += f"- **Title:** {task.get('title', 'N/A')}\n"
                    output += f"- **Status:** {task.get('status', 'N/A')}\n"
                    output += f"- **Priority:** {task.get('priority', 'N/A')}\n"
                    if task.get('description'):
                        output += f"- **Description:** {task['description']}\n"

                if 'tasks' in data:
                    tasks = data['tasks']
                    output += f"\n📋 **Found {len(tasks)} tasks:**\n"
                    for task in tasks[:5]:  # Show max 5 tasks
                        status_emoji = {'completed': '✅', 'in_progress': '🔄', 'pending': '⏳', 'blocked': '🚫'}.get(task.get('status'), '📌')
                        priority = task.get('priority', 'm-')
                        output += f"{status_emoji} **{task.get('title', 'Untitled')}** [{priority}]\n"

                    if len(tasks) > 5:
                        output += f"... and {len(tasks) - 5} more tasks\n"

                if 'active_project' in data:
                    project = data['active_project']
                    if project:
                        output += f"\n🚀 **Active Project:** {project.get('name', 'N/A')}\n"
                        if project.get('description'):
                            output += f"- **Description:** {project['description']}\n"
                    else:
                        output += f"\n⚠️ **No active project**\n"

                if 'task_summary' in data:
                    summary = data['task_summary']
                    output += f"\n📊 **Task Summary:**\n"
                    for status, count in summary.items():
                        status_emoji = {'completed': '✅', 'in_progress': '🔄', 'pending': '⏳', 'blocked': '🚫'}.get(status, '📌')
                        output += f"{status_emoji} {status}: {count}\n"

            if result.get('affected_tasks', 0) > 0:
                output += f"\n📈 **Affected tasks:** {result['affected_tasks']}\n"

            if result.get('confidence', 0) > 0:
                confidence_pct = int(result['confidence'] * 100)
                output += f"\n🎯 **Confidence:** {confidence_pct}%\n"

        else:
            output = f"❌ **Error:** {result['error']}\n"

            if 'suggestions' in result and result['suggestions']:
                output += f"\n💡 **Suggestions:**\n"
                for suggestion in result['suggestions']:
                    output += f"- {suggestion}\n"

            if 'help' in result:
                output += f"\n{result['help']}"

        return output

def main():
    """Entry point for /cometa slash command"""
    try:
        # Get command arguments (everything after /cometa)
        if len(sys.argv) < 2:
            command_text = ""
        else:
            command_text = " ".join(sys.argv[1:])

        # Execute command
        cometa_cmd = CometaSlashCommand(DB_PATH)
        result = cometa_cmd.execute_command(command_text)

        # Format and output result
        formatted_output = cometa_cmd.format_output_for_claude(result)
        print(formatted_output)

        # Log command execution
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'command': f"/cometa {command_text}",
            'success': result['success'],
            'message': result.get('message') or result.get('error', 'Unknown'),
            'affected_tasks': result.get('affected_tasks', 0)
        }

        log_file = Path('./temp/cometa-slash-commands.log')
        log_file.parent.mkdir(exist_ok=True)

        logs = []
        if log_file.exists():
            with open(log_file, 'r') as f:
                logs = json.load(f)

        logs.append(log_entry)

        with open(log_file, 'w') as f:
            json.dump(logs, f, indent=2)

    except Exception as e:
        error_msg = f"❌ **Cometa Brain Error:** {str(e)}"
        print(error_msg)
        sys.stderr.write(f"Cometa slash command error: {e}\n")

if __name__ == "__main__":
    main()