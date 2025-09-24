"""
Hook System Integration Tests

Following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 3.2 exactly
Tests complete hook processing pipeline including:
- NLP hook trigger detection
- Hook end-to-end processing pipeline
- CometaBrainHook class functionality
- Mock database integration
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, Any, List
import json

# Assuming these are the modules we're testing (would need to be implemented)
# from cometa_brain.hooks import CometaBrainHook
# from cometa_brain.nlp import HookTriggerDetector
# from cometa_brain.processing import HookProcessingPipeline


class MockDatabase:
    """Mock database implementation for testing"""
    
    def __init__(self):
        self.hooks = {}
        self.executed_hooks = []
        
    def save_hook(self, hook_id: str, hook_data: Dict[str, Any]) -> None:
        self.hooks[hook_id] = hook_data
        
    def get_hook(self, hook_id: str) -> Dict[str, Any]:
        return self.hooks.get(hook_id, {})
        
    def record_hook_execution(self, hook_id: str, execution_data: Dict[str, Any]) -> None:
        self.executed_hooks.append({
            'hook_id': hook_id,
            'execution_data': execution_data
        })
        
    def get_executed_hooks(self) -> List[Dict[str, Any]]:
        return self.executed_hooks


class CometaBrainHook:
    """Mock CometaBrainHook class for testing"""
    
    def __init__(self, hook_id: str, trigger_phrase: str, action: str):
        self.hook_id = hook_id
        self.trigger_phrase = trigger_phrase
        self.action = action
        self.is_active = True
        
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the hook action"""
        return {
            'hook_id': self.hook_id,
            'action': self.action,
            'context': context,
            'result': f"Executed {self.action} with context {context}"
        }


class HookTriggerDetector:
    """Mock NLP hook trigger detector"""
    
    def __init__(self, database: MockDatabase):
        self.database = database
        self.registered_hooks = {}
        
    def register_hook(self, hook: CometaBrainHook) -> None:
        """Register a hook for trigger detection"""
        self.registered_hooks[hook.hook_id] = hook
        
    def detect_triggers(self, text: str) -> List[str]:
        """Detect which hooks are triggered by the given text"""
        triggered_hooks = []
        for hook_id, hook in self.registered_hooks.items():
            if hook.trigger_phrase.lower() in text.lower():
                triggered_hooks.append(hook_id)
        return triggered_hooks


