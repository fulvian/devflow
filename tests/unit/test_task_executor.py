"""
Task Executor Test Suite
Following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 2.2 exactly
"""

import sqlite3
import unittest
from pathlib import Path
from contextlib import contextmanager


class TaskExecutorTestSuite(unittest.TestCase):
    """Complete Task Executor test suite implementation"""

    @classmethod
    def setUpClass(cls):
        """Set up test database"""
        cls.db_path = Path("test_task_executor.db")
        cls.init_database()

    @classmethod
    def tearDownClass(cls):
        """Clean up test database"""
        if cls.db_path.exists():
            cls.db_path.unlink()

    @classmethod
    def init_database(cls):
        """Initialize database with required schema"""
        with sqlite3.connect(cls.db_path) as conn:
            cursor = conn.cursor()
            
            # Create tasks table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create task_logs table for transaction testing
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS task_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id INTEGER,
                    action TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES tasks (id)
                )
            """)
            
            conn.commit()

    @contextmanager
    def database_transaction(self):
        """Context manager for database transactions with rollback capability"""
        conn = sqlite3.connect(self.db_path)
        conn.execute("BEGIN")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def get_db_connection(self):
        """Get a new database connection"""
        return sqlite3.connect(self.db_path)

    def test_task_creation(self):
        """Task Creation Tests"""
        with self.database_transaction() as conn:
            cursor = conn.cursor()
            
            # Test 1: Create a basic task
            cursor.execute("""
                INSERT INTO tasks (title, description) 
                VALUES (?, ?)
            """, ("Test Task 1", "This is a test task"))
            
            task_id = cursor.lastrowid
            self.assertIsNotNone(task_id)
            
            # Verify task was created
            cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
            task = cursor.fetchone()
            self.assertIsNotNone(task)
            self.assertEqual(task[1], "Test Task 1")
            self.assertEqual(task[2], "This is a test task")
            self.assertEqual(task[3], "pending")
            
            # Test 2: Create task with explicit status
            cursor.execute("""
                INSERT INTO tasks (title, description, status) 
                VALUES (?, ?, ?)
            """, ("Test Task 2", "Task with explicit status", "in_progress"))
            
            task_id_2 = cursor.lastrowid
            cursor.execute("SELECT status FROM tasks WHERE id = ?", (task_id_2,))
            status = cursor.fetchone()[0]
            self.assertEqual(status, "in_progress")

    def test_task_update(self):
        """Task Update Tests"""
        with self.database_transaction() as conn:
            cursor = conn.cursor()
            
            # First create a task to update
            cursor.execute("""
                INSERT INTO tasks (title, description) 
                VALUES (?, ?)
            """, ("Original Task", "Original description"))
            
            task_id = cursor.lastrowid
            
            # Test 1: Update task title and description
            cursor.execute("""
                UPDATE tasks 
                SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, ("Updated Task", "Updated description", task_id))
            
            # Verify update
            cursor.execute("SELECT title, description FROM tasks WHERE id = ?", (task_id,))
            updated_task = cursor.fetchone()
            self.assertEqual(updated_task[0], "Updated Task")
            self.assertEqual(updated_task[1], "Updated description")
            
            # Test 2: Update task status
            cursor.execute("""
                UPDATE tasks 
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, ("completed", task_id))
            
            # Verify status update
            cursor.execute("SELECT status FROM tasks WHERE id = ?", (task_id,))
            status = cursor.fetchone()[0]
            self.assertEqual(status, "completed")

    def test_task_completion(self):
        """Task Completion Tests"""
        with self.database_transaction() as conn:
            cursor = conn.cursor()
            
            # Create a pending task
            cursor.execute("""
                INSERT INTO tasks (title, description, status) 
                VALUES (?, ?, ?)
            """, ("Completion Test Task", "Task to be completed", "pending"))
            
            task_id = cursor.lastrowid
            
            # Test 1: Mark task as completed
            cursor.execute("""
                UPDATE tasks 
                SET status = 'completed', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (task_id,))
            
            # Verify completion
            cursor.execute("SELECT status FROM tasks WHERE id = ?", (task_id,))
            status = cursor.fetchone()[0]
            self.assertEqual(status, "completed")
            
            # Test 2: Verify completion timestamp is updated
            cursor.execute("SELECT updated_at FROM tasks WHERE id = ?", (task_id,))
            updated_at = cursor.fetchone()[0]
            self.assertIsNotNone(updated_at)

    def test_transaction_rollback(self):
        """Transaction Tests with rollback"""
        # Test that transactions properly rollback on error
        conn = sqlite3.connect(self.db_path)
        
        try:
            # Begin transaction
            conn.execute("BEGIN")
            
            cursor = conn.cursor()
            
            # Insert a task
            cursor.execute("""
                INSERT INTO tasks (title, description) 
                VALUES (?, ?)
            """, ("Rollback Test Task", "This should be rolled back"))
            
            task_id = cursor.lastrowid
            
            # Insert a log entry
            cursor.execute("""
                INSERT INTO task_logs (task_id, action) 
                VALUES (?, ?)
            """, (task_id, "created"))
            
            # Intentionally cause an error to trigger rollback
            cursor.execute("INVALID SQL STATEMENT")
            
        except sqlite3.Error:
            # Rollback should happen automatically
            conn.rollback()
            
            # Verify that neither the task nor the log entry was committed
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM tasks WHERE id = ?", (task_id,))
            task_count = cursor.fetchone()[0]
            self.assertEqual(task_count, 0)
            
            cursor.execute("SELECT COUNT(*) FROM task_logs WHERE task_id = ?", (task_id,))
            log_count = cursor.fetchone()[0]
            self.assertEqual(log_count, 0)
        finally:
            conn.close()

    def test_database_initialization(self):
        """Database initialization test"""
        # Verify that the database and tables were created properly
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Check that tasks table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='tasks'
        """)
        result = cursor.fetchone()
        self.assertIsNotNone(result)
        self.assertEqual(result[0], "tasks")
        
        # Check that task_logs table exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='task_logs'
        """)
        result = cursor.fetchone()
        self.assertIsNotNone(result)
        self.assertEqual(result[0], "task_logs")
        
        # Check tasks table structure
        cursor.execute("PRAGMA table_info(tasks)")
        tasks_columns = cursor.fetchall()
        
        # Should have 6 columns: id, title, description, status, created_at, updated_at
        self.assertEqual(len(tasks_columns), 6)
        
        column_names = [col[1] for col in tasks_columns]
        expected_columns = ["id", "title", "description", "status", "created_at", "updated_at"]
        for col in expected_columns:
            self.assertIn(col, column_names)
        
        # Check task_logs table structure
        cursor.execute("PRAGMA table_info(task_logs)")
        logs_columns = cursor.fetchall()
        
        # Should have 4 columns: id, task_id, action, timestamp
        self.assertEqual(len(logs_columns), 4)
        
        column_names = [col[1] for col in logs_columns]
        expected_columns = ["id", "task_id", "action", "timestamp"]
        for col in expected_columns:
            self.assertIn(col, column_names)
        
        conn.close()


if __name__ == "__main__":
    unittest.main()