#!/usr/bin/env python3
"""
Context Monitor Hook v1.0
AUTO-LOGGING ON CONTEXT PROXIMITY

Monitors context window usage and triggers auto-logging when approaching limits.
Prevents memory loss by preserving work before context compaction is needed.

Features:
- Real-time context size monitoring
- Predictive compaction trigger (at 80% capacity)
- Progressive work preservation
- Integration with database session logger
- Smart threshold adjustments
"""

import sys
import os
import json
from datetime import datetime

# Import DevFlow standard hook pattern
sys.path.append('/Users/fulvioventura/devflow/.claude/hooks/base')
from standard_hook_pattern import PreToolUseHook

# Import database logger
sys.path.append('/Users/fulvioventura/devflow/.claude/hooks')
exec(open('/Users/fulvioventura/devflow/.claude/hooks/database-session-logger.py').read())

class ContextMonitorHook(PreToolUseHook):
    """Context window monitoring with auto-logging triggers"""

    def __init__(self):
        super().__init__("context-monitor")
        self.db_logger = DatabaseSessionLogger()

        # Context thresholds (characters)
        self.warning_threshold = 12000   # 80% of typical limit
        self.critical_threshold = 15000  # 95% of typical limit
        self.last_logged_size = 0
        self.log_interval = 3000         # Log every 3k chars increase

    def validate_input(self) -> bool:
        """Always valid - monitors any tool use"""
        return True

    def execute_logic(self):
        """Monitor context and trigger logging when needed"""

        # Calculate current context size
        context_size = self.calculate_context_size()

        # Check if we should trigger auto-logging
        should_log = self.should_trigger_logging(context_size)

        if should_log:
            self.trigger_database_logging(context_size)

        # Always approve tool execution
        self.approve("Context monitored - proceeding with tool execution")

        # Add context metrics to response
        self.response.metadata.update({
            'context_size': context_size,
            'threshold_warning': context_size > self.warning_threshold,
            'threshold_critical': context_size > self.critical_threshold,
            'auto_logged': should_log
        })

    def calculate_context_size(self) -> int:
        """Estimate current context window size"""

        # Start with input data size
        total_size = len(str(self.input_data))

        # Add tool input content
        tool_input = self.get_tool_input()
        for key, value in tool_input.items():
            if isinstance(value, str):
                total_size += len(value)

        # Rough estimate including system context, history, etc.
        estimated_context = total_size * 1.5  # 50% overhead estimate

        return int(estimated_context)

    def should_trigger_logging(self, context_size: int) -> bool:
        """Determine if logging should be triggered"""

        # Critical threshold - always log
        if context_size > self.critical_threshold:
            self.logger.warning(f"Context critical: {context_size} chars")
            return True

        # Warning threshold - log if significant work detected
        if context_size > self.warning_threshold:
            tool_name = self.get_tool_name()
            # Log for significant operations
            if tool_name in ['Edit', 'Write', 'MultiEdit'] or 'mcp__' in tool_name:
                self.logger.info(f"Context warning with significant work: {context_size} chars")
                return True

        # Progressive logging - log at intervals
        if context_size > self.last_logged_size + self.log_interval:
            # Check if there's meaningful work to preserve
            context = self.db_logger.extract_session_context(self.input_data)
            if self.db_logger.is_significant_work(context):
                self.logger.info(f"Progressive logging triggered: {context_size} chars")
                self.last_logged_size = context_size
                return True

        return False

    def trigger_database_logging(self, context_size: int):
        """Trigger database session logging"""

        try:
            session_id = self.db_logger.get_session_id()
            context = self.db_logger.extract_session_context(self.input_data)

            # Enhanced metadata for context monitoring
            metadata = {
                'trigger_type': 'context_proximity',
                'context_size': context_size,
                'threshold_level': self.get_threshold_level(context_size),
                'hook_event': 'PreToolUse',
                'tool_name': self.get_tool_name(),
                'timestamp': datetime.now().isoformat(),
                'auto_logged': True,
                'preservation_reason': 'context_window_management'
            }

            # Log to database
            success = self.db_logger.log_session_to_database(
                session_id,
                context,
                'active',  # Still in progress
                metadata
            )

            if success:
                self.logger.info(f"Context proximity logging successful: {session_id}")
            else:
                self.logger.error(f"Context proximity logging failed: {session_id}")

        except Exception as e:
            self.logger.error(f"Failed to trigger database logging: {str(e)}")

    def get_threshold_level(self, context_size: int) -> str:
        """Get human-readable threshold level"""
        if context_size > self.critical_threshold:
            return 'critical'
        elif context_size > self.warning_threshold:
            return 'warning'
        else:
            return 'normal'

def main():
    """Main hook execution"""
    hook = ContextMonitorHook()
    return hook.run()

if __name__ == "__main__":
    sys.exit(main())