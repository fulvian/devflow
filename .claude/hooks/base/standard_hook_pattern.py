#!/usr/bin/env python3
"""
DevFlow Standard Hook Pattern v2.0 - Context7 Implementation

Comprehensive base class framework for all DevFlow hooks providing standardized
architecture, security enforcement, and audit capabilities.

Features:
- Context7-compliant hook architecture
- Automated security and policy enforcement
- Structured logging and audit trails
- Tool orchestration routing intelligence
- Error handling with fail-open design
- Multiple hook types: PreToolUse, PostToolUse, UserPromptSubmit

Author: DevFlow System
Created: 2025-09-24
Context7 Version: 2.0
Based on cchooks best practices and DevFlow protocol requirements
"""

import json
import sys
import os
import logging
import traceback
from datetime import datetime
from typing import Dict, Any, Optional, List
from abc import ABC, abstractmethod
from enum import Enum

# Hook decision types
class HookDecision(Enum):
    APPROVE = "approve"
    BLOCK = "block"
    DENY = "deny"
    UNDEFINED = None

# Standard DevFlow hook response
class DevFlowHookResponse:
    def __init__(self):
        self.decision: Optional[HookDecision] = None
        self.reason: Optional[str] = None
        self.continue_execution: bool = True
        self.suppress_output: bool = False
        self.additional_context: Optional[str] = None
        self.metadata: Dict[str, Any] = {}

    def to_json(self) -> str:
        """Convert to Claude Code JSON output format"""
        output = {}

        # Core decision fields
        if self.decision and self.decision != HookDecision.UNDEFINED:
            # Check if this is a PreToolUse hook by looking at metadata
            is_pretool_hook = self.metadata.get('hook_event') == 'PreToolUse' or 'PreToolUse' in str(type(self))
            if is_pretool_hook:
                # Map approve/deny to allow/deny for PreToolUse
                decision_value = "allow" if self.decision == HookDecision.APPROVE else "deny"
                output["permissionDecision"] = decision_value
            else:  # PostToolUse, Stop, SubagentStop
                output["decision"] = self.decision.value

        if self.reason:
            output["reason"] = self.reason

        # Flow control
        output["continue"] = self.continue_execution
        if not self.continue_execution and not self.reason:
            output["stopReason"] = "Hook execution halted"

        if self.suppress_output:
            output["suppressOutput"] = True

        # Hook-specific output
        hook_event = self.metadata.get('hook_event', 'Unknown')

        if hook_event == 'PreToolUse':
            # PreToolUse specific output
            output["hookSpecificOutput"] = {
                "hookEventName": "PreToolUse",
            }
            # Add permissionDecisionReason if we have a reason and decision
            if self.reason and self.decision:
                output["hookSpecificOutput"]["permissionDecisionReason"] = self.reason
        elif self.additional_context and hook_event == 'UserPromptSubmit':
            # UserPromptSubmit specific output
            output["hookSpecificOutput"] = {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": self.additional_context
            }

        # Metadata
        if self.metadata:
            output["metadata"] = self.metadata

        return json.dumps(output, indent=2)

