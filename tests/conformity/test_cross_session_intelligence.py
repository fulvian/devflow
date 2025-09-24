"""
Cross-Session Intelligence Tests
Following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 11.5 exactly
"""

import unittest
import json
import os
import tempfile
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta


class MockCometaBrain:
    """Mock implementation of CometaBrain for testing purposes"""
    
    def __init__(self):
        self.memory_stream: List[Dict[str, Any]] = []
        self.patterns: Dict[str, Any] = {}
        self.learning_metrics: Dict[str, Any] = {
            'sessions_count': 0,
            'total_interactions': 0,
            'pattern_recognition_accuracy': 0.0,
            'learning_rate': 0.0
        }
        self.session_id: str = ""
        self.session_start_time: datetime = datetime.now()
        
    def start_new_session(self) -> str:
        """Start a new learning session"""
        self.session_id = f"session_{int(time.time())}"
        self.session_start_time = datetime.now()
        self.learning_metrics['sessions_count'] += 1
        return self.session_id
        
    def add_interaction(self, data: Dict[str, Any]) -> None:
        """Add an interaction to the memory stream"""
        interaction = {
            'timestamp': datetime.now().isoformat(),
            'data': data,
            'session_id': self.session_id
        }
        self.memory_stream.append(interaction)
        self.learning_metrics['total_interactions'] += 1
        
    def recognize_pattern(self, pattern_id: str, pattern_data: Dict[str, Any]) -> None:
        """Recognize and store a pattern"""
        self.patterns[pattern_id] = {
            'data': pattern_data,
            'first_seen': datetime.now().isoformat(),
            'last_seen': datetime.now().isoformat(),
            'occurrence_count': self.patterns.get(pattern_id, {}).get('occurrence_count', 0) + 1
        }
        
    def update_learning_metrics(self, metrics: Dict[str, Any]) -> None:
        """Update learning evolution metrics"""
        self.learning_metrics.update(metrics)
        
    def get_memory_stream(self) -> List[Dict[str, Any]]:
        """Get the complete memory stream"""
        return self.memory_stream
        
    def get_patterns(self) -> Dict[str, Any]:
        """Get all recognized patterns"""
        return self.patterns
        
    def get_learning_metrics(self) -> Dict[str, Any]:
        """Get current learning metrics"""
        return self.learning_metrics
        
    def save_state(self, filepath: str) -> None:
        """Save the current brain state to a file"""
        state = {
            'memory_stream': self.memory_stream,
            'patterns': self.patterns,
            'learning_metrics': self.learning_metrics,
            'session_id': self.session_id,
            'session_start_time': self.session_start_time.isoformat()
        }
        with open(filepath, 'w') as f:
            json.dump(state, f)
            
    def load_state(self, filepath: str) -> None:
        """Load brain state from a file"""
        with open(filepath, 'r') as f:
            state = json.load(f)
            
        self.memory_stream = state.get('memory_stream', [])
        self.patterns = state.get('patterns', {})
        self.learning_metrics = state.get('learning_metrics', {
            'sessions_count': 0,
            'total_interactions': 0,
            'pattern_recognition_accuracy': 0.0,
            'learning_rate': 0.0
        })
        self.session_id = state.get('session_id', "")
        self.session_start_time = datetime.fromisoformat(state.get('session_start_time', datetime.now().isoformat()))


