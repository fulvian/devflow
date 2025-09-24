#!/usr/bin/env python3
"""
UserPromptSubmit Hook Context7 - Critical Implementation
Replaces user-messages.py with Context7-compliant architecture

Features:
- DAIC trigger phrase processing and mode switching
- /cometa command detection and processing
- Context injection with security filtering
- Protocol detection and routing
- Token usage monitoring and warnings
- Task detection and creation suggestions
"""

import sys
import os
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import UserPromptSubmitHook, HookDecision

class UserPromptSubmitContext7Hook(UserPromptSubmitHook):
    """Context7-compliant UserPromptSubmit hook with enhanced functionality"""

    def __init__(self):
        super().__init__("user-prompt-submit-context7")
        self.project_root = Path("/Users/fulvioventura/devflow")
        self.config_file = self.project_root / "sessions" / "sessions-config.json"
        self.daic_state_file = self.project_root / ".claude" / "state" / "daic-mode.json"

        # Load configuration
        self.config = self._load_config()

        # Default trigger phrases
        self.default_trigger_phrases = ["make it so", "run that", "yert"]
        self.trigger_phrases = self.config.get("trigger_phrases", self.default_trigger_phrases)

    def validate_input(self) -> bool:
        """Validate UserPromptSubmit input"""
        if not super().validate_input():
            return False

        prompt = self.input_data.get("prompt")
        if not prompt:
            self.logger.warning("No prompt provided in UserPromptSubmit hook")
            return False

        # Log prompt for security analysis
        self.logger.debug(f"Processing prompt: {prompt[:100]}...")
        return True

    def execute_logic(self) -> None:
        """Main logic for UserPromptSubmit processing"""
        try:
            prompt = self.input_data.get("prompt", "")
            transcript_path = self.input_data.get("transcript_path", "")

            context_additions = []

            # 1. Process /cometa commands
            if prompt.strip().startswith('/cometa'):
                context_additions.append(self._process_cometa_command(prompt))

            # 2. Handle API mode and ultrathink injection
            if not self._is_add_trigger_command(prompt):
                context_additions.extend(self._handle_api_mode())

            # 3. Process DAIC mode and triggers
            context_additions.extend(self._process_daic_mode(prompt))

            # 4. Monitor token usage and add warnings
            if transcript_path:
                context_additions.extend(self._monitor_token_usage(transcript_path))

            # 5. Detect protocol triggers
            context_additions.extend(self._detect_protocol_triggers(prompt))

            # 6. Detect potential tasks
            context_additions.extend(self._detect_task_creation(prompt))

            # 7. Security filtering
            filtered_context = self._apply_security_filters(context_additions)

            # 8. Build response
            if filtered_context:
                self.response.metadata.update({
                    'context_injected': True,
                    'context_length': len(''.join(filtered_context)),
                    'processors_triggered': len([c for c in filtered_context if c.strip()])
                })

                # Set hookSpecificOutput for Context7 compliance
                self.response.hook_specific_output = {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": ''.join(filtered_context)
                }

            self.logger.info(f"UserPromptSubmit processed: {len(filtered_context)} context additions")

        except Exception as e:
            self.logger.error(f"UserPromptSubmit processing failed: {e}")
            # Continue execution even if processing fails

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from sessions-config.json"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            self.logger.warning(f"Failed to load config: {e}")
        return {}

    def _process_cometa_command(self, prompt: str) -> str:
        """Process /cometa commands for NLP delegation"""
        try:
            # Extract command after /cometa
            command = prompt.strip()[7:].strip()  # Remove '/cometa '

            if not command:
                return "\n[COMETA] /cometa command detected but no parameters provided. Usage: /cometa <natural language task>\n"

            # Log cometa command for processing
            cometa_log = {
                'timestamp': datetime.now().isoformat(),
                'command': command,
                'session_id': self.input_data.get('session_id'),
                'processed': True
            }

            cometa_log_file = self.project_root / ".claude" / "state" / "cometa-commands.jsonl"
            cometa_log_file.parent.mkdir(parents=True, exist_ok=True)

            with open(cometa_log_file, 'a') as f:
                f.write(json.dumps(cometa_log) + '\n')

            return f"\n[COMETA BRAIN] Processing command: '{command}' - Delegating to natural language task processor\n"

        except Exception as e:
            self.logger.error(f"Cometa command processing failed: {e}")
            return "\n[COMETA ERROR] Failed to process /cometa command\n"

    def _is_add_trigger_command(self, prompt: str) -> bool:
        """Check if this is an /add-trigger command"""
        return prompt.strip().startswith('/add-trigger')

    def _handle_api_mode(self) -> List[str]:
        """Handle API mode and ultrathink injection"""
        context_additions = []

        if not self.config.get("api_mode", False):
            context_additions.append("[[ ultrathink ]]\n")

        return context_additions

    def _process_daic_mode(self, prompt: str) -> List[str]:
        """Process DAIC mode switching and triggers"""
        context_additions = []

        try:
            current_mode = self._check_daic_mode()

            # Implementation triggers (only work in discussion mode)
            if not self._is_add_trigger_command(prompt) and current_mode:
                if any(phrase in prompt.lower() for phrase in self.trigger_phrases):
                    self._set_daic_mode(False)  # Switch to implementation
                    context_additions.append(
                        "[DAIC: Implementation Mode Activated] You may now implement ONLY the immediately discussed steps. "
                        "DO NOT take **any** actions beyond what was explicitly agreed upon. If instructions were vague, "
                        "consider the bounds of what was requested and *DO NOT* cross them. When you're done, run the command: daic\n"
                    )

            # Emergency stop (works in any mode)
            if any(word in prompt for word in ["SILENCE", "STOP"]):  # Case sensitive
                self._set_daic_mode(True)  # Force discussion mode
                context_additions.append(
                    "[DAIC: EMERGENCY STOP] All tools locked. You are now in discussion mode. Re-align with your pair programmer.\n"
                )

            # Iterloop detection
            if "iterloop" in prompt.lower():
                context_additions.append(
                    "You have been instructed to iteratively loop over a list. Identify what list the user is referring to, "
                    "then follow this loop: present one item, wait for the user to respond with questions and discussion points, "
                    "only continue to the next item when the user explicitly says 'continue' or something similar\n"
                )

        except Exception as e:
            self.logger.error(f"DAIC processing failed: {e}")

        return context_additions

    def _check_daic_mode(self) -> bool:
        """Check current DAIC mode"""
        try:
            if self.daic_state_file.exists():
                with open(self.daic_state_file, 'r') as f:
                    state = json.load(f)
                    return state.get('discussion_mode', True)
        except:
            pass
        return True  # Default to discussion mode

    def _set_daic_mode(self, discussion_mode: bool) -> None:
        """Set DAIC mode"""
        try:
            self.daic_state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.daic_state_file, 'w') as f:
                json.dump({
                    'discussion_mode': discussion_mode,
                    'last_updated': datetime.now().isoformat()
                }, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to set DAIC mode: {e}")

    def _monitor_token_usage(self, transcript_path: str) -> List[str]:
        """Monitor token usage and provide warnings"""
        context_additions = []

        try:
            if not os.path.exists(transcript_path):
                return context_additions

            context_length = self._get_context_length_from_transcript(transcript_path)

            if context_length > 0:
                # Calculate percentage of usable context (160k practical limit)
                usable_percentage = (context_length / 160000) * 100

                # Check for warning flag files
                warning_75_flag = self.project_root / ".claude" / "state" / "context-warning-75.flag"
                warning_90_flag = self.project_root / ".claude" / "state" / "context-warning-90.flag"

                # Token warnings (only show once per session)
                if usable_percentage >= 90 and not warning_90_flag.exists():
                    context_additions.append(
                        f"\n[90% WARNING] {context_length:,}/160,000 tokens used ({usable_percentage:.1f}%). "
                        "CRITICAL: Run sessions/protocols/task-completion.md to wrap up this task cleanly!\n"
                    )
                    warning_90_flag.parent.mkdir(parents=True, exist_ok=True)
                    warning_90_flag.touch()
                elif usable_percentage >= 75 and not warning_75_flag.exists():
                    context_additions.append(
                        f"\n[{usable_percentage:.0f}% WARNING] {context_length:,}/160,000 tokens used ({usable_percentage:.1f}%). "
                        "Context is getting low. Be aware of coming context compaction trigger.\n"
                    )
                    warning_75_flag.parent.mkdir(parents=True, exist_ok=True)
                    warning_75_flag.touch()

        except Exception as e:
            self.logger.error(f"Token monitoring failed: {e}")

        return context_additions

    def _get_context_length_from_transcript(self, transcript_path: str) -> int:
        """Get current context length from transcript"""
        try:
            with open(transcript_path, 'r') as f:
                lines = f.readlines()

            most_recent_usage = None
            most_recent_timestamp = None

            # Parse each JSONL entry
            for line in lines:
                try:
                    data = json.loads(line.strip())
                    # Skip sidechain entries
                    if data.get('isSidechain', False):
                        continue

                    # Check if this entry has usage data
                    if data.get('message', {}).get('usage'):
                        entry_time = data.get('timestamp')
                        if entry_time and (not most_recent_timestamp or entry_time > most_recent_timestamp):
                            most_recent_timestamp = entry_time
                            most_recent_usage = data['message']['usage']
                except json.JSONDecodeError:
                    continue

            # Calculate context length from most recent usage
            if most_recent_usage:
                return (
                    most_recent_usage.get('input_tokens', 0) +
                    most_recent_usage.get('cache_read_input_tokens', 0) +
                    most_recent_usage.get('cache_creation_input_tokens', 0)
                )
        except Exception:
            pass
        return 0

    def _detect_protocol_triggers(self, prompt: str) -> List[str]:
        """Detect protocol triggers and add context"""
        context_additions = []
        prompt_lower = prompt.lower()

        # Context compaction detection
        if any(phrase in prompt_lower for phrase in ["compact", "restart session", "context compaction"]):
            context_additions.append(
                "If the user is asking to compact context, read and follow sessions/protocols/context-compaction.md protocol.\n"
            )

        # Task completion detection
        if any(phrase in prompt_lower for phrase in ["complete the task", "finish the task", "task is done",
                                                       "mark as complete", "close the task", "wrap up the task"]):
            context_additions.append(
                "If the user is asking to complete the task, read and follow sessions/protocols/task-completion.md protocol.\n"
            )

        # Task creation detection
        if any(phrase in prompt_lower for phrase in ["create a new task", "create a task", "make a task",
                                                       "new task for", "add a task"]):
            context_additions.append(
                "If the user is asking to create a task, read and follow sessions/protocols/task-creation.md protocol.\n"
            )

        # Task switching detection
        if any(phrase in prompt_lower for phrase in ["switch to task", "work on task", "change to task"]):
            context_additions.append(
                "If the user is asking to switch tasks, read and follow sessions/protocols/task-startup.md protocol.\n"
            )

        return context_additions

    def _detect_task_creation(self, prompt: str) -> List[str]:
        """Detect potential task creation patterns"""
        context_additions = []

        if not self.config.get("task_detection", {}).get("enabled", True):
            return context_additions

        task_patterns = [
            r"(?i)we (should|need to|have to) (implement|fix|refactor|migrate|test|research)",
            r"(?i)create a task for",
            r"(?i)add this to the (task list|todo|backlog)",
            r"(?i)we'll (need to|have to) (do|handle|address) (this|that) later",
            r"(?i)that's a separate (task|issue|problem)",
            r"(?i)file this as a (bug|task|issue)"
        ]

        task_mentioned = any(re.search(pattern, prompt) for pattern in task_patterns)

        if task_mentioned:
            context_additions.append("""
[Task Detection Notice]
The message may reference something that could be a task.

IF you or the user have discovered a potential task that is sufficiently unrelated to the current task, ask if they'd like to create a task file.

Tasks are:
• More than a couple commands to complete
• Semantically distinct units of work
• Work that takes meaningful context
• Single focused goals (not bundled multiple goals)
• Things that would take multiple days should be broken down
• NOT subtasks of current work (those go in the current task file/directory)

If they want to create a task, follow the task creation protocol.
""")

        return context_additions

    def _apply_security_filters(self, context_additions: List[str]) -> List[str]:
        """Apply security filters to context additions"""
        filtered = []

        for context in context_additions:
            # Check for potential security issues
            if self._is_security_safe(context):
                filtered.append(context)
            else:
                self.logger.warning(f"Filtered potentially unsafe context: {context[:50]}...")

        return filtered

    def _is_security_safe(self, context: str) -> bool:
        """Check if context is security safe"""
        # Basic security patterns to avoid
        dangerous_patterns = [
            r'rm\s+-rf\s+/',
            r'sudo\s+chmod\s+777',
            r'eval\s*\(',
            r'exec\s*\(',
            r'__import__\s*\(',
            r'os\.system\s*\(',
            r'subprocess\.call.*shell=True'
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, context, re.IGNORECASE):
                return False

        return True

if __name__ == "__main__":
    hook = UserPromptSubmitContext7Hook()
    sys.exit(hook.run())