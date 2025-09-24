"""
Natural Language Interface Compliance Tests

Implements complete Natural Language Interface compliance tests following 
PIANO_TEST_DEBUG_COMETA_BRAIN.md section 11.4 exactly.

Tests include:
- Command pattern recognition
- Natural language flexibility
- Contextual understanding
- Validation of original command patterns
"""

import unittest
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import re


@dataclass
class TestCommand:
    """Represents a test command with expected outcomes"""
    input_text: str
    expected_pattern: str
    expected_action: str
    expected_parameters: Dict[str, Any]
    context: Optional[Dict[str, Any]] = None


class NaturalLanguageProcessor:
    """
    Simulated Natural Language Processor for testing purposes.
    In a real implementation, this would interface with an actual NLP system.
    """
    
    def __init__(self):
        # Define command patterns based on original design
        self.patterns = {
            'create_task': [
                r'create(?: a)? task(?: called)? (.+)',
                r'add(?: a)? task(?: named)? (.+)',
                r'make(?: a)? new task (.+)'
            ],
            'delete_task': [
                r'delete(?: the)? task (.+)',
                r'remove(?: the)? task (.+)',
                r'get rid of(?: the)? task (.+)'
            ],
            'update_task': [
                r'(?:update|modify|change)(?: the)? task (.+) to (.+)',
                r'set(?: the)? task (.+) (?:to|as) (.+)'
            ],
            'list_tasks': [
                r'(?:show|list|display)(?: all)? tasks',
                r'what tasks (?:do I have|are there)',
                r'give me (?:a )?list of tasks'
            ],
            'get_task': [
                r'(?:get|show|display)(?: the)? task (.+)',
                r'what is (?:the )?task (.+)',
                r'tell me about (?:the )?task (.+)'
            ]
        }
        
        # Map patterns to actions
        self.action_map = {
            'create_task': 'CREATE_TASK',
            'delete_task': 'DELETE_TASK',
            'update_task': 'UPDATE_TASK',
            'list_tasks': 'LIST_TASKS',
            'get_task': 'GET_TASK'
        }
    
    def process_command(self, text: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Process natural language command and return structured output.
        
        Args:
            text: Natural language input text
            context: Optional context information
            
        Returns:
            Dictionary with action and parameters
        """
        text = text.lower().strip()
        
        # Check each pattern group
        for pattern_group, patterns in self.patterns.items():
            for pattern in patterns:
                match = re.match(pattern, text)
                if match:
                    action = self.action_map[pattern_group]
                    parameters = {}
                    
                    if pattern_group == 'create_task':
                        parameters['task_name'] = match.group(1).strip()
                    elif pattern_group == 'delete_task':
                        parameters['task_name'] = match.group(1).strip()
                    elif pattern_group == 'update_task':
                        parameters['task_name'] = match.group(1).strip()
                        parameters['new_value'] = match.group(2).strip()
                    elif pattern_group == 'get_task':
                        parameters['task_name'] = match.group(1).strip()
                    # list_tasks has no parameters
                    
                    return {
                        'pattern_matched': pattern_group,
                        'action': action,
                        'parameters': parameters,
                        'context': context or {}
                    }
        
        # No pattern matched
        return {
            'pattern_matched': None,
            'action': 'UNKNOWN',
            'parameters': {},
            'context': context or {}
        }


class NaturalLanguageInterfaceComplianceTest(unittest.TestCase):
    """Test suite for Natural Language Interface compliance"""
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        self.nlp = NaturalLanguageProcessor()
        self.test_commands = self._get_test_commands()
    
    def _get_test_commands(self) -> List[TestCommand]:
        """Define test commands according to section 11.4 requirements"""
        return [
            # Test 1: Basic command pattern recognition
            TestCommand(
                input_text="Create a task called Meeting Preparation",
                expected_pattern="create_task",
                expected_action="CREATE_TASK",
                expected_parameters={"task_name": "meeting preparation"}
            ),
            
            # Test 2: Natural language flexibility - alternative phrasing
            TestCommand(
                input_text="Add task Named Project Review",
                expected_pattern="create_task",
                expected_action="CREATE_TASK",
                expected_parameters={"task_name": "project review"}
            ),
            
            # Test 3: Natural language flexibility - different verb
            TestCommand(
                input_text="Make a new task Complete Documentation",
                expected_pattern="create_task",
                expected_action="CREATE_TASK",
                expected_parameters={"task_name": "complete documentation"}
            ),
            
            # Test 4: Delete command pattern
            TestCommand(
                input_text="Delete the task Outdated Report",
                expected_pattern="delete_task",
                expected_action="DELETE_TASK",
                expected_parameters={"task_name": "outdated report"}
            ),
            
            # Test 5: Delete command flexibility
            TestCommand(
                input_text="Remove task Weekly Summary",
                expected_pattern="delete_task",
                expected_action="DELETE_TASK",
                expected_parameters={"task_name": "weekly summary"}
            ),
            
            # Test 6: Update command pattern
            TestCommand(
                input_text="Update the task Draft Document to Final Version",
                expected_pattern="update_task",
                expected_action="UPDATE_TASK",
                expected_parameters={
                    "task_name": "draft document",
                    "new_value": "final version"
                }
            ),
            
            # Test 7: Update command flexibility
            TestCommand(
                input_text="Set the task Status as Completed",
                expected_pattern="update_task",
                expected_action="UPDATE_TASK",
                expected_parameters={
                    "task_name": "status",
                    "new_value": "completed"
                }
            ),
            
            # Test 8: List tasks pattern
            TestCommand(
                input_text="Show all tasks",
                expected_pattern="list_tasks",
                expected_action="LIST_TASKS",
                expected_parameters={}
            ),
            
            # Test 9: List tasks flexibility
            TestCommand(
                input_text="What tasks do I have",
                expected_pattern="list_tasks",
                expected_action="LIST_TASKS",
                expected_parameters={}
            ),
            
            # Test 10: Get task pattern
            TestCommand(
                input_text="Get the task Important Meeting",
                expected_pattern="get_task",
                expected_action="GET_TASK",
                expected_parameters={"task_name": "important meeting"}
            ),
            
            # Test 11: Get task flexibility
            TestCommand(
                input_text="Tell me about the task Client Presentation",
                expected_pattern="get_task",
                expected_action="GET_TASK",
                expected_parameters={"task_name": "client presentation"}
            ),
            
            # Test 12: Contextual understanding with context
            TestCommand(
                input_text="Update to High Priority",
                expected_pattern="update_task",
                expected_action="UPDATE_TASK",
                expected_parameters={
                    "task_name": "current task",
                    "new_value": "high priority"
                },
                context={"current_task": "current task"}
            ),
            
            # Test 13: Validate original command patterns - exact match
            TestCommand(
                input_text="create task Submit Report",
                expected_pattern="create_task",
                expected_action="CREATE_TASK",
                expected_parameters={"task_name": "submit report"}
            ),
            
            # Test 14: Complex natural language
            TestCommand(
                input_text="I would like to add a task named Review Code Changes please",
                expected_pattern="create_task",
                expected_action="CREATE_TASK",
                expected_parameters={"task_name": "review code changes please"}
            ),
            
            # Test 15: Edge case - no match
            TestCommand(
                input_text="This is not a valid command pattern",
                expected_pattern=None,
                expected_action="UNKNOWN",
                expected_parameters={}
            )
        ]
    
    def test_command_pattern_recognition(self):
        """Test 11.4.1: Command pattern recognition compliance"""
        # Test basic pattern recognition for all defined command types
        pattern_tests = [
            cmd for cmd in self.test_commands 
            if cmd.expected_pattern is not None
        ]
        
        for test_cmd in pattern_tests:
            with self.subTest(input_text=test_cmd.input_text):
                result = self.nlp.process_command(
                    test_cmd.input_text, 
                    test_cmd.context
                )
                
                # Verify pattern was recognized
                self.assertEqual(
                    result['pattern_matched'], 
                    test_cmd.expected_pattern,
                    f"Pattern mismatch for '{test_cmd.input_text}'"
                )
                
                # Verify action mapping
                self.assertEqual(
                    result['action'], 
                    test_cmd.expected_action,
                    f"Action mismatch for '{test_cmd.input_text}'"
                )
    
    def test_natural_language_flexibility(self):
        """Test 11.4.2: Natural language flexibility compliance"""
        # Test that various phrasings of the same command are recognized
        create_variations = [
            cmd for cmd in self.test_commands 
            if cmd.expected_pattern == "create_task"
        ]
        
        for test_cmd in create_variations:
            with self.subTest(input_text=test_cmd.input_text):
                result = self.nlp.process_command(test_cmd.input_text)
                
                # All should map to create_task pattern
                self.assertEqual(
                    result['pattern_matched'], 
                    "create_task",
                    f"Flexibility test failed for '{test_cmd.input_text}'"
                )
                
                # Action should be consistent
                self.assertEqual(
                    result['action'], 
                    "CREATE_TASK",
                    f"Action inconsistency for '{test_cmd.input_text}'"
                )
    
    def test_contextual_understanding(self):
        """Test 11.4.3: Contextual understanding compliance"""
        # Test commands that require context for proper interpretation
        context_tests = [
            cmd for cmd in self.test_commands 
            if cmd.context is not None
        ]
        
        for test_cmd in context_tests:
            with self.subTest(input_text=test_cmd.input_text):
                result = self.nlp.process_command(
                    test_cmd.input_text, 
                    test_cmd.context
                )
                
                # Verify context is preserved
                self.assertEqual(
                    result['context'], 
                    test_cmd.context,
                    f"Context not preserved for '{test_cmd.input_text}'"
                )
                
                # Verify pattern recognition with context
                self.assertEqual(
                    result['pattern_matched'], 
                    test_cmd.expected_pattern,
                    f"Contextual pattern recognition failed for '{test_cmd.input_text}'"
                )
    
    def test_original_command_patterns(self):
        """Test 11.4.4: Validate original command patterns compliance"""
        # Test exact matches to original design specifications
        original_pattern_tests = [
            cmd for cmd in self.test_commands 
            if "original" in (cmd.context or {}).get("test_type", "")
        ]
        
        # Add original pattern tests if not already present
        if not original_pattern_tests:
            original_pattern_tests = [
                TestCommand(
                    input_text="create task Submit Report",
                    expected_pattern="create_task",
                    expected_action="CREATE_TASK",
                    expected_parameters={"task_name": "submit report"},
                    context={"test_type": "original"}
                ),
                TestCommand(
                    input_text="delete task Old Document",
                    expected_pattern="delete_task",
                    expected_action="DELETE_TASK",
                    expected_parameters={"task_name": "old document"},
                    context={"test_type": "original"}
                )
            ]
        
        for test_cmd in original_pattern_tests:
            with self.subTest(input_text=test_cmd.input_text):
                result = self.nlp.process_command(
                    test_cmd.input_text, 
                    test_cmd.context
                )
                
                # Verify exact pattern matching
                self.assertEqual(
                    result['pattern_matched'], 
                    test_cmd.expected_pattern,
                    f"Original pattern validation failed for '{test_cmd.input_text}'"
                )
                
                # Verify parameter extraction
                self.assertEqual(
                    result['parameters'], 
                    test_cmd.expected_parameters,
                    f"Parameter extraction failed for '{test_cmd.input_text}'"
                )
    
    def test_parameter_extraction_accuracy(self):
        """Test parameter extraction accuracy for all command types"""
        for test_cmd in self.test_commands:
            if test_cmd.expected_parameters:  # Skip tests without parameters
                with self.subTest(input_text=test_cmd.input_text):
                    result = self.nlp.process_command(test_cmd.input_text)
                    
                    # Check that all expected parameters are present
                    for key, expected_value in test_cmd.expected_parameters.items():
                        self.assertIn(
                            key, 
                            result['parameters'],
                            f"Missing parameter '{key}' in result for '{test_cmd.input_text}'"
                        )
                        
                        # For string parameters, do case-insensitive comparison
                        if isinstance(expected_value, str):
                            actual_value = result['parameters'][key]
                            self.assertEqual(
                                actual_value.lower(), 
                                expected_value.lower(),
                                f"Parameter '{key}' value mismatch for '{test_cmd.input_text}'"
                            )
                        else:
                            self.assertEqual(
                                result['parameters'][key], 
                                expected_value,
                                f"Parameter '{key}' value mismatch for '{test_cmd.input_text}'"
                            )
    
    def test_error_handling_unknown_commands(self):
        """Test handling of unrecognized command patterns"""
        unknown_commands = [
            cmd for cmd in self.test_commands 
            if cmd.expected_pattern is None
        ]
        
        for test_cmd in unknown_commands:
            with self.subTest(input_text=test_cmd.input_text):
                result = self.nlp.process_command(test_cmd.input_text)
                
                # Should return UNKNOWN action
                self.assertEqual(
                    result['action'], 
                    "UNKNOWN",
                    f"Unknown command not handled properly: '{test_cmd.input_text}'"
                )
                
                # Should have no pattern match
                self.assertIsNone(
                    result['pattern_matched'],
                    f"Pattern incorrectly matched for unknown command: '{test_cmd.input_text}'"
                )


if __name__ == '__main__':
    # Run the compliance tests
    unittest.main(verbosity=2)