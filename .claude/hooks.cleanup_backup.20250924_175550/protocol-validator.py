#!/usr/bin/env python3
"""
DevFlow Protocol Validator v1.0
Advanced validation system for Context7 compliance and protocol adherence

Features:
- Hook pattern compliance validation
- Performance threshold monitoring
- Security policy enforcement
- Cross-verification accuracy checks
"""

import json
import sys
import os
import sqlite3
import time
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from datetime import datetime, timedelta
import hashlib

# Import DevFlow standard hook pattern
sys.path.append('/Users/fulvioventura/devflow/.claude/hooks/base')
from standard_hook_pattern import BaseDevFlowHook

class ProtocolValidator:
    """Advanced protocol validation engine"""

    def __init__(self, db_path: str = "./data/devflow_unified.sqlite"):
        self.db_path = db_path
        self.validation_rules = self._load_validation_rules()
        self.performance_thresholds = {
            'hook_execution_time_ms': 5000,  # Max 5 seconds
            'cache_hit_rate_percent': 70,    # Min 70% hit rate
            'orchestrator_success_rate': 95,  # Min 95% success
            'cross_verification_accuracy': 90  # Min 90% accuracy
        }

    def _load_validation_rules(self) -> Dict[str, Any]:
        """Load Context7 validation rules"""
        return {
            'required_hook_methods': {
                'BaseDevFlowHook': ['validate_input', 'execute_logic'],
                'PreToolUseHook': ['validate_input', 'execute_logic', 'approve', 'deny'],
                'PostToolUseHook': ['validate_input', 'execute_logic', 'block']
            },
            'required_metadata_fields': [
                'hook_name', 'session_id', 'execution_time', 'tool_name',
                'security_sensitive', 'orchestrator_required'
            ],
            'security_patterns': [
                r'password\s*=\s*["\'][^"\']*["\']',    # Hardcoded passwords (actual values)
                r'api_key\s*=\s*["\'][^"\']*["\']',     # Hardcoded API keys (actual values)
                r'sudo\s+rm\s+-rf\s+/',                 # Dangerous rm commands
                r'DROP\s+TABLE\s+\w+',                  # Database destruction
            ],
            'orchestrator_compliance': {
                'required_routing': ['mcp__codex-cli__*', 'mcp__gemini-cli__*', 'mcp__qwen-code__*'],
                'fallback_chains': {
                    'codex': ['qwen3_coder', 'claude'],
                    'gemini': ['kimi_k2', 'claude'],
                    'qwen': ['glm_4_5', 'claude']
                }
            }
        }

    def validate_hook_compliance(self, hook_path: Path) -> Dict[str, Any]:
        """Validate individual hook for Context7 compliance"""
        validation_result = {
            'hook_path': str(hook_path),
            'compliant': True,
            'issues': [],
            'score': 100,
            'timestamp': datetime.now().isoformat()
        }

        try:
            # Read hook source code
            with open(hook_path, 'r') as f:
                hook_content = f.read()

            # Check for Context7 pattern imports
            if 'from standard_hook_pattern import' not in hook_content:
                validation_result['issues'].append({
                    'type': 'missing_import',
                    'severity': 'high',
                    'message': 'Missing Context7 standard hook pattern import'
                })
                validation_result['score'] -= 30

            # Check for proper class inheritance
            hook_classes = ['BaseDevFlowHook', 'PreToolUseHook', 'PostToolUseHook']
            has_proper_inheritance = any(cls in hook_content for cls in hook_classes)

            if not has_proper_inheritance:
                validation_result['issues'].append({
                    'type': 'missing_inheritance',
                    'severity': 'high',
                    'message': 'Hook does not inherit from Context7 base classes'
                })
                validation_result['score'] -= 25

            # Check for required methods
            required_methods = ['validate_input', 'execute_logic']
            for method in required_methods:
                if f'def {method}(' not in hook_content:
                    validation_result['issues'].append({
                        'type': 'missing_method',
                        'severity': 'medium',
                        'message': f'Missing required method: {method}'
                    })
                    validation_result['score'] -= 15

            # Check for security anti-patterns
            import re
            for pattern in self.validation_rules['security_patterns']:
                if re.search(pattern, hook_content, re.IGNORECASE):
                    validation_result['issues'].append({
                        'type': 'security_violation',
                        'severity': 'critical',
                        'message': f'Security anti-pattern detected: {pattern}'
                    })
                    validation_result['score'] -= 50

            # Check for proper error handling
            if 'try:' not in hook_content or 'except' not in hook_content:
                validation_result['issues'].append({
                    'type': 'missing_error_handling',
                    'severity': 'medium',
                    'message': 'Hook lacks proper error handling'
                })
                validation_result['score'] -= 10

            # Final compliance determination
            validation_result['compliant'] = validation_result['score'] >= 80

        except Exception as e:
            validation_result['issues'].append({
                'type': 'validation_error',
                'severity': 'critical',
                'message': f'Failed to validate hook: {str(e)}'
            })
            validation_result['compliant'] = False
            validation_result['score'] = 0

        return validation_result

    def validate_all_hooks(self) -> Dict[str, Any]:
        """Validate all hooks in the system"""
        hooks_dir = Path('/Users/fulvioventura/devflow/.claude/hooks')
        validation_results = {
            'summary': {
                'total_hooks': 0,
                'compliant_hooks': 0,
                'non_compliant_hooks': 0,
                'overall_compliance_rate': 0.0,
                'validation_timestamp': datetime.now().isoformat()
            },
            'hook_results': [],
            'recommendations': []
        }

        # Find all Python hook files
        hook_files = list(hooks_dir.glob('*.py'))
        hook_files = [f for f in hook_files if f.name not in ['__init__.py', 'shared_state.py']]

        validation_results['summary']['total_hooks'] = len(hook_files)

        for hook_file in hook_files:
            result = self.validate_hook_compliance(hook_file)
            validation_results['hook_results'].append(result)

            if result['compliant']:
                validation_results['summary']['compliant_hooks'] += 1
            else:
                validation_results['summary']['non_compliant_hooks'] += 1

        # Calculate overall compliance rate
        if validation_results['summary']['total_hooks'] > 0:
            compliance_rate = (validation_results['summary']['compliant_hooks'] /
                             validation_results['summary']['total_hooks'] * 100)
            validation_results['summary']['overall_compliance_rate'] = round(compliance_rate, 2)

        # Generate recommendations
        validation_results['recommendations'] = self._generate_recommendations(validation_results)

        return validation_results

    def validate_performance_metrics(self) -> Dict[str, Any]:
        """Validate system performance against thresholds"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            performance_validation = {
                'compliant': True,
                'metrics': {},
                'issues': [],
                'timestamp': datetime.now().isoformat()
            }

            # Check hook execution times
            cursor.execute("""
                SELECT AVG(execution_time_ms) as avg_time, MAX(execution_time_ms) as max_time
                FROM hook_executions
                WHERE created_at >= datetime('now', '-1 hour')
            """)

            result = cursor.fetchone()
            if result and result[0]:
                avg_time = float(result[0])
                max_time = float(result[1])

                performance_validation['metrics']['avg_hook_execution_ms'] = avg_time
                performance_validation['metrics']['max_hook_execution_ms'] = max_time

                if max_time > self.performance_thresholds['hook_execution_time_ms']:
                    performance_validation['issues'].append({
                        'type': 'performance_threshold',
                        'severity': 'medium',
                        'message': f'Hook execution time exceeded threshold: {max_time}ms > {self.performance_thresholds["hook_execution_time_ms"]}ms'
                    })

            # Check cache performance
            cursor.execute("""
                SELECT
                    SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) as hits,
                    COUNT(*) as total_requests
                FROM performance_cache
                WHERE last_accessed >= datetime('now', '-1 hour')
            """)

            result = cursor.fetchone()
            if result and result[1] > 0:
                hit_rate = (result[0] / result[1]) * 100
                performance_validation['metrics']['cache_hit_rate_percent'] = round(hit_rate, 2)

                if hit_rate < self.performance_thresholds['cache_hit_rate_percent']:
                    performance_validation['issues'].append({
                        'type': 'cache_performance',
                        'severity': 'medium',
                        'message': f'Cache hit rate below threshold: {hit_rate}% < {self.performance_thresholds["cache_hit_rate_percent"]}%'
                    })

            conn.close()

            # Final compliance determination
            performance_validation['compliant'] = len(performance_validation['issues']) == 0

            return performance_validation

        except Exception as e:
            return {
                'compliant': False,
                'metrics': {},
                'issues': [{
                    'type': 'validation_error',
                    'severity': 'critical',
                    'message': f'Failed to validate performance metrics: {str(e)}'
                }],
                'timestamp': datetime.now().isoformat()
            }

    def _generate_recommendations(self, validation_results: Dict[str, Any]) -> List[Dict[str, str]]:
        """Generate actionable recommendations based on validation results"""
        recommendations = []

        # Compliance rate recommendations
        compliance_rate = validation_results['summary']['overall_compliance_rate']
        if compliance_rate < 90:
            recommendations.append({
                'type': 'compliance_improvement',
                'priority': 'high',
                'action': f'Overall compliance rate is {compliance_rate}%. Focus on migrating non-compliant hooks to Context7 patterns.',
                'estimated_effort': 'high'
            })
        elif compliance_rate < 95:
            recommendations.append({
                'type': 'compliance_optimization',
                'priority': 'medium',
                'action': f'Good compliance rate ({compliance_rate}%). Focus on resolving remaining medium-severity issues.',
                'estimated_effort': 'medium'
            })

        # Security recommendations
        security_issues = [result for result in validation_results['hook_results']
                          if any(issue['type'] == 'security_violation' for issue in result['issues'])]

        if security_issues:
            recommendations.append({
                'type': 'security_critical',
                'priority': 'critical',
                'action': f'Found {len(security_issues)} hooks with security violations. Immediate remediation required.',
                'estimated_effort': 'high'
            })

        # Pattern compliance recommendations
        pattern_issues = [result for result in validation_results['hook_results']
                         if any(issue['type'] in ['missing_import', 'missing_inheritance'] for issue in result['issues'])]

        if pattern_issues:
            recommendations.append({
                'type': 'pattern_compliance',
                'priority': 'medium',
                'action': f'Update {len(pattern_issues)} hooks to use Context7 standard patterns.',
                'estimated_effort': 'medium'
            })

        return recommendations

class ProtocolValidatorHook(BaseDevFlowHook):
    """Context7-compliant protocol validation hook"""

    def __init__(self):
        super().__init__("protocol-validator")
        self.validator = ProtocolValidator()

    def validate_input(self) -> bool:
        """Validate protocol validator input"""
        return True  # Always valid for validation requests

    def execute_logic(self):
        """Execute protocol validation"""
        validation_type = self.input_data.get('validation_type', 'all')

        if validation_type == 'hooks':
            results = self.validator.validate_all_hooks()
        elif validation_type == 'performance':
            results = self.validator.validate_performance_metrics()
        else:
            # Full validation
            hook_results = self.validator.validate_all_hooks()
            perf_results = self.validator.validate_performance_metrics()

            results = {
                'validation_type': 'comprehensive',
                'hook_validation': hook_results,
                'performance_validation': perf_results,
                'overall_compliant': hook_results['summary']['overall_compliance_rate'] >= 90 and perf_results['compliant'],
                'timestamp': datetime.now().isoformat()
            }

        self.response.metadata.update({
            'validation_completed': True,
            'validation_type': validation_type,
            'results_summary': results.get('summary', results.get('compliant', 'unknown'))
        })

        # Store results for analysis
        self._store_validation_results(results)

    def _store_validation_results(self, results: Dict[str, Any]):
        """Store validation results for historical analysis"""
        try:
            results_hash = hashlib.sha256(json.dumps(results, sort_keys=True).encode()).hexdigest()
            results_file = Path(f'/Users/fulvioventura/devflow/.claude/logs/validation_{results_hash[:8]}.json')

            with open(results_file, 'w') as f:
                json.dump(results, f, indent=2)

            self.logger.info(f"Validation results stored: {results_file}")

        except Exception as e:
            self.logger.error(f"Failed to store validation results: {e}")

def main():
    """Main validation execution using Context7 pattern"""
    hook = ProtocolValidatorHook()
    return hook.run()

if __name__ == "__main__":
    # Support both command line and hook execution
    if len(sys.argv) > 1:
        # Command line mode for manual validation
        validator = ProtocolValidator()

        if sys.argv[1] == 'hooks':
            results = validator.validate_all_hooks()
            print("=== HOOK VALIDATION RESULTS ===")
            print(f"Total hooks: {results['summary']['total_hooks']}")
            print(f"Compliant: {results['summary']['compliant_hooks']}")
            print(f"Non-compliant: {results['summary']['non_compliant_hooks']}")
            print(f"Compliance rate: {results['summary']['overall_compliance_rate']}%")

            if results['recommendations']:
                print("\n=== RECOMMENDATIONS ===")
                for rec in results['recommendations']:
                    print(f"• {rec['action']} (Priority: {rec['priority']})")

        elif sys.argv[1] == 'performance':
            results = validator.validate_performance_metrics()
            print("=== PERFORMANCE VALIDATION RESULTS ===")
            print(f"Compliant: {results['compliant']}")
            if results['metrics']:
                for metric, value in results['metrics'].items():
                    print(f"{metric}: {value}")
            if results['issues']:
                print("\nIssues found:")
                for issue in results['issues']:
                    print(f"• {issue['message']} (Severity: {issue['severity']})")

        else:
            print("Usage: python3 protocol-validator.py [hooks|performance]")

    else:
        # Hook execution mode
        sys.exit(main())