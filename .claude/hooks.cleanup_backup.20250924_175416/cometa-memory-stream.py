#!/usr/bin/env python3
"""
Cometa Brain Memory Stream Processor
Cattura e processa eventi significativi per apprendimento continuo
"""

import json
import sys
import sqlite3
import hashlib
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

# Import cchooks for structured hook handling
try:
    from cchooks import create_context
    from cchooks.contexts import PostToolUseContext
    CCHOOKS_AVAILABLE = True
except ImportError:
    CCHOOKS_AVAILABLE = False

DB_PATH = Path('./data/devflow_unified.sqlite')

class EventSignificanceAnalyzer:
    """Analizza significatività degli eventi"""

    SIGNIFICANCE_WEIGHTS = {
        'file_creation': {
            'base_score': 0.6,
            'boost_patterns': {
                r'\.py$|\.js$|\.ts$': 0.2,  # Source files
                r'test': 0.15,  # Test files
                r'config|settings': 0.1,  # Configuration
                r'README|CLAUDE': 0.15,  # Documentation
            }
        },
        'file_edit': {
            'base_score': 0.5,
            'boost_patterns': {
                r'fix|bug|error': 0.2,  # Bug fixes
                r'refactor|optimize': 0.15,  # Refactoring
                r'implement|feature': 0.2,  # New features
                r'test': 0.1,  # Test updates
            }
        },
        'command_execution': {
            'base_score': 0.4,
            'boost_patterns': {
                r'npm|pip|yarn': 0.2,  # Package management
                r'test|pytest|jest': 0.15,  # Testing
                r'build|compile': 0.15,  # Building
                r'deploy': 0.3,  # Deployment
                r'git': 0.1,  # Version control
            }
        }
    }

    def analyze(self, event_type: str, event_data: Dict) -> Dict[str, Any]:
        """
        Analizza significatività dell'evento

        Returns:
            Dict con significance_score e metadata
        """
        weights = self.SIGNIFICANCE_WEIGHTS.get(event_type, {'base_score': 0.3})
        score = weights['base_score']

        # Applica boost patterns
        event_string = json.dumps(event_data).lower()

        for pattern, boost in weights.get('boost_patterns', {}).items():
            import re
            if re.search(pattern, event_string):
                score = min(1.0, score + boost)

        # Analizza dimensioni del cambiamento
        if 'lines_changed' in event_data:
            lines = event_data['lines_changed']
            if lines > 100:
                score = min(1.0, score + 0.2)
            elif lines > 50:
                score = min(1.0, score + 0.1)

        return {
            'significance_score': score,
            'event_type': event_type,
            'analyzed_at': datetime.now().isoformat(),
            'boosted_by': self._get_boost_reasons(event_type, event_string, weights)
        }

    def _get_boost_reasons(self, event_type: str, event_string: str, weights: Dict) -> List[str]:
        """Identifica ragioni del boost"""
        reasons = []

        import re
        for pattern, boost in weights.get('boost_patterns', {}).items():
            if re.search(pattern, event_string):
                reasons.append(f"Pattern '{pattern}' (+{boost})")

        return reasons

