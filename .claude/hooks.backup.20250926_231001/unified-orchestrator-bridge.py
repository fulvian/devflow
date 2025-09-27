#!/usr/bin/env python3
"""
Unified Orchestrator Bridge Hook v2.0
CRITICAL PROTOCOL ENFORCEMENT - Context7 Compliant

Intercepts all coding operations and routes through Unified Orchestrator
- Security: Prevents direct agent calls
- Compliance: Enforces CLAUDE.md protocols
- Performance: Optimized routing decisions
- Standards: Context7 pattern compliance
"""

import requests
import json
import sys
import os
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional

# Import DevFlow standard hook pattern
sys.path.append('/Users/fulvioventura/devflow/.claude/hooks/base')
from standard_hook_pattern import PreToolUseHook, HookDecision

# Configuration
ORCHESTRATOR_ENDPOINT = "http://localhost:3005/api/tasks"
HEALTH_ENDPOINT = "http://localhost:3005/health"
API_TOKEN = os.getenv('DEVFLOW_API_TOKEN', 'dev-token-placeholder')
TIMEOUT_SECONDS = 30
MAX_RETRIES = 3

# Security patterns requiring orchestrator routing
SECURITY_SENSITIVE_OPERATIONS = {
    'Edit': ['sql', 'config', 'env', 'key', 'password', 'token'],
    'Write': ['py', 'js', 'ts', 'sh', 'sql'],
    'MultiEdit': True,  # Always route multi-edit operations
    'Bash': ['rm', 'sudo', 'chmod', 'git', 'npm', 'pip']
}

def log_operation(level: str, message: str, context: Dict = None):
    """Structured logging for audit trail"""
    log_entry = {
        'timestamp': datetime.now().isoformat(),
        'level': level,
        'message': message,
        'context': context or {},
        'hook': 'unified-orchestrator-bridge',
        'pid': os.getpid()
    }

    log_file = '/Users/fulvioventura/devflow/.claude/logs/orchestrator-bridge.log'
    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    with open(log_file, 'a') as f:
        f.write(json.dumps(log_entry) + '\n')