class BaseDevFlowHook(ABC):
    """Base class for all DevFlow hooks following Context7 patterns"""

    def __init__(self, hook_name: str):
        self.hook_name = hook_name
        self.input_data: Dict[str, Any] = {}
        self.response = DevFlowHookResponse()
        self._skip_due_to_missing_input = False

        # Setup structured logging
        self.setup_logging()

    def setup_logging(self):
        """Configure structured logging for audit trail"""
        log_dir = "/Users/fulvioventura/devflow/.claude/logs/hooks"
        os.makedirs(log_dir, exist_ok=True)

        log_file = f"{log_dir}/{self.hook_name}.log"

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler(sys.stderr) if os.getenv('DEVFLOW_DEBUG') else logging.NullHandler()
            ]
        )

        self.logger = logging.getLogger(self.hook_name)

    def _create_minimal_context(self) -> Dict[str, Any]:
        """Create minimal execution context for hooks without input"""
        return {
            "session_id": f"hook-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "hook_event_name": "PostToolUse",
            "cwd": "/Users/fulvioventura/devflow",
            "tool_name": "system",
            "tool_input": {},
            "tool_response": {},
            "execution_mode": "minimal-context",
            "timestamp": datetime.now().isoformat()
        }

    def load_input(self) -> bool:
        """Load and validate input from stdin with robust error handling"""
        try:
            # Use select to avoid blocking indefinitely
            import select
            if sys.stdin.isatty() or not select.select([sys.stdin], [], [], 0.1)[0]:
                # No input available, create minimal context for graceful execution
                self.input_data = self._create_minimal_context()
                self.logger.info(f"No input provided for {self.hook_name}, using minimal context")
            else:
                try:
                    self.input_data = json.load(sys.stdin)
                except json.JSONDecodeError as e:
                    self.logger.warning(f"Invalid JSON input: {e}, using minimal context")
                    self.input_data = self._create_minimal_context()

            # Validate required fields
            required_fields = ["session_id", "hook_event_name", "cwd"]
            missing_fields = [field for field in required_fields if field not in self.input_data]

            if missing_fields:
                # Fill in missing fields with defaults for graceful execution
                defaults = {
                    "session_id": f"hook-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
                    "hook_event_name": "PostToolUse",
                    "cwd": "/Users/fulvioventura/devflow"
                }

                for field in missing_fields:
                    if field in defaults:
                        self.input_data[field] = defaults[field]

                self.logger.info(f"Added default values for missing fields: {missing_fields}")

            self.logger.info(f"Hook {self.hook_name} loaded input for session {self.input_data.get('session_id')}")
            self._skip_due_to_missing_input = False
            return True

        except Exception as e:
            self.logger.warning(f"Error loading input: {e}, proceeding with minimal context")
            self.input_data = self._create_minimal_context()
            self._skip_due_to_missing_input = False
            return True  # Always return True for fail-open behavior

    @abstractmethod
    def validate_input(self) -> bool:
        """Validate hook-specific input requirements"""
        pass

    @abstractmethod
    def execute_logic(self) -> None:
        """Main hook logic implementation"""
        pass

    def get_tool_name(self) -> Optional[str]:
        """Get tool name from input (for tool-based hooks)"""
        return self.input_data.get("tool_name")

    def get_tool_input(self) -> Dict[str, Any]:
        """Get tool input parameters"""
        return self.input_data.get("tool_input", {})

    def get_tool_response(self) -> Dict[str, Any]:
        """Get tool response (for PostToolUse hooks)"""
        return self.input_data.get("tool_response", {})

    def is_security_sensitive(self) -> bool:
        """Check if operation involves security-sensitive content"""
        sensitive_patterns = [
            'password', 'secret', 'token', 'key', 'auth',
            'credential', 'api_key', 'private', 'sudo'
        ]

        content = json.dumps(self.input_data).lower()
        return any(pattern in content for pattern in sensitive_patterns)

    def is_orchestrator_required(self) -> bool:
        """Check if operation should route through Unified Orchestrator"""
        tool_name = self.get_tool_name()
        if not tool_name:
            return False

        # Always route MCP agent calls
        if tool_name.startswith('mcp__'):
            return True

        # Route large operations
        tool_input = self.get_tool_input()
        content = tool_input.get('content', tool_input.get('new_string', ''))
        if isinstance(content, str) and content.count('\n') > 50:
            return True

        # Route security-sensitive operations
        if self.is_security_sensitive():
            return True

        return False

    def should_block_operation(self) -> tuple[bool, str]:
        """Central security and policy checking"""
        tool_name = self.get_tool_name()
        tool_input = self.get_tool_input()

        # Check for prohibited patterns
        dangerous_patterns = [
            (r'rm\s+-rf\s*/', "Dangerous file deletion detected"),
            (r'sudo\s+', "Privileged operation without approval"),
            (r'DROP\s+TABLE', "Database destruction detected"),
            (r'DELETE\s+FROM.*WHERE\s+1=1', "Mass deletion detected")
        ]

        import re
        content = json.dumps(tool_input)

        for pattern, message in dangerous_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return True, message

        # Check file path security
        file_path = tool_input.get('file_path', '')
        if file_path:
            dangerous_paths = ['/etc/', '/usr/bin/', '/usr/sbin/', '/boot/']
            if any(file_path.startswith(path) for path in dangerous_paths):
                return True, f"Access to system directory {file_path} prohibited"

        return False, ""

    def add_audit_trail(self):
        """Add audit information to response metadata"""
        self.response.metadata.update({
            'hook_name': self.hook_name,
            'hook_event': self.input_data.get('hook_event_name', 'Unknown'),
            'session_id': self.input_data.get('session_id'),
            'execution_time': datetime.now().isoformat(),
            'tool_name': self.get_tool_name(),
            'security_sensitive': self.is_security_sensitive(),
            'orchestrator_required': self.is_orchestrator_required()
        })

    def run(self) -> int:
        """Main hook execution with error handling"""
        try:
            # Load and validate input
            if not self.load_input():
                if self._skip_due_to_missing_input:
                    return 0

                self.logger.warning("Failed to load input, using fail-open response")
                self._output_fail_open_response("Failed to load input")
                return 0  # Fail-open

            if not self.validate_input():
                self.logger.info("Input validation failed, hook execution skipped gracefully")
                self._output_fail_open_response("Input validation skipped")
                return 0  # Fail-open

            # Execute hook logic
            self.execute_logic()

            # Add audit trail
            self.add_audit_trail()

            # Output response
            print(self.response.to_json())

            self.logger.info(f"Hook {self.hook_name} completed successfully")
            return 0

        except Exception as e:
            self.logger.error(f"Hook execution failed: {str(e)}")
            self.logger.error(traceback.format_exc())

            # Emergency response for critical errors
            self._output_fail_open_response(f"Hook {self.hook_name} encountered an error: {str(e)}")
            return 0  # Always fail-open

    def _output_fail_open_response(self, reason: str):
        """Output a fail-open response"""
        emergency_response = {
            "continue": True,  # Fail-open design
            "reason": reason,
            "metadata": {
                "error": False,  # Not an error, just graceful skip
                "hook_name": self.hook_name,
                "fail_open": True,
                "timestamp": datetime.now().isoformat()
            }
        }
        print(json.dumps(emergency_response))

