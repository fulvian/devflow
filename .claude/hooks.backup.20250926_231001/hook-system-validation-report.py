#!/usr/bin/env python3
"""
Hook System Validation Report
Final validation of the optimized hook architecture

This script performs comprehensive validation of the rationalized hook system:
- Validates the final 16-hook architecture
- Tests Context7 compliance across all hooks
- Verifies functionality and performance
- Generates final system health report
- Confirms optimization objectives achieved

Following Google Python Style Guide and Context7 standards
"""

import os
import json
import subprocess
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
import sqlite3

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/Users/fulvioventura/devflow/logs/hook-validation.log'),
        logging.StreamHandler()
    ]
)

class HookSystemValidator:
    """Comprehensive validation of the optimized hook system"""

    def __init__(self):
        self.hooks_dir = Path("/Users/fulvioventura/devflow/.claude/hooks")
        self.db_path = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
        self.validation_results = {
            'validation_timestamp': datetime.now().isoformat(),
            'target_architecture': self._define_target_architecture(),
            'validation_tests': [],
            'compliance_results': {},
            'performance_metrics': {},
            'functionality_tests': {},
            'errors': [],
            'warnings': [],
            'recommendations': []
        }

    def _define_target_architecture(self) -> Dict[str, List[str]]:
        """Define the target optimized architecture"""
        return {
            'core_system': [
                'session-start.py',
                'post-tool-use.py',
                'user-prompt-submit-context7.py'
            ],
            'cometa_brain': [
                'cometa-brain-sync.py',
                'cometa-memory-stream-hook.py',
                'cometa-system-status-hook.py',
                'unified-cometa-processor.py'
            ],
            'integration_quality': [
                'unified-orchestrator-bridge.py',
                'cross-verification-system.py',
                'protocol-validator.py',
                'cometa-orchestrator-intelligence.py'
            ],
            'system_management': [
                'performance-monitor.py',
                'hook-lifecycle-manager.py',
                'system-diagnostics.py'
            ],
            'utilities': [
                'shared_state.py'
            ],
            'base_patterns': [
                'base/standard_hook_pattern.py'
            ]
        }

    def execute_comprehensive_validation(self) -> Dict[str, Any]:
        """Execute complete validation of optimized hook system"""
        logging.info("🔍 Starting Comprehensive Hook System Validation")
        logging.info("=" * 70)

        try:
            # Step 1: Validate architecture structure
            self._validate_architecture_structure()

            # Step 2: Test Context7 compliance
            self._validate_context7_compliance()

            # Step 3: Test hook functionality
            self._validate_hook_functionality()

            # Step 4: Performance validation
            self._validate_performance_metrics()

            # Step 5: Integration testing
            self._validate_integration_capabilities()

            # Step 6: Security validation
            self._validate_security_compliance()

            # Step 7: Generate final recommendations
            self._generate_final_recommendations()

            # Step 8: Calculate overall score
            self._calculate_validation_score()

            self.validation_results['status'] = 'success'
            self.validation_results['completion_time'] = datetime.now().isoformat()

            # Save comprehensive report
            self._save_validation_report()

            logging.info("✅ Comprehensive validation completed successfully")
            return self.validation_results

        except Exception as e:
            error_msg = f"Validation failed: {str(e)}"
            logging.error(error_msg)
            self.validation_results['errors'].append(error_msg)
            self.validation_results['status'] = 'failed'
            raise

    def _validate_architecture_structure(self) -> None:
        """Validate the final architecture matches target design"""
        logging.info("🏗️ Validating architecture structure...")

        # Get actual hook files
        actual_hooks = set()
        for hook_file in self.hooks_dir.rglob("*.py"):
            if ('audit' not in hook_file.name and
                'phase' not in hook_file.name and
                'validation' not in hook_file.name):
                actual_hooks.add(str(hook_file.relative_to(self.hooks_dir)))

        # Get expected hooks from target architecture
        expected_hooks = set()
        for category, hooks in self.validation_results['target_architecture'].items():
            expected_hooks.update(hooks)

        # Compare actual vs expected
        missing_hooks = expected_hooks - actual_hooks
        extra_hooks = actual_hooks - expected_hooks

        architecture_validation = {
            'total_hooks': len(actual_hooks),
            'expected_hooks': len(expected_hooks),
            'missing_hooks': list(missing_hooks),
            'extra_hooks': list(extra_hooks),
            'architecture_match': len(missing_hooks) == 0 and len(extra_hooks) == 0
        }

        # Validate hook counts per category
        category_validation = {}
        for category, expected_hooks_list in self.validation_results['target_architecture'].items():
            present_hooks = [h for h in expected_hooks_list if h in actual_hooks]
            category_validation[category] = {
                'expected': len(expected_hooks_list),
                'present': len(present_hooks),
                'complete': len(present_hooks) == len(expected_hooks_list),
                'missing': [h for h in expected_hooks_list if h not in actual_hooks]
            }

        architecture_validation['category_validation'] = category_validation

        self.validation_results['validation_tests'].append({
            'test': 'architecture_structure',
            'status': 'pass' if architecture_validation['architecture_match'] else 'fail',
            'details': architecture_validation,
            'timestamp': datetime.now().isoformat()
        })

        if missing_hooks:
            error_msg = f"Missing critical hooks: {missing_hooks}"
            logging.error(error_msg)
            self.validation_results['errors'].append(error_msg)
        else:
            logging.info("✅ Architecture structure validation passed")

    def _validate_context7_compliance(self) -> None:
        """Validate Context7 compliance across all hooks"""
        logging.info("📋 Validating Context7 compliance...")

        compliance_results = {}
        total_compliant = 0

        # Get all hook files for testing
        hook_files = [h for h in self.hooks_dir.rglob("*.py")
                     if ('audit' not in h.name and
                         'phase' not in h.name and
                         'validation' not in h.name)]

        for hook_file in hook_files:
            relative_path = str(hook_file.relative_to(self.hooks_dir))
            compliance_results[relative_path] = self._check_hook_context7_compliance(hook_file)

            if compliance_results[relative_path]['compliant']:
                total_compliant += 1

        compliance_rate = (total_compliant / len(hook_files)) * 100 if hook_files else 0

        self.validation_results['compliance_results'] = {
            'total_hooks': len(hook_files),
            'compliant_hooks': total_compliant,
            'compliance_rate': round(compliance_rate, 1),
            'target_compliance_rate': 100.0,
            'compliance_achieved': compliance_rate >= 95.0,
            'individual_results': compliance_results
        }

        self.validation_results['validation_tests'].append({
            'test': 'context7_compliance',
            'status': 'pass' if compliance_rate >= 95.0 else 'fail',
            'compliance_rate': compliance_rate,
            'timestamp': datetime.now().isoformat()
        })

        logging.info(f"📊 Context7 compliance rate: {compliance_rate}%")

    def _check_hook_context7_compliance(self, hook_file: Path) -> Dict[str, Any]:
        """Check individual hook for Context7 compliance"""
        try:
            with open(hook_file, 'r', encoding='utf-8') as f:
                content = f.read()

            compliance_criteria = {
                'imports_base_pattern': 'from standard_hook_pattern import' in content,
                'extends_base_hook': any(pattern in content for pattern in [
                    'PostToolUseHook', 'PreToolUseHook', 'UserPromptSubmitHook', 'BaseDevFlowHook'
                ]),
                'has_validate_input': 'def validate_input' in content,
                'has_execute_logic': 'def execute_logic' in content,
                'uses_logger': 'self.logger' in content,
                'returns_json': any(pattern in content for pattern in [
                    'json.dumps', 'print(json.dumps'
                ]),
                'has_error_handling': any(pattern in content for pattern in [
                    'try:', 'except:', 'Exception'
                ]),
                'has_docstring': (content.strip().startswith('"""') or
                                content.strip().startswith("'''")),
                'has_shebang': content.startswith('#!'),
                'proper_imports': 'import sys' in content and 'import os' in content
            }

            # Calculate compliance score
            total_criteria = len(compliance_criteria)
            met_criteria = sum(1 for v in compliance_criteria.values() if v)
            score = round((met_criteria / total_criteria) * 100, 1)

            return {
                'score': score,
                'compliant': score >= 70,
                'criteria': compliance_criteria,
                'missing_criteria': [k for k, v in compliance_criteria.items() if not v]
            }

        except Exception as e:
            return {
                'score': 0,
                'compliant': False,
                'error': str(e)
            }

    def _validate_hook_functionality(self) -> None:
        """Validate hook functionality with comprehensive testing"""
        logging.info("🧪 Validating hook functionality...")

        functionality_results = {}
        successful_tests = 0
        total_tests = 0

        # Test cases for different hook types
        test_cases = {
            'PostToolUse': {
                'session_id': 'test-validation',
                'hook_event_name': 'PostToolUse',
                'cwd': '/Users/fulvioventura/devflow',
                'toolCallResult': {
                    'toolName': 'Test',
                    'toolInput': {'test': 'validation'},
                    'toolResponse': {'status': 'success'}
                }
            },
            'UserPromptSubmit': {
                'session_id': 'test-validation',
                'hook_event_name': 'UserPromptSubmit',
                'cwd': '/Users/fulvioventura/devflow',
                'prompt': 'test validation prompt'
            },
            'SessionStart': {
                'session_id': 'test-validation',
                'hook_event_name': 'SessionStart',
                'cwd': '/Users/fulvioventura/devflow'
            }
        }

        # Test each hook with appropriate test case
        hook_files = [h for h in self.hooks_dir.rglob("*.py")
                     if ('audit' not in h.name and
                         'phase' not in h.name and
                         'validation' not in h.name and
                         h.name != 'standard_hook_pattern.py')]

        for hook_file in hook_files:
            relative_path = str(hook_file.relative_to(self.hooks_dir))

            # Determine appropriate test case
            test_input = test_cases['PostToolUse']  # Default
            if 'user-prompt' in hook_file.name:
                test_input = test_cases['UserPromptSubmit']
            elif 'session-start' in hook_file.name:
                test_input = test_cases['SessionStart']

            functionality_results[relative_path] = self._test_individual_hook(
                hook_file, test_input
            )

            total_tests += 1
            if functionality_results[relative_path]['status'] == 'success':
                successful_tests += 1

        success_rate = (successful_tests / total_tests) * 100 if total_tests else 0

        self.validation_results['functionality_tests'] = {
            'total_hooks_tested': total_tests,
            'successful_tests': successful_tests,
            'success_rate': round(success_rate, 1),
            'target_success_rate': 90.0,
            'functionality_achieved': success_rate >= 90.0,
            'individual_results': functionality_results
        }

        self.validation_results['validation_tests'].append({
            'test': 'functionality_validation',
            'status': 'pass' if success_rate >= 90.0 else 'fail',
            'success_rate': success_rate,
            'timestamp': datetime.now().isoformat()
        })

        logging.info(f"📊 Functionality success rate: {success_rate}%")

    def _test_individual_hook(self, hook_file: Path, test_input: Dict[str, Any]) -> Dict[str, Any]:
        """Test individual hook functionality"""
        try:
            result = subprocess.run(
                ['python3', str(hook_file)],
                input=json.dumps(test_input),
                text=True,
                capture_output=True,
                timeout=15
            )

            return {
                'status': 'success' if result.returncode == 0 else 'failed',
                'return_code': result.returncode,
                'stdout_length': len(result.stdout),
                'stderr_length': len(result.stderr),
                'execution_time': 'under_timeout',
                'has_json_output': self._is_valid_json(result.stdout),
                'error_details': result.stderr if result.returncode != 0 else None
            }

        except subprocess.TimeoutExpired:
            return {
                'status': 'timeout',
                'error': 'Hook execution timed out'
            }
        except Exception as e:
            return {
                'status': 'error',
                'error': str(e)
            }

    def _is_valid_json(self, output: str) -> bool:
        """Check if output is valid JSON"""
        try:
            json.loads(output)
            return True
        except:
            return False

    def _validate_performance_metrics(self) -> None:
        """Validate system performance metrics"""
        logging.info("⚡ Validating performance metrics...")

        # Basic performance validation
        hook_count = len([h for h in self.hooks_dir.rglob("*.py")
                         if ('audit' not in h.name and
                             'phase' not in h.name and
                             'validation' not in h.name)])

        # Calculate total lines of code
        total_lines = 0
        for hook_file in self.hooks_dir.rglob("*.py"):
            if ('audit' not in hook_file.name and
                'phase' not in hook_file.name and
                'validation' not in hook_file.name):
                try:
                    with open(hook_file, 'r') as f:
                        total_lines += len(f.readlines())
                except:
                    pass

        performance_metrics = {
            'hook_count': hook_count,
            'target_hook_count': 15,
            'hook_count_optimized': hook_count <= 17,  # Allow small variance
            'total_lines_of_code': total_lines,
            'average_lines_per_hook': round(total_lines / hook_count, 1) if hook_count else 0,
            'complexity_reduced': total_lines < 10000,  # Target: significant reduction
            'system_efficiency': 'optimized' if hook_count <= 17 and total_lines < 10000 else 'suboptimal'
        }

        self.validation_results['performance_metrics'] = performance_metrics

        self.validation_results['validation_tests'].append({
            'test': 'performance_metrics',
            'status': 'pass' if performance_metrics['system_efficiency'] == 'optimized' else 'partial',
            'details': performance_metrics,
            'timestamp': datetime.now().isoformat()
        })

        logging.info(f"📊 Performance metrics: {hook_count} hooks, {total_lines} total lines")

    def _validate_integration_capabilities(self) -> None:
        """Validate integration capabilities"""
        logging.info("🔗 Validating integration capabilities...")

        # Check for critical integration hooks
        integration_hooks = [
            'unified-orchestrator-bridge.py',
            'cross-verification-system.py',
            'cometa-brain-sync.py'
        ]

        integration_status = {}
        for hook in integration_hooks:
            hook_path = self.hooks_dir / hook
            integration_status[hook] = {
                'present': hook_path.exists(),
                'executable': hook_path.exists() and os.access(hook_path, os.X_OK)
            }

        integration_complete = all(
            status['present'] and status['executable']
            for status in integration_status.values()
        )

        self.validation_results['validation_tests'].append({
            'test': 'integration_capabilities',
            'status': 'pass' if integration_complete else 'fail',
            'integration_status': integration_status,
            'timestamp': datetime.now().isoformat()
        })

        logging.info(f"🔗 Integration validation: {'✅ PASSED' if integration_complete else '❌ FAILED'}")

    def _validate_security_compliance(self) -> None:
        """Validate security compliance"""
        logging.info("🛡️ Validating security compliance...")

        security_issues = []
        total_hooks_scanned = 0

        # Security patterns to check for
        dangerous_patterns = [
            (r'eval\s*\(', 'dangerous_eval'),
            (r'exec\s*\(', 'dangerous_exec'),
            (r'os\.system\s*\(', 'shell_injection_risk'),
            (r'subprocess\.call.*shell=True', 'shell_injection_risk')
        ]

        for hook_file in self.hooks_dir.rglob("*.py"):
            if ('audit' not in hook_file.name and
                'phase' not in hook_file.name and
                'validation' not in hook_file.name):

                total_hooks_scanned += 1
                try:
                    with open(hook_file, 'r') as f:
                        content = f.read()

                    for pattern, issue_type in dangerous_patterns:
                        import re
                        if re.search(pattern, content):
                            security_issues.append({
                                'file': str(hook_file.relative_to(self.hooks_dir)),
                                'issue': issue_type,
                                'pattern': pattern
                            })

                except Exception as e:
                    security_issues.append({
                        'file': str(hook_file.relative_to(self.hooks_dir)),
                        'issue': 'scan_error',
                        'error': str(e)
                    })

        security_status = {
            'hooks_scanned': total_hooks_scanned,
            'security_issues_found': len(security_issues),
            'security_issues': security_issues,
            'security_compliant': len(security_issues) == 0
        }

        self.validation_results['validation_tests'].append({
            'test': 'security_compliance',
            'status': 'pass' if security_status['security_compliant'] else 'fail',
            'security_status': security_status,
            'timestamp': datetime.now().isoformat()
        })

        if security_issues:
            for issue in security_issues:
                logging.warning(f"🛡️ Security issue in {issue['file']}: {issue['issue']}")
        else:
            logging.info("🛡️ Security validation: ✅ NO ISSUES FOUND")

    def _generate_final_recommendations(self) -> None:
        """Generate final recommendations based on validation results"""
        logging.info("📋 Generating final recommendations...")

        recommendations = []

        # Check compliance rate
        compliance_rate = self.validation_results.get('compliance_results', {}).get('compliance_rate', 0)
        if compliance_rate < 100:
            recommendations.append({
                'category': 'compliance',
                'priority': 'high',
                'recommendation': f'Improve Context7 compliance from {compliance_rate}% to 100%',
                'actions': ['Update non-compliant hooks to use standard patterns']
            })

        # Check functionality rate
        functionality_rate = self.validation_results.get('functionality_tests', {}).get('success_rate', 0)
        if functionality_rate < 95:
            recommendations.append({
                'category': 'functionality',
                'priority': 'high',
                'recommendation': f'Fix failing hook tests (current: {functionality_rate}%)',
                'actions': ['Debug and fix failing hooks', 'Improve error handling']
            })

        # Check hook count optimization
        hook_count = self.validation_results.get('performance_metrics', {}).get('hook_count', 0)
        if hook_count > 17:
            recommendations.append({
                'category': 'optimization',
                'priority': 'medium',
                'recommendation': f'Further optimize hook count from {hook_count} to target of 15',
                'actions': ['Identify additional consolidation opportunities']
            })

        # Security recommendations
        security_issues = len(self.validation_results.get('validation_tests', []))
        security_test = next((t for t in self.validation_results.get('validation_tests', [])
                            if t.get('test') == 'security_compliance'), {})
        if not security_test.get('security_status', {}).get('security_compliant', True):
            recommendations.append({
                'category': 'security',
                'priority': 'critical',
                'recommendation': 'Address security vulnerabilities in hooks',
                'actions': ['Remove dangerous patterns', 'Implement secure alternatives']
            })

        # Maintenance recommendations
        recommendations.append({
            'category': 'maintenance',
            'priority': 'low',
            'recommendation': 'Establish regular hook system maintenance',
            'actions': [
                'Schedule monthly compliance checks',
                'Implement automated testing pipeline',
                'Create hook update procedures'
            ]
        })

        self.validation_results['recommendations'] = recommendations
        logging.info(f"📋 Generated {len(recommendations)} recommendations")

    def _calculate_validation_score(self) -> None:
        """Calculate overall validation score"""
        logging.info("📊 Calculating overall validation score...")

        test_results = self.validation_results.get('validation_tests', [])
        total_tests = len(test_results)
        passed_tests = sum(1 for test in test_results if test.get('status') == 'pass')

        # Weighted scoring
        weights = {
            'architecture_structure': 0.25,
            'context7_compliance': 0.25,
            'functionality_validation': 0.25,
            'performance_metrics': 0.15,
            'integration_capabilities': 0.05,
            'security_compliance': 0.05
        }

        weighted_score = 0
        for test in test_results:
            test_name = test.get('test', '')
            weight = weights.get(test_name, 0)
            test_score = 1.0 if test.get('status') == 'pass' else 0.5 if test.get('status') == 'partial' else 0.0
            weighted_score += weight * test_score

        overall_score = weighted_score * 100

        # Determine grade
        if overall_score >= 95:
            grade = 'A+'
        elif overall_score >= 90:
            grade = 'A'
        elif overall_score >= 80:
            grade = 'B'
        elif overall_score >= 70:
            grade = 'C'
        else:
            grade = 'F'

        self.validation_results['overall_score'] = {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'test_pass_rate': round((passed_tests / total_tests) * 100, 1) if total_tests else 0,
            'weighted_score': round(overall_score, 1),
            'grade': grade,
            'optimization_successful': overall_score >= 80
        }

        logging.info(f"📊 Overall validation score: {overall_score:.1f}% (Grade: {grade})")

    def _save_validation_report(self) -> None:
        """Save comprehensive validation report"""
        report_path = self.hooks_dir / "hook-system-validation-report.json"

        try:
            with open(report_path, 'w') as f:
                json.dump(self.validation_results, f, indent=2, default=str)

            logging.info(f"📊 Validation report saved: {report_path}")

            # Also save summary to database
            self._save_validation_to_database()

        except Exception as e:
            logging.error(f"Failed to save validation report: {e}")

    def _save_validation_to_database(self) -> None:
        """Save validation summary to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS hook_validation_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        validation_date TEXT,
                        final_hook_count INTEGER,
                        compliance_rate REAL,
                        functionality_rate REAL,
                        overall_score REAL,
                        grade TEXT,
                        optimization_successful BOOLEAN,
                        validation_data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                overall_score = self.validation_results.get('overall_score', {})
                compliance_rate = self.validation_results.get('compliance_results', {}).get('compliance_rate', 0)
                functionality_rate = self.validation_results.get('functionality_tests', {}).get('success_rate', 0)

                conn.execute("""
                    INSERT INTO hook_validation_history (
                        validation_date, final_hook_count, compliance_rate,
                        functionality_rate, overall_score, grade,
                        optimization_successful, validation_data
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    self.validation_results['validation_timestamp'],
                    self.validation_results.get('performance_metrics', {}).get('hook_count', 0),
                    compliance_rate,
                    functionality_rate,
                    overall_score.get('weighted_score', 0),
                    overall_score.get('grade', 'F'),
                    overall_score.get('optimization_successful', False),
                    json.dumps(overall_score)
                ))

                logging.info("💾 Validation results stored in database")

        except sqlite3.Error as e:
            logging.warning(f"Could not store validation results in database: {e}")

