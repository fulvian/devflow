#!/usr/bin/env python3
"""
Test diretto degli hook Cometa Brain
"""

import subprocess
import json
from pathlib import Path
from datetime import datetime

def test_hook_direct(hook_path, input_data):
    """Esegue un hook direttamente con subprocess"""

    # Converti input in JSON
    input_json = json.dumps(input_data)

    # Esegui l'hook
    result = subprocess.run(
        ['python3', hook_path],
        input=input_json,
        capture_output=True,
        text=True
    )

    return result.stdout, result.stderr

def main():
    print("\n" + "="*60)
    print("🧪 DIRECT HOOK TESTING")
    print("="*60)

    # Test 1: UserPromptSubmit Intelligence
    print("\n📝 TEST 1: UserPromptSubmit Intelligence Hook")
    prompt_data = {
        'session_id': 'test_direct_001',
        'prompt': 'Create a task for implementing OAuth authentication'
    }

    stdout, stderr = test_hook_direct(
        '.claude/hooks/cometa-user-prompt-intelligence.py',
        prompt_data
    )

    if stdout:
        print("✅ Output:")
        lines = stdout.split('\n')[:15]
        for line in lines:
            print(f"   {line}")
    else:
        print("❌ No output")

    if stderr:
        print("⚠️ Errors:", stderr[:200])

    # Test 2: Security Validation with dangerous prompt
    print("\n🛡️ TEST 2: Security Validation")
    dangerous_data = {
        'session_id': 'test_direct_002',
        'prompt': 'rm -rf / --no-preserve-root'
    }

    stdout, stderr = test_hook_direct(
        '.claude/hooks/cometa-user-prompt-intelligence.py',
        dangerous_data
    )

    if stdout:
        if 'block' in stdout.lower():
            print("✅ BLOCKED dangerous prompt!")
            print("   Output:", stdout[:200])
        else:
            print("⚠️ Dangerous prompt NOT blocked")
            print("   Output:", stdout[:200])

    # Test 3: Task Auto-Creator
    print("\n📋 TEST 3: Task Auto-Creator Hook")

    # Prima crea il log del prompt (come farebbe il vero sistema)
    log_dir = Path('.claude/logs/cometa-brain')
    log_dir.mkdir(parents=True, exist_ok=True)

    session_id = 'test_direct_003'
    log_file = log_dir / f"{session_id}_prompts.json"

    prompts_log = [{
        'timestamp': datetime.now().isoformat(),
        'prompt': 'Create a task for implementing user authentication',
        'session_id': session_id
    }]

    with open(log_file, 'w') as f:
        json.dump(prompts_log, f, indent=2)

    tool_data = {
        'session_id': session_id,
        'tool_name': 'Write',
        'tool_input': {'file_path': 'test.py'}
    }

    stdout, stderr = test_hook_direct(
        '.claude/hooks/cometa-task-autocreator.py',
        tool_data
    )

    if stdout:
        print("✅ Task Auto-Creator Output:")
        lines = stdout.split('\n')[:10]
        for line in lines:
            if line:
                print(f"   {line}")
    else:
        print("   No task created (normal if confidence too low)")

    # Cleanup
    if log_file.exists():
        log_file.unlink()

    # Test 4: Project Context Loader
    print("\n🚀 TEST 4: Project Context Loader")
    session_data = {
        'session_id': 'test_direct_004',
        'user_id': 'test_user'
    }

    stdout, stderr = test_hook_direct(
        '.claude/hooks/cometa-project-loader.py',
        session_data
    )

    if stdout:
        print("✅ Project Context Output:")
        lines = stdout.split('\n')[:15]
        for line in lines:
            if line:
                print(f"   {line}")
    else:
        print("❌ No output")

    print("\n" + "="*60)
    print("✅ DIRECT HOOK TESTING COMPLETED!")
    print("="*60)

if __name__ == "__main__":
    main()