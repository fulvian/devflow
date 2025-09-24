#!/usr/bin/env python3
"""
Unified Cometa Processor - Context7 Implementation
Consolidates 11 Cometa hooks into single Context7-compliant processor

Replaces and consolidates:
1. cometa_batch_manager.py - Batch operations
2. cometa_nlp_processor.py - Natural language processing
3. cometa_progress_tracker.py - Progress tracking
4. cometa_task_executor.py - Task execution
5. cometa-context-search.py - Context search
6. cometa-memory-stream.py - Memory stream (replaced by cometa-memory-stream-hook.py)
7. cometa-nlp-hook.py - NLP hooks (replaced by cometa-user-prompt-hook.py)
8. cometa-project-loader.py - Project loading
9. cometa-slash-command.py - Slash commands
10. cometa-task-autocreator.py - Auto task creation
11. cometa-user-prompt-intelligence.py - User prompt AI
"""

import sys
import os
import json
import sqlite3
import re
from datetime import datetime
from typing import Dict, Any, Optional, List, Union

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import BaseDevFlowHook, PostToolUseHook, PreToolUseHook, HookDecision

class UnifiedCometaProcessor(BaseDevFlowHook):
    """Unified processor for all Cometa Brain functionality"""

    def __init__(self, hook_type: str = "post-tool-use"):
        super().__init__("unified-cometa-processor")
        self.db_path = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
        self.hook_type = hook_type

        # Processor modules
        self.processors = {
            'batch_manager': BatchManager(self),
            'nlp_processor': NLPProcessor(self),
            'progress_tracker': ProgressTracker(self),
            'task_executor': TaskExecutor(self),
            'context_search': ContextSearch(self),
            'project_loader': ProjectLoader(self),
            'task_autocreator': TaskAutoCreator(self)
        }

    def validate_input(self) -> bool:
        """Validate input based on hook type"""
        if self.hook_type == "post-tool-use":
            required_fields = ["tool_name", "tool_input", "tool_response"]
        elif self.hook_type == "pre-tool-use":
            required_fields = ["tool_name", "tool_input"]
        else:
            required_fields = ["session_id", "hook_event_name"]

        missing = [f for f in required_fields if f not in self.input_data]
        if missing:
            self.logger.error(f"Missing required fields: {missing}")
            return False
        return True

    def execute_logic(self) -> None:
        """Main unified processing logic"""
        try:
            # Progress tracking (always active)
            self.processors['progress_tracker'].track_progress()

            # Context search and enrichment
            context = self.processors['context_search'].get_relevant_context()

            # Task-related processing
            if self._is_task_related():
                self.processors['task_executor'].process_task_operations()
                self.processors['task_autocreator'].check_auto_creation()

            # NLP processing for text-heavy operations
            if self._requires_nlp():
                self.processors['nlp_processor'].process_content()

            # Batch operations for multiple items
            if self._is_batch_operation():
                self.processors['batch_manager'].process_batch()

            # Project lifecycle management
            if self._affects_project_structure():
                self.processors['project_loader'].update_project_context()

            self.logger.info("Unified Cometa processing completed successfully")

        except Exception as e:
            self.logger.error(f"Unified Cometa processing failed: {e}")
            # Continue execution even if processing fails

    def _is_task_related(self) -> bool:
        """Check if operation is task-related"""
        tool_name = self.get_tool_name() or ""
        tool_input = self.get_tool_input()

        # Check tool names
        task_tools = ['Task', 'TodoWrite']
        if tool_name in task_tools:
            return True

        # Check content for task keywords
        content = str(tool_input).lower()
        task_keywords = ['task', 'todo', 'project', 'milestone', 'roadmap', 'plan']
        return any(keyword in content for keyword in task_keywords)

    def _requires_nlp(self) -> bool:
        """Check if operation requires NLP processing"""
        tool_input = self.get_tool_input()
        tool_response = self.get_tool_response()

        # Large text content
        content = str(tool_input) + str(tool_response)
        if len(content) > 500:
            return True

        # Natural language patterns
        nlp_patterns = [
            r'\b(implement|create|build|develop|fix|update)\b',
            r'\b(how to|what is|why does|when should)\b',
            r'\b(problem|issue|error|bug|solution)\b'
        ]

        for pattern in nlp_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                return True

        return False

    def _is_batch_operation(self) -> bool:
        """Check if operation is a batch operation"""
        tool_name = self.get_tool_name() or ""
        tool_input = self.get_tool_input()

        # Batch tools
        if tool_name in ['MultiEdit', 'Bash'] and 'find' in str(tool_input):
            return True

        # Multiple items in input
        if isinstance(tool_input, dict):
            for value in tool_input.values():
                if isinstance(value, list) and len(value) > 3:
                    return True

        return False

    def _affects_project_structure(self) -> bool:
        """Check if operation affects project structure"""
        tool_name = self.get_tool_name() or ""
        tool_input = self.get_tool_input()

        # Structure-affecting tools
        structure_tools = ['Write', 'Edit', 'MultiEdit', 'Bash']
        if tool_name not in structure_tools:
            return False

        # Check for structural changes
        file_path = tool_input.get('file_path', '')
        if any(path in file_path for path in ['.claude/', 'tasks/', 'docs/', 'src/', 'config/']):
            return True

        # Command operations that affect structure
        command = tool_input.get('command', '')
        structure_commands = ['mkdir', 'git', 'npm', 'yarn', 'cargo', 'pip']
        return any(cmd in command for cmd in structure_commands)