class HookProcessingPipeline:
    """Mock hook processing pipeline"""
    
    def __init__(self, database: MockDatabase):
        self.database = database
        self.trigger_detector = HookTriggerDetector(database)
        
    def process_input(self, input_text: str, context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Process input through the complete hook pipeline"""
        if context is None:
            context = {}
            
        # Detect triggers
        triggered_hook_ids = self.trigger_detector.detect_triggers(input_text)
        
        # Execute triggered hooks
        results = []
        for hook_id in triggered_hook_ids:
            hook = self.trigger_detector.registered_hooks.get(hook_id)
            if hook and hook.is_active:
                result = hook.execute(context)
                results.append(result)
                # Record execution in database
                self.database.record_hook_execution(hook_id, result)
                
        return results


class HookSystemIntegrationTests(unittest.TestCase):
    """Complete Hook System Integration Test Suite"""
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.database = MockDatabase()
        self.pipeline = HookProcessingPipeline(self.database)
        
        # Create test hooks
        self.weather_hook = CometaBrainHook(
            hook_id="hook_weather_001",
            trigger_phrase="weather",
            action="get_weather_forecast"
        )
        
        self.reminder_hook = CometaBrainHook(
            hook_id="hook_reminder_002",
            trigger_phrase="remind me",
            action="set_reminder"
        )
        
        self.music_hook = CometaBrainHook(
            hook_id="hook_music_003",
            trigger_phrase="play music",
            action="play_song"
        )
        
        # Register hooks
        self.pipeline.trigger_detector.register_hook(self.weather_hook)
        self.pipeline.trigger_detector.register_hook(self.reminder_hook)
        self.pipeline.trigger_detector.register_hook(self.music_hook)
        
    def test_nlp_hook_trigger_detection_single_trigger(self):
        """Test 3.2.1 - NLP hook trigger detection with single trigger phrase"""
        # Test input that should trigger weather hook
        test_input = "What's the weather like today?"
        
        # Detect triggers
        triggered_hooks = self.pipeline.trigger_detector.detect_triggers(test_input)
        
        # Assert only weather hook is triggered
        self.assertEqual(len(triggered_hooks), 1)
        self.assertIn("hook_weather_001", triggered_hooks)
        self.assertNotIn("hook_reminder_002", triggered_hooks)
        self.assertNotIn("hook_music_003", triggered_hooks)
        
    def test_nlp_hook_trigger_detection_multiple_triggers(self):
        """Test 3.2.2 - NLP hook trigger detection with multiple trigger phrases"""
        # Test input that should trigger multiple hooks
        test_input = "Remind me to check the weather and play some music"
        
        # Detect triggers
        triggered_hooks = self.pipeline.trigger_detector.detect_triggers(test_input)
        
        # Assert multiple hooks are triggered
        self.assertEqual(len(triggered_hooks), 3)
        self.assertIn("hook_reminder_002", triggered_hooks)
        self.assertIn("hook_weather_001", triggered_hooks)
        self.assertIn("hook_music_003", triggered_hooks)
        
    def test_nlp_hook_trigger_detection_no_triggers(self):
        """Test 3.2.3 - NLP hook trigger detection with no matching phrases"""
        # Test input that should not trigger any hooks
        test_input = "This is just a regular sentence with no triggers"
        
        # Detect triggers
        triggered_hooks = self.pipeline.trigger_detector.detect_triggers(test_input)
        
        # Assert no hooks are triggered
        self.assertEqual(len(triggered_hooks), 0)
        
    def test_hook_end_to_end_processing_single_hook(self):
        """Test 3.2.4 - Hook end-to-end processing pipeline with single hook"""
        # Test input that should trigger weather hook
        test_input = "Can you tell me about the weather forecast?"
        context = {"user_id": "user_123", "location": "New York"}
        
        # Process through pipeline
        results = self.pipeline.process_input(test_input, context)
        
        # Assert single result
        self.assertEqual(len(results), 1)
        
        # Assert correct hook was executed
        result = results[0]
        self.assertEqual(result['hook_id'], "hook_weather_001")
        self.assertEqual(result['action'], "get_weather_forecast")
        self.assertEqual(result['context'], context)
        
        # Assert execution was recorded in database
        executed_hooks = self.database.get_executed_hooks()
        self.assertEqual(len(executed_hooks), 1)
        self.assertEqual(executed_hooks[0]['hook_id'], "hook_weather_001")
        
    def test_hook_end_to_end_processing_multiple_hooks(self):
        """Test 3.2.5 - Hook end-to-end processing pipeline with multiple hooks"""
        # Test input that should trigger multiple hooks
        test_input = "Please remind me about the meeting, check the weather, and play music"
        context = {"user_id": "user_456", "priority": "high"}
        
        # Process through pipeline
        results = self.pipeline.process_input(test_input, context)
        
        # Assert multiple results
        self.assertEqual(len(results), 3)
        
        # Collect executed hook IDs
        executed_hook_ids = [result['hook_id'] for result in results]
        
        # Assert all expected hooks were executed
        self.assertIn("hook_reminder_002", executed_hook_ids)
        self.assertIn("hook_weather_001", executed_hook_ids)
        self.assertIn("hook_music_003", executed_hook_ids)
        
        # Assert executions were recorded in database
        executed_hooks = self.database.get_executed_hooks()
        self.assertEqual(len(executed_hooks), 3)
        
        executed_hook_ids_db = [hook['hook_id'] for hook in executed_hooks]
        self.assertIn("hook_reminder_002", executed_hook_ids_db)
        self.assertIn("hook_weather_001", executed_hook_ids_db)
        self.assertIn("hook_music_003", executed_hook_ids_db)
        
    def test_hook_end_to_end_processing_no_hooks(self):
        """Test 3.2.6 - Hook end-to-end processing pipeline with no matching hooks"""
        # Test input that should not trigger any hooks
        test_input = "Just a regular sentence with no hook triggers"
        context = {"user_id": "user_789"}
        
        # Process through pipeline
        results = self.pipeline.process_input(test_input, context)
        
        # Assert no results
        self.assertEqual(len(results), 0)
        
        # Assert no executions were recorded in database
        executed_hooks = self.database.get_executed_hooks()
        self.assertEqual(len(executed_hooks), 0)
        
    def test_cometabrainhook_class_execution(self):
        """Test 3.2.7 - CometaBrainHook class execution functionality"""
        # Test hook execution
        context = {"param1": "value1", "param2": "value2"}
        result = self.weather_hook.execute(context)
        
        # Assert execution result structure
        self.assertIsInstance(result, dict)
        self.assertEqual(result['hook_id'], self.weather_hook.hook_id)
        self.assertEqual(result['action'], self.weather_hook.action)
        self.assertEqual(result['context'], context)
        self.assertIn("Executed", result['result'])
        
    def test_cometabrainhook_class_properties(self):
        """Test 3.2.8 - CometaBrainHook class properties and initialization"""
        # Assert hook properties
        self.assertEqual(self.reminder_hook.hook_id, "hook_reminder_002")
        self.assertEqual(self.reminder_hook.trigger_phrase, "remind me")
        self.assertEqual(self.reminder_hook.action, "set_reminder")
        self.assertTrue(self.reminder_hook.is_active)
        
    def test_mock_database_integration_hook_storage(self):
        """Test 3.2.9 - Mock database integration for hook storage"""
        # Save hook to database
        hook_data = {
            "trigger_phrase": "test trigger",
            "action": "test_action",
            "created_at": "2023-01-01T00:00:00Z"
        }
        
        self.database.save_hook("test_hook_001", hook_data)
        
        # Retrieve hook from database
        retrieved_data = self.database.get_hook("test_hook_001")
        
        # Assert data integrity
        self.assertEqual(retrieved_data, hook_data)
        self.assertEqual(retrieved_data['trigger_phrase'], "test trigger")
        self.assertEqual(retrieved_data['action'], "test_action")
        
    def test_mock_database_integration_execution_recording(self):
        """Test 3.2.10 - Mock database integration for hook execution recording"""
        # Record hook execution
        execution_data = {
            "timestamp": "2023-01-01T00:00:00Z",
            "result": "success",
            "duration_ms": 150
        }
        
        self.database.record_hook_execution("hook_test_001", execution_data)
        
        # Retrieve executed hooks
        executed_hooks = self.database.get_executed_hooks()
        
        # Assert execution was recorded
        self.assertEqual(len(executed_hooks), 1)
        self.assertEqual(executed_hooks[0]['hook_id'], "hook_test_001")
        self.assertEqual(executed_hooks[0]['execution_data'], execution_data)


if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)