class MemoryEventProcessor:
    """Processa eventi in memory blocks"""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.analyzer = EventSignificanceAnalyzer()

    def process_tool_event(self, tool_data: Dict) -> Optional[Dict]:
        """
        Processa evento da tool use

        Returns:
            Memory event se significativo, None altrimenti
        """
        tool_name = tool_data.get('tool_name', '')
        tool_input = tool_data.get('tool_input', {})
        tool_response = tool_data.get('tool_response', {})

        # Determina tipo evento
        event_type = self._classify_tool_event(tool_name)
        if not event_type:
            return None

        # Estrai informazioni rilevanti
        event_data = self._extract_event_data(tool_name, tool_input, tool_response)

        # Analizza significatività
        significance = self.analyzer.analyze(event_type, event_data)

        # Solo eventi significativi (threshold 0.5)
        if significance['significance_score'] < 0.5:
            return None

        # Crea memory event
        memory_event = {
            'id': self._generate_event_id(tool_data),
            'event_type': event_type,
            'tool_name': tool_name,
            'significance_score': significance['significance_score'],
            'event_data': event_data,
            'metadata': {
                'session_id': tool_data.get('session_id'),
                'timestamp': datetime.now().isoformat(),
                'significance_analysis': significance
            }
        }

        return memory_event

    def _classify_tool_event(self, tool_name: str) -> Optional[str]:
        """Classifica tipo di evento dal tool"""
        classifications = {
            'Write': 'file_creation',
            'Edit': 'file_edit',
            'MultiEdit': 'file_edit',
            'Bash': 'command_execution',
            'Read': 'file_read',
        }

        return classifications.get(tool_name)

    def _extract_event_data(self, tool_name: str, tool_input: Dict, tool_response: Dict) -> Dict:
        """Estrae dati rilevanti dall'evento"""
        data = {
            'tool': tool_name,
            'timestamp': datetime.now().isoformat()
        }

        if tool_name in ['Write', 'Edit', 'MultiEdit']:
            data['file_path'] = tool_input.get('file_path', '')
            data['file_type'] = Path(data['file_path']).suffix if data['file_path'] else ''

            # Calcola lines changed per Edit
            if tool_name == 'Edit':
                old_string = tool_input.get('old_string', '')
                new_string = tool_input.get('new_string', '')
                data['lines_changed'] = max(
                    len(old_string.split('\n')),
                    len(new_string.split('\n'))
                )

        elif tool_name == 'Bash':
            data['command'] = tool_input.get('command', '')
            data['exit_code'] = tool_response.get('exit_code', -1)
            data['success'] = data['exit_code'] == 0

        elif tool_name == 'Read':
            data['file_path'] = tool_input.get('file_path', '')

        return data

    def _generate_event_id(self, tool_data: Dict) -> str:
        """Genera ID univoco per evento"""
        content = f"{tool_data.get('tool_name')}_{tool_data.get('session_id')}_{datetime.now().isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()[:16]

    def store_memory_event(self, event: Dict):
        """Salva evento nel database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Genera embedding placeholder (sarà calcolato dopo)
            embedding_placeholder = np.zeros(768).tobytes()  # 768-dim embedding

            cursor.execute("""
                INSERT INTO cometa_memory_stream (
                    session_id, event_type, significance_score,
                    context_data, semantic_embedding, tool_name,
                    file_paths, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event['metadata']['session_id'],
                event['event_type'],
                event['significance_score'],
                json.dumps(event['event_data']),
                embedding_placeholder,
                event['tool_name'],
                json.dumps([event['event_data'].get('file_path')] if 'file_path' in event['event_data'] else []),
                event['metadata']['timestamp']
            ))

            conn.commit()

        except Exception as e:
            sys.stderr.write(f"Failed to store memory event: {e}\n")
        finally:
            conn.close()

def main():
    """Entry point per PostToolUse hook"""
    try:
        if CCHOOKS_AVAILABLE:
            # Use cchooks structured approach
            context = create_context()

            if isinstance(context, PostToolUseContext):
                tool_data = {
                    'session_id': context.session_id,
                    'tool_name': context.tool_name,
                    'tool_input': context.tool_input,
                    'tool_response': context.tool_response
                }

                # Process event
                processor = MemoryEventProcessor(DB_PATH)
                memory_event = processor.process_tool_event(tool_data)

                if memory_event:
                    processor.store_memory_event(memory_event)
                    context.output.exit_success(
                        f"💾 Memory event captured: {memory_event['event_type']} "
                        f"(significance: {memory_event['significance_score']:.2f})"
                    )
                else:
                    context.output.exit_success()
        else:
            # Fallback to manual JSON parsing
            input_data = json.loads(sys.stdin.read())

            # Process event
            processor = MemoryEventProcessor(DB_PATH)
            memory_event = processor.process_tool_event(input_data)

            if memory_event:
                processor.store_memory_event(memory_event)
                print(f"💾 MEMORY EVENT CAPTURED")
                print(f"   Type: {memory_event['event_type']}")
                print(f"   Significance: {memory_event['significance_score']:.2f}")
                print(f"   Tool: {memory_event['tool_name']}")

        sys.exit(0)

    except Exception as e:
        sys.stderr.write(f"Memory stream error: {e}\n")
        sys.exit(0)

if __name__ == "__main__":
    main()