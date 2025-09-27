#!/usr/bin/env python3
"""
Cometa Brain - Orchestrator Intelligence Integration v2.0
Advanced integration between Cometa Brain v2.0 and Unified Orchestrator

Features:
- Smart task routing based on Cometa Brain context
- Historical pattern learning for agent selection
- Contextual complexity prediction
- Cross-session intelligence
"""

import json
import sys
import os
import sqlite3
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path

# Import DevFlow standard patterns
sys.path.append('/Users/fulvioventura/devflow/.claude/hooks/base')
from standard_hook_pattern import PreToolUseHook, PostToolUseHook

# Configuration
DB_PATH = Path('./data/devflow_unified.sqlite')
ORCHESTRATOR_ENDPOINT = "http://localhost:3005/api/tasks"
COMETA_CONTEXT_ENDPOINT = "http://localhost:3005/api/cometa/context"

class CometaOrchestratorIntelligence:
    """Intelligence layer between Cometa Brain and Unified Orchestrator"""

    def __init__(self):
        self.db_path = DB_PATH

    def get_task_context(self, tool_name: str, tool_input: Dict) -> Dict[str, Any]:
        """Get enriched context for task from Cometa Brain"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Get current session context
            cursor.execute("""
                SELECT context_data, intent_category, confidence
                FROM cometa_sessions
                WHERE created_at >= datetime('now', '-1 hour')
                ORDER BY created_at DESC LIMIT 5
            """)

            recent_sessions = cursor.fetchall()

            # Get memory stream for similar operations
            content_hash = self._generate_content_hash(tool_name, tool_input)
            cursor.execute("""
                SELECT memory_content, context_data, confidence_score
                FROM cometa_memory_stream
                WHERE memory_type = 'tool_operation'
                AND memory_content LIKE ?
                ORDER BY confidence_score DESC, created_at DESC LIMIT 3
            """, (f"%{tool_name}%",))

            similar_operations = cursor.fetchall()

            # Get project context
            cursor.execute("""
                SELECT name, description, status
                FROM projects
                WHERE status = 'active'
                ORDER BY created_at DESC LIMIT 1
            """)

            current_project = cursor.fetchone()

            conn.close()

            return {
                'recent_sessions': recent_sessions,
                'similar_operations': similar_operations,
                'current_project': current_project,
                'content_hash': content_hash,
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}

    def predict_optimal_agent(self, tool_name: str, tool_input: Dict, context: Dict) -> Dict[str, Any]:
        """Predict optimal agent based on Cometa Brain intelligence"""

        # Agent capabilities mapping with Context7 patterns
        agent_capabilities = {
            'codex': {
                'strengths': ['complex_reasoning', 'tool_use', 'debugging'],
                'best_for': ['architecture', 'complex_logic', 'system_design'],
                'complexity_range': (7, 10)
            },
            'gemini': {
                'strengths': ['frontend', 'refactoring', 'rapid_iteration'],
                'best_for': ['ui_components', 'styling', 'user_experience'],
                'complexity_range': (4, 8)
            },
            'qwen': {
                'strengths': ['backend', 'automation', 'data_processing'],
                'best_for': ['apis', 'database', 'scripts'],
                'complexity_range': (3, 7)
            }
        }

        # Calculate complexity score
        complexity_score = self._calculate_complexity(tool_name, tool_input, context)

        # Analyze operation type
        operation_type = self._classify_operation(tool_name, tool_input)

        # Get historical performance
        historical_performance = self._get_agent_performance(operation_type)

        # Select optimal agent
        optimal_agent = self._select_agent(
            complexity_score,
            operation_type,
            historical_performance,
            agent_capabilities
        )

        return {
            'recommended_agent': optimal_agent,
            'complexity_score': complexity_score,
            'operation_type': operation_type,
            'reasoning': f"Selected {optimal_agent} for {operation_type} (complexity: {complexity_score}/10)",
            'fallback_agents': self._get_fallback_chain(optimal_agent),
            'confidence': min(0.95, max(0.6, complexity_score / 10))
        }

    def _calculate_complexity(self, tool_name: str, tool_input: Dict, context: Dict) -> float:
        """Calculate task complexity using multiple factors"""
        complexity_factors = []

        # File/content size factor
        content = tool_input.get('content', tool_input.get('new_string', ''))
        if isinstance(content, str):
            lines = content.count('\n')
            complexity_factors.append(min(10, lines / 10))  # 10 lines = 1 complexity point

        # Tool complexity mapping
        tool_complexity = {
            'Edit': 3, 'Write': 4, 'MultiEdit': 7, 'Bash': 5,
            'mcp__codex-cli__codex': 8,
            'mcp__gemini-cli__ask-gemini': 6,
            'mcp__qwen-code__ask-qwen': 5
        }
        complexity_factors.append(tool_complexity.get(tool_name, 5))

        # Context complexity (similar operations)
        similar_ops = context.get('similar_operations', [])
        if similar_ops:
            avg_confidence = sum(float(op[2]) for op in similar_ops) / len(similar_ops)
            complexity_factors.append(10 - (avg_confidence * 10))  # Lower confidence = higher complexity

        # Security sensitivity adds complexity
        content_str = json.dumps(tool_input).lower()
        security_patterns = ['password', 'secret', 'token', 'sudo', 'rm', 'delete']
        security_count = sum(1 for pattern in security_patterns if pattern in content_str)
        complexity_factors.append(security_count * 2)

        # Calculate weighted average
        if complexity_factors:
            return min(10, max(1, sum(complexity_factors) / len(complexity_factors)))
        return 5.0  # Default complexity

    def _classify_operation(self, tool_name: str, tool_input: Dict) -> str:
        """Classify operation type for agent selection"""
        content = json.dumps(tool_input).lower()

        # Classification patterns
        if any(pattern in content for pattern in ['ui', 'component', 'react', 'vue', 'css']):
            return 'frontend'
        elif any(pattern in content for pattern in ['api', 'database', 'server', 'backend']):
            return 'backend'
        elif any(pattern in content for pattern in ['test', 'spec', 'assert', 'mock']):
            return 'testing'
        elif any(pattern in content for pattern in ['config', 'setup', 'install', 'deploy']):
            return 'configuration'
        elif any(pattern in content for pattern in ['debug', 'error', 'fix', 'bug']):
            return 'debugging'
        elif 'mcp__' in tool_name:
            return 'ai_assisted'
        else:
            return 'general'

    def _get_agent_performance(self, operation_type: str) -> Dict[str, float]:
        """Get historical performance data for agents by operation type"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Query successful operations by agent type
            cursor.execute("""
                SELECT
                    CASE
                        WHEN memory_content LIKE '%codex%' THEN 'codex'
                        WHEN memory_content LIKE '%gemini%' THEN 'gemini'
                        WHEN memory_content LIKE '%qwen%' THEN 'qwen'
                        ELSE 'unknown'
                    END as agent,
                    AVG(confidence_score) as avg_confidence,
                    COUNT(*) as operation_count
                FROM cometa_memory_stream
                WHERE memory_type = 'tool_operation'
                AND memory_content LIKE ?
                AND confidence_score > 0.7
                AND created_at >= datetime('now', '-7 days')
                GROUP BY agent
            """, (f"%{operation_type}%",))

            results = cursor.fetchall()
            conn.close()

            performance = {}
            for agent, confidence, count in results:
                if agent != 'unknown' and count >= 2:  # Minimum sample size
                    performance[agent] = float(confidence) * min(1.0, count / 10)  # Confidence * frequency factor

            return performance

        except Exception:
            return {}

    def _select_agent(self, complexity: float, operation_type: str, performance: Dict, capabilities: Dict) -> str:
        """Select optimal agent based on all factors"""
        scores = {}

        for agent, caps in capabilities.items():
            score = 0.0

            # Complexity fit score
            min_complexity, max_complexity = caps['complexity_range']
            if min_complexity <= complexity <= max_complexity:
                score += 0.4  # Perfect fit
            elif complexity < min_complexity:
                score += 0.2 - (min_complexity - complexity) * 0.05  # Underutilized
            else:
                score += 0.2 - (complexity - max_complexity) * 0.1  # Potentially overwhelmed

            # Operation type fit
            if operation_type in caps['best_for']:
                score += 0.3
            elif operation_type in [op.replace('_', ' ') for op in caps['strengths']]:
                score += 0.2

            # Historical performance
            if agent in performance:
                score += performance[agent] * 0.3

            scores[agent] = max(0.0, score)

        # Select agent with highest score
        if scores:
            return max(scores.items(), key=lambda x: x[1])[0]
        return 'codex'  # Default fallback

    def _get_fallback_chain(self, primary_agent: str) -> List[str]:
        """Get fallback agent chain based on orchestrator architecture"""
        fallback_chains = {
            'codex': ['qwen3_coder', 'claude'],
            'gemini': ['kimi_k2', 'claude'],
            'qwen': ['glm_4_5', 'claude']
        }
        return fallback_chains.get(primary_agent, ['claude'])

    def _generate_content_hash(self, tool_name: str, tool_input: Dict) -> str:
        """Generate hash for content similarity"""
        import hashlib
        content = f"{tool_name}:{json.dumps(tool_input, sort_keys=True)}"
        return hashlib.md5(content.encode()).hexdigest()

    def store_orchestrator_result(self, task_context: Dict, agent_used: str, success: bool, execution_time: float):
        """Store orchestrator execution results for learning"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO cometa_memory_stream (
                    memory_type, memory_content, context_data,
                    confidence_score, created_at
                ) VALUES (?, ?, ?, ?, ?)
            """, (
                'orchestrator_result',
                json.dumps({
                    'agent_used': agent_used,
                    'success': success,
                    'execution_time': execution_time
                }),
                json.dumps(task_context),
                0.9 if success else 0.3,
                datetime.now().isoformat()
            ))

            conn.commit()
            conn.close()

        except Exception as e:
            print(f"Error storing orchestrator result: {e}", file=sys.stderr)

