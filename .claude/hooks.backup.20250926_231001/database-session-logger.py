#!/usr/bin/env python3
"""
Database Session Logger Hook v1.0
CRITICAL AUTO-LOGGING ENFORCEMENT

Comprehensive session logging system that prevents memory loss by tracking:
- Task completion events
- Progressive implementation work
- Context compaction proximity
- Crash recovery scenarios
- Real-time work preservation

Features:
- Multi-trigger activation (completion, progress, compaction, crash)
- Incremental logging during task execution
- Context window monitoring
- Work preservation on interruptions
- Integration with DevFlow unified database
"""

import sqlite3
import json
import sys
import os
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, List
import re

# Import DevFlow standard hook pattern
sys.path.append('/Users/fulvioventura/devflow/.claude/hooks/base')
try:
    from standard_hook_pattern import BaseDevFlowHook
except ImportError:
    # Fallback for testing
    class BaseDevFlowHook:
        def __init__(self, name):
            self.hook_name = name
            self.input_data = {}
            self.logger = type('Logger', (), {'info': print, 'error': print, 'warning': print})()
            self.response = type('Response', (), {
                'continue_execution': True,
                'metadata': {}
            })()

        def run(self):
            self.input_data = json.load(sys.stdin)
            self.execute_logic()
            return 0

