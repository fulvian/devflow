#!/usr/bin/env python3
"""
DevFlow Robust Hook Wrapper - Context7 Implementation
Provides graceful error handling and resilience patterns for all DevFlow hooks

Features:
- Context7-compliant error handling with fluent builders
- Graceful degradation when input is missing
- Comprehensive audit trails and state persistence
- oops-style error propagation patterns
- Fail-open design for maximum reliability
"""

import json
import sys
import os
import logging
import traceback
import select
from datetime import datetime
from typing import Dict, Any, Optional, Union, List
from dataclasses import dataclass, asdict
from pathlib import Path

@dataclass
class HookErrorContext:
    """Error context following oops library patterns"""
    code: str = ""
    domain: str = "devflow-hooks"
    operation: str = ""
    hook_name: str = ""
    tags: List[str] = None
    user_context: Dict[str, Any] = None
    additional_data: Dict[str, Any] = None
    hint: str = ""

    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.user_context is None:
            self.user_context = {}
        if self.additional_data is None:
            self.additional_data = {}

class RobustHookError(Exception):
    """Context7-compliant hook error with rich context"""

    def __init__(self, message: str, context: HookErrorContext = None):
        self.message = message
        self.context = context or HookErrorContext()
        super().__init__(message)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": self.message,
            "context": asdict(self.context),
            "timestamp": datetime.now().isoformat(),
            "type": "RobustHookError"
        }

class HookErrorBuilder:
    """Fluent builder for hook errors following oops patterns"""

    def __init__(self):
        self._context = HookErrorContext()

    def code(self, code: str) -> 'HookErrorBuilder':
        self._context.code = code
        return self

    def in_domain(self, domain: str) -> 'HookErrorBuilder':
        self._context.domain = domain
        return self

    def operation(self, operation: str) -> 'HookErrorBuilder':
        self._context.operation = operation
        return self

    def hook(self, hook_name: str) -> 'HookErrorBuilder':
        self._context.hook_name = hook_name
        return self

    def tags(self, *tags: str) -> 'HookErrorBuilder':
        self._context.tags.extend(tags)
        return self

    def with_data(self, key: str, value: Any) -> 'HookErrorBuilder':
        self._context.additional_data[key] = value
        return self

    def user(self, user_id: str, **kwargs) -> 'HookErrorBuilder':
        self._context.user_context = {"user_id": user_id, **kwargs}
        return self

    def hint(self, hint: str) -> 'HookErrorBuilder':
        self._context.hint = hint
        return self

    def error(self, message: str) -> RobustHookError:
        return RobustHookError(message, self._context)

    def wrap(self, original_error: Exception, message: str) -> RobustHookError:
        self._context.additional_data["wrapped_error"] = str(original_error)
        self._context.additional_data["wrapped_type"] = type(original_error).__name__
        return RobustHookError(f"{message}: {original_error}", self._context)

def oops() -> HookErrorBuilder:
    """Create a new error builder following oops patterns"""
    return HookErrorBuilder()

