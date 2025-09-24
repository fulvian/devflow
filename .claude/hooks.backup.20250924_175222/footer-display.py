#!/usr/bin/env python3
"""
DevFlow v3.1 Custom Footer System
Generates a one-line footer, sourcing data from .devflow/footer-state.json.
Falls back to live probes only if state is unavailable.
"""

import json
import os
import sys
from datetime import datetime

STATE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                          ".devflow", "footer-state.json")

def read_state():
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def generate_footer():
    state = read_state()

    version = state.get('version', '3.1')
    progress = int(state.get('progress', {}).get('percentage') or 0)
    task = state.get('progress', {}).get('current_task') or 'active'
    token_count = state.get('progress', {}).get('token_count', 0)
    system = state.get('system', {})
    status = system.get('status', 'PARTIAL')
    services_active = system.get('services_active', 0)
    services_total = system.get('services_total', 8)
    mode = state.get('mode') or ('PRODUCTION' if os.getenv('NODE_ENV') == 'production' else 'DEV')
    last_tool = state.get('last_tool')

    # Progress bar
    filled = min(10, max(0, int(progress / 10)))
    bar = '█' * filled + '░' * (10 - filled)
    
    # Format token count
    if token_count > 1000:
        formatted_tokens = f"{token_count // 1000}k"
    else:
        formatted_tokens = str(token_count)

    footer = f"DevFlow v{version} · {status} · 🔥 {services_active}/{services_total} · {mode} · 📌 {task} · {bar} {progress}% ({formatted_tokens} tokens)"
    if last_tool:
        footer += f" · 🛠 {last_tool}"

    return {
        "hookSpecificOutput": {
            "hookEventName": "FooterDisplay",
            "footerContent": footer,
            "devflow_version": version,
            "status": "active"
        }
    }

if __name__ == "__main__":
    try:
        with open("logs/footer-debug.log", "a") as f:
            f.write(f"{datetime.now().isoformat()}: Footer hook called\n")

        result = generate_footer()
        print(json.dumps(result, indent=2))
    except Exception as e:
        error_result = {
            "hookSpecificOutput": {
                "hookEventName": "FooterDisplay",
                "footerContent": f"🧠 DevFlow v3.1 | ❌ Error: {str(e)}",
                "status": "error"
            }
        }
        print(json.dumps(error_result, indent=2))
        sys.exit(1)
