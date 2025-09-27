#!/usr/bin/env python3
"""
Cometa Brain Natural Language Processing Hook
Integrates NLP interface with existing Cometa Brain hook system
Triggered by specific NLP commands in user prompts
"""

import json
import sys
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
# import pysnooper  # Temporarily commented for testing

# Import our NLP components
sys.path.append(str(Path(__file__).parent))
from cometa_nlp_processor import NaturalLanguageCommandProcessor
from cometa_task_executor import TaskCommandExecutor
from cometa_progress_tracker import TaskProgressTracker
from cometa_batch_manager import BatchOperationsManager

DB_PATH = Path('./data/devflow_unified.sqlite')
LOG_DIR = Path('./.claude/logs/cometa-brain')

class CometaNLPHook:
    """Cometa Brain NLP Hook for processing natural language commands"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.nlp_processor = NaturalLanguageCommandProcessor(db_path)
        self.task_executor = TaskCommandExecutor(db_path)
        self.progress_tracker = TaskProgressTracker(db_path)
        self.batch_manager = BatchOperationsManager(db_path)

        # Command triggers that activate NLP processing
        self.nlp_triggers = [
            r'cometa[:\s]+(.+)',  # "cometa: create task for authentication"
            r'@cometa\s+(.+)',    # "@cometa list active tasks"
            r'brain[:\s]+(.+)',   # "brain: show progress summary"
            r'task[:\s]+(.+)',    # "task: complete login feature"
            r'project[:\s]+(.+)', # "project: switch to devflow"
        ]

        # Special commands that bypass normal processing
        self.special_commands = {
            'help': self._show_help,
            'status': self._show_status,
            'examples': self._show_examples,
            'metrics': self._show_metrics
        }

    # @pysnooper.snoop('/Users/fulvioventura/devflow/temp/nlp-hook-trace.log')
    def process_hook_input(self, hook_input: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Process hook input and detect NLP commands

        Args:
            hook_input: Hook input data from Claude

        Returns:
            Processing result or None if no NLP command detected
        """
        try:
            prompt = hook_input.get('prompt', '')
            session_id = hook_input.get('session_id', 'unknown')

            # Check for NLP command triggers
            nlp_command = self._extract_nlp_command(prompt)

            if not nlp_command:
                return None  # No NLP command detected

            # Log NLP command
            self._log_nlp_command(session_id, nlp_command, prompt)

            # Process the command
            result = self._process_nlp_command(nlp_command, session_id)

            # Format output for Claude with robust error handling
            try:
                output = self._format_claude_output(result, nlp_command)
            except Exception as format_error:
                # Ultra-robust fallback output - handles all None/invalid cases
                success_status = "❌"  # Default to error
                error_msg = "Processing failed"

                # Safely extract status and error if result exists and is valid
                if result is not None and isinstance(result, dict):
                    if result.get('success', False):
                        success_status = "✅"
                    if 'error' in result and result['error']:
                        error_msg = str(result['error'])

                output = f"{success_status} **Command Processed**: {nlp_command}\n"
                if success_status == "✅":
                    output += f"**Result**: Command executed successfully\n"
                else:
                    output += f"**Error**: {error_msg}\n"
                output += f"\n*Note: Output formatting error resolved - {str(format_error)}*\n"

            return {
                'success': True,
                'nlp_command': nlp_command,
                'result': result,
                'output': output,
                'session_id': session_id
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'nlp_command': nlp_command if 'nlp_command' in locals() else None
            }

    def _extract_nlp_command(self, prompt: str) -> Optional[str]:
        """Extract NLP command from prompt"""
        prompt_lower = prompt.lower().strip()

        # Check for trigger patterns
        for trigger_pattern in self.nlp_triggers:
            match = re.search(trigger_pattern, prompt_lower, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        # Check for direct task management commands without triggers
        direct_patterns = [
            r'^(create|add|new)\s+task',
            r'^(list|show|display)\s+(?:all\s+)?tasks?',
            r'^(complete|finish|done)\s+(?:task\s+)?',
            r'^(update|change|modify)\s+(?:task\s+)?',
            r'^(delete|remove|archive)\s+(?:task\s+)?',
            r'^(project|switch|status)',
            r'^(help|examples|metrics)',
        ]

        for pattern in direct_patterns:
            if re.search(pattern, prompt_lower):
                return prompt.strip()

        return None

    def _process_nlp_command(self, nlp_command: str, session_id: str) -> Dict[str, Any]:
        """Process the extracted NLP command"""
        command_lower = nlp_command.lower().strip()

        # Handle special commands first
        for special_cmd, handler in self.special_commands.items():
            if command_lower.startswith(special_cmd):
                return handler(nlp_command, session_id)

        # Handle batch commands (multiple commands separated by semicolon or "and then")
        if ';' in nlp_command or 'and then' in nlp_command.lower():
            return self._process_batch_command(nlp_command, session_id)

        # Handle single NLP command
        return self._process_single_command(nlp_command, session_id)

    def _process_single_command(self, nlp_command: str, session_id: str) -> Dict[str, Any]:
        """Process a single NLP command"""
        # Parse natural language to structured command
        parse_result = self.nlp_processor.process_command(nlp_command)

        # Robust validation: ensure parse_result exists and is valid
        if parse_result is None:
            return {
                'success': False,
                'error': 'NLP processor returned no result',
                'suggestions': ['Check if the command syntax is correct', 'Try rephrasing the command'],
                'type': 'parse_error'
            }

        if not isinstance(parse_result, dict):
            return {
                'success': False,
                'error': f'NLP processor returned invalid result type: {type(parse_result)}',
                'suggestions': ['Try a simpler command format'],
                'type': 'parse_error'
            }

        if not parse_result.get('success', False):
            return {
                'success': False,
                'error': parse_result.get('error', 'Failed to parse command'),
                'suggestions': parse_result.get('suggestions', []),
                'type': 'parse_error'
            }

        # Execute the structured command
        execution_result = self.task_executor.execute_command(parse_result['command'])

        return {
            'success': execution_result['success'],
            'type': 'single_command',
            'parsed_command': parse_result['command'],
            'execution_result': execution_result,
            'confidence': parse_result.get('confidence', 0),
            'natural_input': nlp_command
        }

    def _process_batch_command(self, nlp_command: str, session_id: str) -> Dict[str, Any]:
        """Process multiple commands in a batch"""
        # Split commands
        if ';' in nlp_command:
            commands = [cmd.strip() for cmd in nlp_command.split(';')]
        else:
            commands = [cmd.strip() for cmd in re.split(r'\s+and\s+then\s+', nlp_command, flags=re.IGNORECASE)]

        # Execute batch
        batch_result = self.batch_manager.execute_natural_language_batch(commands, 'sequential')

        return {
            'success': batch_result['success'],
            'type': 'batch_command',
            'commands': commands,
            'execution_result': batch_result,
            'natural_input': nlp_command
        }

    def _show_help(self, command: str, session_id: str) -> Dict[str, Any]:
        """Show help information"""
        help_data = {
            'success': True,
            'type': 'help',
            'content': {
                'title': '🧠 Cometa Brain Natural Language Interface',
                'triggers': [
                    'cometa: [command]',
                    '@cometa [command]',
                    'brain: [command]',
                    'task: [command]',
                    'project: [command]'
                ],
                'task_commands': [
                    'create task for [description]',
                    'list active tasks',
                    'complete task [name]',
                    'update task [name] to [status]',
                    'search tasks about [keyword]'
                ],
                'project_commands': [
                    'project status',
                    'switch to project [name]'
                ],
                'system_commands': [
                    'show metrics',
                    'progress summary',
                    'help',
                    'examples'
                ],
                'batch_commands': [
                    'create task for auth; list active tasks',
                    'complete task login and then show metrics'
                ]
            }
        }

        return help_data

    def _show_status(self, command: str, session_id: str) -> Dict[str, Any]:
        """Show current status"""
        try:
            # Get system status
            system_result = self.task_executor.execute_command({
                'intent': 'system.status',
                'action': {'type': 'system', 'operation': 'status'}
            })

            # Get project status
            project_result = self.task_executor.execute_command({
                'intent': 'project_management.status',
                'action': {'type': 'project_management', 'operation': 'status'}
            })

            # Get progress summary
            progress_result = self.progress_tracker.get_progress_summary('today')

            return {
                'success': True,
                'type': 'status',
                'system_status': system_result,
                'project_status': project_result,
                'progress_summary': progress_result
            }

        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get status: {str(e)}",
                'type': 'status_error'
            }

    def _show_examples(self, command: str, session_id: str) -> Dict[str, Any]:
        """Show command examples"""
        examples = {
            'success': True,
            'type': 'examples',
            'content': {
                'basic_tasks': [
                    'cometa: create task for user authentication system',
                    'task: list active tasks',
                    'brain: complete task login feature',
                    '@cometa update task authentication to in progress'
                ],
                'project_management': [
                    'project: status',
                    'cometa: switch to project devflow-v2',
                    'brain: show project metrics'
                ],
                'batch_operations': [
                    'cometa: create task for API endpoint; create task for database schema',
                    'task: list pending tasks and then show progress summary',
                    'brain: complete task auth; complete task validation; show metrics'
                ],
                'progress_tracking': [
                    'cometa: show progress summary',
                    'brain: productivity insights',
                    'task: track activity for task 123'
                ]
            }
        }

        return examples

    def _show_metrics(self, command: str, session_id: str) -> Dict[str, Any]:
        """Show system metrics"""
        try:
            # Get system metrics
            metrics_result = self.task_executor.execute_command({
                'intent': 'system.metrics',
                'action': {
                    'type': 'system',
                    'operation': 'metrics',
                    'parameters': {'scope': 'all'}
                }
            })

            # Get progress summary
            progress_result = self.progress_tracker.get_progress_summary('week')

            return {
                'success': True,
                'type': 'metrics',
                'system_metrics': metrics_result,
                'progress_summary': progress_result
            }

        except Exception as e:
            return {
                'success': False,
                'error': f"Failed to get metrics: {str(e)}",
                'type': 'metrics_error'
            }

    def _format_claude_output(self, result: Dict[str, Any], nlp_command: str) -> str:
        """Format result for Claude output"""
        # Robust validation: ensure result exists and is valid
        if result is None:
            return f"❌ **Command Failed**: {nlp_command}\n**Error**: Internal processing error - no result returned\n"

        if not isinstance(result, dict):
            return f"❌ **Command Failed**: {nlp_command}\n**Error**: Internal processing error - invalid result type: {type(result)}\n"

        if not result.get('success', False):
            output = f"❌ **Command Failed**: {nlp_command}\n"
            output += f"**Error**: {result.get('error', 'Unknown error')}\n"

            if result.get('suggestions'):
                output += "\n**Suggestions**:\n"
                for suggestion in result['suggestions']:
                    output += f"- {suggestion}\n"

            return output

        result_type = result.get('type', 'unknown')

        if result_type == 'single_command':
            return self._format_single_command_output(result)
        elif result_type == 'batch_command':
            return self._format_batch_command_output(result)
        elif result_type == 'help':
            return self._format_help_output(result)
        elif result_type == 'status':
            return self._format_status_output(result)
        elif result_type == 'examples':
            return self._format_examples_output(result)
        elif result_type == 'metrics':
            return self._format_metrics_output(result)
        else:
            return f"✅ **Command executed**: {nlp_command}\n\n{json.dumps(result, indent=2)}"

    def _format_single_command_output(self, result: Dict[str, Any]) -> str:
        """Format single command output"""
        execution_result = result.get('execution_result')

        # Robust validation: ensure execution_result exists and is valid
        if execution_result is None:
            return f"✅ **Command completed** (no detailed results available)\n"

        if not isinstance(execution_result, dict):
            return f"✅ **Command completed** (result format: {type(execution_result)})\n"

        output = f"✅ **Command completed successfully**\n\n"

        if execution_result.get('message'):
            output += f"**Result**: {execution_result['message']}\n"

        if execution_result.get('data'):
            data = execution_result['data']

            if 'tasks' in data:
                output += f"\n**Tasks** ({len(data['tasks'])} found):\n"
                for task in data['tasks'][:5]:  # Show first 5
                    status_emoji = {'pending': '⏳', 'in_progress': '🔄', 'completed': '✅', 'blocked': '🚫'}.get(task.get('status', ''), '📋')
                    output += f"{status_emoji} {task.get('priority', 'm-')}{task.get('title', 'Untitled')} ({task.get('status', 'unknown')})\n"

                if len(data['tasks']) > 5:
                    output += f"... and {len(data['tasks']) - 5} more\n"

            elif 'task' in data:
                task = data['task']

                # Robust null handling: ensure task is valid dict
                if task is None or not isinstance(task, dict):
                    output += f"\n**Task**: 📋 Task information not available\n"
                    output += f"**Status**: unknown\n"
                    output += f"**Priority**: m-\n"
                else:
                    status_emoji = {'pending': '⏳', 'in_progress': '🔄', 'completed': '✅', 'blocked': '🚫'}.get(task.get('status', ''), '📋')
                    output += f"\n**Task**: {status_emoji} {task.get('title', 'Untitled')}\n"
                    output += f"**Status**: {task.get('status', 'unknown')}\n"
                    output += f"**Priority**: {task.get('priority', 'm-')}\n"

        confidence = result.get('confidence', 0)
        if confidence < 0.8:
            output += f"\n*Note: Command interpretation confidence was {confidence:.1%}*"

        return output

    def _format_batch_command_output(self, result: Dict[str, Any]) -> str:
        """Format batch command output"""
        execution_result = result['execution_result']
        commands = result['commands']

        output = f"🚀 **Batch execution completed**\n\n"
        output += f"**Commands executed**: {len(commands)}\n"
        output += f"**Success rate**: {execution_result.get('completed', 0)}/{len(commands)}\n\n"

        if execution_result.get('batch_summary'):
            summary = execution_result['batch_summary']
            output += f"**Summary**: {summary.get('natural_language_summary', 'Batch completed')}\n"

        # Show individual results
        results = execution_result.get('results', [])
        for i, cmd_result in enumerate(results[:3]):  # Show first 3
            cmd_name = commands[i] if i < len(commands) else f"Command {i+1}"
            success_emoji = "✅" if cmd_result['result']['success'] else "❌"
            output += f"\n{success_emoji} **{cmd_name}**"
            if cmd_result['result'].get('message'):
                output += f": {cmd_result['result']['message']}"

        if len(results) > 3:
            output += f"\n... and {len(results) - 3} more commands"

        return output

    def _format_help_output(self, result: Dict[str, Any]) -> str:
        """Format help output"""
        content = result['content']
        output = f"# {content['title']}\n\n"

        output += "## 🎯 **Command Triggers**\n"
        for trigger in content['triggers']:
            output += f"- `{trigger}`\n"

        output += "\n## 📋 **Task Commands**\n"
        for cmd in content['task_commands']:
            output += f"- `{cmd}`\n"

        output += "\n## 📁 **Project Commands**\n"
        for cmd in content['project_commands']:
            output += f"- `{cmd}`\n"

        output += "\n## ⚙️ **System Commands**\n"
        for cmd in content['system_commands']:
            output += f"- `{cmd}`\n"

        output += "\n## 🔄 **Batch Commands**\n"
        for cmd in content['batch_commands']:
            output += f"- `{cmd}`\n"

        return output

    def _format_status_output(self, result: Dict[str, Any]) -> str:
        """Format status output"""
        output = "# 🧠 **Cometa Brain Status**\n\n"

        if result.get('system_status', {}).get('success'):
            output += "## ⚙️ **System Status**\n"
            output += "✅ System operational\n\n"

        if result.get('project_status', {}).get('success'):
            project_data = result['project_status'].get('data', {})
            active_project = project_data.get('active_project')

            output += "## 📁 **Project Status**\n"
            if active_project:
                output += f"**Active Project**: {active_project.get('name', 'Unknown')}\n"
                output += f"**Description**: {active_project.get('description', 'No description')}\n"
            else:
                output += "No active project\n"

            task_summary = project_data.get('task_summary', {})
            if task_summary:
                output += "\n**Task Summary**:\n"
                for status, count in task_summary.items():
                    status_emoji = {'pending': '⏳', 'in_progress': '🔄', 'completed': '✅', 'blocked': '🚫'}.get(status, '📋')
                    output += f"{status_emoji} {status}: {count}\n"

        if result.get('progress_summary', {}).get('success'):
            progress_data = result['progress_summary'].get('data', {})
            if progress_data.get('natural_language_summary'):
                output += f"\n## 📊 **Today's Progress**\n"
                output += f"{progress_data['natural_language_summary']}\n"

        return output

    def _format_examples_output(self, result: Dict[str, Any]) -> str:
        """Format examples output"""
        content = result['content']
        output = "# 📚 **Cometa Brain Command Examples**\n\n"

        output += "## 📋 **Basic Task Management**\n"
        for example in content['basic_tasks']:
            output += f"- `{example}`\n"

        output += "\n## 📁 **Project Management**\n"
        for example in content['project_management']:
            output += f"- `{example}`\n"

        output += "\n## 🔄 **Batch Operations**\n"
        for example in content['batch_operations']:
            output += f"- `{example}`\n"

        output += "\n## 📊 **Progress Tracking**\n"
        for example in content['progress_tracking']:
            output += f"- `{example}`\n"

        return output

    def _format_metrics_output(self, result: Dict[str, Any]) -> str:
        """Format metrics output"""
        output = "# 📊 **System Metrics**\n\n"

        if result.get('system_metrics', {}).get('success'):
            metrics_data = result['system_metrics'].get('data', {}).get('metrics', {})

            if 'task_counts' in metrics_data:
                output += "## 📋 **Task Distribution**\n"
                task_counts = metrics_data['task_counts']
                for status, count in task_counts.items():
                    status_emoji = {'pending': '⏳', 'in_progress': '🔄', 'completed': '✅', 'blocked': '🚫'}.get(status, '📋')
                    output += f"{status_emoji} {status}: {count}\n"

            if 'memory_events' in metrics_data:
                output += f"\n💾 **Memory Events**: {metrics_data['memory_events']}\n"

            if 'pattern_count' in metrics_data:
                output += f"🔍 **Learned Patterns**: {metrics_data['pattern_count']}\n"

        if result.get('progress_summary', {}).get('success'):
            progress_data = result['progress_summary'].get('data', {})
            if progress_data.get('natural_language_summary'):
                output += f"\n## 📈 **Weekly Progress**\n"
                output += f"{progress_data['natural_language_summary']}\n"

        return output

    def _log_nlp_command(self, session_id: str, nlp_command: str, original_prompt: str):
        """Log NLP command for analysis"""
        try:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            log_file = LOG_DIR / f"{session_id}_nlp_commands.json"

            log_entry = {
                'timestamp': datetime.now().isoformat(),
                'session_id': session_id,
                'nlp_command': nlp_command,
                'original_prompt': original_prompt,
                'extracted_by': 'cometa-nlp-hook'
            }

            logs = []
            if log_file.exists():
                with open(log_file, 'r') as f:
                    logs = json.load(f)

            logs.append(log_entry)

            with open(log_file, 'w') as f:
                json.dump(logs, f, indent=2)

        except Exception as e:
            # Don't fail on logging errors
            sys.stderr.write(f"NLP logging error: {e}\n")