class ProcessorModule:
    """Base class for processor modules"""

    def __init__(self, parent: UnifiedCometaProcessor):
        self.parent = parent
        self.logger = parent.logger
        self.db_path = parent.db_path

class BatchManager(ProcessorModule):
    """Handles batch operations consolidation"""

    def process_batch(self) -> None:
        """Process batch operations"""
        try:
            batch_info = self._analyze_batch()
            if batch_info:
                self._store_batch_metadata(batch_info)
                self._optimize_batch_execution(batch_info)

        except Exception as e:
            self.logger.error(f"Batch processing failed: {e}")

    def _analyze_batch(self) -> Optional[Dict[str, Any]]:
        """Analyze batch operation characteristics"""
        tool_name = self.parent.get_tool_name()
        tool_input = self.parent.get_tool_input()

        return {
            'tool_name': tool_name,
            'batch_size': self._estimate_batch_size(),
            'batch_type': self._classify_batch_type(),
            'complexity': self._assess_complexity()
        }

    def _estimate_batch_size(self) -> int:
        """Estimate size of batch operation"""
        tool_input = self.parent.get_tool_input()

        # Count edits in MultiEdit
        if isinstance(tool_input.get('edits'), list):
            return len(tool_input['edits'])

        # Count files in Bash operations
        command = tool_input.get('command', '')
        if 'find' in command:
            return 10  # Estimate

        return 1

    def _classify_batch_type(self) -> str:
        """Classify type of batch operation"""
        tool_name = self.parent.get_tool_name()
        tool_input = self.parent.get_tool_input()

        if tool_name == 'MultiEdit':
            return 'multi_file_edit'
        elif 'git' in str(tool_input):
            return 'version_control'
        elif any(cmd in str(tool_input) for cmd in ['find', 'grep', 'sed']):
            return 'file_processing'
        else:
            return 'unknown'

    def _assess_complexity(self) -> str:
        """Assess complexity level"""
        size = self._estimate_batch_size()
        if size > 10:
            return 'high'
        elif size > 3:
            return 'medium'
        else:
            return 'low'

    def _store_batch_metadata(self, batch_info: Dict[str, Any]) -> None:
        """Store batch operation metadata"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO batch_operations (
                        session_id, tool_name, batch_type, batch_size,
                        complexity, metadata, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    self.parent.input_data.get('session_id'),
                    batch_info['tool_name'],
                    batch_info['batch_type'],
                    batch_info['batch_size'],
                    batch_info['complexity'],
                    json.dumps(batch_info)
                ))
        except sqlite3.Error as e:
            self.logger.error(f"Error storing batch metadata: {e}")

    def _optimize_batch_execution(self, batch_info: Dict[str, Any]) -> None:
        """Optimize batch execution based on analysis"""
        # Future: implement batch optimization strategies
        pass

class NLPProcessor(ProcessorModule):
    """Handles natural language processing"""

    def process_content(self) -> None:
        """Process content for NLP insights"""
        try:
            content = self._extract_content()
            if content:
                insights = self._analyze_content(content)
                self._store_nlp_insights(insights)

        except Exception as e:
            self.logger.error(f"NLP processing failed: {e}")

    def _extract_content(self) -> str:
        """Extract textual content from tool data"""
        tool_input = self.parent.get_tool_input()
        tool_response = self.parent.get_tool_response()

        # Extract from various sources
        content_sources = [
            tool_input.get('content', ''),
            tool_input.get('new_string', ''),
            tool_input.get('command', ''),
            str(tool_response.get('stdout', '')),
            str(tool_response.get('stderr', ''))
        ]

        return ' '.join(filter(None, content_sources))

    def _analyze_content(self, content: str) -> Dict[str, Any]:
        """Analyze content for NLP insights"""
        insights = {
            'word_count': len(content.split()),
            'contains_code': self._detect_code(content),
            'language_detected': self._detect_language(content),
            'intent_classification': self._classify_intent(content),
            'key_terms': self._extract_key_terms(content)
        }

        return insights

    def _detect_code(self, content: str) -> bool:
        """Detect if content contains code"""
        code_patterns = [
            r'\bfunction\s+\w+\s*\(',
            r'\bclass\s+\w+',
            r'\bimport\s+\w+',
            r'\{[\s\S]*\}',
            r'def\s+\w+\s*\(',
            r'<\w+[^>]*>'
        ]

        return any(re.search(pattern, content) for pattern in code_patterns)

    def _detect_language(self, content: str) -> str:
        """Detect programming language"""
        if 'def ' in content or 'import ' in content:
            return 'python'
        elif 'function' in content or 'const' in content:
            return 'javascript'
        elif 'class' in content or 'public' in content:
            return 'java'
        else:
            return 'unknown'

    def _classify_intent(self, content: str) -> str:
        """Classify user intent"""
        if any(word in content.lower() for word in ['create', 'implement', 'build']):
            return 'creation'
        elif any(word in content.lower() for word in ['fix', 'debug', 'error']):
            return 'debugging'
        elif any(word in content.lower() for word in ['update', 'modify', 'change']):
            return 'modification'
        elif any(word in content.lower() for word in ['read', 'show', 'display']):
            return 'information'
        else:
            return 'unknown'

    def _extract_key_terms(self, content: str) -> List[str]:
        """Extract key terms from content"""
        # Simple keyword extraction
        words = re.findall(r'\b[a-zA-Z]{3,}\b', content.lower())

        # Filter common words
        stopwords = {'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'her', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'end', 'few', 'got', 'let', 'put', 'say', 'she', 'too', 'use'}

        filtered_words = [w for w in words if w not in stopwords and len(w) > 3]

        # Return top 10 most frequent terms
        from collections import Counter
        return [term for term, count in Counter(filtered_words).most_common(10)]

    def _store_nlp_insights(self, insights: Dict[str, Any]) -> None:
        """Store NLP analysis results"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO nlp_insights (
                        session_id, tool_name, insights_data, created_at
                    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    self.parent.input_data.get('session_id'),
                    self.parent.get_tool_name(),
                    json.dumps(insights)
                ))
        except sqlite3.Error as e:
            self.logger.error(f"Error storing NLP insights: {e}")

