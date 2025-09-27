#!/usr/bin/env python3
"""
CC-Tools Integration Hook for Claude Code Sessions
Replaces existing validation hooks with cc-tools validators
"""

import json
import sys
import os
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

try:
    from hooks.cc_validation_hook import cc_validation_hook, CCValidationHookError
    CC_TOOLS_AVAILABLE = True
except ImportError as e:
    print(f"CC-Tools hook not available: {e}", file=sys.stderr)
    CC_TOOLS_AVAILABLE = False

class CCToolsClaudeIntegration:
    def __init__(self):
        self.project_dir = os.getenv('CLAUDE_PROJECT_DIR', os.getcwd())
        self.cc_tools_enabled = CC_TOOLS_AVAILABLE and self.load_cc_tools_config()

    def load_cc_tools_config(self) -> bool:
        """Check if CC-Tools integration is enabled in configuration"""
        config_path = Path(self.project_dir) / '.claude' / 'settings.json'

        if not config_path.exists():
            return False

        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                return config.get('devflow', {}).get('cc_tools_enabled', True)
        except (json.JSONDecodeError, FileNotFoundError):
            return False

    def log(self, message: str, level: str = 'INFO'):
        """Log message to stderr"""
        print(f"[CC-Tools {level}] {message}", file=sys.stderr)

    async def handle_pre_tool_use(self, hook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle pre-tool use validation with CC-Tools"""
        if not self.cc_tools_enabled:
            return {"status": "cc_tools_disabled", "passthrough": True}

        tool_name = hook_data.get('tool_name', '')
        tool_params = hook_data.get('tool_parameters', {})
        session_id = hook_data.get('session_id', '')

        # Only validate tools that modify files or execute commands
        validation_tools = {'Write', 'Edit', 'MultiEdit', 'Bash', 'Task'}

        if tool_name not in validation_tools:
            return {"status": "no_validation_needed", "passthrough": True}

        try:
            validation_data = {
                'tool_name': tool_name,
                'parameters': tool_params,
                'session_id': session_id,
                'hook_type': 'pre_tool_use'
            }

            result = await cc_validation_hook.validate(validation_data, session_id)

            if result.get('source') == 'cc-tools' and not result.get('valid', True):
                self.log(f"CC-Tools validation failed for {tool_name}")
                return {
                    "status": "validation_failed",
                    "errors": result.get('errors', []),
                    "warnings": result.get('warnings', []),
                    "block": True
                }

            self.log(f"CC-Tools validation passed for {tool_name}")
            return {
                "status": "validation_passed",
                "source": result.get('source', 'unknown'),
                "passthrough": True
            }

        except Exception as e:
            self.log(f"CC-Tools validation error: {str(e)}", 'ERROR')
            return {
                "status": "validation_error",
                "error": str(e),
                "passthrough": True  # Allow execution on validation errors
            }

    async def handle_post_tool_use(self, hook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle post-tool use analysis with CC-Tools"""
        if not self.cc_tools_enabled:
            return {"status": "cc_tools_disabled"}

        tool_name = hook_data.get('tool_name', '')
        tool_response = hook_data.get('tool_response', '')
        session_id = hook_data.get('session_id', '')

        try:
            analysis_data = {
                'tool_name': tool_name,
                'response': tool_response,
                'session_id': session_id,
                'hook_type': 'post_tool_use'
            }

            result = await cc_validation_hook.validate(analysis_data, session_id)

            # Get performance metrics
            metrics = cc_validation_hook.get_performance_metrics()

            return {
                "status": "analysis_complete",
                "source": result.get('source', 'unknown'),
                "metrics": {
                    "validation_calls": metrics.get('validation_time', {}).get('total_calls', 0),
                    "avg_validation_time": metrics.get('validation_time', {}).get('avg_time', 0),
                    "bridge_latency": metrics.get('bridge_latency', {}).get('avg_time', 0)
                }
            }

        except Exception as e:
            self.log(f"CC-Tools post-analysis error: {str(e)}", 'ERROR')
            return {"status": "analysis_error", "error": str(e)}

# Global instance
cc_integration = CCToolsClaudeIntegration()

async def main():
    """Main hook handler"""
    try:
        # Read hook data from stdin
        hook_data = json.load(sys.stdin)

        hook_event_name = hook_data.get('hook_event_name', '')

        if hook_event_name == 'PreToolUse':
            result = await cc_integration.handle_pre_tool_use(hook_data)
        elif hook_event_name == 'PostToolUse':
            result = await cc_integration.handle_post_tool_use(hook_data)
        else:
            result = {"status": "ignored", "event": hook_event_name}

        # Output result
        print(json.dumps(result))

    except json.JSONDecodeError as e:
        print(json.dumps({"status": "error", "error": f"Invalid JSON input: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())