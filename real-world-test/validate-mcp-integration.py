import os
import requests
import json
import sqlite3
from datetime import datetime
import sys

def load_env_file(env_path=".env"):
    """Load environment variables from .env file"""
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value
        print(f"✅ Environment variables loaded from {env_path}")
    else:
        print(f"⚠️  Environment file {env_path} not found")

def validate_environment():
    """Validate required environment variables"""
    print("🔍 Validating environment variables...")

    synthetic_api_key = os.getenv('SYNTHETIC_API_KEY')
    if not synthetic_api_key:
        print("❌ SYNTHETIC_API_KEY not found in environment")
        return False

    print("✅ SYNTHETIC_API_KEY present")
    return True

def test_devflow_database():
    """Test connection to DevFlow SQLite database"""
    print("\n🗄️  Testing DevFlow database connectivity...")

    db_path = "/Users/fulvioventura/devflow/data/devflow.sqlite"

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check if task_contexts table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='task_contexts'")
        table_exists = cursor.fetchone()

        if table_exists:
            print("  ✅ task_contexts table exists")

            # Check table structure
            cursor.execute("PRAGMA table_info(task_contexts)")
            columns = cursor.fetchall()
            print(f"  📊 Table has {len(columns)} columns")

            # Count existing tasks
            cursor.execute("SELECT COUNT(*) FROM task_contexts")
            count = cursor.fetchone()[0]
            print(f"  📋 Current tasks in database: {count}")

        else:
            print("  ❌ task_contexts table not found")
            conn.close()
            return False

        conn.close()
        print("✅ DevFlow database connectivity test passed")
        return True

    except Exception as e:
        print(f"❌ DevFlow database test failed: {str(e)}")
        return False

def test_synthetic_api():
    """Test Synthetic API connectivity with actual endpoint"""
    print("\n🔌 Testing Synthetic API connectivity...")

    synthetic_api_key = os.getenv('SYNTHETIC_API_KEY')
    if not synthetic_api_key:
        print("❌ No API key available")
        return False

    # Test with actual Synthetic API endpoint
    headers = {
        'Authorization': f'Bearer {synthetic_api_key}',
        'Content-Type': 'application/json'
    }

    # Simple test request to check API availability
    test_data = {
        "messages": [
            {"role": "user", "content": "Hello, testing API connectivity"}
        ],
        "model": "hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
        "max_tokens": 50
    }

    try:
        response = requests.post(
            'https://api.synthetic.new/v1/chat/completions',
            headers=headers,
            json=test_data,
            timeout=30
        )

        if response.status_code == 200:
            print("✅ Synthetic API connectivity test passed")
            result = response.json()
            print(f"  📊 API Response: {len(result.get('choices', []))} choices returned")
            return True
        else:
            print(f"❌ Synthetic API test failed - Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}...")
            return False

    except requests.exceptions.RequestException as e:
        print(f"❌ Synthetic API connectivity failed: {str(e)}")
        return False

def validate_devflow_services():
    """Check if DevFlow services are running by checking PID files"""
    print("\n⚙️  Validating DevFlow services status...")

    service_pids = {
        ".database.pid": "Database Manager",
        ".registry.pid": "Model Registry",
        ".vector.pid": "Vector Memory",
        ".optimizer.pid": "Token Optimizer",
        ".synthetic.pid": "Synthetic MCP",
        ".ccr.pid": "Auto CCR Runner",
        ".enforcement.pid": "Enforcement Daemon"
    }

    running_services = 0
    for pid_file, service_name in service_pids.items():
        pid_path = f"/Users/fulvioventura/devflow/{pid_file}"

        if os.path.exists(pid_path):
            print(f"  ✅ {service_name}: Running")
            running_services += 1
        else:
            print(f"  ❌ {service_name}: Not running")

    print(f"\n📊 Services running: {running_services}/{len(service_pids)}")
    return running_services >= 5  # Most services should be running

def test_memory_system_integration():
    """Test integration with DevFlow memory system"""
    print("\n🧠 Testing memory system integration...")

    try:
        # Test semantic memory by creating a test task
        db_path = "/Users/fulvioventura/devflow/data/devflow.sqlite"
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Insert a test task to validate memory system
        test_task_id = f"test-integration-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        cursor.execute("""
            INSERT INTO task_contexts (
                id, title, description, priority, status,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            test_task_id,
            "MCP Integration Test Task",
            "Testing DevFlow memory system integration with Claude Code",
            "medium",
            "active",
            datetime.now(),
            datetime.now()
        ))

        conn.commit()

        # Verify task was created
        cursor.execute("SELECT * FROM task_contexts WHERE id = ?", (test_task_id,))
        task = cursor.fetchone()

        if task:
            print(f"  ✅ Test task created: {test_task_id}")

            # Clean up test task
            cursor.execute("DELETE FROM task_contexts WHERE id = ?", (test_task_id,))
            conn.commit()
            print("  🧹 Test task cleaned up")
        else:
            print("  ❌ Failed to create test task")
            conn.close()
            return False

        conn.close()
        print("✅ Memory system integration test passed")
        return True

    except Exception as e:
        print(f"❌ Memory system integration test failed: {str(e)}")
        return False

def main():
    """Main validation execution"""
    print("🚀 DEVFLOW MCP INTEGRATION VALIDATION")
    print("=" * 50)

    # Load environment variables from .env file
    load_env_file()

    # Track validation results
    results = {
        "environment": validate_environment(),
        "devflow_services": validate_devflow_services(),
        "devflow_database": test_devflow_database(),
        "synthetic_api": test_synthetic_api(),
        "memory_integration": test_memory_system_integration()
    }

    # Summary
    print("\n" + "=" * 50)
    print("📊 VALIDATION RESULTS")
    print("=" * 50)

    passed = sum([1 for k, v in results.items() if v])
    total = len(results)

    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.upper()}: {status}")

    print(f"\n🎯 Overall: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 ALL SYSTEMS READY FOR REAL-WORLD TESTING!")
    elif passed >= 3:
        print("⚠️  PARTIAL SUCCESS - Some components ready for testing")
    else:
        print("❌ CRITICAL ISSUES - System not ready for testing")

    return results

if __name__ == "__main__":
    results = main()
    sys.exit(0 if all(results.values()) else 1)