class ProgressTracker(ProcessorModule):
    """Tracks task and project progress"""

    def track_progress(self) -> None:
        """Track progress across tasks and projects"""
        try:
            progress_data = self._calculate_progress()
            self._update_progress_metrics(progress_data)

        except Exception as e:
            self.logger.error(f"Progress tracking failed: {e}")

    def _calculate_progress(self) -> Dict[str, Any]:
        """Calculate current progress metrics"""
        current_task = self._get_current_task()

        return {
            'current_task': current_task,
            'session_activity': self._get_session_activity(),
            'completion_indicators': self._detect_completion_indicators(),
            'progress_score': self._calculate_progress_score()
        }

    def _get_current_task(self) -> Optional[str]:
        """Get current active task"""
        try:
            with open("/Users/fulvioventura/devflow/.claude/state/current_task.json", 'r') as f:
                current_task = json.load(f)
                return current_task.get('task')
        except:
            return None

    def _get_session_activity(self) -> Dict[str, int]:
        """Get session activity metrics"""
        try:
            session_id = self.parent.input_data.get('session_id')
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT tool_name, COUNT(*) FROM memory_streams
                    WHERE session_id = ?
                    GROUP BY tool_name
                """, (session_id,))

                return dict(cursor.fetchall())
        except:
            return {}

    def _detect_completion_indicators(self) -> List[str]:
        """Detect indicators of task completion"""
        tool_response = self.parent.get_tool_response()
        indicators = []

        # Success indicators
        if not tool_response.get('error') and tool_response.get('stdout'):
            indicators.append('tool_success')

        # File completion indicators
        if self.parent.get_tool_name() in ['Write', 'Edit'] and not tool_response.get('error'):
            indicators.append('file_updated')

        return indicators

    def _calculate_progress_score(self) -> float:
        """Calculate overall progress score"""
        activity = self._get_session_activity()

        # Simple scoring based on activity
        total_actions = sum(activity.values())
        success_weight = len(self._detect_completion_indicators()) * 0.2

        return min(1.0, (total_actions * 0.1) + success_weight)

    def _update_progress_metrics(self, progress_data: Dict[str, Any]) -> None:
        """Update progress metrics in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO progress_metrics (
                        session_id, current_task, progress_score, metrics_data, updated_at
                    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    self.parent.input_data.get('session_id'),
                    progress_data.get('current_task'),
                    progress_data.get('progress_score', 0.0),
                    json.dumps(progress_data)
                ))
        except sqlite3.Error as e:
            self.logger.error(f"Error updating progress metrics: {e}")

