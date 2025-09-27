#!/usr/bin/env python3
"""
Auto-Logging System Test Suite
Comprehensive testing of database session logging functionality
"""

import os
import sys
import json
import subprocess
import sqlite3
from datetime import datetime

def test_stop_hook_integration():
    """Test stop hook integration with database logging"""
    print("🧪 Testing stop hook integration...")

    # Run stop hook
    try:
        result = subprocess.run(
            ['node', '.claude/hooks/stop-hook.js'],
            cwd='/Users/fulvioventura/devflow',
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            print("✅ Stop hook executed successfully")
            print(f"Output: {result.stdout}")
            return True
        else:
            print(f"❌ Stop hook failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Stop hook test failed: {e}")
        return False

def test_database_session_logging():
    """Test direct database session logging"""
    print("🧪 Testing database session logging...")

    # Mock input for database logger
    test_input = {
        "session_id": f"test-{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "hook_event_name": "Test",
        "cwd": "/Users/fulvioventura/devflow",
        "tool_name": "Edit",
        "tool_input": {
            "file_path": "/test/auto-logging.py",
            "content": "# Auto-logging test\nprint('System working!')"
        },
        "transcript": "Testing comprehensive auto-logging system implementation"
    }

    try:
        # Run database logger hook
        process = subprocess.Popen(
            ['python3', '.claude/hooks/database-session-logger.py'],
            cwd='/Users/fulvioventura/devflow',
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        stdout, stderr = process.communicate(input=json.dumps(test_input), timeout=10)

        if process.returncode == 0:
            print("✅ Database session logger executed successfully")
            if stdout.strip():
                print(f"Output: {stdout}")
            return True
        else:
            print(f"❌ Database session logger failed: {stderr}")
            return False

    except Exception as e:
        print(f"❌ Database logging test failed: {e}")
        return False

def test_database_entries():
    """Test that entries are being written to database"""
    print("🧪 Testing database entries...")

    try:
        conn = sqlite3.connect('./data/devflow_unified.sqlite')
        cursor = conn.cursor()

        # Get recent sessions
        cursor.execute("""
            SELECT id, status, updated_at, metadata
            FROM sessions
            WHERE id LIKE 'test-%' OR updated_at >= date('now', '-1 hour')
            ORDER BY updated_at DESC
            LIMIT 5
        """)

        sessions = cursor.fetchall()

        if sessions:
            print(f"✅ Found {len(sessions)} recent session(s):")
            for session in sessions:
                session_id, status, updated_at, metadata_json = session
                metadata = {}
                try:
                    metadata = json.loads(metadata_json) if metadata_json else {}
                except:
                    pass

                auto_logged = metadata.get('auto_logged', False)
                trigger_type = metadata.get('trigger_type', 'unknown')

                print(f"  📝 {session_id} | {status} | {trigger_type} | auto: {auto_logged}")

            conn.close()
            return True
        else:
            print("❌ No recent sessions found in database")
            conn.close()
            return False

    except Exception as e:
        print(f"❌ Database entries test failed: {e}")
        return False

def run_comprehensive_test():
    """Run complete test suite"""
    print("🚀 Starting Auto-Logging System Test Suite")
    print("=" * 50)

    tests = [
        ("Database Session Logging", test_database_session_logging),
        ("Database Entries Verification", test_database_entries),
        ("Stop Hook Integration", test_stop_hook_integration),
    ]

    results = []

    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 30)

        success = test_func()
        results.append((test_name, success))

        if success:
            print(f"✅ {test_name}: PASSED")
        else:
            print(f"❌ {test_name}: FAILED")

    # Summary
    print("\n" + "=" * 50)
    print("🏁 TEST SUMMARY")
    print("=" * 50)

    passed = sum(1 for _, success in results if success)
    total = len(results)

    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status:<15} {test_name}")

    print(f"\n🎯 Results: {passed}/{total} tests passed")

    if passed == total:
        print("🎉 All tests passed! Auto-logging system is working correctly.")
        return True
    else:
        print("⚠️  Some tests failed. Auto-logging system needs attention.")
        return False

if __name__ == "__main__":
    success = run_comprehensive_test()
    sys.exit(0 if success else 1)