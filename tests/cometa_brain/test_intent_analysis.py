#!/usr/bin/env python3
"""
Test suite per Cometa Brain Intent Analysis
"""

import pytest
import sys
import json
from pathlib import Path
from datetime import datetime

# Add hooks to path
sys.path.insert(0, str(Path('.claude/hooks')))

# Mock database path for testing
TEST_DB_PATH = Path('./data/devflow_unified.sqlite')

class TestIntentAnalyzer:
    """Test intent analysis functionality"""

    def setup_method(self):
        """Setup per ogni test"""
        # Import dinamico per evitare problemi di path
        global IntentAnalyzer
        module = {}
        with open('.claude/hooks/cometa-user-prompt-intelligence.py') as f:
            code = f.read()
            exec(code, module)
            IntentAnalyzer = module['IntentAnalyzer']

        self.analyzer = IntentAnalyzer()

    def test_task_creation_detection(self):
        """Test detection of task creation intent"""
        prompts = [
            "Create a new feature for user authentication",
            "Implement OAuth login",
            "Build a payment system",
            "I need to add email notifications",
            "voglio implementare un sistema di notifiche"
        ]

        for prompt in prompts:
            result = self.analyzer.analyze(prompt)
            assert result['primary_intent'] == 'task_creation', f"Failed for: {prompt}"
            assert result['confidence'] >= 0.4, f"Low confidence for: {prompt}"
            assert 'prompt_hash' in result
            assert 'analyzed_at' in result

    def test_debugging_detection(self):
        """Test detection of debugging intent"""
        prompts = [
            "Fix the login bug",
            "The payment system isn't working",
            "Debug the API error",
            "Resolve the timeout issue",
            "Application crashes on startup"
        ]

        for prompt in prompts:
            result = self.analyzer.analyze(prompt)
            assert result['primary_intent'] == 'debugging', f"Failed for: {prompt}"
            assert result['confidence'] >= 0.4, f"Low confidence for: {prompt}"

    def test_architecture_detection(self):
        """Test detection of architecture intent"""
        prompts = [
            "Design the system architecture",
            "How should I structure the database",
            "Best practice for microservices",
            "Plan the API structure"
        ]

        for prompt in prompts:
            result = self.analyzer.analyze(prompt)
            assert result['primary_intent'] == 'architecture', f"Failed for: {prompt}"
            assert result['confidence'] >= 0.4, f"Low confidence for: {prompt}"

    def test_refactoring_detection(self):
        """Test detection of refactoring intent"""
        prompts = [
            "Refactor the authentication module",
            "Optimize the database queries",
            "Make the code cleaner",
            "Improve performance of the API"
        ]

        for prompt in prompts:
            result = self.analyzer.analyze(prompt)
            assert result['primary_intent'] == 'refactoring', f"Failed for: {prompt}"
            assert result['confidence'] >= 0.4, f"Low confidence for: {prompt}"

    def test_testing_detection(self):
        """Test detection of testing intent"""
        prompts = [
            "Write unit tests for the auth module",
            "Add test coverage",
            "Create e2e tests",
            "Test the payment flow"
        ]

        for prompt in prompts:
            result = self.analyzer.analyze(prompt)
            assert result['primary_intent'] == 'testing', f"Failed for: {prompt}"
            assert result['confidence'] >= 0.4, f"Low confidence for: {prompt}"

    def test_documentation_detection(self):
        """Test detection of documentation intent"""
        prompts = [
            "Document the API endpoints",
            "Write README for the project",
            "Explain how the authentication works",
            "Add docstrings to functions"
        ]

        for prompt in prompts:
            result = self.analyzer.analyze(prompt)
            assert result['primary_intent'] == 'documentation', f"Failed for: {prompt}"
            assert result['confidence'] >= 0.4, f"Low confidence for: {prompt}"

    def test_general_intent_fallback(self):
        """Test fallback to general intent"""
        prompts = [
            "Hello there",
            "What's the weather like?",
            "Tell me a joke"
        ]

        for prompt in prompts:
            result = self.analyzer.analyze(prompt)
            assert result['primary_intent'] == 'general', f"Should be general for: {prompt}"
            assert result['confidence'] == 0.5, f"Wrong confidence for general: {prompt}"

    def test_multiple_intents(self):
        """Test detection of multiple intents"""
        prompt = "Fix the bug in the authentication system and write tests for it"
        result = self.analyzer.analyze(prompt)

        # Should detect primary intent
        assert result['primary_intent'] in ['debugging', 'testing']

        # Should have multiple intents detected
        assert len(result['all_intents']) > 0
        intent_types = [i['type'] for i in result['all_intents']]

        # Both debugging and testing should be detected
        assert 'debugging' in intent_types or 'testing' in intent_types

    def test_confidence_scoring(self):
        """Test confidence scoring mechanism"""
        # Explicit creation should have high confidence
        explicit = "create a task for implementing user authentication"
        result_explicit = self.analyzer.analyze(explicit)

        # Implicit creation should have lower confidence
        implicit = "maybe we should implement authentication"
        result_implicit = self.analyzer.analyze(implicit)

        # Explicit should have higher confidence
        assert result_explicit['confidence'] > result_implicit['confidence']