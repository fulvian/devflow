#!/usr/bin/env python3
"""
Post-Tool Use Hook - Context7 Implementation

DevFlow post-tool execution hook for DAIC (Discussion/Implementation) mode management.
Provides intelligent mode switching recommendations and workflow guidance.

Author: DevFlow System
Created: 2025-09-24
Context7 Version: 2.0
"""
import sys
from pathlib import Path

# Import DevFlow standard hook pattern
sys.path.append('/Users/fulvioventura/devflow/.claude/hooks/base')
from standard_hook_pattern import PostToolUseHook

from shared_state import check_daic_mode_bool, get_project_root

class DAICReminderHook(PostToolUseHook):
    """Context7-compliant DAIC reminder hook"""

    def __init__(self):
        super().__init__("daic-reminder")

    def validate_input(self) -> bool:
        """Validate PostToolUse input for DAIC reminder"""
        required_fields = ["tool_name", "tool_input"]
        missing = [f for f in required_fields if f not in self.input_data]
        if missing:
            self.logger.error(f"DAIC reminder hook missing fields: {missing}")
            return False
        return True

    def execute_logic(self):
        """Execute DAIC reminder logic"""
        try:
            tool_name = self.get_tool_name()
            tool_input = self.get_tool_input()
            cwd = self.input_data.get("cwd", "")

            # Check if we're in a subagent context
            project_root = get_project_root()
            subagent_flag = project_root / '.claude' / 'state' / 'in_subagent_context.flag'
            in_subagent = subagent_flag.exists()

            # If this is the Task tool completing, clear the subagent flag
            if tool_name == "Task" and in_subagent:
                try:
                    subagent_flag.unlink()
                    # Don't show DAIC reminder for Task completion
                    in_subagent = True
                except Exception as e:
                    self.logger.warning(f"Failed to clear subagent flag: {e}")

            # Check current mode
            try:
                discussion_mode = check_daic_mode_bool()
            except Exception as e:
                self.logger.warning(f"Failed to check DAIC mode: {e}")
                discussion_mode = False

            # Only remind if in implementation mode AND not in a subagent
            implementation_tools = ["Edit", "Write", "MultiEdit", "NotebookEdit"]
            if not discussion_mode and tool_name in implementation_tools and not in_subagent:
                # Add reminder to response metadata
                self.response.metadata.update({
                    'daic_reminder_shown': True,
                    'reminder_message': '[DAIC Reminder] When you\'re done implementing, run: daic'
                })
                self.logger.info("[DAIC Reminder] When you're done implementing, run: daic")

            # Check for cd command in Bash operations
            if tool_name == "Bash":
                command = tool_input.get("command", "")
                if "cd " in command:
                    self.response.metadata.update({
                        'cwd_shown': True,
                        'cwd_message': f'[CWD: {cwd}]'
                    })
                    self.logger.info(f"[CWD: {cwd}]")

        except Exception as e:
            self.logger.error(f"Error in DAIC reminder logic: {e}")
            # Don't block execution for reminder failures
            self.response.metadata.update({
                'daic_reminder_error': str(e)
            })

def main():
    """Main hook execution using Context7 pattern"""
    hook = DAICReminderHook()
    return hook.run()

if __name__ == "__main__":
    sys.exit(main())