class CometaEnhancedPreToolUse(PreToolUseHook):
    """Enhanced PreToolUse hook with Cometa Brain intelligence"""

    def __init__(self):
        super().__init__("cometa-orchestrator-intelligence")
        self.cometa = CometaOrchestratorIntelligence()

    def execute_logic(self):
        """Execute with Cometa Brain intelligence"""
        tool_name = self.get_tool_name()
        tool_input = self.get_tool_input()

        # Get Cometa Brain context
        context = self.cometa.get_task_context(tool_name, tool_input)

        # Predict optimal agent
        agent_prediction = self.cometa.predict_optimal_agent(tool_name, tool_input, context)

        # Enhanced security check with context
        should_block, block_reason = self.should_block_operation()
        if should_block:
            self.deny(f"Security policy violation: {block_reason}")
            return

        # Make intelligent routing decision
        if self.is_orchestrator_required():
            # Enhance orchestrator request with Cometa intelligence
            orchestrator_payload = {
                'tool_name': tool_name,
                'tool_input': tool_input,
                'cometa_context': context,
                'agent_recommendation': agent_prediction,
                'timestamp': datetime.now().isoformat()
            }

            # Route to orchestrator with enhanced context
            try:
                response = requests.post(
                    f"{COMETA_CONTEXT_ENDPOINT}/enhanced-routing",
                    json=orchestrator_payload,
                    headers={'Authorization': f'Bearer {os.getenv("DEVFLOW_API_TOKEN", "dev-token")}'},
                    timeout=30
                )

                if response.status_code == 200:
                    result = response.json()
                    self.approve(f"Cometa-enhanced routing: {result.get('agent_used', 'unknown')}")
                    self.response.metadata.update({
                        'cometa_enhanced': True,
                        'predicted_agent': agent_prediction['recommended_agent'],
                        'actual_agent': result.get('agent_used'),
                        'complexity_score': agent_prediction['complexity_score']
                    })
                else:
                    self.logger.warning(f"Enhanced routing failed: {response.status_code}")
                    self.approve("Fallback to standard orchestrator routing")

            except Exception as e:
                self.logger.error(f"Cometa-enhanced routing error: {e}")
                self.approve("Fallback to standard routing due to error")
        else:
            self.approve("Direct execution - no orchestrator routing required")

