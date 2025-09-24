#!/usr/bin/env python3
"""
DevFlow Footer Detail View System
Interactive expandable details for footer components
Prefers reading consolidated state from .devflow/footer-state.json
Falls back to live probes (PID files + Synthetic health) when missing.
"""

import json
import os
import sys
import urllib.request
from datetime import datetime

STATE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                          ".devflow", "footer-state.json")

CORE_NAMES = ['Database', 'Registry', 'Vector', 'Optimizer']
INTEGRATION_NAMES = ['CCR', 'Enforcement', 'Orchestrator', 'Synthetic']

def read_state_file():
    """Read consolidated footer state if available."""
    try:
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
    except Exception:
        pass
    return None

def get_detailed_service_status():
    """Get detailed status of all DevFlow services (from state when possible)."""
    state = read_state_file()
    services = {}

    icons = {
        'Database': '🗄️',
        'Registry': '📚',
        'Vector': '🧠',
        'Optimizer': '⚡',
        'CCR': '🔄',
        'Enforcement': '🛡️',
        'Orchestrator': '🎛️',
        'Synthetic': '🤖'
    }

    if state and isinstance(state.get('services'), list):
        for s in state['services']:
            name = s.get('name')
            status = s.get('status')
            if name:
                services[name] = {'status': '✅' if status == 'active' else '❌', 'pid': '', 'icon': icons.get(name, '❓')}
        return services

    # Fallback to live probes
    probes = [
        ('.database.pid', 'Database'),
        ('.registry.pid', 'Registry'),
        ('.vector.pid', 'Vector'),
        ('.optimizer.pid', 'Optimizer'),
        ('.ccr.pid', 'CCR'),
        ('.enforcement.pid', 'Enforcement'),
        ('.orchestrator.pid', 'Orchestrator')
    ]

    for pid_file, name in probes:
        if os.path.exists(pid_file):
            try:
                with open(pid_file, 'r') as f:
                    pid = f.read().strip()
                services[name] = {'status': '✅', 'pid': pid, 'icon': icons.get(name, '❓')}
            except Exception:
                services[name] = {'status': '❌', 'pid': 'N/A', 'icon': icons.get(name, '❓')}
        else:
            services[name] = {'status': '❌', 'pid': 'N/A', 'icon': icons.get(name, '❓')}

    # Synthetic health probe
    try:
        syn_url = os.getenv('DEVFLOW_SYNTHETIC_HEALTH_URL', 'http://localhost:3000/health')
        urllib.request.urlopen(syn_url, timeout=1)
        services['Synthetic'] = {'status': '✅', 'pid': 'MCP', 'icon': icons.get('Synthetic')}
    except Exception:
        services['Synthetic'] = {'status': '❌', 'pid': 'N/A', 'icon': icons.get('Synthetic')}

    return services

def get_system_metrics():
    """Get system performance metrics"""
    try:
        import psutil

        # Memory usage
        memory = psutil.virtual_memory()
        memory_pct = memory.percent
        memory_used = memory.used // (1024**3)  # GB
        memory_total = memory.total // (1024**3)  # GB

        # CPU usage
        cpu_pct = psutil.cpu_percent(interval=1)

        return {
            'memory': {'used': memory_used, 'total': memory_total, 'percent': memory_pct},
            'cpu': {'percent': cpu_pct}
        }
    except ImportError:
        return {
            'memory': {'used': 0, 'total': 0, 'percent': 0},
            'cpu': {'percent': 0}
        }

def generate_detailed_view(component=None):
    """Generate detailed view for footer components"""

    if component == "services":
        services = get_detailed_service_status()

        # ASCII art service grid
        detail_view = """
╭─ DevFlow v3.1 Service Status ────────────────────────────────╮
│                                                              │
│  🔵 CORE SERVICES              │  🟢 INTEGRATIONS           │"""

        core_names = CORE_NAMES
        integration_names = INTEGRATION_NAMES

        for i in range(4):
            core_service = services.get(core_names[i], {})
            integration_service = services.get(integration_names[i], {})

            core_icon = core_service.get('icon', '❓')
            core_status = core_service.get('status', '❌')
            core_pid = core_service.get('pid', 'N/A')

            int_icon = integration_service.get('icon', '❓')
            int_status = integration_service.get('status', '❌')
            int_pid = integration_service.get('pid', 'N/A')

            detail_view += f"""
│  ├─ {core_icon} {core_names[i]:<15} {core_status} │  ├─ {int_icon} {integration_names[i]:<13} {int_status} │"""

        detail_view += """
│                                │                             │
╰──────────────────────────────────────────────────────────────╯"""

        return detail_view

    elif component == "metrics":
        metrics = get_system_metrics()
        state = read_state_file() or {}
        mode = state.get('mode', os.environ.get('NODE_ENV', 'development'))

        detail_view = f"""
╭─ DevFlow System Metrics ──────────────────────────────────────╮
│                                                               │
│  💾 Memory: {metrics['memory']['used']}GB / {metrics['memory']['total']}GB ({metrics['memory']['percent']:.1f}%)              │
│  🔥 CPU Load: {metrics['cpu']['percent']:.1f}% average                             │
│  🧭 Mode: {mode:<10}                                            │
│  🌐 API Calls: Active monitoring                              │
│  📊 Database: devflow.sqlite operational                      │
│                                                               │
╰───────────────────────────────────────────────────────────────╯"""

        return detail_view

    else:
        # Default overview
        services = get_detailed_service_status()
        active_count = sum(1 for s in services.values() if s['status'] == '✅')
        mode = (read_state_file() or {}).get('mode', os.environ.get('NODE_ENV', 'development'))
        status = '🟢 All Systems Operational' if active_count == 8 else '🟡 Some Issues Detected' if active_count >= 3 else '🔴 Degraded'

        return f"""
╭─ DevFlow v3.1 Quick Status ──────────────────────────────────╮
│                                                              │
│  Services: {active_count}/8 Active                                      │
│  Status: {status:<30}     │
│  Environment: {mode:<20}                    │
│                                                              │
│  Click services or metrics for detailed view                │
│                                                              │
╰──────────────────────────────────────────────────────────────╯"""

if __name__ == "__main__":
    component = sys.argv[1] if len(sys.argv) > 1 else None

    result = {
        "hookSpecificOutput": {
            "hookEventName": "FooterDetailView",
            "component": component or "overview",
            "detailContent": generate_detailed_view(component),
            "timestamp": datetime.now().isoformat()
        }
    }

    print(json.dumps(result, indent=2))