# Specific hook types with Context7 patterns
class PreToolUseHook(BaseDevFlowHook):
    """Pre-tool execution hook with permission control"""

    def validate_input(self) -> bool:
        required_fields = ["tool_name", "tool_input"]
        missing = [f for f in required_fields if f not in self.input_data]
        if missing:
            self.logger.error(f"PreToolUse missing fields: {missing}")
            return False
        return True

    def approve(self, reason: str = ""):
        """Approve tool execution"""
        self.response.decision = HookDecision.APPROVE
        if reason:
            self.response.reason = reason

    def deny(self, reason: str):
        """Deny tool execution"""
        self.response.decision = HookDecision.DENY
        self.response.reason = reason

class PostToolUseHook(BaseDevFlowHook):
    """Post-tool execution hook with result validation"""

    def validate_input(self) -> bool:
        required_fields = ["tool_name", "tool_input", "tool_response"]
        missing = [f for f in required_fields if f not in self.input_data]
        if missing:
            self.logger.error(f"PostToolUse missing fields: {missing}")
            return False
        return True

    def block(self, reason: str):
        """Block continuation after tool execution"""
        self.response.decision = HookDecision.BLOCK
        self.response.reason = reason

class UserPromptSubmitHook(BaseDevFlowHook):
    """User prompt submission hook with context injection"""

    def validate_input(self) -> bool:
        if "prompt" not in self.input_data:
            self.logger.error("UserPromptSubmit missing prompt field")
            return False
        return True

    def add_context(self, context: str):
        """Add context to user prompt"""
        self.response.additional_context = context

    def block_prompt(self, reason: str):
        """Block prompt submission"""
        self.response.decision = HookDecision.BLOCK
        self.response.reason = reason
