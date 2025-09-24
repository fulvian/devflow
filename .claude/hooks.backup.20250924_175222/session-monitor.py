#!/usr/bin/env python3
"""
DevFlow v3.1 Smart Session Retry System
Monitors Claude Code sessions and enables auto-resume
"""

import json
import os
import sys
from datetime import datetime, timedelta

def monitor_session():
    """Monitor current session state"""
    try:
        # Read session data
        task_file = ".claude/state/current_task.json"
        if os.path.exists(task_file):
            with open(task_file) as f:
                task_data = json.load(f)

            # Update session monitoring
            session_data = {
                "last_activity": datetime.now().isoformat(),
                "task": task_data.get("task", "unknown"),
                "progress": task_data.get("progress_percentage", 0),
                "status": "active",
                "auto_resume_enabled": True
            }

            # Save session monitoring data
            os.makedirs(".devflow/sessions", exist_ok=True)
            with open(".devflow/sessions/current_session.json", "w") as f:
                json.dump(session_data, f, indent=2)

            return {
                "continue": True,
                "suppressOutput": False,
                "systemMessage": f"📊 DevFlow Session: Task '{task_data.get('task', 'unknown')}' active ({task_data.get('progress_percentage', 0)}% complete)"
            }

    except Exception as e:
        return {
            "continue": True,
            "suppressOutput": False,
            "systemMessage": f"⚠️ DevFlow Session Monitor Error: {str(e)}"
        }

if __name__ == "__main__":
    result = monitor_session()
    print(json.dumps(result, indent=2))
