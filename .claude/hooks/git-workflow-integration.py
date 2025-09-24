#!/usr/bin/env python3
"""
Git Workflow Integration Hook - Context7 Implementation
Manages complete Git workflow for project creation and implementation

Features:
- Automatic branch creation for new projects
- Milestone-based commits during development
- Phase-based push strategy
- Final commit and push on project completion
- Integration with natural language project creation
- Coordination with project implementation monitor
"""

import sys
import os
import json
import re
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import PostToolUseHook, HookDecision

class GitWorkflowIntegrationHook(PostToolUseHook):
    """Context7-compliant hook for Git workflow integration"""

    def __init__(self):
        super().__init__("git-workflow-integration")
        self.project_root = Path("/Users/fulvioventura/devflow")
        self.db_path = self.project_root / "data" / "devflow_unified.sqlite"
        self.current_task_file = self.project_root / ".claude" / "state" / "current_task.json"
        self.git_state_file = self.project_root / ".claude" / "state" / "git-workflow-state.json"

        # Git workflow configuration
        self.milestone_triggers = [
            # Phase completions
            r"(?i)(phase.*complete|milestone.*reached|sprint.*done)",
            # Feature completions
            r"(?i)(feature.*implemented|component.*finished|module.*complete)",
            # Major changes
            r"(?i)(architecture.*updated|database.*migrated|api.*implemented)",
            # Testing milestones
            r"(?i)(tests.*passing|coverage.*improved|integration.*successful)"
        ]

        # Tools that should trigger Git operations
        self.git_trigger_tools = [
            "Write", "Edit", "MultiEdit", "Bash",
            "mcp__devflow-synthetic-cc-sessions__synthetic_code_to_file",
            "mcp__devflow-synthetic-cc-sessions__synthetic_auto_file",
            "Task"
        ]

    def validate_input(self) -> bool:
        """Validate PostToolUse input"""
        if not super().validate_input():
            return False

        tool_name = self.input_data.get("tool_name")
        if tool_name not in self.git_trigger_tools:
            return False

        return True

    def execute_logic(self) -> None:
        """Main Git workflow logic"""
        try:
            tool_name = self.input_data.get("tool_name")
            tool_input = self.input_data.get("tool_input", {})
            tool_output = self.input_data.get("tool_output", {})

            # Get current task context
            current_task = self._get_current_task()
            if not current_task:
                return

            # Load Git workflow state
            git_state = self._load_git_state()

            # Analyze tool execution for Git triggers
            git_analysis = self._analyze_git_triggers(tool_name, tool_input, tool_output, current_task)

            if git_analysis:
                # Handle different Git workflow events
                if git_analysis.get('should_create_branch'):
                    self._handle_branch_creation(git_analysis, git_state, current_task)

                if git_analysis.get('should_commit'):
                    self._handle_milestone_commit(git_analysis, git_state, current_task)

                if git_analysis.get('should_push'):
                    self._handle_phase_push(git_analysis, git_state, current_task)

                if git_analysis.get('should_complete'):
                    self._handle_project_completion(git_analysis, git_state, current_task)

                # Update Git workflow state
                self._save_git_state(git_state)

                # Send Git workflow notifications
                if git_analysis.get('notifications'):
                    self._send_git_notifications(git_analysis['notifications'], current_task)

        except Exception as e:
            self.logger.error(f"Git workflow integration failed: {e}")

    def _get_current_task(self) -> Optional[Dict[str, Any]]:
        """Get current active task with project context"""
        try:
            if self.current_task_file.exists():
                with open(self.current_task_file, 'r') as f:
                    task_data = json.load(f)

                # Enrich with database information if available
                task_id = task_data.get('id')
                if task_id and self.db_path.exists():
                    import sqlite3
                    with sqlite3.connect(str(self.db_path)) as conn:
                        conn.row_factory = sqlite3.Row
                        result = conn.execute("""
                            SELECT t.*, p.name as project_name, p.description as project_description,
                                   pl.name as plan_name, pl.description as plan_description
                            FROM tasks t
                            LEFT JOIN projects p ON t.project_id = p.id
                            LEFT JOIN plans pl ON t.plan_id = pl.id
                            WHERE t.id = ?
                        """, (task_id,)).fetchone()

                        if result:
                            task_data.update(dict(result))

                return task_data

        except Exception as e:
            self.logger.error(f"Failed to get current task: {e}")
        return None

    def _analyze_git_triggers(self, tool_name: str, tool_input: Dict, tool_output: Dict, task: Dict) -> Optional[Dict[str, Any]]:
        """Analyze tool execution for Git workflow triggers"""
        analysis = {
            'tool_name': tool_name,
            'timestamp': datetime.now().isoformat(),
            'task_id': task.get('id'),
            'project_id': task.get('project_id'),
            'notifications': []
        }

        try:
            # Check for branch creation triggers
            if self._should_create_project_branch(tool_name, tool_input, task):
                analysis['should_create_branch'] = True
                analysis['branch_name'] = self._generate_branch_name(task)

            # Check for milestone commit triggers
            if self._should_commit_milestone(tool_name, tool_input, tool_output, task):
                analysis['should_commit'] = True
                analysis['commit_message'] = self._generate_commit_message(tool_name, tool_input, task)
                analysis['commit_type'] = self._determine_commit_type(tool_name, tool_input)

            # Check for phase push triggers
            if self._should_push_phase(tool_name, tool_input, task):
                analysis['should_push'] = True
                analysis['push_reason'] = self._determine_push_reason(tool_name, tool_input, task)

            # Check for project completion triggers
            if self._should_complete_project(tool_name, tool_input, task):
                analysis['should_complete'] = True
                analysis['completion_message'] = self._generate_completion_message(task)

            return analysis if any(analysis.get(key) for key in ['should_create_branch', 'should_commit', 'should_push', 'should_complete']) else None

        except Exception as e:
            self.logger.error(f"Git trigger analysis failed: {e}")
            return None

    def _should_create_project_branch(self, tool_name: str, tool_input: Dict, task: Dict) -> bool:
        """Check if we should create a new project branch"""
        # Create branch when starting a new project (first significant file operation)
        if not self._project_branch_exists(task):
            # Check if this is a significant project file operation
            if tool_name in ["Write", "Edit"] and tool_input.get('file_path'):
                file_path = tool_input['file_path']
                # Skip temporary or config files
                if not any(skip in file_path.lower() for skip in ['.tmp', '.log', '.cache', '__pycache__']):
                    return True
        return False

    def _should_commit_milestone(self, tool_name: str, tool_input: Dict, tool_output: Dict, task: Dict) -> bool:
        """Check if we should create a milestone commit"""
        # Commit on significant file changes
        if tool_name in ["Write", "Edit", "MultiEdit"]:
            file_path = tool_input.get('file_path', '')
            content = tool_input.get('content', '') or tool_input.get('new_string', '')

            # Commit criteria
            if len(content) > 100:  # Significant content
                return True

            if any(pattern in file_path for pattern in ['.py', '.js', '.ts', '.java', '.go']):  # Code files
                return True

        # Commit on successful synthetic operations
        elif tool_name.startswith("mcp__devflow-synthetic"):
            if not tool_output.get('error'):
                return True

        # Commit on successful task completions
        elif tool_name == "Task":
            return True

        return False

    def _should_push_phase(self, tool_name: str, tool_input: Dict, task: Dict) -> bool:
        """Check if we should push current phase"""
        # Push on phase completion indicators
        prompt = tool_input.get('prompt', '') or tool_input.get('description', '')

        for trigger in self.milestone_triggers:
            if re.search(trigger, prompt):
                return True

        # Push every 5 commits (periodic backup)
        git_state = self._load_git_state()
        commits_since_push = git_state.get('commits_since_push', 0)

        return commits_since_push >= 5

    def _should_complete_project(self, tool_name: str, tool_input: Dict, task: Dict) -> bool:
        """Check if project should be completed"""
        # Check for completion indicators
        prompt = tool_input.get('prompt', '') or tool_input.get('description', '')
        completion_patterns = [
            r"(?i)(project.*complete|task.*done|implementation.*finished)",
            r"(?i)(ready.*deployment|final.*commit|project.*ready)",
            r"(?i)(wrap.*up|close.*task|mark.*complete)"
        ]

        return any(re.search(pattern, prompt) for pattern in completion_patterns)

    def _handle_branch_creation(self, analysis: Dict, git_state: Dict, task: Dict) -> None:
        """Handle project branch creation"""
        try:
            branch_name = analysis['branch_name']

            # Create and switch to new branch
            result = self._run_git_command(['checkout', '-b', branch_name])

            if result['success']:
                # Update Git state
                git_state.update({
                    'current_branch': branch_name,
                    'branch_created_at': datetime.now().isoformat(),
                    'project_id': task.get('project_id'),
                    'task_id': task.get('id'),
                    'commits_count': 0,
                    'commits_since_push': 0
                })

                analysis['notifications'].append({
                    'type': 'branch_created',
                    'message': f"✅ Git branch `{branch_name}` created and active",
                    'branch_name': branch_name
                })

                self.logger.info(f"Created project branch: {branch_name}")
            else:
                analysis['notifications'].append({
                    'type': 'branch_error',
                    'message': f"❌ Failed to create branch `{branch_name}`: {result.get('error', 'Unknown error')}",
                    'branch_name': branch_name
                })

        except Exception as e:
            self.logger.error(f"Branch creation failed: {e}")

    def _handle_milestone_commit(self, analysis: Dict, git_state: Dict, task: Dict) -> None:
        """Handle milestone-based commits"""
        try:
            commit_message = analysis['commit_message']

            # Add all changes
            add_result = self._run_git_command(['add', '.'])

            if add_result['success']:
                # Create commit
                commit_result = self._run_git_command(['commit', '-m', commit_message])

                if commit_result['success']:
                    # Update Git state
                    git_state['commits_count'] = git_state.get('commits_count', 0) + 1
                    git_state['commits_since_push'] = git_state.get('commits_since_push', 0) + 1
                    git_state['last_commit_at'] = datetime.now().isoformat()
                    git_state['last_commit_message'] = commit_message

                    analysis['notifications'].append({
                        'type': 'commit_created',
                        'message': f"📝 Commit created: {commit_message[:50]}{'...' if len(commit_message) > 50 else ''}",
                        'commit_message': commit_message,
                        'commit_count': git_state['commits_count']
                    })

                    self.logger.info(f"Created milestone commit: {commit_message}")
                else:
                    analysis['notifications'].append({
                        'type': 'commit_error',
                        'message': f"❌ Commit failed: {commit_result.get('error', 'Unknown error')}"
                    })
            else:
                self.logger.warning("Git add failed, skipping commit")

        except Exception as e:
            self.logger.error(f"Milestone commit failed: {e}")

    def _handle_phase_push(self, analysis: Dict, git_state: Dict, task: Dict) -> None:
        """Handle phase-based pushes"""
        try:
            push_reason = analysis.get('push_reason', 'milestone push')
            current_branch = git_state.get('current_branch')

            if not current_branch:
                return

            # Push current branch
            push_result = self._run_git_command(['push', 'origin', current_branch])

            if push_result['success']:
                # Reset push counter
                git_state['commits_since_push'] = 0
                git_state['last_push_at'] = datetime.now().isoformat()
                git_state['push_count'] = git_state.get('push_count', 0) + 1

                analysis['notifications'].append({
                    'type': 'phase_pushed',
                    'message': f"🚀 Phase pushed to GitHub: {push_reason}",
                    'branch': current_branch,
                    'push_count': git_state['push_count']
                })

                self.logger.info(f"Pushed phase to GitHub: {current_branch}")
            else:
                analysis['notifications'].append({
                    'type': 'push_error',
                    'message': f"❌ Push failed: {push_result.get('error', 'Unknown error')}"
                })

        except Exception as e:
            self.logger.error(f"Phase push failed: {e}")

    def _handle_project_completion(self, analysis: Dict, git_state: Dict, task: Dict) -> None:
        """Handle project completion workflow"""
        try:
            completion_message = analysis['completion_message']
            current_branch = git_state.get('current_branch')

            if not current_branch:
                return

            # Final commit if there are changes
            status_result = self._run_git_command(['status', '--porcelain'])
            if status_result['success'] and status_result.get('output', '').strip():
                # Add and commit final changes
                self._run_git_command(['add', '.'])
                final_commit_result = self._run_git_command(['commit', '-m', completion_message])

                if final_commit_result['success']:
                    git_state['commits_count'] = git_state.get('commits_count', 0) + 1

            # Final push
            push_result = self._run_git_command(['push', 'origin', current_branch])

            if push_result['success']:
                # Mark project as completed in Git state
                git_state.update({
                    'project_completed': True,
                    'completed_at': datetime.now().isoformat(),
                    'completion_commit': completion_message,
                    'final_push_successful': True
                })

                analysis['notifications'].append({
                    'type': 'project_completed',
                    'message': f"🎉 Project completed and pushed to GitHub!\n📝 Final commit: {completion_message}\n🌟 Branch: `{current_branch}` ready for PR",
                    'branch': current_branch,
                    'total_commits': git_state['commits_count']
                })

                self.logger.info(f"Project completed: {current_branch}")
            else:
                analysis['notifications'].append({
                    'type': 'completion_error',
                    'message': f"❌ Final push failed: {push_result.get('error', 'Unknown error')}"
                })

        except Exception as e:
            self.logger.error(f"Project completion failed: {e}")

    # Helper methods for Git operations
    def _run_git_command(self, args: List[str]) -> Dict[str, Any]:
        """Run a git command and return result"""
        try:
            result = subprocess.run(
                ['git'] + args,
                cwd=str(self.project_root),
                capture_output=True,
                text=True,
                timeout=30
            )

            return {
                'success': result.returncode == 0,
                'output': result.stdout.strip(),
                'error': result.stderr.strip(),
                'returncode': result.returncode
            }
        except subprocess.TimeoutExpired:
            return {'success': False, 'error': 'Git command timeout'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _generate_branch_name(self, task: Dict) -> str:
        """Generate branch name for project"""
        project_name = task.get('project_name', '').lower()
        task_name = task.get('title', '').lower()

        # Clean up name for Git branch
        if project_name:
            branch_base = re.sub(r'[^a-z0-9\-]', '-', project_name)
        else:
            branch_base = re.sub(r'[^a-z0-9\-]', '-', task_name)

        # Remove consecutive hyphens and trim
        branch_base = re.sub(r'-+', '-', branch_base).strip('-')

        # Add feature prefix and timestamp for uniqueness
        timestamp = datetime.now().strftime('%m%d')
        return f"feature/{branch_base}-{timestamp}"

    def _generate_commit_message(self, tool_name: str, tool_input: Dict, task: Dict) -> str:
        """Generate commit message based on changes"""
        project_name = task.get('project_name', 'project').replace('-', ' ').title()

        if tool_name in ["Write", "Edit", "MultiEdit"]:
            file_path = tool_input.get('file_path', '')
            if file_path:
                file_name = Path(file_path).name
                return f"feat: Update {file_name} for {project_name}"
            else:
                return f"feat: Update files for {project_name}"

        elif tool_name.startswith("mcp__devflow-synthetic"):
            objective = tool_input.get('objective', 'implementation')
            return f"feat: {objective.capitalize()} for {project_name}"

        elif tool_name == "Task":
            description = tool_input.get('description', 'task completion')
            return f"feat: {description.capitalize()} for {project_name}"

        else:
            return f"feat: Progress update for {project_name}"

    def _determine_commit_type(self, tool_name: str, tool_input: Dict) -> str:
        """Determine commit type for conventional commits"""
        if tool_name in ["Write", "Edit", "MultiEdit"]:
            return "feat"
        elif tool_name.startswith("mcp__devflow-synthetic"):
            return "feat"
        elif "test" in tool_input.get('file_path', '').lower():
            return "test"
        elif "doc" in tool_input.get('file_path', '').lower():
            return "docs"
        else:
            return "feat"

    def _determine_push_reason(self, tool_name: str, tool_input: Dict, task: Dict) -> str:
        """Determine reason for phase push"""
        prompt = tool_input.get('prompt', '') or tool_input.get('description', '')

        for trigger in self.milestone_triggers:
            if re.search(trigger, prompt):
                return f"milestone reached: {prompt[:50]}"

        return "periodic backup"

    def _generate_completion_message(self, task: Dict) -> str:
        """Generate final completion commit message"""
        project_name = task.get('project_name', 'project').replace('-', ' ').title()
        return f"🎉 Complete {project_name} implementation\n\nFinal implementation ready for review and deployment.\n\n🤖 Generated with Claude Code\n\nCo-Authored-By: Claude <noreply@anthropic.com>"

    def _project_branch_exists(self, task: Dict) -> bool:
        """Check if project branch already exists"""
        git_state = self._load_git_state()
        return bool(git_state.get('current_branch') and git_state.get('project_id') == task.get('project_id'))

    def _send_git_notifications(self, notifications: List[Dict], task: Dict) -> None:
        """Send Git workflow notifications"""
        if not notifications:
            return

        notification_message = "\n[🔄 GIT WORKFLOW]\n"

        for notification in notifications:
            notification_message += f"{notification['message']}\n"

        notification_message += f"\nProject: {task.get('project_name', 'Unknown')}\n"

        self.response.hook_specific_output = {
            "hookEventName": "PostToolUse",
            "additionalContext": notification_message
        }

    def _load_git_state(self) -> Dict[str, Any]:
        """Load Git workflow state"""
        try:
            if self.git_state_file.exists():
                with open(self.git_state_file, 'r') as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def _save_git_state(self, state: Dict[str, Any]) -> None:
        """Save Git workflow state"""
        try:
            self.git_state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.git_state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save Git state: {e}")

if __name__ == "__main__":
    hook = GitWorkflowIntegrationHook()
    sys.exit(hook.run())