def main():
    """Entry point for UserPromptSubmit hook execution (Context7-compliant)"""
    try:
        # DEBUG: Log hook execution
        with open('/Users/fulvioventura/devflow/temp/nlp-hook-debug.log', 'a') as f:
            f.write(f"[{datetime.now().isoformat()}] UserPromptSubmit hook called!\n")

        # Read UserPromptSubmit hook input from stdin
        input_data = json.loads(sys.stdin.read())

        # DEBUG: Log input data
        with open('/Users/fulvioventura/devflow/temp/nlp-hook-debug.log', 'a') as f:
            f.write(f"[{datetime.now().isoformat()}] Input data: {json.dumps(input_data, indent=2)}\n")

        # Validate UserPromptSubmit schema
        if input_data.get('hook_event_name') != 'UserPromptSubmit':
            sys.exit(0)  # Not our hook event

        # Create and process with NLP hook
        nlp_hook = CometaNLPHook(DB_PATH)
        result = nlp_hook.process_hook_input(input_data)

        if result and result.get('success'):
            # NLP command detected and processed - add as additional context
            output_response = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": result['output']
                }
            }
            print(json.dumps(output_response))
        else:
            # No NLP command detected or processing failed - allow prompt to proceed
            pass

        sys.exit(0)

    except json.JSONDecodeError as e:
        sys.stderr.write(f"NLP hook JSON error: {e}\n")
        sys.exit(0)
    except Exception as e:
        # Don't block normal processing on hook errors
        sys.stderr.write(f"NLP hook error: {e}\n")
        sys.exit(0)

if __name__ == "__main__":
    main()