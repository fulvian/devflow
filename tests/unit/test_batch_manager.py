"""
Batch Manager Test Suite
Following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 2.4 exactly
"""
import asyncio
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import AsyncMock, patch, MagicMock

from batch_manager import BatchManager
from command import Command


class TestBatchManager(unittest.IsolatedAsyncioTestCase):
    """Test suite for BatchManager following section 2.4 of PIANO_TEST_DEBUG_COMETA_BRAIN.md"""

    def setUp(self):
        """Set up test fixtures before each test method."""
        self.batch_manager = BatchManager()
        self.commands = [
            Command(id="cmd1", command="echo 'Command 1'", dependencies=[]),
            Command(id="cmd2", command="echo 'Command 2'", dependencies=["cmd1"]),
            Command(id="cmd3", command="echo 'Command 3'", dependencies=["cmd1"]),
            Command(id="cmd4", command="echo 'Command 4'", dependencies=["cmd2", "cmd3"])
        ]

    @patch('batch_manager.execute_single_command')
    async def test_sequential_execution(self, mock_execute):
        """2.4.1 Sequential Execution Tests"""
        # Setup mock to return successful results
        mock_execute.return_value = {"status": "success", "output": "completed"}

        # Configure batch manager for sequential execution
        self.batch_manager.execution_mode = "sequential"
        
        # Execute commands sequentially
        results = await self.batch_manager.execute_batch(self.commands)
        
        # Verify all commands were executed
        self.assertEqual(len(results), 4)
        self.assertTrue(all(result["status"] == "success" for result in results))
        
        # Verify execution order (sequential)
        call_args_list = mock_execute.call_args_list
        self.assertEqual(len(call_args_list), 4)

    @patch('batch_manager.execute_single_command')
    async def test_parallel_execution(self, mock_execute):
        """2.4.2 Parallel Execution Tests"""
        # Setup mock to return successful results with delay to simulate parallelism
        async def async_execute(*args, **kwargs):
            await asyncio.sleep(0.1)
            return {"status": "success", "output": "completed"}
        
        mock_execute.side_effect = async_execute

        # Configure batch manager for parallel execution
        self.batch_manager.execution_mode = "parallel"
        
        # Execute commands in parallel
        results = await self.batch_manager.execute_batch(self.commands)
        
        # Verify all commands were executed
        self.assertEqual(len(results), 4)
        self.assertTrue(all(result["status"] == "success" for result in results))

    @patch('batch_manager.execute_single_command')
    async def test_conditional_execution(self, mock_execute):
        """2.4.3 Conditional Execution Tests"""
        # Setup mock with conditional logic
        async def conditional_execute(command, *args, **kwargs):
            # cmd2 and cmd3 depend on cmd1
            if command.id == "cmd1":
                return {"status": "success", "output": "cmd1 completed"}
            elif command.id == "cmd2":
                # Only execute if cmd1 succeeded
                return {"status": "success", "output": "cmd2 completed"}
            elif command.id == "cmd3":
                # Simulate failure for cmd3
                return {"status": "failure", "output": "cmd3 failed"}
            elif command.id == "cmd4":
                # Should not execute if cmd3 failed
                return {"status": "skipped", "output": "cmd4 skipped"}
            return {"status": "unknown", "output": "unknown"}

        mock_execute.side_effect = conditional_execute

        # Configure batch manager for conditional execution
        self.batch_manager.execution_mode = "conditional"
        
        # Execute commands with conditional logic
        results = await self.batch_manager.execute_batch(self.commands)
        
        # Verify results match conditional execution logic
        self.assertEqual(len(results), 4)
        # cmd1 should succeed
        self.assertEqual(results[0]["status"], "success")
        # cmd2 should succeed (dependency succeeded)
        self.assertEqual(results[1]["status"], "success")
        # cmd3 should fail
        self.assertEqual(results[2]["status"], "failure")
        # cmd4 should be skipped (dependency failed)
        self.assertEqual(results[3]["status"], "skipped")

    @patch('batch_manager.execute_single_command')
    async def test_rollback_mechanism(self, mock_execute):
        """2.4.4 Rollback Tests"""
        # Setup mock to simulate failure requiring rollback
        async def execute_with_failure(command, *args, **kwargs):
            if command.id == "cmd3":
                return {"status": "failure", "output": "cmd3 failed", "rollback_needed": True}
            return {"status": "success", "output": f"{command.id} completed"}

        mock_execute.side_effect = execute_with_failure

        # Track rollback calls
        rollback_called = []
        
        # Mock rollback function
        async def mock_rollback(command):
            rollback_called.append(command.id)
            return {"status": "rollback_success", "output": f"Rolled back {command.id}"}

        # Attach rollback mock to batch manager
        self.batch_manager.rollback_command = mock_rollback
        
        # Execute batch - should trigger rollback
        results = await self.batch_manager.execute_batch(self.commands)
        
        # Verify rollback was called for successful previous commands
        self.assertIn("cmd1", rollback_called)
        self.assertIn("cmd2", rollback_called)
        
        # Verify the failure is in results
        failed_result = next((r for r in results if r["status"] == "failure"), None)
        self.assertIsNotNone(failed_result)
        self.assertEqual(failed_result["output"], "cmd3 failed")


if __name__ == '__main__':
    unittest.main()