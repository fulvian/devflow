#!/usr/bin/env python3
"""
Shared State Management Hook - Context7 Implementation

DevFlow shared state management system for session coordination and task tracking.
Provides centralized state management for DAIC modes and task state tracking.

Author: DevFlow System
Created: 2025-09-24
Context7 Version: 2.0
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import BaseDevFlowHook

class SharedStateHook(BaseDevFlowHook):
    """Context7-compliant shared state management hook"""

    def __init__(self):
        super().__init__("shared-state")

        # Get project root dynamically
        self.project_root = self._get_project_root()
        self.state_dir = self.project_root / ".claude" / "state"
        self.daic_state_file = self.state_dir / "daic-mode.json"
        self.task_state_file = self.state_dir / "current_task.json"

        # Mode description strings
        self.discussion_mode_msg = "You are now in Discussion Mode and should focus on discussing and investigating with the user (no edit-based tools)"
        self.implementation_mode_msg = "You are now in Implementation Mode and may use tools to execute the agreed upon actions - when you are done return immediately to Discussion Mode"

    def _get_project_root(self) -> Path:
        """Find project root by looking for .claude directory."""
        current = Path.cwd()
        while current.parent != current:
            if (current / ".claude").exists():
                return current
            current = current.parent
        # Fallback to current directory if no .claude found
        return Path.cwd()

    def validate_input(self) -> bool:
        """Validate shared state hook input"""
        # Shared state hook accepts any valid input
        return True

    def execute_logic(self) -> None:
        """Main shared state management logic"""
        try:
            # Ensure state directory exists
            self._ensure_state_dir()

            # Get current state information
            daic_mode = self._check_daic_mode_bool()
            task_state = self._get_task_state()

            # Prepare response with state information
            self.response.metadata.update({
                'daic_mode': 'discussion' if daic_mode else 'implementation',
                'current_task': task_state.get('task'),
                'current_branch': task_state.get('branch'),
                'affected_services': task_state.get('services', []),
                'state_management': 'active'
            })

            # Continue execution
            self.response.continue_execution = True

        except Exception as e:
            self.logger.error(f"Shared state management error: {str(e)}")
            self.response.continue_execution = True  # Fail-open design
            self.response.metadata['error'] = str(e)

    def _ensure_state_dir(self):
        """Ensure the state directory exists."""
        self.state_dir.mkdir(parents=True, exist_ok=True)

    def _check_daic_mode_bool(self) -> bool:
        """Check if DAIC (discussion) mode is enabled. Returns True for discussion, False for implementation."""
        self._ensure_state_dir()
        try:
            with open(self.daic_state_file, 'r') as f:
                data = json.load(f)
                return data.get("mode", "discussion") == "discussion"
        except (FileNotFoundError, json.JSONDecodeError):
            # Default to discussion mode if file doesn't exist
            self._set_daic_mode(True)
            return True

    def _set_daic_mode(self, value):
        """Set DAIC mode to a specific value."""
        self._ensure_state_dir()
        if value == True or value == "discussion":
            mode = "discussion"
        elif value == False or value == "implementation":
            mode = "implementation"
        else:
            raise ValueError(f"Invalid mode value: {value}")

        with open(self.daic_state_file, 'w') as f:
            json.dump({"mode": mode}, f, indent=2)

    def _get_task_state(self) -> dict:
        """Get current task state including branch and affected services."""
        try:
            with open(self.task_state_file, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"task": None, "branch": None, "services": [], "updated": None}

# Main execution
def main():
    """Main hook execution entry point"""
    hook = SharedStateHook()
    return hook.run()

if __name__ == "__main__":
    sys.exit(main())

# Legacy compatibility functions for backward compatibility
# These redirect to the Context7 hook implementation

def ensure_state_dir():
    """Legacy function - ensures state directory exists."""
    hook = SharedStateHook()
    hook._ensure_state_dir()

def check_daic_mode_bool() -> bool:
    """Legacy function - check if DAIC mode is enabled."""
    hook = SharedStateHook()
    return hook._check_daic_mode_bool()

def get_task_state() -> dict:
    """Legacy function - get current task state."""
    hook = SharedStateHook()
    return hook._get_task_state()

def set_daic_mode(value):
    """Legacy function - set DAIC mode."""
    hook = SharedStateHook()
    return hook._set_daic_mode(value)

def get_project_root():
    """Legacy function - get project root."""
    hook = SharedStateHook()
    return hook.project_root