if __name__ == "__main__":
    validator = HookSystemValidator()

    try:
        results = validator.execute_comprehensive_validation()

        # Print comprehensive summary
        overall_score = results['overall_score']
        compliance = results.get('compliance_results', {})
        functionality = results.get('functionality_tests', {})
        performance = results.get('performance_metrics', {})

        print("\n" + "=" * 70)
        print("🎯 HOOK SYSTEM VALIDATION SUMMARY")
        print("=" * 70)
        print(f"📊 Final Hook Count: {performance.get('hook_count', 0)} (Target: ≤17)")
        print(f"📊 Context7 Compliance: {compliance.get('compliance_rate', 0)}% (Target: ≥95%)")
        print(f"📊 Functionality Success: {functionality.get('success_rate', 0)}% (Target: ≥90%)")
        print(f"📊 Performance Optimized: {'✅ YES' if performance.get('system_efficiency') == 'optimized' else '❌ NO'}")
        print(f"📊 Security Compliant: {'✅ YES' if not any(t.get('security_status', {}).get('security_issues', []) for t in results.get('validation_tests', [])) else '⚠️ ISSUES FOUND'}")
        print(f"📊 Overall Score: {overall_score.get('weighted_score', 0)}% (Grade: {overall_score.get('grade', 'F')})")
        print(f"🎯 Optimization Successful: {'✅ YES' if overall_score.get('optimization_successful', False) else '❌ NO'}")
        print("=" * 70)

        if overall_score.get('optimization_successful', False):
            print("🎉 HOOK SYSTEM OPTIMIZATION COMPLETED SUCCESSFULLY!")
            print("📋 System is ready for production use")

            # Print key achievements
            print("\n🏆 KEY ACHIEVEMENTS:")
            print(f"   • Reduced from 44 to {performance.get('hook_count', 0)} hooks ({round((1 - performance.get('hook_count', 44)/44) * 100)}% reduction)")
            print(f"   • Achieved {compliance.get('compliance_rate', 0)}% Context7 compliance")
            print(f"   • {functionality.get('successful_tests', 0)}/{functionality.get('total_hooks_tested', 0)} hooks functioning correctly")
            print(f"   • System efficiency: {performance.get('system_efficiency', 'unknown').upper()}")
        else:
            print("⚠️ OPTIMIZATION PARTIALLY SUCCESSFUL")
            print("📋 Review recommendations for further improvements")

        # Print recommendations if any
        recommendations = results.get('recommendations', [])
        if recommendations:
            print(f"\n📋 RECOMMENDATIONS ({len(recommendations)}):")
            for i, rec in enumerate(recommendations[:5], 1):  # Show top 5
                print(f"   {i}. [{rec['priority'].upper()}] {rec['recommendation']}")

        print("=" * 70)

    except Exception as e:
        logging.error(f"Validation execution failed: {str(e)}")
        print(f"\n❌ VALIDATION FAILED: {str(e)}")
        print("📋 Check logs for detailed error information")