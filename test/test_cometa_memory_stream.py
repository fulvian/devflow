#!/usr/bin/env python3
"""
Test suite per Cometa Brain Memory Stream components
"""

import pytest
import sys
import json
import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

# Add hooks directory to path
sys.path.append(str(Path('.claude/hooks')))

# Import components to test
try:
    from cometa_memory_stream import EventSignificanceAnalyzer, MemoryEventProcessor
    from cometa_context_search import SemanticSearchEngine, HistoricalPatternMatcher
    IMPORTS_OK = True
except ImportError as e:
    print(f"Import error: {e}")
    IMPORTS_OK = False

@pytest.mark.skipif(not IMPORTS_OK, reason="Required modules not available")
class TestEventSignificanceAnalyzer:
    """Test per l'analizzatore di significatività eventi"""

    def setup_method(self):
        self.analyzer = EventSignificanceAnalyzer()

    def test_file_creation_scoring(self):
        """Test scoring per creazione file"""
        event_data = {
            'file_path': '/test/file.py',
            'file_type': '.py'
        }

        result = self.analyzer.analyze('file_creation', event_data)

        assert result['significance_score'] >= 0.6  # Base score
        assert result['event_type'] == 'file_creation'
        assert 'analyzed_at' in result

    def test_command_execution_scoring(self):
        """Test scoring per esecuzione comandi"""
        event_data = {
            'command': 'npm test',
            'success': True
        }

        result = self.analyzer.analyze('command_execution', event_data)

        assert result['significance_score'] >= 0.4  # Base score
        assert 'boosted_by' in result

    def test_pattern_boost(self):
        """Test boost da pattern matching"""
        # Test with testing pattern
        event_data_test = {
            'command': 'pytest tests/',
            'success': True
        }

        result_test = self.analyzer.analyze('command_execution', event_data_test)

        # Should get boost for test pattern
        assert result_test['significance_score'] > 0.4
        assert len(result_test['boosted_by']) > 0

@pytest.mark.skipif(not IMPORTS_OK, reason="Required modules not available")
class TestMemoryEventProcessor:
    """Test per il processore di eventi memory"""

    def setup_method(self):
        # Create temporary database
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
        self.temp_db.close()
        self.db_path = Path(self.temp_db.name)

        # Setup minimal schema
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE cometa_memory_stream (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                event_type TEXT,
                significance_score REAL,
                context_data TEXT,
                semantic_embedding BLOB,
                tool_name TEXT,
                file_paths TEXT,
                created_at DATETIME
            )
        """)
        conn.commit()
        conn.close()

        self.processor = MemoryEventProcessor(self.db_path)

    def teardown_method(self):
        # Cleanup
        if self.db_path.exists():
            self.db_path.unlink()

    def test_tool_event_classification(self):
        """Test classificazione eventi da tool"""
        assert self.processor._classify_tool_event('Write') == 'file_creation'
        assert self.processor._classify_tool_event('Edit') == 'file_edit'
        assert self.processor._classify_tool_event('Bash') == 'command_execution'
        assert self.processor._classify_tool_event('UnknownTool') is None

    def test_event_data_extraction(self):
        """Test estrazione dati da eventi tool"""
        tool_input = {
            'file_path': '/test/file.py',
            'old_string': 'old\ncode',
            'new_string': 'new\ncode\nmore'
        }
        tool_response = {}

        data = self.processor._extract_event_data('Edit', tool_input, tool_response)

        assert data['file_path'] == '/test/file.py'
        assert data['file_type'] == '.py'
        assert data['lines_changed'] == 3  # Max of old/new string lines

    def test_memory_event_processing(self):
        """Test processing completo di eventi memory"""
        tool_data = {
            'session_id': 'test_session',
            'tool_name': 'Write',
            'tool_input': {'file_path': '/test/important.py'},
            'tool_response': {}
        }

        memory_event = self.processor.process_tool_event(tool_data)

        assert memory_event is not None
        assert memory_event['event_type'] == 'file_creation'
        assert memory_event['significance_score'] >= 0.5
        assert memory_event['metadata']['session_id'] == 'test_session'

    def test_low_significance_filtering(self):
        """Test filtro per eventi poco significativi"""
        tool_data = {
            'session_id': 'test_session',
            'tool_name': 'Read',  # Read has lower significance
            'tool_input': {'file_path': '/test/config.txt'},
            'tool_response': {}
        }

        memory_event = self.processor.process_tool_event(tool_data)

        # Low significance events should be filtered out
        assert memory_event is None

@pytest.mark.skipif(not IMPORTS_OK, reason="Required modules not available")
class TestSemanticSearchEngine:
    """Test per il motore di ricerca semantica"""

    def setup_method(self):
        # Create temporary database with test data
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
        self.temp_db.close()
        self.db_path = Path(self.temp_db.name)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Create minimal schema
        cursor.execute("""
            CREATE TABLE memory_blocks (
                id INTEGER PRIMARY KEY,
                content TEXT,
                type TEXT,
                metadata TEXT,
                created_at DATETIME
            )
        """)

        cursor.execute("""
            CREATE TABLE memory_block_embeddings (
                block_id INTEGER,
                embedding BLOB,
                FOREIGN KEY (block_id) REFERENCES memory_blocks(id)
            )
        """)

        conn.commit()
        conn.close()

        self.search_engine = SemanticSearchEngine(self.db_path)

    def teardown_method(self):
        if self.db_path.exists():
            self.db_path.unlink()

    def test_search_with_no_data(self):
        """Test ricerca senza dati nel database"""
        import numpy as np
        query_embedding = np.random.rand(768).astype(np.float32)

        results = self.search_engine.search_similar_contexts(
            query_embedding,
            limit=5
        )

        assert results == []

    def test_dummy_embedding_consistency(self):
        """Test che gli embedding dummy siano consistenti"""
        from cometa_context_search import create_dummy_embedding

        embedding1 = create_dummy_embedding("test text")
        embedding2 = create_dummy_embedding("test text")

        # Same input should produce same embedding
        assert np.array_equal(embedding1, embedding2)

        embedding3 = create_dummy_embedding("different text")
        # Different input should produce different embedding
        assert not np.array_equal(embedding1, embedding3)

def test_basic_imports():
    """Test che gli import base funzionino"""
    try:
        import sqlite3
        import numpy as np
        from sklearn.metrics.pairwise import cosine_similarity
        assert True
    except ImportError as e:
        pytest.fail(f"Basic imports failed: {e}")

def test_database_schema_requirements():
    """Test che lo schema database richiesto sia corretto"""
    temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
    temp_db.close()

    try:
        conn = sqlite3.connect(temp_db.name)
        cursor = conn.cursor()

        # Test che possiamo creare le tabelle richieste
        cursor.execute("""
            CREATE TABLE cometa_memory_stream (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                event_type TEXT,
                significance_score REAL DEFAULT 0.5,
                context_data TEXT,
                semantic_embedding BLOB,
                tool_name TEXT,
                file_paths TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE cometa_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern_type TEXT,
                domain TEXT,
                pattern_data TEXT,
                success_rate REAL DEFAULT 0.5,
                usage_count INTEGER DEFAULT 0,
                last_used DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()
        conn.close()

        assert True

    except Exception as e:
        pytest.fail(f"Database schema test failed: {e}")
    finally:
        Path(temp_db.name).unlink()

if __name__ == "__main__":
    pytest.main([__file__, "-v"])