class TaskExecutor(ProcessorModule):
    """Handles task execution and management"""

    def process_task_operations(self) -> None:
        """Process task-related operations"""
        try:
            if self._is_task_creation():
                self._handle_task_creation()
            elif self._is_task_update():
                self._handle_task_update()
            elif self._is_task_completion():
                self._handle_task_completion()

        except Exception as e:
            self.logger.error(f"Task execution failed: {e}")

    def _is_task_creation(self) -> bool:
        """Check if operation creates a task"""
        tool_input = self.parent.get_tool_input()
        content = str(tool_input).lower()
        return 'create task' in content or 'new task' in content

    def _is_task_update(self) -> bool:
        """Check if operation updates a task"""
        tool_input = self.parent.get_tool_input()
        content = str(tool_input).lower()
        return 'update task' in content or 'modify task' in content

    def _is_task_completion(self) -> bool:
        """Check if operation completes a task"""
        tool_input = self.parent.get_tool_input()
        content = str(tool_input).lower()
        return 'complete task' in content or 'finish task' in content

    def _handle_task_creation(self) -> None:
        """Handle task creation operations"""
        # Placeholder for task creation logic
        self.logger.info("Task creation detected")

    def _handle_task_update(self) -> None:
        """Handle task update operations"""
        # Placeholder for task update logic
        self.logger.info("Task update detected")

    def _handle_task_completion(self) -> None:
        """Handle task completion operations"""
        # Placeholder for task completion logic
        self.logger.info("Task completion detected")