def generate_task_id(component: str = "GENERAL") -> str:
    """Generate standardized task ID with timestamp"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    sequence = hashlib.md5(f"{component}{timestamp}".encode()).hexdigest()[:4].upper()
    return f"DEVFLOW-{component}-{sequence}-{timestamp}"

def check_orchestrator_health() -> bool:
    """Verify orchestrator is responsive"""
    try:
        response = requests.get(HEALTH_ENDPOINT, timeout=5)
        return response.status_code == 200
    except:
        return False

def should_route_through_orchestrator(tool_name: str, tool_input: Dict) -> bool:
    """Determine if operation requires orchestrator routing"""

    # Always route these operations
    if tool_name in ['MultiEdit', 'mcp__codex-cli__*', 'mcp__gemini-cli__*', 'mcp__qwen-code__*']:
        return True

    # Check for security-sensitive content
    if tool_name in SECURITY_SENSITIVE_OPERATIONS:
        patterns = SECURITY_SENSITIVE_OPERATIONS[tool_name]

        if patterns is True:
            return True

        if isinstance(patterns, list):
            content = json.dumps(tool_input).lower()
            for pattern in patterns:
                if pattern in content:
                    return True

    # Check file size for Edit/Write operations
    if tool_name in ['Edit', 'Write']:
        content = tool_input.get('content', tool_input.get('new_string', ''))
        if isinstance(content, str) and content.count('\n') > 50:
            return True

    return False

def route_to_orchestrator(tool_name: str, tool_input: Dict) -> Dict:
    """Route operation through Unified Orchestrator"""

    # Generate task metadata
    task_id = generate_task_id(tool_name.replace('mcp__', '').replace('__', '-').upper())

    task_payload = {
        'task_id': task_id,
        'operation': map_tool_to_operation(tool_name),
        'tool_name': tool_name,
        'parameters': tool_input,
        'verification_required': True,
        'priority': 'high' if is_security_critical(tool_input) else 'medium',
        'timestamp': datetime.now().isoformat(),
        'source': 'claude-bridge-hook',
        'auth_token': API_TOKEN
    }

    # Attempt orchestrator routing
    for attempt in range(MAX_RETRIES):
        try:
            log_operation('INFO', f"Routing {tool_name} through orchestrator (attempt {attempt + 1})", {
                'task_id': task_id,
                'tool_name': tool_name,
                'attempt': attempt + 1
            })

            response = requests.post(
                ORCHESTRATOR_ENDPOINT,
                json=task_payload,
                headers={'Authorization': f'Bearer {API_TOKEN}'},
                timeout=TIMEOUT_SECONDS
            )

            if response.status_code == 200:
                result = response.json()
                log_operation('SUCCESS', f"Orchestrator routing successful", {
                    'task_id': task_id,
                    'agent_used': result.get('meta', {}).get('agent_used'),
                    'execution_time': result.get('meta', {}).get('execution_time_ms')
                })
                return result
            else:
                log_operation('ERROR', f"Orchestrator returned {response.status_code}", {
                    'task_id': task_id,
                    'response': response.text
                })

        except requests.exceptions.Timeout:
            log_operation('WARNING', f"Orchestrator timeout on attempt {attempt + 1}", {
                'task_id': task_id
            })

        except Exception as e:
            log_operation('ERROR', f"Orchestrator routing error: {str(e)}", {
                'task_id': task_id,
                'error': str(e)
            })

    # Fail-open: Allow direct execution if orchestrator unavailable
    log_operation('WARNING', f"Orchestrator routing failed, allowing direct execution", {
        'tool_name': tool_name,
        'fallback': 'direct_execution'
    })
    return None

def map_tool_to_operation(tool_name: str) -> str:
    """Map tool name to orchestrator operation type"""
    mapping = {
        'Edit': 'code_modification',
        'Write': 'file_creation',
        'MultiEdit': 'bulk_modification',
        'Bash': 'system_command',
        'mcp__codex-cli__codex': 'complex_coding',
        'mcp__gemini-cli__ask-gemini': 'ai_analysis',
        'mcp__qwen-code__ask-qwen': 'code_generation'
    }

    for pattern, operation in mapping.items():
        if pattern in tool_name:
            return operation

    return 'general_operation'

def is_security_critical(tool_input: Dict) -> bool:
    """Check if operation involves security-critical content"""
    content = json.dumps(tool_input).lower()
    critical_patterns = ['password', 'token', 'key', 'secret', 'auth', 'sudo', 'rm -rf']
    return any(pattern in content for pattern in critical_patterns)

class OrchestratorBridgeHook(PreToolUseHook):
    """Context7-compliant orchestrator bridge hook"""

    def __init__(self):
        super().__init__("unified-orchestrator-bridge")

    def execute_logic(self):
        """Main orchestrator routing logic"""
        tool_name = self.get_tool_name()
        tool_input = self.get_tool_input()

        # Security check first
        should_block, block_reason = self.should_block_operation()
        if should_block:
            self.logger.warning(f"Blocking {tool_name}: {block_reason}")
            self.deny(f"Security policy violation: {block_reason}")
            return

        # Check if orchestrator routing required
        if self.is_orchestrator_required():
            if not check_orchestrator_health():
                self.logger.warning("Orchestrator unavailable - allowing direct execution")
                self.approve("Orchestrator unavailable - fail-open mode")
                return

            # Route through orchestrator
            result = route_to_orchestrator(tool_name, tool_input)
            if result and result.get('status') == 'success':
                self.approve(f"Routed through orchestrator: {result.get('agent_used', 'unknown')}")
                self.response.metadata.update({
                    'orchestrator_result': result,
                    'routed': True
                })
            else:
                self.logger.error(f"Orchestrator routing failed for {tool_name}")
                self.deny("Orchestrator routing failed - blocking for safety")
                return
        else:
            # Direct execution allowed
            self.approve("Direct execution - no orchestrator routing required")
            self.response.metadata['routed'] = False

def main():
    """Main hook execution using Context7 pattern"""
    hook = OrchestratorBridgeHook()
    return hook.run()

if __name__ == "__main__":
    sys.exit(main())