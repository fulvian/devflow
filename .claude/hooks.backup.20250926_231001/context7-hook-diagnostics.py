#!/usr/bin/env python3
"""
Context7-based Hook Diagnostics
Soluzione robusta basata su claude-code-hooks-mastery per debugging hook execution
"""

import json
import sys
import os
import subprocess
from pathlib import Path
from datetime import datetime

def validate_settings_json():
    """Validate .claude/settings.json syntax"""
    settings_path = Path.cwd() / ".claude" / "settings.json"

    if not settings_path.exists():
        return False, f"Settings file not found: {settings_path}"

    try:
        with open(settings_path) as f:
            settings = json.load(f)

        if "hooks" not in settings:
            return False, "No 'hooks' section in settings.json"

        if "UserPromptSubmit" not in settings["hooks"]:
            return False, "No 'UserPromptSubmit' in hooks section"

        return True, f"Settings valid - {len(settings['hooks']['UserPromptSubmit'])} UserPromptSubmit configs found"

    except json.JSONDecodeError as e:
        return False, f"JSON syntax error: {e}"
    except Exception as e:
        return False, f"Settings validation error: {e}"

def test_hook_commands():
    """Test individual hook commands manually (Context7 recommendation)"""
    settings_path = Path.cwd() / ".claude" / "settings.json"

    try:
        with open(settings_path) as f:
            settings = json.load(f)

        hooks = settings.get("hooks", {}).get("UserPromptSubmit", [])
        results = []

        for hook_group in hooks:
            for hook in hook_group.get("hooks", []):
                if hook.get("type") == "command":
                    command = hook["command"]

                    # Expand environment variables
                    expanded_command = os.path.expandvars(command)

                    # Test command existence
                    try:
                        # Create test JSON input
                        test_input = json.dumps({
                            "prompt": "Context7 hook test",
                            "session_id": "test-session",
                            "timestamp": datetime.now().isoformat()
                        })

                        # Test command execution
                        result = subprocess.run(
                            expanded_command.split(),
                            input=test_input,
                            capture_output=True,
                            text=True,
                            timeout=10
                        )

                        results.append({
                            "command": command,
                            "expanded": expanded_command,
                            "return_code": result.returncode,
                            "stdout": result.stdout[:200] + ("..." if len(result.stdout) > 200 else ""),
                            "stderr": result.stderr[:200] + ("..." if len(result.stderr) > 200 else ""),
                            "success": result.returncode == 0
                        })

                    except subprocess.TimeoutExpired:
                        results.append({
                            "command": command,
                            "expanded": expanded_command,
                            "error": "Command timeout (>10s)",
                            "success": False
                        })
                    except FileNotFoundError:
                        results.append({
                            "command": command,
                            "expanded": expanded_command,
                            "error": "Command not found",
                            "success": False
                        })
                    except Exception as e:
                        results.append({
                            "command": command,
                            "expanded": expanded_command,
                            "error": str(e),
                            "success": False
                        })

        return results

    except Exception as e:
        return [{"error": f"Failed to test commands: {e}"}]

def check_permissions():
    """Check script permissions (Context7 recommendation)"""
    hook_dir = Path.cwd() / ".claude" / "hooks"
    if not hook_dir.exists():
        return False, "Hook directory doesn't exist"

    issues = []
    for script in hook_dir.glob("*.py"):
        if not os.access(script, os.X_OK):
            issues.append(f"Not executable: {script.name}")

    if issues:
        return False, "; ".join(issues)
    else:
        return True, f"All {len(list(hook_dir.glob('*.py')))} Python scripts are executable"

def generate_diagnostics_report():
    """Generate comprehensive diagnostics report"""
    report = {
        "timestamp": datetime.now().isoformat(),
        "diagnostics": {}
    }

    # Test 1: Settings validation
    valid, msg = validate_settings_json()
    report["diagnostics"]["settings_validation"] = {
        "valid": valid,
        "message": msg
    }

    # Test 2: Command testing
    command_results = test_hook_commands()
    report["diagnostics"]["command_testing"] = command_results

    # Test 3: Permissions check
    perm_valid, perm_msg = check_permissions()
    report["diagnostics"]["permissions"] = {
        "valid": perm_valid,
        "message": perm_msg
    }

    # Test 4: Environment variables
    env_vars = {
        "CLAUDE_PROJECT_DIR": os.environ.get("CLAUDE_PROJECT_DIR"),
        "PWD": os.environ.get("PWD"),
        "PATH": os.environ.get("PATH", "")[:100] + "..."
    }
    report["diagnostics"]["environment"] = env_vars

    return report

def main():
    print("🔍 CONTEXT7 HOOK DIAGNOSTICS - Starting comprehensive analysis...")

    # Generate diagnostics
    report = generate_diagnostics_report()

    # Print results
    print("\n" + "="*60)
    print("DIAGNOSTICS REPORT")
    print("="*60)

    for test_name, result in report["diagnostics"].items():
        print(f"\n📊 {test_name.upper()}:")

        if test_name == "command_testing":
            for cmd_result in result:
                status = "✅" if cmd_result.get("success", False) else "❌"
                print(f"  {status} {cmd_result.get('command', 'Unknown')}")
                if not cmd_result.get("success", False):
                    error = cmd_result.get("error", cmd_result.get("stderr", "Unknown error"))
                    print(f"      Error: {error}")
                elif cmd_result.get("stdout"):
                    print(f"      Output: {cmd_result['stdout']}")
        else:
            status = "✅" if result.get("valid", True) else "❌"
            print(f"  {status} {result.get('message', result)}")

    # Summary
    print(f"\n📋 SUMMARY:")
    settings_ok = report["diagnostics"]["settings_validation"]["valid"]
    perms_ok = report["diagnostics"]["permissions"]["valid"]
    commands_ok = all(cmd.get("success", False) for cmd in report["diagnostics"]["command_testing"])

    if settings_ok and perms_ok and commands_ok:
        print("  ✅ All diagnostics PASSED - Hook configuration is correct")
        print("  🐛 Issue is likely a Claude Code bug or execution timing")
    else:
        print("  ❌ Configuration issues found - Fix these first:")
        if not settings_ok:
            print(f"    - Settings: {report['diagnostics']['settings_validation']['message']}")
        if not perms_ok:
            print(f"    - Permissions: {report['diagnostics']['permissions']['message']}")
        if not commands_ok:
            failed_commands = [cmd["command"] for cmd in report["diagnostics"]["command_testing"] if not cmd.get("success", False)]
            print(f"    - Commands: {', '.join(failed_commands)}")

    # Save report
    report_file = Path.cwd() / ".claude" / "logs" / "context7-diagnostics.json"
    report_file.parent.mkdir(parents=True, exist_ok=True)
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\n📄 Full report saved: {report_file}")

if __name__ == "__main__":
    main()