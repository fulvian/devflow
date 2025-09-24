#!/usr/bin/env python3
"""
Comprehensive Hook Audit Analysis
Analyzes all 43 hooks for optimization and rationalization

This script performs:
1. Hook classification by type and purpose
2. Context7 compliance assessment
3. Code quality analysis
4. Duplicate functionality detection
5. Security vulnerability scanning
6. Performance impact assessment
7. Deprecation recommendations
"""

import os
import re
import json
import ast
import hashlib
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import sqlite3

class HookAuditor:
    """Comprehensive hook analysis system"""

    def __init__(self):
        self.hooks_dir = Path("/Users/fulvioventura/devflow/.claude/hooks")
        self.db_path = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
        self.analysis_results = {}

        # Hook categories for classification
        self.hook_categories = {
            'core': ['session-start', 'post-tool-use', 'user-messages'],
            'cometa': ['cometa-', 'cometa_'],
            'system': ['footer', 'status', 'monitor'],
            'integration': ['bridge', 'integration', 'orchestrator'],
            'utility': ['shared', 'setup', 'dispatcher'],
            'deprecated': ['.deprecated'],
            'context7': ['context7', 'standard_hook_pattern']
        }

        # Security patterns to check
        self.security_patterns = {
            'dangerous_imports': [r'import\s+(os\.system|subprocess\.call|eval|exec)',
                                 r'from\s+os\s+import\s+system',
                                 r'__import__\s*\('],
            'shell_injection': [r'os\.system\s*\([^)]*["\'][^"\']*\+',
                               r'subprocess\.call\s*\([^)]*shell\s*=\s*True'],
            'file_operations': [r'open\s*\([^)]*["\'][^"\']*\+',
                               r'with\s+open\s*\([^)]*["\'][^"\']*\+'],
            'network_operations': [r'urllib|requests|http|socket'],
            'dangerous_eval': [r'eval\s*\(', r'exec\s*\(']
        }

    def run_full_audit(self) -> Dict[str, Any]:
        """Run complete hook audit analysis"""
        print("🔍 Starting Comprehensive Hook Audit...")
        print("=" * 60)

        # Get all Python hooks
        hook_files = list(self.hooks_dir.rglob("*.py"))
        print(f"📁 Found {len(hook_files)} Python files")

        # Analyze each hook
        for hook_file in hook_files:
            relative_path = str(hook_file.relative_to(self.hooks_dir))
            print(f"📋 Analyzing: {relative_path}")

            self.analysis_results[relative_path] = self._analyze_single_hook(hook_file)

        # Generate comprehensive report
        report = self._generate_audit_report()

        # Save results
        self._save_audit_results(report)

        return report

    def _analyze_single_hook(self, hook_file: Path) -> Dict[str, Any]:
        """Analyze a single hook file comprehensively"""
        analysis = {
            'file_path': str(hook_file),
            'relative_path': str(hook_file.relative_to(self.hooks_dir)),
            'file_size': hook_file.stat().st_size,
            'last_modified': datetime.fromtimestamp(hook_file.stat().st_mtime).isoformat(),
            'analysis_timestamp': datetime.now().isoformat()
        }

        try:
            # Read file content
            with open(hook_file, 'r', encoding='utf-8') as f:
                content = f.read()

            analysis.update({
                'line_count': len(content.splitlines()),
                'char_count': len(content),
                'content_hash': hashlib.sha256(content.encode()).hexdigest()[:16],

                # Basic analysis
                'category': self._classify_hook(hook_file.name),
                'hook_type': self._detect_hook_type(content),
                'context7_compliant': self._check_context7_compliance(content),
                'executable': os.access(hook_file, os.X_OK),

                # Code quality analysis
                'code_quality': self._analyze_code_quality(content, hook_file),
                'security_analysis': self._analyze_security(content),
                'functionality_analysis': self._analyze_functionality(content),
                'dependencies': self._extract_dependencies(content),
                'complexity_metrics': self._calculate_complexity(content),

                # Context analysis
                'imports_context7': self._uses_context7_patterns(content),
                'duplicate_functionality': self._detect_duplicate_functionality(content),
                'deprecation_indicators': self._check_deprecation_indicators(content, hook_file),
            })

        except Exception as e:
            analysis['error'] = f"Analysis failed: {str(e)}"
            analysis['status'] = 'error'

        return analysis

    def _classify_hook(self, filename: str) -> str:
        """Classify hook by category"""
        filename_lower = filename.lower()

        for category, patterns in self.hook_categories.items():
            for pattern in patterns:
                if pattern in filename_lower:
                    return category

        return 'unknown'

    def _detect_hook_type(self, content: str) -> List[str]:
        """Detect what type of hook this is (PostToolUse, PreToolUse, etc.)"""
        hook_types = []

        # Pattern matching for hook types
        if re.search(r'PostToolUse|post.tool.use', content, re.IGNORECASE):
            hook_types.append('PostToolUse')
        if re.search(r'PreToolUse|pre.tool.use', content, re.IGNORECASE):
            hook_types.append('PreToolUse')
        if re.search(r'UserPromptSubmit|user.prompt.submit', content, re.IGNORECASE):
            hook_types.append('UserPromptSubmit')
        if re.search(r'SessionStart|session.start', content, re.IGNORECASE):
            hook_types.append('SessionStart')

        # Check for specific hook event handling
        if 'HOOK_EVENT' in content:
            hook_types.append('Multi-Event')

        return hook_types if hook_types else ['Unknown']

    def _check_context7_compliance(self, content: str) -> Dict[str, Any]:
        """Check Context7 compliance indicators"""
        compliance = {
            'imports_base_pattern': bool(re.search(r'from\s+standard_hook_pattern\s+import', content)),
            'extends_base_hook': bool(re.search(r'class\s+\w+\([^)]*Hook\)', content)),
            'has_validate_input': bool(re.search(r'def\s+validate_input', content)),
            'has_execute_logic': bool(re.search(r'def\s+execute_logic', content)),
            'uses_logger': bool(re.search(r'self\.logger', content)),
            'returns_json': bool(re.search(r'json\.dumps|print.*json', content)),
            'has_error_handling': bool(re.search(r'try:|except:|catch:', content)),
        }

        # Calculate compliance score
        total_criteria = len(compliance)
        met_criteria = sum(1 for v in compliance.values() if v)
        compliance['score'] = round((met_criteria / total_criteria) * 100, 1)
        compliance['compliant'] = compliance['score'] >= 70

        return compliance

    def _analyze_code_quality(self, content: str, file_path: Path) -> Dict[str, Any]:
        """Analyze code quality metrics"""
        quality = {
            'has_docstring': content.strip().startswith('"""') or content.strip().startswith("'''"),
            'has_shebang': content.startswith('#!'),
            'proper_encoding': '# -*- coding:' in content or 'encoding=' in content,
            'syntax_valid': True,  # Will be updated below
            'pylint_score': None,
        }

        # Check syntax validity
        try:
            ast.parse(content)
            quality['syntax_valid'] = True
        except SyntaxError as e:
            quality['syntax_valid'] = False
            quality['syntax_error'] = str(e)

        # Count functions and classes
        try:
            tree = ast.parse(content)
            quality['function_count'] = len([n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)])
            quality['class_count'] = len([n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)])
        except:
            quality['function_count'] = 0
            quality['class_count'] = 0

        # Check for best practices
        quality['has_main_guard'] = 'if __name__ == "__main__"' in content
        quality['uses_typing'] = 'typing' in content or 'from typing import' in content
        quality['has_constants'] = bool(re.search(r'^[A-Z_]+ = ', content, re.MULTILINE))

        return quality

    def _analyze_security(self, content: str) -> Dict[str, Any]:
        """Analyze security vulnerabilities"""
        security = {
            'vulnerabilities': [],
            'risk_level': 'low',
            'security_score': 100
        }

        # Check for security patterns
        for category, patterns in self.security_patterns.items():
            for pattern in patterns:
                if re.search(pattern, content, re.MULTILINE | re.IGNORECASE):
                    security['vulnerabilities'].append({
                        'category': category,
                        'pattern': pattern,
                        'severity': self._assess_vulnerability_severity(category)
                    })

        # Calculate risk level
        if security['vulnerabilities']:
            high_risk = any(v['severity'] == 'high' for v in security['vulnerabilities'])
            medium_risk = any(v['severity'] == 'medium' for v in security['vulnerabilities'])

            if high_risk:
                security['risk_level'] = 'high'
                security['security_score'] = 30
            elif medium_risk:
                security['risk_level'] = 'medium'
                security['security_score'] = 60
            else:
                security['risk_level'] = 'low'
                security['security_score'] = 80

        return security

    def _assess_vulnerability_severity(self, category: str) -> str:
        """Assess vulnerability severity"""
        severity_map = {
            'dangerous_imports': 'high',
            'shell_injection': 'high',
            'dangerous_eval': 'high',
            'file_operations': 'medium',
            'network_operations': 'low'
        }
        return severity_map.get(category, 'low')

    def _analyze_functionality(self, content: str) -> Dict[str, Any]:
        """Analyze hook functionality"""
        functionality = {
            'purpose': self._infer_purpose(content),
            'database_operations': bool(re.search(r'sqlite3|\.db|database', content, re.IGNORECASE)),
            'file_operations': bool(re.search(r'open\s*\(|with\s+open|file|path', content, re.IGNORECASE)),
            'network_operations': bool(re.search(r'requests|urllib|http|socket', content, re.IGNORECASE)),
            'subprocess_calls': bool(re.search(r'subprocess|os\.system', content, re.IGNORECASE)),
            'json_processing': bool(re.search(r'json\.|import json', content)),
            'logging_operations': bool(re.search(r'logging|logger|log\(', content, re.IGNORECASE)),
        }

        # Count API calls and external dependencies
        functionality['external_dependencies'] = len(re.findall(r'import\s+(\w+)', content))
        functionality['api_calls'] = len(re.findall(r'def\s+(\w+)', content))

        return functionality

    def _infer_purpose(self, content: str) -> str:
        """Infer hook purpose from content"""
        # Look for docstring or comments that explain purpose
        docstring_match = re.search(r'"""([^"]*?)"""', content, re.DOTALL)
        if docstring_match:
            docstring = docstring_match.group(1).strip()
            return docstring.split('\n')[0]  # First line of docstring

        # Look for comments
        comment_match = re.search(r'#\s*(.+)', content)
        if comment_match:
            return comment_match.group(1).strip()

        return "Purpose not documented"

    def _extract_dependencies(self, content: str) -> List[str]:
        """Extract all dependencies"""
        dependencies = []

        # Standard imports
        import_matches = re.findall(r'import\s+([a-zA-Z_][a-zA-Z0-9_]*)', content)
        dependencies.extend(import_matches)

        # From imports
        from_matches = re.findall(r'from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import', content)
        dependencies.extend(from_matches)

        return list(set(dependencies))

    def _calculate_complexity(self, content: str) -> Dict[str, Any]:
        """Calculate complexity metrics"""
        try:
            tree = ast.parse(content)

            complexity = {
                'cyclomatic_complexity': self._cyclomatic_complexity(tree),
                'nesting_depth': self._max_nesting_depth(tree),
                'cognitive_complexity': self._cognitive_complexity(tree)
            }

            # Overall complexity assessment
            if complexity['cyclomatic_complexity'] > 10:
                complexity['assessment'] = 'high'
            elif complexity['cyclomatic_complexity'] > 5:
                complexity['assessment'] = 'medium'
            else:
                complexity['assessment'] = 'low'

            return complexity

        except:
            return {'assessment': 'unknown', 'error': 'Failed to parse AST'}

    def _cyclomatic_complexity(self, tree: ast.AST) -> int:
        """Calculate cyclomatic complexity"""
        complexity = 1  # Base complexity

        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.While, ast.For, ast.AsyncFor)):
                complexity += 1
            elif isinstance(node, ast.Try):
                complexity += len(node.handlers)
            elif isinstance(node, ast.BoolOp):
                complexity += len(node.values) - 1

        return complexity

    def _max_nesting_depth(self, tree: ast.AST) -> int:
        """Calculate maximum nesting depth"""
        def get_depth(node, current_depth=0):
            max_depth = current_depth
            for child in ast.iter_child_nodes(node):
                if isinstance(child, (ast.If, ast.While, ast.For, ast.AsyncFor, ast.With, ast.Try)):
                    child_depth = get_depth(child, current_depth + 1)
                    max_depth = max(max_depth, child_depth)
                else:
                    child_depth = get_depth(child, current_depth)
                    max_depth = max(max_depth, child_depth)
            return max_depth

        return get_depth(tree)

    def _cognitive_complexity(self, tree: ast.AST) -> int:
        """Calculate cognitive complexity (simplified)"""
        complexity = 0

        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.While, ast.For)):
                complexity += 1
            elif isinstance(node, ast.Try):
                complexity += 1
            elif isinstance(node, ast.BoolOp):
                complexity += 1

        return complexity

    def _uses_context7_patterns(self, content: str) -> bool:
        """Check if hook uses Context7 patterns"""
        context7_indicators = [
            'standard_hook_pattern',
            'BaseDevFlowHook',
            'PostToolUseHook',
            'PreToolUseHook',
            'UserPromptSubmitHook',
            'validate_input',
            'execute_logic'
        ]

        return any(indicator in content for indicator in context7_indicators)

    def _detect_duplicate_functionality(self, content: str) -> List[str]:
        """Detect potential duplicate functionality"""
        duplicates = []

        # Common functionality patterns
        patterns = {
            'database_operations': r'sqlite3\.connect|\.execute\(',
            'json_processing': r'json\.loads|json\.dumps',
            'file_operations': r'with\s+open|open\s*\(',
            'logging': r'logging\.|logger\.',
            'daic_processing': r'daic|discussion.*mode',
            'task_management': r'task|todo|project',
            'cometa_processing': r'cometa|brain|nlp'
        }

        for pattern_name, pattern in patterns.items():
            if re.search(pattern, content, re.IGNORECASE):
                duplicates.append(pattern_name)

        return duplicates

    def _check_deprecation_indicators(self, content: str, file_path: Path) -> Dict[str, Any]:
        """Check for deprecation indicators"""
        deprecation = {
            'is_deprecated': False,
            'reasons': [],
            'confidence': 0
        }

        # File path indicators
        if '.deprecated' in str(file_path) or 'deprecated' in file_path.name.lower():
            deprecation['is_deprecated'] = True
            deprecation['reasons'].append('Located in deprecated directory')
            deprecation['confidence'] += 50

        # Content indicators
        if re.search(r'deprecated|obsolete|legacy|old|unused', content, re.IGNORECASE):
            deprecation['reasons'].append('Contains deprecation keywords')
            deprecation['confidence'] += 20

        # Non-Context7 compliance
        context7_compliance = self._check_context7_compliance(content)
        if not context7_compliance['compliant']:
            deprecation['reasons'].append('Not Context7 compliant')
            deprecation['confidence'] += 15

        # Security issues
        security = self._analyze_security(content)
        if security['risk_level'] == 'high':
            deprecation['reasons'].append('High security risk')
            deprecation['confidence'] += 25

        # Set deprecation flag based on confidence
        if deprecation['confidence'] >= 40:
            deprecation['is_deprecated'] = True

        return deprecation

    def _generate_audit_report(self) -> Dict[str, Any]:
        """Generate comprehensive audit report"""
        report = {
            'audit_metadata': {
                'timestamp': datetime.now().isoformat(),
                'total_hooks': len(self.analysis_results),
                'auditor_version': '1.0.0'
            },
            'summary': self._generate_summary(),
            'categories': self._generate_category_analysis(),
            'compliance': self._generate_compliance_analysis(),
            'security': self._generate_security_analysis(),
            'optimization': self._generate_optimization_recommendations(),
            'deprecation': self._generate_deprecation_recommendations(),
            'detailed_results': self.analysis_results
        }

        return report

    def _generate_summary(self) -> Dict[str, Any]:
        """Generate audit summary"""
        total_hooks = len(self.analysis_results)

        # Count by category
        categories = {}
        for result in self.analysis_results.values():
            category = result.get('category', 'unknown')
            categories[category] = categories.get(category, 0) + 1

        # Count Context7 compliant
        context7_compliant = sum(1 for r in self.analysis_results.values()
                                if r.get('context7_compliant', {}).get('compliant', False))

        # Count deprecated
        deprecated = sum(1 for r in self.analysis_results.values()
                        if r.get('deprecation_indicators', {}).get('is_deprecated', False))

        # Security issues
        high_security_risk = sum(1 for r in self.analysis_results.values()
                                if r.get('security_analysis', {}).get('risk_level') == 'high')

        return {
            'total_hooks': total_hooks,
            'categories': categories,
            'context7_compliant': context7_compliant,
            'context7_compliance_rate': round((context7_compliant / total_hooks) * 100, 1),
            'deprecated_hooks': deprecated,
            'high_security_risk': high_security_risk,
            'total_lines_of_code': sum(r.get('line_count', 0) for r in self.analysis_results.values()),
            'average_complexity': self._calculate_average_complexity()
        }

    def _calculate_average_complexity(self) -> float:
        """Calculate average complexity across all hooks"""
        complexities = []
        for result in self.analysis_results.values():
            complexity = result.get('complexity_metrics', {}).get('cyclomatic_complexity')
            if complexity and isinstance(complexity, (int, float)):
                complexities.append(complexity)

        return round(sum(complexities) / len(complexities), 2) if complexities else 0

    def _generate_category_analysis(self) -> Dict[str, Any]:
        """Generate analysis by category"""
        category_analysis = {}

        for category in self.hook_categories.keys():
            hooks_in_category = [
                (path, result) for path, result in self.analysis_results.items()
                if result.get('category') == category
            ]

            if hooks_in_category:
                category_analysis[category] = {
                    'count': len(hooks_in_category),
                    'context7_compliant': sum(1 for _, r in hooks_in_category
                                             if r.get('context7_compliant', {}).get('compliant', False)),
                    'deprecated': sum(1 for _, r in hooks_in_category
                                     if r.get('deprecation_indicators', {}).get('is_deprecated', False)),
                    'high_complexity': sum(1 for _, r in hooks_in_category
                                          if r.get('complexity_metrics', {}).get('assessment') == 'high'),
                    'security_issues': sum(1 for _, r in hooks_in_category
                                          if r.get('security_analysis', {}).get('risk_level') == 'high')
                }

        return category_analysis

    def _generate_compliance_analysis(self) -> Dict[str, Any]:
        """Generate Context7 compliance analysis"""
        compliance_scores = []
        non_compliant = []

        for path, result in self.analysis_results.items():
            compliance = result.get('context7_compliant', {})
            score = compliance.get('score', 0)
            compliance_scores.append(score)

            if not compliance.get('compliant', False):
                non_compliant.append({
                    'path': path,
                    'score': score,
                    'missing_criteria': [k for k, v in compliance.items() if k != 'score' and k != 'compliant' and not v]
                })

        return {
            'average_compliance_score': round(sum(compliance_scores) / len(compliance_scores), 1) if compliance_scores else 0,
            'fully_compliant_count': sum(1 for s in compliance_scores if s >= 70),
            'non_compliant_hooks': non_compliant,
            'most_common_missing_criteria': self._get_most_common_missing_criteria()
        }

    def _get_most_common_missing_criteria(self) -> Dict[str, int]:
        """Get most common missing Context7 criteria"""
        missing_criteria = {}

        for result in self.analysis_results.values():
            compliance = result.get('context7_compliant', {})
            for criterion, met in compliance.items():
                if criterion not in ['score', 'compliant'] and not met:
                    missing_criteria[criterion] = missing_criteria.get(criterion, 0) + 1

        return dict(sorted(missing_criteria.items(), key=lambda x: x[1], reverse=True))

    def _generate_security_analysis(self) -> Dict[str, Any]:
        """Generate security analysis"""
        security_issues = []
        risk_levels = {'high': 0, 'medium': 0, 'low': 0}

        for path, result in self.analysis_results.items():
            security = result.get('security_analysis', {})
            risk_level = security.get('risk_level', 'low')
            risk_levels[risk_level] += 1

            if security.get('vulnerabilities'):
                security_issues.append({
                    'path': path,
                    'risk_level': risk_level,
                    'vulnerabilities': security['vulnerabilities']
                })

        return {
            'total_security_issues': len(security_issues),
            'risk_distribution': risk_levels,
            'critical_security_hooks': [issue for issue in security_issues if issue['risk_level'] == 'high'],
            'most_common_vulnerabilities': self._get_most_common_vulnerabilities()
        }

    def _get_most_common_vulnerabilities(self) -> Dict[str, int]:
        """Get most common vulnerability types"""
        vulnerability_types = {}

        for result in self.analysis_results.values():
            security = result.get('security_analysis', {})
            for vuln in security.get('vulnerabilities', []):
                category = vuln['category']
                vulnerability_types[category] = vulnerability_types.get(category, 0) + 1

        return dict(sorted(vulnerability_types.items(), key=lambda x: x[1], reverse=True))

    def _generate_optimization_recommendations(self) -> List[Dict[str, Any]]:
        """Generate optimization recommendations"""
        recommendations = []

        # Identify hooks with duplicate functionality
        functionality_groups = {}
        for path, result in self.analysis_results.items():
            duplicates = result.get('duplicate_functionality', [])
            for func in duplicates:
                if func not in functionality_groups:
                    functionality_groups[func] = []
                functionality_groups[func].append(path)

        # Recommend consolidation for groups with multiple hooks
        for functionality, hooks in functionality_groups.items():
            if len(hooks) > 2:
                recommendations.append({
                    'type': 'consolidation',
                    'priority': 'high',
                    'functionality': functionality,
                    'affected_hooks': hooks,
                    'recommendation': f'Consider consolidating {len(hooks)} hooks with {functionality} functionality'
                })

        # Identify high complexity hooks
        for path, result in self.analysis_results.items():
            complexity = result.get('complexity_metrics', {})
            if complexity.get('assessment') == 'high':
                recommendations.append({
                    'type': 'complexity_reduction',
                    'priority': 'medium',
                    'affected_hooks': [path],
                    'recommendation': f'Reduce complexity in {path} (complexity: {complexity.get("cyclomatic_complexity", "unknown")})'
                })

        return recommendations

    def _generate_deprecation_recommendations(self) -> List[Dict[str, Any]]:
        """Generate deprecation recommendations"""
        recommendations = []

        # Group by deprecation reasons
        deprecation_groups = {
            'immediate': [],  # High confidence deprecated
            'review': [],     # Medium confidence, needs review
            'migrate': []     # Non-Context7 compliant
        }

        for path, result in self.analysis_results.items():
            deprecation = result.get('deprecation_indicators', {})

            if deprecation.get('is_deprecated') and deprecation.get('confidence', 0) > 70:
                deprecation_groups['immediate'].append({
                    'path': path,
                    'reasons': deprecation.get('reasons', []),
                    'confidence': deprecation.get('confidence', 0)
                })
            elif deprecation.get('confidence', 0) > 40:
                deprecation_groups['review'].append({
                    'path': path,
                    'reasons': deprecation.get('reasons', []),
                    'confidence': deprecation.get('confidence', 0)
                })

            # Check for non-Context7 compliance
            context7 = result.get('context7_compliant', {})
            if not context7.get('compliant', False) and context7.get('score', 0) < 30:
                deprecation_groups['migrate'].append({
                    'path': path,
                    'compliance_score': context7.get('score', 0)
                })

        # Generate recommendations
        if deprecation_groups['immediate']:
            recommendations.append({
                'type': 'immediate_deprecation',
                'priority': 'high',
                'count': len(deprecation_groups['immediate']),
                'hooks': deprecation_groups['immediate'],
                'action': 'Remove immediately - high confidence deprecated'
            })

        if deprecation_groups['review']:
            recommendations.append({
                'type': 'deprecation_review',
                'priority': 'medium',
                'count': len(deprecation_groups['review']),
                'hooks': deprecation_groups['review'],
                'action': 'Review for potential deprecation'
            })

        if deprecation_groups['migrate']:
            recommendations.append({
                'type': 'context7_migration',
                'priority': 'medium',
                'count': len(deprecation_groups['migrate']),
                'hooks': deprecation_groups['migrate'],
                'action': 'Migrate to Context7 or deprecate'
            })

        return recommendations

    def _save_audit_results(self, report: Dict[str, Any]) -> None:
        """Save audit results to file and database"""
        # Save to JSON file
        output_file = self.hooks_dir / "comprehensive-audit-report.json"
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"📊 Audit report saved to: {output_file}")

        # Save summary to database if available
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO hook_audits (
                        audit_date, total_hooks, context7_compliant, deprecated_hooks,
                        high_security_risk, average_complexity, report_data
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    datetime.now().isoformat(),
                    report['summary']['total_hooks'],
                    report['summary']['context7_compliant'],
                    report['summary']['deprecated_hooks'],
                    report['summary']['high_security_risk'],
                    report['summary']['average_complexity'],
                    json.dumps(report['summary'])
                ))
        except sqlite3.Error as e:
            print(f"⚠️  Could not save to database: {e}")

