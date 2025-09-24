#!/usr/bin/env python3
"""
Cross-Verification Protocol System v2.0
Ensures no agent verifies its own work - implements Context7 patterns

Verification Matrix (from Unified Orchestrator Architecture):
- Codex → Verified by Gemini, Qwen, GLM 4.5
- Gemini → Verified by Codex, Qwen, Kimi K2
- Qwen → Verified by Codex, Gemini, DeepSeek V3.1
- Synthetic agents → Cross-verified by different synthetic agents
"""

import json
import sys
import os
import sqlite3
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Set
from pathlib import Path
from enum import Enum

# Import DevFlow patterns
sys.path.append('/Users/fulvioventura/devflow/.claude/hooks/base')
from standard_hook_pattern import PostToolUseHook, HookDecision

# Configuration
DB_PATH = Path('./data/devflow_unified.sqlite')
ORCHESTRATOR_ENDPOINT = "http://localhost:3005/api/verification"
VERIFICATION_TIMEOUT = 45  # seconds

class VerificationResult(Enum):
    PASS = "pass"
    FAIL = "fail"
    NEEDS_REVIEW = "needs_review"
    INCONCLUSIVE = "inconclusive"

class AgentType(Enum):
    CLI = "cli"
    SYNTHETIC = "synthetic"
    CLAUDE = "claude"