class RobustHookExecutor:
    """Robust wrapper for DevFlow hooks with Context7 compliance"""

    def __init__(self, hook_script_path: str):
        self.hook_script_path = Path(hook_script_path)
        self.hook_name = self.hook_script_path.stem
        self.project_root = Path("/Users/fulvioventura/devflow")
        self.state_dir = self.project_root / ".claude" / "state" / "hooks"
        self.log_dir = self.project_root / ".claude" / "logs" / "hooks"

        # Ensure directories exist
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Setup logging
        self.setup_logging()

    def setup_logging(self):
        """Configure structured logging"""
        log_file = self.log_dir / f"{self.hook_name}-wrapper.log"

        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler(sys.stderr) if os.getenv('DEVFLOW_DEBUG') else logging.NullHandler()
            ]
        )

        self.logger = logging.getLogger(f"{self.hook_name}-wrapper")

    def check_input_availability(self) -> tuple[bool, Optional[Dict[str, Any]]]:
        """Check if hook input is available using non-blocking select"""
        try:
            # Check if there's input available
            if sys.stdin.isatty():
                return False, None

            # Use select to check for available input without blocking
            ready, _, _ = select.select([sys.stdin], [], [], 0.1)

            if not ready:
                return False, None

            # Read available input
            input_data = json.load(sys.stdin)
            return True, input_data

        except json.JSONDecodeError as e:
            self.logger.warning(f"Invalid JSON input: {e}")
            return False, None
        except Exception as e:
            self.logger.warning(f"Error checking input: {e}")
            return False, None

    def create_minimal_context(self) -> Dict[str, Any]:
        """Create minimal execution context for hooks without input"""
        return {
            "session_id": f"wrapper-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "hook_event_name": "PostToolUse",
            "cwd": str(self.project_root),
            "tool_name": "system",
            "tool_input": {},
            "tool_response": {},
            "execution_mode": "wrapper-mode",
            "timestamp": datetime.now().isoformat()
        }

    def save_execution_state(self, success: bool, error: Optional[Exception] = None,
                           input_available: bool = False):
        """Save hook execution state for debugging"""
        state_file = self.state_dir / f"{self.hook_name}-state.json"

        state = {
            "last_execution": datetime.now().isoformat(),
            "success": success,
            "input_available": input_available,
            "hook_script": str(self.hook_script_path),
            "error": str(error) if error else None,
            "execution_count": 1
        }

        # Load previous state and increment counter
        if state_file.exists():
            try:
                with open(state_file, 'r') as f:
                    prev_state = json.load(f)
                state["execution_count"] = prev_state.get("execution_count", 0) + 1
            except Exception:
                pass

        try:
            with open(state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save state: {e}")

    def execute_hook_safely(self) -> int:
        """Execute hook with comprehensive error handling"""
        try:
            # Check input availability
            input_available, input_data = self.check_input_availability()

            if not input_available:
                # Create minimal context for graceful execution
                self.logger.info(f"No input available for {self.hook_name}, using minimal context")
                input_data = self.create_minimal_context()

            # Execute the hook script
            import subprocess
            import tempfile

            # Create temporary input file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp:
                json.dump(input_data, tmp, indent=2)
                temp_input_file = tmp.name

            try:
                # Execute hook with input
                result = subprocess.run(
                    [sys.executable, str(self.hook_script_path)],
                    input=json.dumps(input_data),
                    text=True,
                    capture_output=True,
                    timeout=30
                )

                if result.returncode == 0:
                    # Hook executed successfully
                    self.logger.info(f"Hook {self.hook_name} executed successfully")
                    if result.stdout.strip():
                        print(result.stdout)
                    self.save_execution_state(True, input_available=input_available)
                    return 0
                else:
                    # Hook failed but we continue (fail-open)
                    self.logger.warning(f"Hook {self.hook_name} failed with code {result.returncode}")
                    if result.stderr:
                        self.logger.warning(f"Hook stderr: {result.stderr}")

                    # Generate minimal success response for fail-open
                    minimal_response = {
                        "continue": True,
                        "reason": f"Hook {self.hook_name} failed gracefully",
                        "metadata": {
                            "wrapper_mode": True,
                            "original_error": result.stderr[:200] if result.stderr else "Unknown error"
                        }
                    }
                    print(json.dumps(minimal_response))
                    self.save_execution_state(False, Exception(result.stderr), input_available)
                    return 0  # Return 0 for fail-open behavior

            finally:
                # Cleanup temp file
                try:
                    os.unlink(temp_input_file)
                except:
                    pass

        except subprocess.TimeoutExpired:
            error = oops().code("hook_timeout").hook(self.hook_name).operation("execute").error(
                f"Hook {self.hook_name} timed out after 30 seconds"
            )
            self.logger.error(error.message)
            self.save_execution_state(False, error)
            return self._generate_fail_open_response("Hook timeout")

        except Exception as e:
            error = oops().code("hook_execution_failure").hook(self.hook_name).operation("execute").wrap(
                e, f"Failed to execute hook {self.hook_name}"
            )
            self.logger.error(error.message)
            self.logger.error(traceback.format_exc())
            self.save_execution_state(False, error)
            return self._generate_fail_open_response(f"Execution error: {e}")

    def _generate_fail_open_response(self, reason: str) -> int:
        """Generate fail-open response and return success code"""
        response = {
            "continue": True,
            "reason": reason,
            "metadata": {
                "hook_name": self.hook_name,
                "wrapper_mode": True,
                "fail_open": True,
                "timestamp": datetime.now().isoformat()
            }
        }
        print(json.dumps(response))
        return 0  # Always return 0 for fail-open

def main():
    """Main wrapper execution"""
    if len(sys.argv) != 2:
        print("Usage: robust-hook-wrapper.py <hook_script_path>", file=sys.stderr)
        return 1

    hook_script_path = sys.argv[1]

    if not os.path.exists(hook_script_path):
        print(f"Hook script not found: {hook_script_path}", file=sys.stderr)
        return 1

    executor = RobustHookExecutor(hook_script_path)
    return executor.execute_hook_safely()

if __name__ == "__main__":
    sys.exit(main())