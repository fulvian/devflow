#!/usr/bin/env python3
"""
Cometa Brain Batch Operations Manager
Executes multiple commands in sequence, parallel, or conditional modes
"""

import json
import sys
import asyncio
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from cometa_nlp_processor import NaturalLanguageCommandProcessor
from cometa_task_executor import TaskCommandExecutor

DB_PATH = Path('./data/devflow_unified.sqlite')

class BatchOperationsManager:
    """Manages batch execution of natural language commands"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.nlp_processor = NaturalLanguageCommandProcessor(db_path)
        self.task_executor = TaskCommandExecutor(db_path)

    def execute_batch(self, batch_request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a batch of commands based on execution mode

        Args:
            batch_request: Batch configuration with commands and execution settings

        Returns:
            Batch execution results with success status and individual results
        """
        try:
            commands = batch_request.get('commands', [])
            execution_mode = batch_request.get('execution_mode', 'sequential')
            rollback_on_error = batch_request.get('rollback_on_error', False)
            conditions = batch_request.get('conditions', [])

            if not commands:
                return self._error_response("No commands provided for batch execution")

            # Start batch execution
            batch_id = self._generate_batch_id()
            start_time = time.time()

            batch_context = {
                'batch_id': batch_id,
                'start_time': start_time,
                'execution_mode': execution_mode,
                'rollback_on_error': rollback_on_error,
                'total_commands': len(commands),
                'results': [],
                'errors': [],
                'completed_count': 0,
                'failed_count': 0
            }

            if execution_mode == 'sequential':
                result = self._execute_sequential(commands, batch_context)
            elif execution_mode == 'parallel':
                result = self._execute_parallel(commands, batch_context)
            elif execution_mode == 'conditional':
                result = self._execute_conditional(commands, conditions, batch_context)
            else:
                return self._error_response(f"Unknown execution mode: {execution_mode}")

            # Add batch summary
            result['batch_summary'] = self._create_batch_summary(batch_context)
            result['execution_time_ms'] = (time.time() - start_time) * 1000

            return result

        except Exception as e:
            return self._error_response(f"Batch execution failed: {str(e)}")

    def execute_natural_language_batch(self, nl_commands: List[str], execution_mode: str = 'sequential') -> Dict[str, Any]:
        """
        Execute a batch of natural language commands

        Args:
            nl_commands: List of natural language command strings
            execution_mode: 'sequential', 'parallel', or 'conditional'

        Returns:
            Batch execution results
        """
        # Convert natural language to structured commands
        structured_commands = []

        for nl_command in nl_commands:
            nl_result = self.nlp_processor.process_command(nl_command)

            if nl_result['success']:
                structured_commands.append(nl_result['command'])
            else:
                # Return early if any command fails to parse
                return {
                    'success': False,
                    'error': f"Failed to parse command: '{nl_command}' - {nl_result.get('error', 'Unknown error')}",
                    'failed_command': nl_command
                }

        # Execute structured batch
        batch_request = {
            'commands': structured_commands,
            'execution_mode': execution_mode,
            'rollback_on_error': True  # Default to safe execution
        }

        return self.execute_batch(batch_request)

    def _execute_sequential(self, commands: List[Dict[str, Any]], batch_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute commands sequentially"""
        results = []
        should_continue = True

        for idx, command in enumerate(commands):
            if not should_continue:
                break

            print(f"🔄 Executing command {idx + 1}/{len(commands)}: {command.get('intent', 'unknown')}")

            result = self._execute_single_command(command, batch_context)
            results.append({
                'command_index': idx,
                'command': command,
                'result': result,
                'executed_at': datetime.now().isoformat()
            })

            if result['success']:
                batch_context['completed_count'] += 1
                print(f"✅ Command {idx + 1} completed successfully")
            else:
                batch_context['failed_count'] += 1
                batch_context['errors'].append({
                    'command_index': idx,
                    'error': result.get('error', 'Unknown error')
                })
                print(f"❌ Command {idx + 1} failed: {result.get('error', 'Unknown error')}")

                if batch_context['rollback_on_error']:
                    print("🔄 Rollback enabled - stopping execution")
                    should_continue = False
                    # TODO: Implement actual rollback logic

        batch_context['results'] = results

        return {
            'success': batch_context['failed_count'] == 0,
            'execution_mode': 'sequential',
            'results': results,
            'completed': batch_context['completed_count'],
            'failed': batch_context['failed_count'],
            'errors': batch_context['errors']
        }

    def _execute_parallel(self, commands: List[Dict[str, Any]], batch_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute commands in parallel"""
        results = []

        print(f"🚀 Executing {len(commands)} commands in parallel")

        with ThreadPoolExecutor(max_workers=min(len(commands), 5)) as executor:
            # Submit all commands
            future_to_command = {
                executor.submit(self._execute_single_command, command, batch_context): (idx, command)
                for idx, command in enumerate(commands)
            }

            # Collect results as they complete
            for future in as_completed(future_to_command):
                idx, command = future_to_command[future]

                try:
                    result = future.result()
                    results.append({
                        'command_index': idx,
                        'command': command,
                        'result': result,
                        'executed_at': datetime.now().isoformat()
                    })

                    if result['success']:
                        batch_context['completed_count'] += 1
                        print(f"✅ Command {idx + 1} completed successfully")
                    else:
                        batch_context['failed_count'] += 1
                        batch_context['errors'].append({
                            'command_index': idx,
                            'error': result.get('error', 'Unknown error')
                        })
                        print(f"❌ Command {idx + 1} failed: {result.get('error', 'Unknown error')}")

                except Exception as e:
                    batch_context['failed_count'] += 1
                    batch_context['errors'].append({
                        'command_index': idx,
                        'error': f"Execution exception: {str(e)}"
                    })
                    print(f"❌ Command {idx + 1} failed with exception: {str(e)}")

        # Sort results by command index
        results.sort(key=lambda x: x['command_index'])
        batch_context['results'] = results

        return {
            'success': batch_context['failed_count'] == 0,
            'execution_mode': 'parallel',
            'results': results,
            'completed': batch_context['completed_count'],
            'failed': batch_context['failed_count'],
            'errors': batch_context['errors']
        }

    def _execute_conditional(self, commands: List[Dict[str, Any]], conditions: List[Dict[str, Any]], batch_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute commands based on conditions"""
        results = []
        context_vars = {}  # Store variables for condition evaluation

        print(f"🎯 Executing {len(commands)} commands with conditional logic")

        for idx, command in enumerate(commands):
            # Check if this command has associated conditions
            command_conditions = [c for c in conditions if c.get('command_index') == idx]

            should_execute = True
            condition_results = []

            for condition in command_conditions:
                condition_result = self._evaluate_condition(condition, context_vars, batch_context)
                condition_results.append(condition_result)

                if not condition_result['passed']:
                    should_execute = False
                    print(f"⏭️ Skipping command {idx + 1}: condition failed - {condition_result['reason']}")

            if should_execute:
                print(f"🔄 Executing command {idx + 1}: {command.get('intent', 'unknown')}")
                result = self._execute_single_command(command, batch_context)

                # Update context variables with result
                if result['success']:
                    context_vars[f"command_{idx}_result"] = result
                    batch_context['completed_count'] += 1
                    print(f"✅ Command {idx + 1} completed successfully")
                else:
                    batch_context['failed_count'] += 1
                    batch_context['errors'].append({
                        'command_index': idx,
                        'error': result.get('error', 'Unknown error')
                    })
                    print(f"❌ Command {idx + 1} failed: {result.get('error', 'Unknown error')}")
            else:
                result = {
                    'success': True,
                    'skipped': True,
                    'reason': 'Condition not met'
                }

            results.append({
                'command_index': idx,
                'command': command,
                'result': result,
                'conditions': condition_results,
                'executed_at': datetime.now().isoformat()
            })

        batch_context['results'] = results

        return {
            'success': batch_context['failed_count'] == 0,
            'execution_mode': 'conditional',
            'results': results,
            'completed': batch_context['completed_count'],
            'failed': batch_context['failed_count'],
            'errors': batch_context['errors']
        }

    def _execute_single_command(self, command: Dict[str, Any], batch_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single command"""
        try:
            # Add batch context to command
            command['batch_context'] = {
                'batch_id': batch_context['batch_id'],
                'execution_mode': batch_context['execution_mode']
            }

            result = self.task_executor.execute_command(command)
            return result

        except Exception as e:
            return {
                'success': False,
                'error': f"Command execution failed: {str(e)}"
            }

    def _evaluate_condition(self, condition: Dict[str, Any], context_vars: Dict[str, Any], batch_context: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate a condition for conditional execution"""
        condition_expr = condition.get('if', '')

        # Simple condition evaluation (can be extended)
        try:
            if 'previous_success' in condition_expr:
                # Check if previous command succeeded
                prev_idx = condition.get('command_index', 0) - 1
                if prev_idx >= 0:
                    prev_result = context_vars.get(f"command_{prev_idx}_result")
                    passed = prev_result and prev_result.get('success', False)
                else:
                    passed = True  # First command always passes

                return {
                    'passed': passed,
                    'condition': condition_expr,
                    'reason': 'Previous command success check'
                }

            elif 'task_count' in condition_expr:
                # Check task count conditions
                if 'completed' in condition_expr:
                    passed = batch_context['completed_count'] > 0
                    return {
                        'passed': passed,
                        'condition': condition_expr,
                        'reason': f"Completed tasks: {batch_context['completed_count']}"
                    }

            # Default: always pass unknown conditions
            return {
                'passed': True,
                'condition': condition_expr,
                'reason': 'Unknown condition - defaulting to pass'
            }

        except Exception as e:
            return {
                'passed': False,
                'condition': condition_expr,
                'reason': f"Condition evaluation error: {str(e)}"
            }

    def _generate_batch_id(self) -> str:
        """Generate unique batch ID"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"batch_{timestamp}"

    def _create_batch_summary(self, batch_context: Dict[str, Any]) -> Dict[str, Any]:
        """Create batch execution summary"""
        total = batch_context['total_commands']
        completed = batch_context['completed_count']
        failed = batch_context['failed_count']

        success_rate = (completed / total) if total > 0 else 0

        summary = {
            'batch_id': batch_context['batch_id'],
            'execution_mode': batch_context['execution_mode'],
            'total_commands': total,
            'completed': completed,
            'failed': failed,
            'success_rate': success_rate,
            'status': 'success' if failed == 0 else 'partial' if completed > 0 else 'failed',
            'natural_language_summary': self._create_nl_batch_summary(batch_context)
        }

        return summary

    def _create_nl_batch_summary(self, batch_context: Dict[str, Any]) -> str:
        """Create natural language summary of batch execution"""
        total = batch_context['total_commands']
        completed = batch_context['completed_count']
        failed = batch_context['failed_count']
        mode = batch_context['execution_mode']

        summary = f"📋 Batch execution ({mode} mode): {completed}/{total} commands completed successfully."

        if failed > 0:
            summary += f" {failed} command(s) failed."
        else:
            summary += " All commands executed successfully! 🎉"

        return summary

    def _error_response(self, message: str) -> Dict[str, Any]:
        """Create standardized error response"""
        return {
            'success': False,
            'error': message,
            'batch_id': None,
            'results': []
        }

    # Pre-defined batch operations

    def create_task_workflow(self, workflow_name: str, task_descriptions: List[str]) -> Dict[str, Any]:
        """Create a workflow of related tasks"""
        nl_commands = [f"create task for {desc}" for desc in task_descriptions]

        # Add workflow metadata to first command
        nl_commands[0] += f" (workflow: {workflow_name})"

        return self.execute_natural_language_batch(nl_commands, 'sequential')

    def bulk_task_update(self, task_identifiers: List[str], update_properties: Dict[str, Any]) -> Dict[str, Any]:
        """Update multiple tasks with same properties"""
        nl_commands = []

        for task_id in task_identifiers:
            if update_properties.get('status'):
                if update_properties['status'] == 'completed':
                    nl_commands.append(f"complete task {task_id}")
                else:
                    nl_commands.append(f"update task {task_id} to {update_properties['status']}")
            elif update_properties.get('priority'):
                nl_commands.append(f"set task {task_id} priority to {update_properties['priority']}")

        return self.execute_natural_language_batch(nl_commands, 'parallel')

    def daily_task_routine(self) -> Dict[str, Any]:
        """Execute daily task management routine"""
        routine_commands = [
            "show metrics",
            "list active tasks",
            "list high priority tasks",
            "project status"
        ]

        return self.execute_natural_language_batch(routine_commands, 'sequential')

def main():
    """Entry point for CLI testing"""
    if len(sys.argv) < 2:
        print("Usage: python cometa-batch-manager.py [execute|workflow|routine] [args...]")
        sys.exit(1)

    manager = BatchOperationsManager(DB_PATH)
    command = sys.argv[1]

    if command == 'execute':
        if len(sys.argv) < 3:
            print("Error: JSON batch request required")
            sys.exit(1)

        try:
            batch_request = json.loads(sys.argv[2])
            result = manager.execute_batch(batch_request)
        except json.JSONDecodeError:
            print("Error: Invalid JSON batch request")
            sys.exit(1)

    elif command == 'workflow':
        if len(sys.argv) < 4:
            print("Error: workflow_name and task_descriptions required")
            sys.exit(1)

        workflow_name = sys.argv[2]
        task_descriptions = sys.argv[3].split(',')
        result = manager.create_task_workflow(workflow_name, task_descriptions)

    elif command == 'routine':
        result = manager.daily_task_routine()

    elif command == 'nl_batch':
        if len(sys.argv) < 3:
            print("Error: comma-separated commands required")
            sys.exit(1)

        commands = sys.argv[2].split(',')
        execution_mode = sys.argv[3] if len(sys.argv) > 3 else 'sequential'
        result = manager.execute_natural_language_batch(commands, execution_mode)

    else:
        print(f"Error: Unknown command '{command}'")
        sys.exit(1)

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()