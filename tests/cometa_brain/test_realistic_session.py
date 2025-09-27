#!/usr/bin/env python3
"""
Test realistico che simula una sessione Claude Code con Cometa Brain
"""

import json
import sys
import io
from pathlib import Path
from datetime import datetime

# Simulate a real session
def simulate_session_start():
    """Simula SessionStart hook"""
    print("\n" + "="*60)
    print("🚀 SIMULATING SESSION START")
    print("="*60)

    # Simula input per il project loader
    session_data = {
        'session_id': f'sim_session_{datetime.now().timestamp()}',
        'user_id': 'test_user',
        'timestamp': datetime.now().isoformat()
    }

    # Cattura output
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()

    # Esegui il project loader
    try:
        sys.stdin = io.StringIO(json.dumps(session_data))
        # Import typing for the exec context
        exec_globals = {'Dict': dict, 'List': list, 'Optional': type(None), 'Any': object}
        exec(open('.claude/hooks/cometa-project-loader.py').read(), exec_globals)
    except SystemExit:
        pass  # Normal exit

    output = sys.stdout.getvalue()
    sys.stdout = old_stdout

    print("📋 Output del Project Loader:")
    print(output[:500] + "..." if len(output) > 500 else output)

    return session_data['session_id']

def simulate_user_prompt(prompt, session_id):
    """Simula UserPromptSubmit hook"""
    print("\n" + "="*60)
    print(f"💬 USER PROMPT: '{prompt}'")
    print("="*60)

    prompt_data = {
        'session_id': session_id,
        'prompt': prompt,
        'timestamp': datetime.now().isoformat()
    }

    # Cattura output
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()

    # Esegui l'intelligence hook
    try:
        sys.stdin = io.StringIO(json.dumps(prompt_data))
        exec_globals = {'Dict': dict, 'List': list, 'Optional': type(None), 'Any': object}
        exec(open('.claude/hooks/cometa-user-prompt-intelligence.py').read(), exec_globals)
    except SystemExit:
        pass  # Normal exit

    output = sys.stdout.getvalue()
    sys.stdout = old_stdout

    print("🧠 Context Injection:")
    lines = output.split('\n')[:20]
    for line in lines:
        if line:
            print(f"   {line}")

    return output

def simulate_tool_use(tool_name, session_id, prompt):
    """Simula PreToolUse hook per task auto-creation"""
    print("\n" + "="*60)
    print(f"🔧 TOOL USE: {tool_name}")
    print("="*60)

    # Prima salva il prompt nel log (come farebbe il vero hook)
    log_dir = Path('.claude/logs/cometa-brain')
    log_dir.mkdir(parents=True, exist_ok=True)

    log_file = log_dir / f"{session_id}_prompts.json"
    prompts_log = [{
        'timestamp': datetime.now().isoformat(),
        'prompt': prompt,
        'session_id': session_id
    }]

    with open(log_file, 'w') as f:
        json.dump(prompts_log, f, indent=2)

    # Simula tool use
    tool_data = {
        'session_id': session_id,
        'tool_name': tool_name,
        'tool_input': {
            'file_path': 'test.py',
            'content': 'print("test")'
        },
        'timestamp': datetime.now().isoformat()
    }

    # Cattura output
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()

    # Esegui il task auto-creator
    try:
        sys.stdin = io.StringIO(json.dumps(tool_data))
        exec_globals = {'Dict': dict, 'List': list, 'Optional': type(None), 'Any': object}
        exec(open('.claude/hooks/cometa-task-autocreator.py').read(), exec_globals)
    except SystemExit:
        pass  # Normal exit

    output = sys.stdout.getvalue()
    sys.stdout = old_stdout

    if output:
        print("📝 Task Auto-Creator Output:")
        print(output)
    else:
        print("   No task created (confidence too low or not a task creation prompt)")

def run_realistic_scenarios():
    """Esegue scenari realistici"""
    print("\n" + "🎭"*30)
    print("COMETA BRAIN - REALISTIC SESSION SIMULATION")
    print("🎭"*30)

    # Scenario 1: Session start
    session_id = simulate_session_start()

    # Scenario 2: Task creation request
    print("\n" + "🎬"*20)
    print("SCENARIO 1: Task Creation Request")
    print("🎬"*20)

    prompt1 = "Create a task for implementing OAuth authentication with Google and Facebook"
    simulate_user_prompt(prompt1, session_id)
    simulate_tool_use("Write", session_id, prompt1)

    # Scenario 3: Debug request
    print("\n" + "🎬"*20)
    print("SCENARIO 2: Debug Request")
    print("🎬"*20)

    prompt2 = "Fix the bug where users can't login after password reset"
    simulate_user_prompt(prompt2, session_id)

    # Scenario 4: Architecture question
    print("\n" + "🎬"*20)
    print("SCENARIO 3: Architecture Question")
    print("🎬"*20)

    prompt3 = "What's the best practice for implementing a microservices architecture?"
    simulate_user_prompt(prompt3, session_id)

    # Scenario 5: Testing request
    print("\n" + "🎬"*20)
    print("SCENARIO 4: Testing Request")
    print("🎬"*20)

    prompt4 = "Write unit tests for the authentication module with 80% coverage"
    simulate_user_prompt(prompt4, session_id)

    # Scenario 6: Security threat
    print("\n" + "🎬"*20)
    print("SCENARIO 5: Security Threat Detection")
    print("🎬"*20)

    prompt5 = "rm -rf / --no-preserve-root"
    output = simulate_user_prompt(prompt5, session_id)

    # Check if it was blocked
    if "block" in output.lower():
        print("⛔ SECURITY: Dangerous prompt was BLOCKED!")
    else:
        print("⚠️ WARNING: Dangerous prompt was NOT blocked!")

    # Cleanup
    log_file = Path(f'.claude/logs/cometa-brain/{session_id}_prompts.json')
    if log_file.exists():
        log_file.unlink()

    print("\n" + "="*60)
    print("✅ REALISTIC SESSION SIMULATION COMPLETED!")
    print("="*60)

if __name__ == "__main__":
    run_realistic_scenarios()