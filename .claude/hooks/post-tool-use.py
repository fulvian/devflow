#!/usr/bin/env python3

"""
DevFlow Non-Invasive DAIC Hook - Production Version

Replaces invasive legacy DAIC interventions with smart, context-aware suggestions
Only intervenes when truly helpful, integrates with DevFlow v3.1 architecture
"""

import json
import sys
import requests
import os
from datetime import datetime
from pathlib import Path

DAIC_SERVICE_URL = "http://localhost:3205"
MAX_INTERVENTION_FREQUENCY = 300  # 5 minutes between interventions

def should_suggest_intervention(context):
    """Check if intervention is warranted based on context and frequency"""

    # Check if DAIC service is available
    try:
        response = requests.get(f"{DAIC_SERVICE_URL}/health", timeout=1)
        if response.status_code != 200:
            return False
    except:
        # Service not available - minimal fallback behavior
        return False

    # Get smart intervention decision from DAIC Context Manager
    try:
        intervention_data = {
            "context": context,
            "timestamp": datetime.now().isoformat(),
            "hook_type": "post-tool-use"
        }

        response = requests.post(
            f"{DAIC_SERVICE_URL}/intervention",
            json=intervention_data,
            timeout=2
        )

        if response.status_code == 200:
            result = response.json()
            return result.get("shouldIntervene", False)
    except:
        pass

    return False

def get_context_suggestion(context):
    """Get intelligent context-aware suggestion from DAIC service"""
    try:
        suggestion_data = {
            "context": context,
            "taskType": "implementation",
            "urgency": "low"
        }

        response = requests.post(
            f"{DAIC_SERVICE_URL}/suggest",
            json=suggestion_data,
            timeout=2
        )

        if response.status_code == 200:
            return response.json()
    except:
        pass

    return None

def main():
    """Non-invasive DAIC hook that respects user workflow"""

    # Load input
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        cwd = input_data.get("cwd", "")
    except:
        # Graceful fallback if input parsing fails
        sys.exit(0)

    # Get context for DAIC service
    context = {
        "tool_used": tool_name,
        "working_directory": cwd,
        "timestamp": datetime.now().isoformat(),
        "tool_input": tool_input
    }

    # Check for subagent context (maintain compatibility)
    project_root = Path(cwd)
    while project_root.parent != project_root:
        claude_dir = project_root / '.claude'
        if claude_dir.exists():
            break
        project_root = project_root.parent

    subagent_flag = project_root / '.claude' / 'state' / 'in_subagent_context.flag'
    in_subagent = subagent_flag.exists()

    # Clear subagent flag if Task tool completing
    if tool_name == "Task" and in_subagent:
        try:
            subagent_flag.unlink()
        except:
            pass

    # Only suggest if truly warranted and not in subagent
    if not in_subagent and should_suggest_intervention(context):
        suggestion = get_context_suggestion(context)

        if suggestion and suggestion.get("confidence", 0) > 0.8:
            # Non-invasive suggestion format
            print(f"💡 DevFlow: {suggestion.get('message', 'Consider workflow optimization')}", file=sys.stderr)
            sys.exit(2)  # Feed suggestion back to Claude

    # Handle cd command tracking (maintain compatibility)
    if tool_name == "Bash":
        command = tool_input.get("command", "")
        if "cd " in command:
            print(f"[CWD: {cwd}]", file=sys.stderr)
            sys.exit(2)

    # Always exit successfully to avoid blocking workflow
    sys.exit(0)

if __name__ == "__main__":
    main()