#!/usr/bin/env python3
"""
Debug Hook Database Connection
Test DirectProjectClient in isolation to identify issues
"""

import os
import sqlite3
import sys
from pathlib import Path

def test_database_connection():
    """Test basic database connection and operations"""
    print("🔍 Debugging Hook Database Connection")
    print(f"Current directory: {os.getcwd()}")

    # Test various database paths
    test_paths = [
        "./data/devflow_unified.sqlite",
        "/Users/fulvioventura/devflow/data/devflow_unified.sqlite",
        os.path.abspath("./data/devflow_unified.sqlite")
    ]

    for db_path in test_paths:
        print(f"\n📍 Testing path: {db_path}")
        print(f"   Absolute path: {os.path.abspath(db_path)}")
        print(f"   File exists: {os.path.exists(db_path)}")

        if os.path.exists(db_path):
            try:
                # Test connection
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()

                # Check if projects table exists
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
                table_exists = cursor.fetchone() is not None
                print(f"   Projects table exists: {table_exists}")

                if table_exists:
                    # Test query
                    cursor.execute("SELECT COUNT(*) FROM projects")
                    count = cursor.fetchone()[0]
                    print(f"   Projects count: {count}")

                    # Test create operation
                    try:
                        cursor.execute("""
                            INSERT INTO projects (name, description, status, progress, created_at, updated_at)
                            VALUES (?, ?, 'active', 0, datetime('now'), datetime('now'))
                        """, ("Debug Test Project", "Test project for debugging"))

                        project_id = cursor.lastrowid
                        conn.commit()
                        print(f"   ✅ Test project created with ID: {project_id}")

                        # Clean up test project
                        cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
                        conn.commit()
                        print(f"   🧹 Test project cleaned up")

                    except sqlite3.IntegrityError as e:
                        print(f"   ⚠️ Integrity error: {e}")
                    except Exception as e:
                        print(f"   ❌ Insert error: {e}")

                conn.close()
                print(f"   ✅ Connection successful")

            except Exception as e:
                print(f"   ❌ Connection failed: {e}")
        else:
            print(f"   ❌ File not found")

def test_direct_project_client():
    """Test DirectProjectClient class directly"""
    print("\n🧪 Testing DirectProjectClient Class")

    # Add current directory to Python path to import the class
    hook_dir = Path("./.claude/hooks")
    if hook_dir.exists():
        sys.path.insert(0, str(hook_dir))

        try:
            from devflow_integration import DirectProjectClient

            print("✅ DirectProjectClient imported successfully")

            # Test with different database paths
            for db_path in ["./data/devflow_unified.sqlite", "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"]:
                print(f"\n📍 Testing DirectProjectClient with: {db_path}")

                try:
                    client = DirectProjectClient(db_path)
                    print("✅ Client created")

                    # Test project creation
                    result = client.create_project("Debug Test Project Hook", "Test from hook system debug")
                    print(f"   Create result: {result}")

                    # Test project listing
                    projects = client.get_projects()
                    print(f"   Projects found: {len(projects)}")

                    # Test project status
                    status = client.get_project_status("Debug Test Project Hook")
                    print(f"   Status result: {status}")

                    # Test command handling
                    cmd_result = client.handle_project_command("stato progetto")
                    print(f"   Command result: {cmd_result}")

                except Exception as e:
                    print(f"   ❌ DirectProjectClient error: {e}")
                    import traceback
                    print(f"   Stack trace: {traceback.format_exc()}")

        except ImportError as e:
            print(f"❌ Failed to import DirectProjectClient: {e}")
    else:
        print("❌ Hook directory not found")

if __name__ == "__main__":
    test_database_connection()
    test_direct_project_client()
    print("\n📊 Debug complete")