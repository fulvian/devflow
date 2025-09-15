#!/usr/bin/env python3
"""
DevFlow PostToolUse Footer Hook
Captures system state after tool use and updates footer status file
Based on cc-sessions successful footer implementation pattern
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path

def get_devflow_state():
    """Get current DevFlow system state"""
    project_root = Path(__file__).parent.parent.parent

    # Read current task
    task_info = {"task": "devflow-v3_1-deployment", "progress": 100}
    current_task_file = project_root / ".claude/state/current_task.json"
    if current_task_file.exists():
        try:
            with open(current_task_file) as f:
                task_data = json.load(f)
                task_info["task"] = task_data.get("task", "unknown")
                task_info["progress"] = task_data.get("progress_percentage", 0)
        except:
            pass

    # Check service status
    services = []
    pid_files = [
        (".database.pid", "Database"),
        (".registry.pid", "Registry"),
        (".vector.pid", "Vector"),
        (".optimizer.pid", "Optimizer"),
        (".synthetic.pid", "Synthetic"),
        (".ccr.pid", "CCR"),
        (".enforcement.pid", "Enforcement")
    ]

    active_services = 0
    for pid_file, name in pid_files:
        pid_path = project_root / pid_file
        is_active = False
        if pid_path.exists():
            try:
                with open(pid_path) as f:
                    pid = f.read().strip()
                    if pid == "MCP_READY":
                        is_active = True
                    else:
                        # Check if process is running
                        import subprocess
                        try:
                            subprocess.run(["kill", "-0", pid], check=True, capture_output=True)
                            is_active = True
                        except:
                            pass
            except:
                pass

        if is_active:
            active_services += 1
            services.append({"name": name, "status": "active"})
        else:
            services.append({"name": name, "status": "inactive"})

    return {
        "task": task_info,
        "services": services,
        "active_services": active_services,
        "total_services": len(pid_files),
        "system_status": "PRODUCTION" if active_services >= 5 else "PARTIAL" if active_services >= 3 else "DEGRADED"
    }

def update_footer_state(tool_info):
    """Update footer state file"""
    project_root = Path(__file__).parent.parent.parent
    devflow_dir = project_root / ".devflow"
    devflow_dir.mkdir(exist_ok=True)

    state_file = devflow_dir / "footer-state.json"

    # Get current state
    devflow_state = get_devflow_state()

    # Create footer state
    footer_state = {
        "timestamp": datetime.now().isoformat(),
        "version": "3.1",
        "progress": {
            "percentage": devflow_state["task"]["progress"],
            "current_task": devflow_state["task"]["task"]
        },
        "system": {
            "status": devflow_state["system_status"],
            "services_active": devflow_state["active_services"],
            "services_total": devflow_state["total_services"]
        },
        "mode": "PRODUCTION",
        "last_tool": tool_info.get("tool", "unknown"),
        "services": devflow_state["services"]
    }

    # Write state file
    try:
        with open(state_file, 'w') as f:
            json.dump(footer_state, f, indent=2)
    except Exception as e:
        # Log error
        log_file = project_root / "logs/footer-debug.log"
        log_file.parent.mkdir(exist_ok=True)
        with open(log_file, 'a') as f:
            f.write(f"{datetime.now().isoformat()}: Error writing footer state: {e}\n")

def main():
    """Main hook function"""
    try:
        # Read hook input
        input_data = sys.stdin.read()
        if input_data.strip():
            hook_input = json.loads(input_data)
        else:
            hook_input = {}

        # Update footer state
        update_footer_state(hook_input)

        # Return hook response (no specific output needed for PostToolUse)
        response = {
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "footerUpdated": True,
                "status": "success"
            }
        }

        print(json.dumps(response))

    except Exception as e:
        # Log error and return empty response
        project_root = Path(__file__).parent.parent.parent
        log_file = project_root / "logs/footer-debug.log"
        log_file.parent.mkdir(exist_ok=True)
        with open(log_file, 'a') as f:
            f.write(f"{datetime.now().isoformat()}: PostToolUse hook error: {e}\n")

        print(json.dumps({"hookSpecificOutput": {}}))

if __name__ == "__main__":
    main()