class CrossSessionIntelligenceTests(unittest.TestCase):
    """Test suite for Cross-Session Intelligence following PIANO_TEST_DEBUG_COMETA_BRAIN.md section 11.5"""
    
    def setUp(self) -> None:
        """Set up test environment"""
        self.test_dir = tempfile.mkdtemp()
        self.brain_state_file = os.path.join(self.test_dir, "brain_state.json")
        self.brain = MockCometaBrain()
        
    def tearDown(self) -> None:
        """Clean up test environment"""
        if os.path.exists(self.brain_state_file):
            os.remove(self.brain_state_file)
        os.rmdir(self.test_dir)
        
    def test_pattern_persistence(self) -> None:
        """
        Test 11.5.1 - Pattern Persistence
        Validate that learned patterns persist across sessions
        """
        # Session 1: Learn patterns
        session1_id = self.brain.start_new_session()
        
        # Add some interactions and patterns
        self.brain.add_interaction({"type": "user_query", "content": "What is AI?"})
        self.brain.recognize_pattern("question_pattern_1", {
            "pattern_type": "informational_question",
            "keywords": ["what", "is"],
            "confidence": 0.95
        })
        
        self.brain.add_interaction({"type": "user_query", "content": "How does machine learning work?"})
        self.brain.recognize_pattern("question_pattern_2", {
            "pattern_type": "process_question",
            "keywords": ["how", "does", "work"],
            "confidence": 0.87
        })
        
        # Save state
        self.brain.save_state(self.brain_state_file)
        
        # Session 2: Load state and verify patterns persist
        new_brain = MockCometaBrain()
        new_brain.load_state(self.brain_state_file)
        
        # Verify patterns are preserved
        patterns = new_brain.get_patterns()
        self.assertIn("question_pattern_1", patterns)
        self.assertIn("question_pattern_2", patterns)
        
        pattern1 = patterns["question_pattern_1"]
        self.assertEqual(pattern1["data"]["pattern_type"], "informational_question")
        self.assertEqual(pattern1["data"]["confidence"], 0.95)
        self.assertEqual(pattern1["occurrence_count"], 1)
        
        pattern2 = patterns["question_pattern_2"]
        self.assertEqual(pattern2["data"]["pattern_type"], "process_question")
        self.assertEqual(pattern2["data"]["confidence"], 0.87)
        self.assertEqual(pattern2["occurrence_count"], 1)
        
        # Verify session information is preserved
        self.assertEqual(new_brain.session_id, session1_id)
        
    def test_memory_stream_intelligence(self) -> None:
        """
        Test 11.5.2 - Memory Stream Intelligence
        Validate intelligent memory stream management across sessions
        """
        # Session 1: Build memory stream
        session1_id = self.brain.start_new_session()
        
        # Add various types of interactions
        self.brain.add_interaction({
            "type": "user_query",
            "content": "Hello, how are you?",
            "timestamp": "2023-01-01T10:00:00"
        })
        
        self.brain.add_interaction({
            "type": "system_response",
            "content": "I'm doing well, thank you!",
            "timestamp": "2023-01-01T10:00:05"
        })
        
        self.brain.add_interaction({
            "type": "user_feedback",
            "content": "That was helpful",
            "sentiment": "positive",
            "timestamp": "2023-01-01T10:00:10"
        })
        
        initial_memory_count = len(self.brain.get_memory_stream())
        self.assertEqual(initial_memory_count, 3)
        
        # Save state
        self.brain.save_state(self.brain_state_file)
        
        # Session 2: Load and extend memory stream
        new_brain = MockCometaBrain()
        new_brain.load_state(self.brain_state_file)
        
        # Add more interactions in new session
        session2_id = new_brain.start_new_session()
        self.assertNotEqual(session1_id, session2_id)
        
        new_brain.add_interaction({
            "type": "user_query",
            "content": "Can you explain neural networks?",
            "timestamp": "2023-01-02T14:30:00"
        })
        
        # Verify memory stream integrity
        memory_stream = new_brain.get_memory_stream()
        self.assertEqual(len(memory_stream), 4)  # 3 from session 1 + 1 from session 2
        
        # Verify session attribution
        session1_interactions = [i for i in memory_stream if i.get('session_id') == session1_id]
        session2_interactions = [i for i in memory_stream if i.get('session_id') == session2_id]
        
        self.assertEqual(len(session1_interactions), 3)
        self.assertEqual(len(session2_interactions), 1)
        
        # Verify chronological ordering is maintained
        timestamps = [i['timestamp'] for i in memory_stream]
        self.assertLess(timestamps[0], timestamps[-1])
        
    def test_learning_evolution_metrics(self) -> None:
        """
        Test 11.5.3 - Learning Evolution Metrics
        Validate that learning metrics evolve correctly across sessions
        """
        # Session 1: Initial learning state
        self.brain.start_new_session()
        
        # Initial metrics
        initial_metrics = self.brain.get_learning_metrics()
        self.assertEqual(initial_metrics['sessions_count'], 1)
        self.assertEqual(initial_metrics['total_interactions'], 0)
        self.assertEqual(initial_metrics['pattern_recognition_accuracy'], 0.0)
        
        # Add learning activities
        self.brain.add_interaction({"type": "training_data", "content": "sample data 1"})
        self.brain.add_interaction({"type": "training_data", "content": "sample data 2"})
        self.brain.recognize_pattern("pattern_A", {"type": "sequence", "length": 5})
        self.brain.update_learning_metrics({
            'pattern_recognition_accuracy': 0.75,
            'learning_rate': 0.1
        })
        
        # Save state after session 1
        session1_metrics = self.brain.get_learning_metrics()
        self.assertEqual(session1_metrics['total_interactions'], 2)
        self.assertEqual(session1_metrics['pattern_recognition_accuracy'], 0.75)
        self.brain.save_state(self.brain_state_file)
        
        # Session 2: Continue learning
        new_brain = MockCometaBrain()
        new_brain.load_state(self.brain_state_file)
        
        new_brain.start_new_session()
        
        # Add more learning activities
        new_brain.add_interaction({"type": "training_data", "content": "sample data 3"})
        new_brain.add_interaction({"type": "training_data", "content": "sample data 4"})
        new_brain.add_interaction({"type": "training_data", "content": "sample data 5"})
        new_brain.recognize_pattern("pattern_B", {"type": "classification", "categories": 3})
        new_brain.update_learning_metrics({
            'pattern_recognition_accuracy': 0.82,  # Improved accuracy
            'learning_rate': 0.15
        })
        
        # Verify cumulative metrics
        final_metrics = new_brain.get_learning_metrics()
        self.assertEqual(final_metrics['sessions_count'], 2)  # Should increment session count
        self.assertEqual(final_metrics['total_interactions'], 5)  # 2 from session 1 + 3 from session 2
        self.assertEqual(final_metrics['pattern_recognition_accuracy'], 0.82)  # Latest value
        self.assertEqual(final_metrics['learning_rate'], 0.15)  # Latest value
        
        # Verify pattern persistence in metrics context
        patterns = new_brain.get_patterns()
        self.assertIn("pattern_A", patterns)
        self.assertIn("pattern_B", patterns)
        self.assertEqual(patterns["pattern_A"]["occurrence_count"], 1)
        self.assertEqual(patterns["pattern_B"]["occurrence_count"], 1)
        
    def test_cross_session_learning(self) -> None:
        """
        Test 11.5.4 - Cross-Session Learning
        Validate that learning from one session influences subsequent sessions
        """
        # Session 1: Establish baseline knowledge
        session1_id = self.brain.start_new_session()
        
        # Teach fundamental concepts
        self.brain.add_interaction({
            "type": "concept_introduction",
            "concept": "machine_learning",
            "definition": "Algorithms that improve through experience"
        })
        
        self.brain.recognize_pattern("definition_request", {
            "pattern_type": "concept_explanation",
            "complexity": "intermediate"
        })
        
        self.brain.update_learning_metrics({
            'pattern_recognition_accuracy': 0.65,
            'concept_mastery_level': 0.3
        })
        
        # Save the foundational knowledge
        self.brain.save_state(self.brain_state_file)
        
        # Session 2: Build upon previous knowledge
        advanced_brain = MockCometaBrain()
        advanced_brain.load_state(self.brain_state_file)
        
        session2_id = advanced_brain.start_new_session()
        
        # Demonstrate building on previous learning
        advanced_brain.add_interaction({
            "type": "concept_extension",
            "base_concept": "machine_learning",
            "new_aspect": "deep_learning",
            "relationship": "subset"
        })
        
        # Recognize evolved pattern (building on previous pattern recognition)
        advanced_brain.recognize_pattern("definition_request", {
            "pattern_type": "concept_explanation",
            "complexity": "advanced",  # Increased complexity
            "evolution_from_previous": True
        })
        
        # Update metrics showing learning progression
        advanced_brain.update_learning_metrics({
            'pattern_recognition_accuracy': 0.85,  # Improved from 0.65
            'concept_mastery_level': 0.7,  # Improved from 0.3
            'knowledge_depth': 0.6
        })
        
        # Verify cross-session learning effectiveness
        final_patterns = advanced_brain.get_patterns()
        self.assertIn("definition_request", final_patterns)
        
        # Pattern should show evolution
        definition_pattern = final_patterns["definition_request"]
        self.assertEqual(definition_pattern["occurrence_count"], 2)  # Seen in both sessions
        self.assertEqual(definition_pattern["data"]["complexity"], "advanced")  # Evolved complexity
        
        # Verify metrics show improvement
        final_metrics = advanced_brain.get_learning_metrics()
        self.assertGreater(final_metrics['pattern_recognition_accuracy'], 0.65)
        self.assertGreater(final_metrics['concept_mastery_level'], 0.3)
        self.assertEqual(final_metrics['sessions_count'], 2)
        
        # Verify memory continuity
        memory_stream = advanced_brain.get_memory_stream()
        self.assertEqual(len(memory_stream), 2)  # One from each session
        
        # Verify both sessions are represented
        session_ids = {interaction['session_id'] for interaction in memory_stream}
        self.assertIn(session1_id, session_ids)
        self.assertIn(session2_id, session_ids)
        self.assertEqual(len(session_ids), 2)


if __name__ == '__main__':
    unittest.main()