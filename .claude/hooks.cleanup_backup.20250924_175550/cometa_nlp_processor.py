#!/usr/bin/env python3
"""
Cometa Brain Natural Language Command Processor
Converts natural language to structured commands using TypeChat patterns
"""

import json
import sys
import sqlite3
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Union
import subprocess
# import pysnooper  # Temporarily commented for testing

DB_PATH = Path('./data/devflow_unified.sqlite')
SCHEMAS_PATH = Path('.claude/hooks/schemas/cometa-command-schemas.ts')

class NaturalLanguageCommandProcessor:
    """Processes natural language commands using TypeChat-inspired patterns"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.command_patterns = self._load_command_patterns()

    def _load_command_patterns(self) -> Dict[str, Dict]:
        """Load command patterns for intent detection"""
        return {
            'task_management': {
                'create': [
                    r'create\s+(?:a\s+)?(?:new\s+)?task\s+(?:for\s+|to\s+|called\s+)?(.+)',
                    r'add\s+(?:a\s+)?(?:new\s+)?task\s*:\s*(.+)',
                    r'new\s+task\s*:\s*(.+)',
                    r'i\s+need\s+to\s+(.+?)(?:\s+as\s+(?:high|medium|low)\s+priority)?',
                    r'let\'s\s+(?:create|add|make)\s+(.+)',
                ],
                'update': [
                    r'update\s+task\s+(.+?)\s+(?:to\s+|with\s+)(.+)',
                    r'change\s+(.+?)\s+(?:to\s+|status\s+to\s+)(.+)',
                    r'mark\s+(.+?)\s+as\s+(.+)',
                    r'set\s+(.+?)\s+(?:priority\s+)?(?:to\s+)?(.+)',
                ],
                'complete': [
                    r'complete\s+(?:task\s+)?(.+)',
                    r'finish\s+(?:task\s+)?(.+)',
                    r'done\s+(?:with\s+)?(.+)',
                    r'mark\s+(.+?)\s+(?:as\s+)?(?:complete|done|finished)',
                ],
                'list': [
                    r'(?:list|show|display)\s+(?:all\s+)?tasks?(?:\s+(?:for|in|with)\s+(.+))?',
                    r'what\s+tasks?\s+(?:do\s+i\s+have|are\s+(?:active|pending|in\s+progress))',
                    r'show\s+me\s+(?:my\s+)?(?:active|pending|current)\s+tasks?',
                ],
                'search': [
                    r'find\s+tasks?\s+(?:about|for|containing|with)\s+(.+)',
                    r'search\s+(?:for\s+)?tasks?\s+(.+)',
                    r'tasks?\s+(?:related\s+to|about)\s+(.+)',
                ]
            },
            'project_management': {
                'switch': [
                    r'switch\s+to\s+project\s+(.+)',
                    r'work\s+on\s+project\s+(.+)',
                    r'activate\s+project\s+(.+)',
                ],
                'status': [
                    r'(?:project\s+)?status',
                    r'what\s+project\s+am\s+i\s+working\s+on',
                    r'current\s+project',
                ],
                'create': [
                    r'create\s+(?:a\s+)?(?:new\s+)?project\s+(?:called\s+)?(.+)',
                    r'new\s+project\s*:\s*(.+)',
                ]
            },
            'system': {
                'status': [
                    r'(?:system\s+)?status',
                    r'how\s+(?:is\s+)?(?:everything|the\s+system)(?:\s+doing)?',
                    r'cometa\s+(?:brain\s+)?status',
                ],
                'metrics': [
                    r'(?:show\s+)?(?:metrics|stats|statistics)',
                    r'performance\s+(?:metrics|stats)',
                    r'how\s+(?:many|much)\s+(.+)',
                ],
                'help': [
                    r'help',
                    r'what\s+can\s+(?:i\s+do|you\s+do)',
                    r'available\s+commands',
                    r'how\s+(?:do\s+i|to)\s+(.+)',
                ]
            }
        }

    # @pysnooper.snoop('/Users/fulvioventura/devflow/temp/nlp-processor-trace.log')
    def process_command(self, natural_language_input: str) -> Dict[str, Any]:
        """
        Main entry point: convert natural language to structured command

        Args:
            natural_language_input: Raw user input

        Returns:
            Dict with command structure or error
        """
        try:
            # Normalize input
            input_normalized = natural_language_input.strip().lower()

            # Detect intent and extract parameters
            intent_result = self._detect_intent(input_normalized)

            if not intent_result['success']:
                return self._create_error_response(
                    "Could not understand command",
                    suggestions=self._get_help_suggestions()
                )

            # Build structured command
            command = self._build_command(intent_result, natural_language_input)

            # Validate command structure
            validation_result = self._validate_command(command)

            if not validation_result['isValid']:
                return self._create_error_response(
                    f"Invalid command: {'; '.join(validation_result['errors'])}",
                    suggestions=validation_result.get('suggestions', [])
                )

            return {
                'success': True,
                'command': command,
                'natural_input': natural_language_input,
                'confidence': intent_result['confidence'],
                'processing_time_ms': 0  # TODO: add timing
            }

        except Exception as e:
            return self._create_error_response(f"Processing error: {str(e)}")

    def _detect_intent(self, input_text: str) -> Dict[str, Any]:
        """Detect user intent using pattern matching"""
        best_match = None
        max_confidence = 0.0

        for category, operations in self.command_patterns.items():
            for operation, patterns in operations.items():
                for pattern in patterns:
                    match = re.search(pattern, input_text, re.IGNORECASE)
                    if match:
                        # Calculate confidence based on pattern specificity
                        confidence = len(pattern) / 100.0  # Simple heuristic
                        confidence += 0.1 if '\\s+' in pattern else 0  # Bonus for word boundaries
                        confidence = min(confidence, 1.0)

                        if confidence > max_confidence:
                            max_confidence = confidence
                            best_match = {
                                'category': category,
                                'operation': operation,
                                'pattern': pattern,
                                'match': match,
                                'groups': match.groups() if match.groups() else []
                            }

        if best_match and max_confidence > 0.3:  # Threshold for valid detection
            return {
                'success': True,
                'confidence': max_confidence,
                **best_match
            }

        return {'success': False, 'confidence': 0.0}

    def _build_command(self, intent_result: Dict, original_input: str) -> Dict[str, Any]:
        """Build structured command from intent detection result"""
        category = intent_result['category']
        operation = intent_result['operation']
        groups = intent_result.get('groups', [])

        command = {
            'intent': f"{category}.{operation}",
            'action': {
                'type': category,
                'operation': operation
            },
            'confidence': intent_result['confidence'],
            'original_input': original_input
        }

        # Extract operation-specific parameters
        if category == 'task_management':
            command['action'].update(self._extract_task_parameters(operation, groups, original_input))
        elif category == 'project_management':
            command['action'].update(self._extract_project_parameters(operation, groups, original_input))
        elif category == 'system':
            command['action'].update(self._extract_system_parameters(operation, groups, original_input))

        return command

    def _extract_task_parameters(self, operation: str, groups: List[str], input_text: str) -> Dict[str, Any]:
        """Extract task-specific parameters"""
        params = {}

        if operation == 'create' and groups:
            params['target'] = {'title': groups[0].strip()}
            params['properties'] = {
                'title': groups[0].strip(),
                'description': groups[0].strip(),
                'priority': self._extract_priority(input_text),
                'status': 'pending'
            }

        elif operation == 'update' and len(groups) >= 2:
            params['target'] = {'title': groups[0].strip()}
            params['properties'] = self._parse_update_properties(groups[1].strip())

        elif operation == 'complete' and groups:
            params['target'] = {'title': groups[0].strip()}
            params['properties'] = {'status': 'completed'}

        elif operation == 'list':
            params['filters'] = self._extract_list_filters(input_text)

        elif operation == 'search' and groups:
            params['filters'] = {'search_text': groups[0].strip()}

        return params

    def _extract_priority(self, text: str) -> str:
        """Extract priority from text"""
        text_lower = text.lower()
        if any(word in text_lower for word in ['urgent', 'critical', 'high', 'asap']):
            return 'h-'
        elif any(word in text_lower for word in ['low', 'optional', 'later', 'eventually']):
            return 'l-'
        return 'm-'

    def _parse_update_properties(self, update_text: str) -> Dict[str, Any]:
        """Parse update text into properties"""
        properties = {}
        text_lower = update_text.lower()

        # Status updates
        if any(word in text_lower for word in ['complete', 'done', 'finished']):
            properties['status'] = 'completed'
        elif any(word in text_lower for word in ['progress', 'working', 'active']):
            properties['status'] = 'in_progress'
        elif any(word in text_lower for word in ['pending', 'todo', 'waiting']):
            properties['status'] = 'pending'
        elif any(word in text_lower for word in ['blocked', 'stuck', 'waiting']):
            properties['status'] = 'blocked'

        # Priority updates
        if any(word in text_lower for word in ['high', 'urgent', 'critical']):
            properties['priority'] = 'h-'
        elif any(word in text_lower for word in ['low', 'optional']):
            properties['priority'] = 'l-'
        elif 'medium' in text_lower:
            properties['priority'] = 'm-'

        return properties

    def _extract_list_filters(self, text: str) -> Dict[str, Any]:
        """Extract filters for list operations"""
        filters = {}
        text_lower = text.lower()

        # Status filters
        if 'active' in text_lower or 'in progress' in text_lower:
            filters['status'] = ['in_progress']
        elif 'pending' in text_lower:
            filters['status'] = ['pending']
        elif 'completed' in text_lower or 'done' in text_lower:
            filters['status'] = ['completed']

        # Priority filters
        if 'high priority' in text_lower or 'urgent' in text_lower:
            filters['priority'] = ['h-']
        elif 'low priority' in text_lower:
            filters['priority'] = ['l-']

        return filters

    def _extract_project_parameters(self, operation: str, groups: List[str], input_text: str) -> Dict[str, Any]:
        """Extract project-specific parameters"""
        params = {}

        if operation == 'switch' and groups:
            params['target'] = {'name': groups[0].strip()}
        elif operation == 'create' and groups:
            params['target'] = {'name': groups[0].strip()}
            params['properties'] = {
                'name': groups[0].strip(),
                'status': 'active'
            }

        return params

    def _extract_system_parameters(self, operation: str, groups: List[str], input_text: str) -> Dict[str, Any]:
        """Extract system-specific parameters"""
        params = {}

        if operation == 'metrics':
            if 'memory' in input_text.lower():
                params['scope'] = 'memory'
            elif 'pattern' in input_text.lower():
                params['scope'] = 'patterns'
            elif 'session' in input_text.lower():
                params['scope'] = 'sessions'
            else:
                params['scope'] = 'all'

        return params

    def _validate_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Validate command structure"""
        errors = []
        suggestions = []

        # Basic structure validation
        if 'intent' not in command:
            errors.append("Missing intent")

        if 'action' not in command:
            errors.append("Missing action")
        elif 'type' not in command['action'] or 'operation' not in command['action']:
            errors.append("Invalid action structure")

        # Task-specific validation
        if command.get('action', {}).get('type') == 'task_management':
            operation = command['action'].get('operation')

            if operation in ['create', 'update'] and not command['action'].get('properties'):
                errors.append(f"Missing properties for {operation} operation")
                suggestions.append("Provide task title and description")

            if operation in ['update', 'complete'] and not command['action'].get('target'):
                errors.append(f"Missing target for {operation} operation")
                suggestions.append("Specify which task to update")

        return {
            'isValid': len(errors) == 0,
            'errors': errors,
            'suggestions': suggestions
        }

    def _create_error_response(self, message: str, suggestions: List[str] = None) -> Dict[str, Any]:
        """Create standardized error response"""
        return {
            'success': False,
            'error': message,
            'suggestions': suggestions or []
        }

    def _get_help_suggestions(self) -> List[str]:
        """Get general help suggestions"""
        return [
            "Try: 'create task for implementing feature X'",
            "Try: 'list active tasks'",
            "Try: 'complete task authentication'",
            "Try: 'show project status'",
            "Try: 'help' for more commands"
        ]

def main():
    """Entry point for CLI testing"""
    if len(sys.argv) < 2:
        print("Usage: python cometa-nlp-processor.py 'natural language command'")
        sys.exit(1)

    processor = NaturalLanguageCommandProcessor(DB_PATH)
    result = processor.process_command(sys.argv[1])

    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()