class DatabaseSessionLogger:
    """Core database logging functionality"""

    def __init__(self):
        self.db_path = '/Users/fulvioventura/devflow/data/devflow_unified.sqlite'
        self.project_dir = '/Users/fulvioventura/devflow'
        self.current_task_file = '/Users/fulvioventura/devflow/.claude/state/current_task.json'

    def get_session_id(self) -> str:
        """Generate or retrieve current session ID"""
        try:
            # Use current task + timestamp for session ID
            task_info = self.get_current_task()
            timestamp = datetime.now().strftime("%Y%m%d_%H%M")
            task_name = task_info.get('task', 'unknown')

            session_id = f"session-{task_name}-{timestamp}"
            return session_id
        except:
            # Fallback session ID
            return f"session-auto-{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def get_current_task(self) -> Dict[str, Any]:
        """Get current task information"""
        try:
            if os.path.exists(self.current_task_file):
                with open(self.current_task_file, 'r') as f:
                    return json.load(f)
        except:
            pass
        return {'task': 'unknown', 'branch': 'unknown', 'services': []}

    def extract_session_context(self, input_data: Dict) -> str:
        """Extract meaningful context from session data"""
        context_parts = []

        # Add current task info
        task_info = self.get_current_task()
        context_parts.append(f"Task: {task_info.get('task', 'unknown')}")
        context_parts.append(f"Branch: {task_info.get('branch', 'unknown')}")

        # Extract work from input data
        if 'tool_name' in input_data:
            context_parts.append(f"Tool: {input_data['tool_name']}")

        # Extract file operations
        tool_input = input_data.get('tool_input', {})
        if 'file_path' in tool_input:
            context_parts.append(f"File: {tool_input['file_path']}")

        # Extract code context
        if 'content' in tool_input or 'new_string' in tool_input:
            content = tool_input.get('content') or tool_input.get('new_string', '')
            if content and len(content) > 50:
                # Summarize significant code changes
                lines = content.count('\n')
                context_parts.append(f"Code change: {lines} lines modified")

        # Add transcript analysis if available
        transcript = input_data.get('transcript', '')
        if transcript:
            # Extract key activities from transcript
            activities = self.extract_activities_from_transcript(transcript)
            if activities:
                context_parts.append(f"Activities: {', '.join(activities)}")

        return ' | '.join(context_parts)

    def extract_activities_from_transcript(self, transcript: str) -> List[str]:
        """Extract key activities from session transcript"""
        activities = []

        # Detect common activities
        patterns = {
            'file_creation': r'(created?|wrote) .*\.(py|js|ts|json|md)',
            'file_modification': r'(modified?|edited?|updated?) .*\.(py|js|ts|json)',
            'debugging': r'(debug|fix|error|issue|problem)',
            'testing': r'(test|spec|pytest|jest)',
            'documentation': r'(document|readme|comment)',
            'refactoring': r'(refactor|cleanup|optimize)',
            'implementation': r'(implement|add|create)',
        }

        for activity, pattern in patterns.items():
            if re.search(pattern, transcript, re.IGNORECASE):
                activities.append(activity.replace('_', ' '))

        return list(set(activities))  # Remove duplicates

    def calculate_progress_score(self, context: str) -> float:
        """Calculate progress score (0.0-1.0) based on context"""
        score = 0.0

        # Base score for any activity
        if context and len(context) > 20:
            score += 0.1

        # File operations
        if 'File:' in context:
            score += 0.3

        # Code changes
        if 'Code change:' in context:
            lines_match = re.search(r'(\d+) lines', context)
            if lines_match:
                lines = int(lines_match.group(1))
                score += min(0.4, lines / 100.0)  # Max 0.4 for code

        # Multiple activities
        activities = context.count('|')
        score += min(0.2, activities * 0.05)  # Max 0.2 for activities

        return min(1.0, score)

    def is_significant_work(self, context: str) -> bool:
        """Determine if work is significant enough to log"""
        # Always log if context has substantial content
        if len(context) > 100:
            return True

        # Log file operations
        if any(keyword in context for keyword in ['File:', 'Code change:', 'Tool:']):
            return True

        # Log multiple activities
        if context.count('|') >= 2:
            return True

        return False

    def log_session_to_database(self, session_id: str, context: str,
                              status: str = 'active', metadata: Dict = None):
        """Write session data to unified database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Get project_id (create if needed)
            project_id = self.get_or_create_project_id(cursor)

            # Prepare session data
            now = datetime.now().isoformat()
            metadata_json = json.dumps(metadata or {})

            # Insert or update session
            cursor.execute("""
                INSERT OR REPLACE INTO sessions
                (id, context, status, project_id, created_at, updated_at, metadata)
                VALUES (?, ?, ?, ?,
                    COALESCE((SELECT created_at FROM sessions WHERE id = ?), ?),
                    ?, ?)
            """, (session_id, context, status, project_id,
                  session_id, now, now, metadata_json))

            conn.commit()
            conn.close()

            return True
        except Exception as e:
            self.log_error(f"Database logging failed: {str(e)}")
            return False

    def get_or_create_project_id(self, cursor) -> int:
        """Get or create project ID for DevFlow"""
        cursor.execute("SELECT id FROM projects WHERE name = 'DevFlow' LIMIT 1")
        result = cursor.fetchone()

        if result:
            return result[0]

        # Create DevFlow project
        cursor.execute("""
            INSERT INTO projects (name, description, status, created_at, updated_at)
            VALUES ('DevFlow', 'DevFlow Development Environment', 'active', ?, ?)
        """, (datetime.now().isoformat(), datetime.now().isoformat()))

        return cursor.lastrowid

    def log_error(self, message: str):
        """Log errors to file"""
        log_file = '/Users/fulvioventura/devflow/.claude/logs/database-session-logger.log'
        os.makedirs(os.path.dirname(log_file), exist_ok=True)

        with open(log_file, 'a') as f:
            f.write(f"{datetime.now().isoformat()} ERROR: {message}\n")

class DatabaseSessionLoggerHook(BaseDevFlowHook):
    """Main hook class with multi-trigger support"""

    def __init__(self):
        super().__init__("database-session-logger")
        self.db_logger = DatabaseSessionLogger()
        self.context_threshold = 15000  # Trigger at 15k characters

    def validate_input(self) -> bool:
        """Validate hook input - flexible for multiple trigger types"""
        # This hook should work with any input type
        return True

    def execute_logic(self):
        """Main logging logic with multiple activation triggers"""

        # Determine trigger type
        trigger_type = self.detect_trigger_type()

        # Always proceed with logging for preservation
        session_id = self.db_logger.get_session_id()
        context = self.db_logger.extract_session_context(self.input_data)

        # Determine if work is significant enough to log
        if self.should_log_session(context, trigger_type):

            # Determine session status
            status = self.determine_session_status(trigger_type)

            # Prepare metadata
            metadata = {
                'trigger_type': trigger_type,
                'hook_event': self.input_data.get('hook_event_name', 'unknown'),
                'timestamp': datetime.now().isoformat(),
                'tool_name': self.input_data.get('tool_name'),
                'context_size': len(str(self.input_data)),
                'progress_score': self.db_logger.calculate_progress_score(context),
                'auto_logged': True
            }

            # Log to database
            success = self.db_logger.log_session_to_database(
                session_id, context, status, metadata
            )

            if success:
                self.logger.info(f"Session logged: {session_id} ({trigger_type})")
                self.response.metadata.update({
                    'session_logged': True,
                    'session_id': session_id,
                    'trigger_type': trigger_type,
                    'context_preserved': True
                })
            else:
                self.logger.error(f"Failed to log session: {session_id}")

        # Always approve continuation
        self.response.continue_execution = True

    def detect_trigger_type(self) -> str:
        """Detect what triggered this hook"""

        hook_event = self.input_data.get('hook_event_name', '')
        tool_name = self.input_data.get('tool_name', '')

        # Context compaction proximity
        context_size = len(str(self.input_data))
        if context_size > self.context_threshold:
            return 'context_compaction_proximity'

        # Task completion
        if 'stop' in hook_event.lower() or 'completion' in hook_event.lower():
            return 'task_completion'

        # Progressive work during implementation
        if tool_name in ['Edit', 'Write', 'MultiEdit'] or 'mcp__' in tool_name:
            return 'progressive_implementation'

        # Crash recovery / interruption
        if 'error' in str(self.input_data).lower() or 'crash' in str(self.input_data).lower():
            return 'crash_recovery'

        # Default: general preservation
        return 'work_preservation'

    def should_log_session(self, context: str, trigger_type: str) -> bool:
        """Determine if session should be logged based on significance"""

        # Always log completion and compaction events
        if trigger_type in ['task_completion', 'context_compaction_proximity', 'crash_recovery']:
            return True

        # For progressive work, check significance
        if trigger_type in ['progressive_implementation', 'work_preservation']:
            return self.db_logger.is_significant_work(context)

        return False

    def determine_session_status(self, trigger_type: str) -> str:
        """Determine session status based on trigger"""
        status_map = {
            'task_completion': 'completed',
            'context_compaction_proximity': 'active',
            'progressive_implementation': 'active',
            'crash_recovery': 'interrupted',
            'work_preservation': 'active'
        }
        return status_map.get(trigger_type, 'active')

def main():
    """Main hook execution"""
    hook = DatabaseSessionLoggerHook()
    return hook.run()

if __name__ == "__main__":
    sys.exit(main())