class ContextSearch(ProcessorModule):
    """Provides context search capabilities"""

    def get_relevant_context(self) -> Dict[str, Any]:
        """Get relevant context for current operation"""
        try:
            return {
                'recent_tools': self._get_recent_tools(),
                'related_tasks': self._get_related_tasks(),
                'similar_operations': self._get_similar_operations()
            }
        except Exception as e:
            self.logger.error(f"Context search failed: {e}")
            return {}

    def _get_recent_tools(self) -> List[str]:
        """Get recently used tools"""
        try:
            session_id = self.parent.input_data.get('session_id')
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT DISTINCT tool_name FROM memory_streams
                    WHERE session_id = ? AND created_at > datetime('now', '-1 hour')
                    ORDER BY created_at DESC LIMIT 10
                """, (session_id,))
                return [row[0] for row in cursor.fetchall()]
        except:
            return []

    def _get_related_tasks(self) -> List[str]:
        """Get related tasks based on current context"""
        try:
            current_task = self._get_current_task()
            if not current_task:
                return []

            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT name FROM tasks
                    WHERE status = 'in_progress' OR status = 'pending'
                    ORDER BY created_at DESC LIMIT 5
                """)
                return [row[0] for row in cursor.fetchall()]
        except:
            return []

    def _get_similar_operations(self) -> List[Dict[str, Any]]:
        """Get similar operations from history"""
        try:
            tool_name = self.parent.get_tool_name()
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT tool_name, tool_input, created_at FROM memory_streams
                    WHERE tool_name = ? AND created_at > datetime('now', '-7 days')
                    ORDER BY created_at DESC LIMIT 5
                """, (tool_name,))

                results = []
                for row in cursor.fetchall():
                    results.append({
                        'tool_name': row[0],
                        'tool_input': json.loads(row[1]),
                        'created_at': row[2]
                    })
                return results
        except:
            return []

    def _get_current_task(self) -> Optional[str]:
        """Get current active task"""
        try:
            with open("/Users/fulvioventura/devflow/.claude/state/current_task.json", 'r') as f:
                current_task = json.load(f)
                return current_task.get('task')
        except:
            return None

class ProjectLoader(ProcessorModule):
    """Handles project loading and context management"""

    def update_project_context(self) -> None:
        """Update project context based on structural changes"""
        try:
            changes = self._detect_structural_changes()
            if changes:
                self._update_project_metadata(changes)

        except Exception as e:
            self.logger.error(f"Project context update failed: {e}")

    def _detect_structural_changes(self) -> Dict[str, Any]:
        """Detect structural changes to project"""
        tool_name = self.parent.get_tool_name()
        tool_input = self.parent.get_tool_input()

        changes = {}

        # File system changes
        if tool_name in ['Write', 'Edit', 'MultiEdit']:
            file_path = tool_input.get('file_path', '')
            if file_path:
                changes['file_modified'] = file_path

        # Configuration changes
        if any(config in str(tool_input) for config in ['package.json', '.claude/', 'config/']):
            changes['config_modified'] = True

        return changes

    def _update_project_metadata(self, changes: Dict[str, Any]) -> None:
        """Update project metadata with changes"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO project_changes (
                        session_id, change_type, change_data, created_at
                    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """, (
                    self.parent.input_data.get('session_id'),
                    'structural_change',
                    json.dumps(changes)
                ))
        except sqlite3.Error as e:
            self.logger.error(f"Error updating project metadata: {e}")

class TaskAutoCreator(ProcessorModule):
    """Automatically creates tasks based on patterns"""

    def check_auto_creation(self) -> None:
        """Check if automatic task creation is needed"""
        try:
            if self._should_create_task():
                task_data = self._generate_task_data()
                self._create_automatic_task(task_data)

        except Exception as e:
            self.logger.error(f"Auto task creation failed: {e}")

    def _should_create_task(self) -> bool:
        """Determine if automatic task creation is warranted"""
        tool_response = self.parent.get_tool_response()

        # Create task on significant errors
        if tool_response.get('error') or tool_response.get('stderr'):
            return True

        # Create task for large operations
        tool_input = self.parent.get_tool_input()
        content = str(tool_input)
        if len(content) > 2000:
            return True

        return False

    def _generate_task_data(self) -> Dict[str, Any]:
        """Generate task data based on current context"""
        tool_name = self.parent.get_tool_name()
        tool_response = self.parent.get_tool_response()

        if tool_response.get('error'):
            task_name = f"Fix {tool_name} error - {datetime.now().strftime('%Y%m%d-%H%M')}"
            description = f"Resolve error in {tool_name}: {tool_response.get('error', 'Unknown error')}"
        else:
            task_name = f"Complete {tool_name} operation - {datetime.now().strftime('%Y%m%d-%H%M')}"
            description = f"Complete large {tool_name} operation started automatically"

        return {
            'name': task_name,
            'description': description,
            'status': 'pending',
            'auto_created': True
        }

    def _create_automatic_task(self, task_data: Dict[str, Any]) -> None:
        """Create automatic task in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO tasks (name, description, status, created_at, metadata)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
                """, (
                    task_data['name'],
                    task_data['description'],
                    task_data['status'],
                    json.dumps({'auto_created': True, 'session_id': self.parent.input_data.get('session_id')})
                ))

            self.logger.info(f"Auto-created task: {task_data['name']}")
        except sqlite3.Error as e:
            self.logger.error(f"Error creating automatic task: {e}")

if __name__ == "__main__":
    # Can be used as PostToolUse, PreToolUse, or general hook
    hook_type = sys.argv[1] if len(sys.argv) > 1 else "post-tool-use"
    hook = UnifiedCometaProcessor(hook_type)
    sys.exit(hook.run())