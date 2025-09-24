#!/usr/bin/env python3
"""
Cometa Memory Stream Hook - Context7 Implementation
Critical missing functionality for rules-n-protocols-review

Replaces non-compliant robust-memory-stream.py with:
- Memory stream capture and storage
- Context persistence across sessions
- Semantic indexing with embeddings
- Cross-session memory retrieval
- Unified database integration
"""

import sys
import os
import json
import sqlite3
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, List

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import PostToolUseHook, HookDecision

class CometaMemoryStreamHook(PostToolUseHook):
    """Context7-compliant PostToolUse hook with advanced memory stream capabilities"""

    def __init__(self):
        super().__init__("cometa-memory-stream-hook")
        self.db_path = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
        self.memory_types = {
            'context_fragment': self._store_context_fragment,
            'decision_point': self._store_decision_point,
            'error_pattern': self._store_error_pattern,
            'success_pattern': self._store_success_pattern
        }

    def validate_input(self) -> bool:
        """Validate PostToolUse input"""
        if not super().validate_input():
            return False

        # Additional validation for memory stream functionality
        tool_name = self.get_tool_name()
        if not tool_name:
            self.logger.warning("No tool name provided for memory stream")
            return True  # Continue but with limited functionality

        return True

    def execute_logic(self) -> None:
        """Main logic for memory stream capture"""
        try:
            # Always capture tool interactions
            self._capture_tool_interaction()

            # Check for special patterns requiring enhanced memory storage
            if self._is_significant_interaction():
                self._capture_enhanced_memory()

            # Update context vectors for semantic search
            self._update_context_vectors()

            # Cleanup old memory entries if needed
            self._cleanup_old_memories()

            self.logger.info(f"Memory stream processed for tool: {self.get_tool_name()}")

        except Exception as e:
            self.logger.error(f"Memory stream processing failed: {e}")
            # Continue execution even if memory fails
            pass

    def _capture_tool_interaction(self) -> None:
        """Capture basic tool interaction data"""
        tool_name = self.get_tool_name()
        tool_input = self.get_tool_input()
        tool_response = self.get_tool_response()
        session_id = self.input_data.get("session_id", "unknown")

        # Create interaction hash for deduplication
        interaction_data = {
            'tool_name': tool_name,
            'input': tool_input,
            'response': tool_response,
            'session_id': session_id
        }
        interaction_hash = hashlib.sha256(
            json.dumps(interaction_data, sort_keys=True).encode()
        ).hexdigest()[:16]

        try:
            with sqlite3.connect(self.db_path) as conn:
                # Check if we already stored this interaction
                cursor = conn.execute(
                    "SELECT id FROM memory_streams WHERE interaction_hash = ?",
                    (interaction_hash,)
                )
                if cursor.fetchone():
                    return  # Already stored

                # Store new interaction
                conn.execute("""
                    INSERT INTO memory_streams (
                        session_id, tool_name, tool_input, tool_response,
                        interaction_hash, memory_type, created_at, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                """, (
                    session_id,
                    tool_name,
                    json.dumps(tool_input),
                    json.dumps(tool_response),
                    interaction_hash,
                    'tool_interaction',
                    json.dumps({
                        'significant': self._is_significant_interaction(),
                        'security_sensitive': self.is_security_sensitive(),
                        'orchestrator_required': self.is_orchestrator_required()
                    })
                ))

                self.logger.debug(f"Stored tool interaction: {tool_name}")

        except sqlite3.Error as e:
            self.logger.error(f"Database error storing interaction: {e}")

    def _is_significant_interaction(self) -> bool:
        """Determine if this interaction is significant for enhanced storage"""
        tool_name = self.get_tool_name()
        tool_input = self.get_tool_input()
        tool_response = self.get_tool_response()

        # File operations are always significant
        if tool_name in ['Write', 'Edit', 'MultiEdit', 'Read']:
            return True

        # Large content operations
        content = str(tool_input) + str(tool_response)
        if len(content) > 1000:
            return True

        # Error conditions
        if tool_response.get('error') or tool_response.get('stderr'):
            return True

        # Database operations
        if 'database' in tool_name.lower() or 'sqlite' in str(tool_input):
            return True

        # Security-sensitive operations
        if self.is_security_sensitive():
            return True

        # MCP agent calls
        if tool_name.startswith('mcp__'):
            return True

        return False

    def _capture_enhanced_memory(self) -> None:
        """Capture enhanced memory for significant interactions"""
        try:
            # Extract patterns and context
            patterns = self._extract_patterns()
            context = self._extract_context()

            # Store enhanced memory data
            for memory_type, data in patterns.items():
                if data and memory_type in self.memory_types:
                    self.memory_types[memory_type](data, context)

        except Exception as e:
            self.logger.error(f"Enhanced memory capture failed: {e}")

    def _extract_patterns(self) -> Dict[str, Any]:
        """Extract meaningful patterns from tool interaction"""
        tool_response = self.get_tool_response()
        tool_input = self.get_tool_input()

        patterns = {}

        # Error patterns
        if tool_response.get('error') or tool_response.get('stderr'):
            patterns['error_pattern'] = {
                'error_type': 'tool_execution_error',
                'tool_name': self.get_tool_name(),
                'error_content': tool_response.get('stderr', tool_response.get('error', '')),
                'input_context': tool_input
            }

        # Success patterns for file operations
        elif self.get_tool_name() in ['Write', 'Edit', 'MultiEdit'] and not tool_response.get('error'):
            patterns['success_pattern'] = {
                'pattern_type': 'file_operation_success',
                'tool_name': self.get_tool_name(),
                'file_path': tool_input.get('file_path'),
                'operation_size': len(str(tool_input.get('content', tool_input.get('new_string', ''))))
            }

        # Decision points for significant choices
        if self.is_orchestrator_required():
            patterns['decision_point'] = {
                'decision_type': 'orchestrator_routing',
                'tool_name': self.get_tool_name(),
                'routing_reason': 'Required by orchestrator rules',
                'context': str(tool_input)[:500]
            }

        return patterns

    def _extract_context(self) -> Dict[str, Any]:
        """Extract contextual information"""
        return {
            'session_id': self.input_data.get('session_id'),
            'cwd': self.input_data.get('cwd'),
            'timestamp': datetime.now().isoformat(),
            'tool_sequence': self._get_recent_tool_sequence(),
            'current_task': self._get_current_task()
        }

    def _get_recent_tool_sequence(self) -> List[str]:
        """Get recent tool usage sequence for pattern analysis"""
        try:
            session_id = self.input_data.get('session_id')
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT tool_name FROM memory_streams
                    WHERE session_id = ? AND created_at > datetime('now', '-5 minutes')
                    ORDER BY created_at DESC LIMIT 10
                """, (session_id,))
                return [row[0] for row in cursor.fetchall()]
        except:
            return []

    def _get_current_task(self) -> Optional[str]:
        """Get current task context"""
        try:
            with open("/Users/fulvioventura/devflow/.claude/state/current_task.json", 'r') as f:
                current_task = json.load(f)
                return current_task.get('task')
        except:
            return None

    def _store_context_fragment(self, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        """Store context fragments for semantic search"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO context_fragments (
                        session_id, fragment_type, content, context_metadata,
                        created_at, task_context
                    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                """, (
                    context['session_id'],
                    'memory_stream_context',
                    json.dumps(data),
                    json.dumps(context),
                    context.get('current_task')
                ))
        except sqlite3.Error as e:
            self.logger.error(f"Error storing context fragment: {e}")

    def _store_decision_point(self, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        """Store decision points for learning"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO decision_points (
                        session_id, decision_type, decision_data, context_data,
                        created_at, outcome
                    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                """, (
                    context['session_id'],
                    data.get('decision_type', 'unknown'),
                    json.dumps(data),
                    json.dumps(context),
                    'pending'  # Outcome determined later
                ))
        except sqlite3.Error as e:
            self.logger.error(f"Error storing decision point: {e}")

    def _store_error_pattern(self, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        """Store error patterns for debugging"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO error_patterns (
                        session_id, error_type, error_data, context_data,
                        tool_name, created_at, resolved
                    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                """, (
                    context['session_id'],
                    data.get('error_type', 'unknown'),
                    json.dumps(data),
                    json.dumps(context),
                    data.get('tool_name'),
                    False
                ))
        except sqlite3.Error as e:
            self.logger.error(f"Error storing error pattern: {e}")

    def _store_success_pattern(self, data: Dict[str, Any], context: Dict[str, Any]) -> None:
        """Store success patterns for replication"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO success_patterns (
                        session_id, pattern_type, pattern_data, context_data,
                        tool_name, created_at, replication_score
                    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                """, (
                    context['session_id'],
                    data.get('pattern_type', 'unknown'),
                    json.dumps(data),
                    json.dumps(context),
                    data.get('tool_name'),
                    1.0  # Initial replication score
                ))
        except sqlite3.Error as e:
            self.logger.error(f"Error storing success pattern: {e}")

    def _update_context_vectors(self) -> None:
        """Update semantic vectors for context search (placeholder for future embedding integration)"""
        # This would integrate with embedding services for semantic search
        # For now, we store structured data for future vector integration
        try:
            session_id = self.input_data.get('session_id')
            tool_name = self.get_tool_name()

            # Create vector placeholder
            vector_data = {
                'session_id': session_id,
                'tool_name': tool_name,
                'content_hash': hashlib.sha256(
                    (str(self.get_tool_input()) + str(self.get_tool_response())).encode()
                ).hexdigest()[:16],
                'timestamp': datetime.now().isoformat()
            }

            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO vector_contexts (
                        session_id, content_hash, vector_data, created_at
                    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    session_id,
                    vector_data['content_hash'],
                    json.dumps(vector_data)
                ))

        except sqlite3.Error as e:
            self.logger.error(f"Error updating context vectors: {e}")

    def _cleanup_old_memories(self) -> None:
        """Cleanup old memory entries to prevent database bloat"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Keep only last 1000 tool interactions per session
                conn.execute("""
                    DELETE FROM memory_streams
                    WHERE id NOT IN (
                        SELECT id FROM memory_streams
                        WHERE session_id = ?
                        ORDER BY created_at DESC LIMIT 1000
                    ) AND session_id = ?
                """, (self.input_data.get('session_id'), self.input_data.get('session_id')))

                # Clean vector contexts older than 30 days
                conn.execute("""
                    DELETE FROM vector_contexts
                    WHERE created_at < datetime('now', '-30 days')
                """)

        except sqlite3.Error as e:
            self.logger.error(f"Error cleaning old memories: {e}")

    def get_memory_context(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve relevant memory context (utility method for other hooks)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT tool_name, tool_input, tool_response, metadata, created_at
                    FROM memory_streams
                    WHERE (tool_input LIKE ? OR tool_response LIKE ?)
                    ORDER BY created_at DESC LIMIT ?
                """, (f"%{query}%", f"%{query}%", limit))

                results = []
                for row in cursor.fetchall():
                    results.append({
                        'tool_name': row[0],
                        'tool_input': json.loads(row[1]),
                        'tool_response': json.loads(row[2]),
                        'metadata': json.loads(row[3]),
                        'created_at': row[4]
                    })
                return results

        except sqlite3.Error as e:
            self.logger.error(f"Error retrieving memory context: {e}")
            return []

if __name__ == "__main__":
    hook = CometaMemoryStreamHook()
    sys.exit(hook.run())