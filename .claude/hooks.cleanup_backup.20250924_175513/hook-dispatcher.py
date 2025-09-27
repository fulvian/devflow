#!/usr/bin/env python3
"""
Hook Dispatcher for Claude Code Integration
Routes different hook events to appropriate handlers in DevFlow Integration
"""

import json
import sys
import asyncio
from pathlib import Path

# Add current directory to path for imports
sys.path.append(str(Path(__file__).parent))

try:
    from devflow_integration import DevFlowIntegration
except ImportError as e:
    print(json.dumps({"error": f"Failed to import DevFlowIntegration: {str(e)}"}))
    sys.exit(1)

async def main():
    """Main hook dispatcher"""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)
        hook_event_name = input_data.get('hook_event_name', '')

        # Initialize DevFlow integration
        integration = DevFlowIntegration()

        # Route to appropriate handler
        if hook_event_name == 'SessionStart':
            result = await integration.handle_session_start(input_data)
        elif hook_event_name == 'PostToolUse':
            result = await integration.handle_post_tool_use(input_data)
        elif hook_event_name == 'UserPromptSubmit':
            result = await integration.handle_user_prompt_submit(input_data)
        else:
            result = {"status": "ignored", "event": hook_event_name}

        # Output result
        print(json.dumps(result))

    except Exception as e:
        error_result = {
            "status": "error",
            "error": str(e),
            "hook_event": input_data.get('hook_event_name', 'unknown') if 'input_data' in locals() else 'unknown'
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())