#!/usr/bin/env python3
"""
Test Hook System Directly
Simulate exactly how Claude Code calls the hook
"""

import json
import subprocess
import os

def test_hook_direct_call():
    """Test hook system by calling it directly like Claude Code does"""
    print("🔗 Testing Hook System Direct Call")

    # Test data simulating SessionStart with project command
    test_data = {
        "hook_event_name": "SessionStart",
        "task_name": "test-project-creation",
        "session_id": "test-session-123",
        "user_message": "crea progetto Test Hook Direct"
    }

    # Test 1: SessionStart event
    print("\n1️⃣ Testing SessionStart hook...")
    try:
        result = subprocess.run(
            ["python3", ".claude/hooks/devflow-integration.py"],
            input=json.dumps(test_data),
            text=True,
            capture_output=True,
            timeout=30,
            cwd="/Users/fulvioventura/devflow"  # Ensure correct working directory
        )

        print(f"Exit code: {result.returncode}")
        print(f"Stdout: {result.stdout}")
        if result.stderr:
            print(f"Stderr: {result.stderr}")

        if result.returncode == 0:
            try:
                hook_result = json.loads(result.stdout)
                print("✅ Hook executed successfully")
                print(f"Result: {json.dumps(hook_result, indent=2)}")
            except json.JSONDecodeError as e:
                print(f"❌ Invalid JSON response: {e}")
        else:
            print("❌ Hook failed")

    except subprocess.TimeoutExpired:
        print("❌ Hook timed out")
    except Exception as e:
        print(f"❌ Error running hook: {e}")

    # Test 2: Direct database operations
    print("\n2️⃣ Testing direct database operations...")
    try:
        # Add the hook directory to the Python path by copying DirectProjectClient code
        hook_test_code = '''
import sqlite3
from datetime import datetime
import os

class DirectProjectClient:
    def __init__(self, db_path="./data/devflow_unified.sqlite"):
        self.db_path = db_path
        print(f"📍 Using database: {os.path.abspath(db_path)}")

    def create_project(self, name, description=""):
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO projects (name, description, status, progress, created_at, updated_at)
                VALUES (?, ?, 'active', 0, ?, ?)
            """, (name, description, datetime.now().isoformat(), datetime.now().isoformat()))
            project_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return {"id": project_id, "name": name, "status": "created", "success": True}
        except sqlite3.IntegrityError:
            return {"error": "Project already exists", "name": name, "success": False}
        except Exception as e:
            return {"error": str(e), "success": False}

    def handle_project_command(self, command):
        command_lower = command.lower().strip()
        if command_lower.startswith("crea progetto"):
            project_name = command_lower.replace("crea progetto", "").strip()
            if not project_name:
                project_name = "Test Project"
            result = self.create_project(project_name, "Progetto creato tramite hook system")
            if result.get("success"):
                return {"output": f"✅ Progetto '{project_name}' creato con successo (ID: {result.get('id', 'N/A')})"}
            else:
                return {"output": f"⚠️ {result.get('error', 'Errore sconosciuto')}"}
        else:
            return {"output": f"❓ Comando non riconosciuto: {command}"}

# Test the client
client = DirectProjectClient()
result = client.handle_project_command("crea progetto Test Hook Direct 2")
print(f"Direct test result: {result}")
'''

        with open("/tmp/test_hook_direct.py", "w") as f:
            f.write(hook_test_code)

        result = subprocess.run(
            ["python3", "/tmp/test_hook_direct.py"],
            capture_output=True,
            text=True,
            cwd="/Users/fulvioventura/devflow"
        )

        print(f"Direct test exit code: {result.returncode}")
        print(f"Direct test output: {result.stdout}")
        if result.stderr:
            print(f"Direct test stderr: {result.stderr}")

    except Exception as e:
        print(f"❌ Error in direct test: {e}")

if __name__ == "__main__":
    test_hook_direct_call()
    print("\n📊 Hook Direct Test Complete")