if __name__ == "__main__":
    auditor = HookAuditor()
    report = auditor.run_full_audit()

    # Print key findings
    summary = report['summary']
    print("\n" + "=" * 60)
    print("🎯 KEY AUDIT FINDINGS")
    print("=" * 60)
    print(f"📊 Total Hooks: {summary['total_hooks']}")
    print(f"✅ Context7 Compliant: {summary['context7_compliant']} ({summary['context7_compliance_rate']}%)")
    print(f"⚠️  Deprecated: {summary['deprecated_hooks']}")
    print(f"🔒 High Security Risk: {summary['high_security_risk']}")
    print(f"🧮 Average Complexity: {summary['average_complexity']}")
    print(f"📝 Total Lines of Code: {summary['total_lines_of_code']:,}")

    print("\n🏷️  HOOKS BY CATEGORY:")
    for category, count in summary['categories'].items():
        print(f"   {category}: {count}")

    print("\n📋 OPTIMIZATION RECOMMENDATIONS:")
    for rec in report['optimization'][:3]:  # Top 3
        print(f"   • {rec['type']}: {rec['recommendation']}")

    print("\n🗑️  DEPRECATION RECOMMENDATIONS:")
    for rec in report['deprecation']:
        print(f"   • {rec['type']}: {rec['action']} ({rec['count']} hooks)")

    print("\n📊 Full report saved to: comprehensive-audit-report.json")
    print("=" * 60)