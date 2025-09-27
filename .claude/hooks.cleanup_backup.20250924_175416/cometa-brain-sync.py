#!/usr/bin/env python3
"""
Cometa Brain Sync Hook - Minimal Context7 Implementation
Always succeeds, handles SessionStart specifically
"""

import json
import sys
import os
import subprocess
import uuid
from datetime import datetime

def main():
    """Main hook execution - Context7 compliant"""

    # Read input (resilient)
    input_data = {}
    try:
        # Only try to read from stdin if it's not a TTY (i.e., data is piped)
        if not sys.stdin.isatty():
            input_data = json.load(sys.stdin)
    except:
        # If any error in reading/parsing, use empty dict
        pass

    # Ensure required Context7 fields
    if not input_data.get('session_id'):
        input_data['session_id'] = str(uuid.uuid4())[:8]

    if not input_data.get('hook_event_name'):
        input_data['hook_event_name'] = os.getenv('HOOK_EVENT', 'PostToolUse')

    if not input_data.get('cwd'):
        input_data['cwd'] = '/Users/fulvioventura/devflow'

    # Try to run Cometa Brain sync (optional)
    sync_success = False
    try:
        script_path = "/Users/fulvioventura/devflow/src/core/cometa/cometa-brain-authority.js"
        if os.path.exists(script_path):
            env = os.environ.copy()
            env["DB_PATH"] = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
            env["HOOK_EVENT"] = input_data['hook_event_name']

            result = subprocess.run(
                ["node", script_path],
                env=env,
                capture_output=True,
                text=True,
                timeout=10,
                cwd="/Users/fulvioventura/devflow"
            )
            sync_success = result.returncode == 0
    except:
        pass  # Sync failure is not critical

    # Always return Context7-compliant success response
    response = {
        "continue": True,
        "metadata": {
            "hook_name": "cometa-brain-sync",
            "session_id": input_data['session_id'],
            "execution_time": datetime.now().isoformat(),
            "cometa_sync_success": sync_success,
            "hook_event": input_data['hook_event_name']
        }
    }

    print(json.dumps(response, indent=2))
    return 0

if __name__ == "__main__":
    sys.exit(main())