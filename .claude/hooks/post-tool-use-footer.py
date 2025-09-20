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
import urllib.request
import importlib.util
import traceback

def get_devflow_state():
    """Get current DevFlow system state"""
    project_root = Path(__file__).parent.parent.parent

    # Read current task from real system state
    task_info = {"task": "unknown", "progress": 0}
    current_task_file = project_root / ".claude/state/current_task.json"
    if current_task_file.exists():
        try:
            with open(current_task_file) as f:
                task_data = json.load(f)
                task_info["task"] = task_data.get("task", "unknown")
                # Try to get progress percentage directly, fallback to derived progress
                task_info["progress"] = task_data.get("progress_percentage", 0)
                if not task_info["progress"]:
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
        (".ccr.pid", "CCR"),
        (".enforcement.pid", "Enforcement"),
        (".orchestrator.pid", "Orchestrator")
    ]

    active_services = 0

    def is_pid_running(pid: str) -> bool:
        try:
            if not pid.isdigit():
                return False
            # Try absolute ps paths first (robust on macOS)
            for ps_path in ("/bin/ps", "/usr/bin/ps", "ps"):
                try:
                    import subprocess
                    res = subprocess.run([ps_path, "-p", pid], capture_output=True)
                    if res.returncode == 0:
                        return True
                except Exception:
                    continue
            # Fallback: kill -0
            try:
                import subprocess
                res = subprocess.run(["kill", "-0", pid], capture_output=True)
                return res.returncode == 0
            except Exception:
                return False
        except Exception:
            return False
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
                        # Check if process is running with robust helper
                        if is_pid_running(pid):
                            is_active = True
            except:
                pass

        if is_active:
            active_services += 1
            services.append({"name": name, "status": "active"})
        else:
            services.append({"name": name, "status": "inactive"})

    # Check Synthetic MCP health (8th service)
    synthetic_active = False
    # Consider .synthetic.pid sentinel MCP_READY as active
    syn_pid_file = project_root / ".synthetic.pid"
    if syn_pid_file.exists():
        try:
            if syn_pid_file.read_text().strip() == "MCP_READY":
                synthetic_active = True
        except Exception:
            pass
    try:
        syn_url = os.getenv('DEVFLOW_SYNTHETIC_HEALTH_URL', 'http://localhost:3000/health')
        urllib.request.urlopen(syn_url, timeout=1)
        synthetic_active = True
    except Exception:
        synthetic_active = False

    if synthetic_active:
        active_services += 1
        services.append({"name": "Synthetic", "status": "active"})
    else:
        services.append({"name": "Synthetic", "status": "inactive"})

    # Derive progress from services if not provided
    try:
        total_services = len(services)
        derived_progress = int(active_services * 100 / total_services) if total_services else 0
    except Exception:
        derived_progress = 0
    if not task_info.get("progress"):
        task_info["progress"] = derived_progress

    return {
        "task": task_info,
        "services": services,
        "active_services": active_services,
        "total_services": len(services),
        "system_status": "PRODUCTION" if active_services >= 6 else "PARTIAL" if active_services >= 3 else "DEGRADED"
    }

def sync_current_task_json(project_root, footer_state):
    """Sync .claude/state/current_task.json with footer state data"""
    try:
        current_task_file = project_root / ".claude/state/current_task.json"

        # Read existing current_task.json
        current_task_data = {}
        if current_task_file.exists():
            try:
                with open(current_task_file, 'r') as f:
                    current_task_data = json.load(f)
            except:
                pass

        # Update with footer state data
        current_task_data.update({
            "task": footer_state["progress"]["current_task"],
            "progress_percentage": footer_state["progress"]["percentage"],
            "updated": datetime.now().strftime("%Y-%m-%d")
        })

        # Preserve existing fields if they exist
        if "branch" not in current_task_data:
            current_task_data["branch"] = "feature/co-me-ta_to_real_world"
        if "services" not in current_task_data:
            current_task_data["services"] = ["ui", "real-time-platform-visibility", "footer", "session-recovery"]

        # Write updated current_task.json
        current_task_file.parent.mkdir(exist_ok=True)
        with open(current_task_file, 'w') as f:
            json.dump(current_task_data, f, indent=2)

    except Exception as e:
        # Log error but don't fail
        try:
            log_file = project_root / "logs/footer-debug.log"
            log_file.parent.mkdir(exist_ok=True)
            with open(log_file, 'a') as f:
                f.write(f"{datetime.now().isoformat()}: Error syncing current_task.json: {e}\n")
        except:
            pass

def update_footer_state(tool_info):
    """Update footer state file"""
    project_root = Path(__file__).parent.parent.parent
    devflow_dir = project_root / ".devflow"
    devflow_dir.mkdir(exist_ok=True)

    state_file = devflow_dir / "footer-state.json"

    # Get current state
    devflow_state = get_devflow_state()

    # Determine environment mode from NODE_ENV
    node_env = os.getenv('NODE_ENV', '').lower()
    mode_env = 'PRODUCTION' if node_env == 'production' else 'DEV'

    # Create footer state
    footer_state = {
        "timestamp": datetime.now().isoformat(),
        "version": "3.1",
        "progress": {
            "percentage": devflow_state["task"]["progress"],
            "current_task": devflow_state["task"]["task"],
            "token_count": devflow_state["task"].get("token_count", 0)
        },
        "system": {
            "status": devflow_state["system_status"],
            "services_active": devflow_state["active_services"],
            "services_total": devflow_state["total_services"]
        },
        "mode": mode_env,
        "last_tool": tool_info.get("tool", "unknown"),
        "services": devflow_state["services"]
    }

    # Write state file
    try:
        with open(state_file, 'w') as f:
            json.dump(footer_state, f, indent=2)

        # Sync current_task.json for cascading updates
        sync_current_task_json(project_root, footer_state)

    except Exception as e:
        # Log error
        log_file = project_root / "logs/footer-debug.log"
        log_file.parent.mkdir(exist_ok=True)
        with open(log_file, 'a') as f:
            f.write(f"{datetime.now().isoformat()}: Error writing footer state: {e}\n")
    
    # Also render footer one-liner for consumers
    try:
        hooks_dir = Path(__file__).parent
        footer_display_path = hooks_dir / 'footer-display.py'
        spec = importlib.util.spec_from_file_location('footer_display', str(footer_display_path))
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)  # type: ignore
        result = module.generate_footer() if hasattr(module, 'generate_footer') else None
        content = ''
        if isinstance(result, dict):
            content = (
                result.get('hookSpecificOutput', {}) or {}
            ).get('footerContent', '')
        if content:
            with open(devflow_dir / 'footer-line.txt', 'w') as f:
                f.write(content + "\n")
    except Exception as e:
        log_file = project_root / "logs/footer-debug.log"
        log_file.parent.mkdir(exist_ok=True)
        with open(log_file, 'a') as f:
            f.write(
                f"{datetime.now().isoformat()}: Error rendering footer line: {e}\n{traceback.format_exc()}\n"
            )

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