class CrossVerificationSystem:
    """Manages cross-agent verification according to DevFlow architecture"""

    def __init__(self):
        self.db_path = DB_PATH

        # Verification matrix - no agent verifies its own work
        self.verification_matrix = {
            # CLI Agents
            'codex': {
                'type': AgentType.CLI,
                'verifiers': ['gemini', 'qwen'],
                'fallback_verifiers': ['glm_4_5', 'kimi_k2'],
                'strengths': ['complex_logic', 'system_design', 'debugging']
            },
            'gemini': {
                'type': AgentType.CLI,
                'verifiers': ['codex', 'qwen'],
                'fallback_verifiers': ['kimi_k2', 'deepseek_v3'],
                'strengths': ['frontend', 'refactoring', 'user_experience']
            },
            'qwen': {
                'type': AgentType.CLI,
                'verifiers': ['codex', 'gemini'],
                'fallback_verifiers': ['deepseek_v3', 'glm_4_5'],
                'strengths': ['backend', 'automation', 'data_processing']
            },

            # Synthetic Agents
            'qwen3_coder': {
                'type': AgentType.SYNTHETIC,
                'verifiers': ['kimi_k2', 'glm_4_5', 'deepseek_v3'],
                'fallback_verifiers': [],
                'strengths': ['heavy_reasoning', 'tool_use', 'complex_coding']
            },
            'kimi_k2': {
                'type': AgentType.SYNTHETIC,
                'verifiers': ['qwen3_coder', 'glm_4_5', 'deepseek_v3'],
                'fallback_verifiers': [],
                'strengths': ['frontend', 'robust_refactoring', 'user_interface']
            },
            'glm_4_5': {
                'type': AgentType.SYNTHETIC,
                'verifiers': ['qwen3_coder', 'kimi_k2', 'deepseek_v3'],
                'fallback_verifiers': [],
                'strengths': ['backend', 'fast_patching', 'automation']
            },
            'deepseek_v3': {
                'type': AgentType.SYNTHETIC,
                'verifiers': ['qwen3_coder', 'kimi_k2', 'glm_4_5'],
                'fallback_verifiers': [],
                'strengths': ['strategic_decisions', 'architecture', 'reasoning']
            },

            # Claude as emergency verifier
            'claude': {
                'type': AgentType.CLAUDE,
                'verifiers': [],  # Claude doesn't need verification
                'fallback_verifiers': [],
                'strengths': ['general_purpose', 'fallback', 'emergency']
            }
        }

    def select_verifier(self, executing_agent: str, operation_type: str, complexity: float) -> Optional[str]:
        """Select optimal verifier for given agent and task"""

        if executing_agent not in self.verification_matrix:
            return 'claude'  # Emergency fallback

        agent_config = self.verification_matrix[executing_agent]
        available_verifiers = agent_config['verifiers'] + agent_config['fallback_verifiers']

        if not available_verifiers:
            return 'claude'  # No verifiers available, use Claude

        # Select verifier based on operation type and complexity
        best_verifier = self._match_verifier_to_task(
            available_verifiers, operation_type, complexity
        )

        return best_verifier or available_verifiers[0]  # Fallback to first available

    def _match_verifier_to_task(self, verifiers: List[str], operation_type: str, complexity: float) -> Optional[str]:
        """Match verifier strengths to task requirements"""

        # Operation type to strength mapping
        operation_strengths = {
            'frontend': ['frontend', 'user_experience', 'user_interface'],
            'backend': ['backend', 'automation', 'data_processing'],
            'debugging': ['debugging', 'complex_logic', 'heavy_reasoning'],
            'architecture': ['system_design', 'architecture', 'strategic_decisions'],
            'testing': ['debugging', 'complex_logic'],
            'configuration': ['automation', 'fast_patching']
        }

        required_strengths = operation_strengths.get(operation_type, ['general_purpose'])

        # Score verifiers based on strength match and availability
        verifier_scores = {}

        for verifier in verifiers:
            if verifier in self.verification_matrix:
                verifier_strengths = self.verification_matrix[verifier]['strengths']

                # Calculate match score
                score = sum(1 for strength in required_strengths if strength in verifier_strengths)

                # Complexity adjustment
                if complexity > 7:  # High complexity tasks
                    if 'heavy_reasoning' in verifier_strengths or 'complex_logic' in verifier_strengths:
                        score += 2
                elif complexity < 4:  # Simple tasks
                    if 'fast_patching' in verifier_strengths or 'automation' in verifier_strengths:
                        score += 1

                verifier_scores[verifier] = score

        # Return highest scoring verifier
        if verifier_scores:
            return max(verifier_scores.items(), key=lambda x: x[1])[0]

        return None

    def initiate_verification(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Initiate cross-verification process"""

        executing_agent = task_data.get('agent_used', 'unknown')
        operation_type = task_data.get('operation_type', 'general')
        complexity = task_data.get('complexity_score', 5.0)

        # Select verifier
        verifier = self.select_verifier(executing_agent, operation_type, complexity)

        if not verifier:
            return {
                'status': 'error',
                'message': 'No verifier available',
                'timestamp': datetime.now().isoformat()
            }

        # Prepare verification request
        verification_request = {
            'verification_id': self._generate_verification_id(),
            'executing_agent': executing_agent,
            'verifier_agent': verifier,
            'task_data': task_data,
            'verification_criteria': self._get_verification_criteria(operation_type, complexity),
            'timestamp': datetime.now().isoformat(),
            'timeout_seconds': VERIFICATION_TIMEOUT
        }

        # Store verification request
        self._store_verification_request(verification_request)

        # Send to orchestrator for execution
        try:
            response = requests.post(
                ORCHESTRATOR_ENDPOINT,
                json=verification_request,
                headers={'Authorization': f'Bearer {os.getenv("DEVFLOW_API_TOKEN", "dev-token")}'},
                timeout=VERIFICATION_TIMEOUT + 5
            )

            if response.status_code == 200:
                result = response.json()
                self._store_verification_result(verification_request['verification_id'], result)
                return result
            else:
                return {
                    'status': 'error',
                    'message': f'Orchestrator returned {response.status_code}',
                    'fallback': 'manual_review_required'
                }

        except requests.exceptions.Timeout:
            return {
                'status': 'timeout',
                'message': 'Verification timeout - manual review required',
                'verifier': verifier
            }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Verification request failed: {str(e)}',
                'fallback': 'manual_review_required'
            }

    def _get_verification_criteria(self, operation_type: str, complexity: float) -> List[str]:
        """Get verification criteria based on operation type and complexity"""

        base_criteria = [
            'correctness',
            'security_compliance',
            'code_quality',
            'performance_impact'
        ]

        # Add operation-specific criteria
        type_specific_criteria = {
            'frontend': ['accessibility', 'responsive_design', 'user_experience'],
            'backend': ['scalability', 'error_handling', 'data_integrity'],
            'debugging': ['root_cause_identification', 'fix_completeness'],
            'architecture': ['design_patterns', 'maintainability', 'extensibility'],
            'testing': ['test_coverage', 'edge_cases', 'test_reliability'],
            'configuration': ['environment_compatibility', 'rollback_safety']
        }

        criteria = base_criteria + type_specific_criteria.get(operation_type, [])

        # Add complexity-based criteria
        if complexity > 7:
            criteria.extend(['architectural_impact', 'integration_effects'])
        elif complexity > 4:
            criteria.append('maintainability')

        return criteria

    def _generate_verification_id(self) -> str:
        """Generate unique verification ID"""
        import hashlib
        import uuid

        unique_data = f"{datetime.now().isoformat()}{uuid.uuid4()}"
        return f"VER-{hashlib.md5(unique_data.encode()).hexdigest()[:8].upper()}"

    def _store_verification_request(self, request: Dict[str, Any]):
        """Store verification request in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Create table if not exists
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cross_verifications (
                    id TEXT PRIMARY KEY,
                    executing_agent TEXT NOT NULL,
                    verifier_agent TEXT NOT NULL,
                    task_data TEXT NOT NULL,
                    verification_criteria TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    result TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    completed_at DATETIME
                )
            """)

            cursor.execute("""
                INSERT INTO cross_verifications (
                    id, executing_agent, verifier_agent, task_data,
                    verification_criteria, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                request['verification_id'],
                request['executing_agent'],
                request['verifier_agent'],
                json.dumps(request['task_data']),
                json.dumps(request['verification_criteria']),
                request['timestamp']
            ))

            conn.commit()
            conn.close()

        except Exception as e:
            print(f"Error storing verification request: {e}", file=sys.stderr)

    def _store_verification_result(self, verification_id: str, result: Dict[str, Any]):
        """Store verification result in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                UPDATE cross_verifications
                SET status = ?, result = ?, completed_at = ?
                WHERE id = ?
            """, (
                result.get('status', 'completed'),
                json.dumps(result),
                datetime.now().isoformat(),
                verification_id
            ))

            conn.commit()
            conn.close()

        except Exception as e:
            print(f"Error storing verification result: {e}", file=sys.stderr)

    def get_verification_stats(self, days: int = 7) -> Dict[str, Any]:
        """Get verification statistics for monitoring"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Get verification stats
            cursor.execute("""
                SELECT
                    executing_agent,
                    verifier_agent,
                    status,
                    COUNT(*) as count,
                    AVG(
                        CASE WHEN completed_at IS NOT NULL THEN
                            JULIANDAY(completed_at) - JULIANDAY(created_at)
                        END
                    ) * 24 * 60 as avg_minutes
                FROM cross_verifications
                WHERE created_at >= datetime('now', '-{} days')
                GROUP BY executing_agent, verifier_agent, status
            """.format(days))

            stats = cursor.fetchall()
            conn.close()

            # Format results
            formatted_stats = {
                'verification_pairs': {},
                'summary': {'total': 0, 'passed': 0, 'failed': 0, 'pending': 0}
            }

            for exec_agent, verifier, status, count, avg_minutes in stats:
                pair_key = f"{exec_agent} → {verifier}"
                if pair_key not in formatted_stats['verification_pairs']:
                    formatted_stats['verification_pairs'][pair_key] = {}

                formatted_stats['verification_pairs'][pair_key][status] = {
                    'count': count,
                    'avg_time_minutes': round(avg_minutes or 0, 2)
                }

                formatted_stats['summary']['total'] += count
                if status == 'passed':
                    formatted_stats['summary']['passed'] += count
                elif status == 'failed':
                    formatted_stats['summary']['failed'] += count
                elif status == 'pending':
                    formatted_stats['summary']['pending'] += count

            return formatted_stats

        except Exception as e:
            return {'error': str(e)}

class CrossVerificationHook(PostToolUseHook):
    """PostToolUse hook that triggers cross-verification"""

    def __init__(self):
        super().__init__("cross-verification-system")
        self.verification_system = CrossVerificationSystem()

    def execute_logic(self):
        """Execute cross-verification logic"""
        tool_response = self.get_tool_response()

        # Extract agent information from tool response
        agent_used = tool_response.get('agent_used', 'unknown')
        success = tool_response.get('success', True)

        if not success:
            self.logger.info("Task failed - skipping cross-verification")
            return

        # Skip verification for Claude (emergency agent)
        if agent_used == 'claude':
            self.logger.info("Claude execution - no cross-verification needed")
            return

        # Prepare task data for verification
        task_data = {
            'tool_name': self.get_tool_name(),
            'tool_input': self.get_tool_input(),
            'tool_response': tool_response,
            'agent_used': agent_used,
            'session_id': self.input_data.get('session_id'),
            'timestamp': datetime.now().isoformat()
        }

        # Add operation classification
        task_data['operation_type'] = self._classify_operation()
        task_data['complexity_score'] = self._estimate_complexity()

        # Initiate cross-verification
        verification_result = self.verification_system.initiate_verification(task_data)

        # Process verification result
        if verification_result.get('status') == 'passed':
            self.logger.info(f"Cross-verification passed for {agent_used}")
            self.response.metadata.update({
                'cross_verification': 'passed',
                'verifier': verification_result.get('verifier_agent'),
                'verification_id': verification_result.get('verification_id')
            })
        elif verification_result.get('status') == 'failed':
            self.logger.warning(f"Cross-verification failed for {agent_used}")
            self.block(f"Cross-verification failed: {verification_result.get('reason', 'Unknown failure')}")
        elif verification_result.get('status') == 'timeout':
            self.logger.warning(f"Cross-verification timeout for {agent_used}")
            # Don't block on timeout - log for manual review
            self.response.metadata.update({
                'cross_verification': 'timeout',
                'requires_manual_review': True
            })
        else:
            self.logger.error(f"Cross-verification error: {verification_result.get('message')}")
            self.response.metadata.update({
                'cross_verification': 'error',
                'requires_manual_review': True
            })

    def _classify_operation(self) -> str:
        """Classify the operation type for verification"""
        tool_name = self.get_tool_name()
        tool_input = self.get_tool_input()

        content = json.dumps(tool_input).lower()

        if any(pattern in content for pattern in ['test', 'spec', 'assert']):
            return 'testing'
        elif any(pattern in content for pattern in ['ui', 'component', 'frontend']):
            return 'frontend'
        elif any(pattern in content for pattern in ['api', 'server', 'database']):
            return 'backend'
        elif any(pattern in content for pattern in ['config', 'setup']):
            return 'configuration'
        elif any(pattern in content for pattern in ['debug', 'fix', 'error']):
            return 'debugging'
        elif 'architecture' in content or tool_name == 'MultiEdit':
            return 'architecture'
        else:
            return 'general'

    def _estimate_complexity(self) -> float:
        """Estimate task complexity for verification"""
        tool_input = self.get_tool_input()
        content = tool_input.get('content', tool_input.get('new_string', ''))

        complexity_factors = []

        # Content size factor
        if isinstance(content, str):
            lines = content.count('\n')
            complexity_factors.append(min(10, lines / 10))

        # Tool complexity
        tool_complexity = {
            'Edit': 3, 'Write': 4, 'MultiEdit': 7, 'Bash': 5
        }
        complexity_factors.append(tool_complexity.get(self.get_tool_name(), 5))

        # Security patterns increase complexity
        security_patterns = ['password', 'secret', 'token', 'sudo']
        content_str = json.dumps(tool_input).lower()
        security_count = sum(1 for pattern in security_patterns if pattern in content_str)
        complexity_factors.append(security_count * 2)

        return min(10, max(1, sum(complexity_factors) / len(complexity_factors)) if complexity_factors else 5)

def main():
    """Main execution"""
    hook = CrossVerificationHook()
    return hook.run()

if __name__ == "__main__":
    sys.exit(main())