class CometaEnhancedPostToolUse(PostToolUseHook):
    """Enhanced PostToolUse hook for learning from results"""

    def __init__(self):
        super().__init__("cometa-orchestrator-learning")
        self.cometa = CometaOrchestratorIntelligence()

    def execute_logic(self):
        """Store results for continuous learning"""
        tool_response = self.get_tool_response()
        success = tool_response.get('success', True)

        # Extract execution metadata from response
        agent_used = tool_response.get('agent_used', 'unknown')
        execution_time = tool_response.get('execution_time_ms', 0)

        # Store for learning
        task_context = {
            'tool_name': self.get_tool_name(),
            'tool_input': self.get_tool_input(),
            'session_id': self.input_data.get('session_id')
        }

        self.cometa.store_orchestrator_result(task_context, agent_used, success, execution_time)

        # Continue processing
        if success:
            self.logger.info(f"Task completed successfully with {agent_used}")
        else:
            self.logger.warning(f"Task failed with {agent_used}")
            self.block(f"Task execution failed - review required")

def main():
    """Main execution with hook type detection"""
    hook_event = os.getenv('HOOK_EVENT', 'PreToolUse')

    if hook_event == 'PreToolUse':
        hook = CometaEnhancedPreToolUse()
    elif hook_event == 'PostToolUse':
        hook = CometaEnhancedPostToolUse()
    else:
        print(json.dumps({'error': f'Unsupported hook event: {hook_event}'}))
        return 1

    return hook.run()

if __name__ == "__main__":
    sys.exit(main())