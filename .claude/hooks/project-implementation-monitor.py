#!/usr/bin/env python3
"""
Project Implementation Monitor - Context7 Implementation
Monitors implementation progress, spec adherence, and coordinates cross-validation

Features:
- Real-time progress tracking vs plan
- Spec adherence verification
- Cross-validation coordination
- Scope drift detection
- Milestone tracking and alerts
- Integration with Unified Orchestrator
"""

import sys
import os
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import PostToolUseHook, HookDecision

class ProjectImplementationMonitorHook(PostToolUseHook):
    """Context7-compliant hook for project implementation monitoring"""

    def __init__(self):
        super().__init__("project-implementation-monitor")
        self.project_root = Path("/Users/fulvioventura/devflow")
        self.db_path = self.project_root / "data" / "devflow_unified.sqlite"
        self.current_task_file = self.project_root / ".claude" / "state" / "current_task.json"
        self.monitor_state_file = self.project_root / ".claude" / "state" / "project-monitor.json"

        # Tools that trigger monitoring
        self.monitored_tools = [
            "Write", "Edit", "MultiEdit", "Bash",
            "mcp__devflow-synthetic-cc-sessions__synthetic_code",
            "mcp__devflow-synthetic-cc-sessions__synthetic_auto_file",
            "Task"  # Subagent completions
        ]

        # Cross-validation matrix
        self.cross_validation_matrix = {
            "code_implementation": ["code-reviewer", "security-auditor"],
            "architecture_changes": ["software-architect", "tech-lead"],
            "database_changes": ["database-specialist", "data-architect"],
            "security_implementation": ["security-auditor", "penetration-tester"],
            "performance_optimization": ["performance-engineer", "load-tester"]
        }

    def validate_input(self) -> bool:
        """Validate PostToolUse input"""
        if not super().validate_input():
            return False

        tool_name = self.input_data.get("tool_name")
        if tool_name not in self.monitored_tools:
            return False

        return True

    def execute_logic(self) -> None:
        """Main monitoring logic"""
        try:
            tool_name = self.input_data.get("tool_name")
            tool_input = self.input_data.get("tool_input", {})
            tool_output = self.input_data.get("tool_output", {})

            # Get current task context
            current_task = self._get_current_task()
            if not current_task:
                # No active task to monitor
                return

            # Load monitoring state
            monitor_state = self._load_monitor_state()

            # Analyze the tool execution
            analysis = self._analyze_tool_execution(tool_name, tool_input, tool_output, current_task)

            if analysis:
                # Update progress tracking
                self._update_progress_tracking(analysis, monitor_state, current_task)

                # Check spec adherence
                adherence_issues = self._check_spec_adherence(analysis, current_task)

                # Detect scope drift
                scope_issues = self._detect_scope_drift(analysis, current_task)

                # Coordinate cross-validation if needed
                validation_requests = self._coordinate_cross_validation(analysis, current_task)

                # Generate alerts/reports
                alerts = self._generate_alerts(adherence_issues, scope_issues, validation_requests)

                # Update monitor state
                monitor_state.update({
                    'last_update': datetime.now().isoformat(),
                    'total_operations': monitor_state.get('total_operations', 0) + 1,
                    'last_analysis': analysis,
                    'adherence_score': self._calculate_adherence_score(adherence_issues),
                    'active_validations': validation_requests
                })

                self._save_monitor_state(monitor_state)

                # Send alerts if any
                if alerts:
                    self._send_monitoring_alerts(alerts, current_task)

                self.logger.info(f"Monitored {tool_name} execution for task {current_task.get('id')}")

        except Exception as e:
            self.logger.error(f"Project monitoring failed: {e}")

    def _get_current_task(self) -> Optional[Dict[str, Any]]:
        """Get current active task"""
        try:
            if self.current_task_file.exists():
                with open(self.current_task_file, 'r') as f:
                    task_data = json.load(f)

                # Enrich with database information
                task_id = task_data.get('id')
                if task_id:
                    import sqlite3
                    with sqlite3.connect(str(self.db_path)) as conn:
                        conn.row_factory = sqlite3.Row
                        result = conn.execute("""
                            SELECT t.*, p.name as project_name, p.description as project_description,
                                   pl.name as plan_name, pl.description as plan_description,
                                   tc.title as context_title, tc.description as context_description
                            FROM tasks t
                            LEFT JOIN projects p ON t.project_id = p.id
                            LEFT JOIN plans pl ON t.plan_id = pl.id
                            LEFT JOIN task_contexts tc ON t.task_context_id = tc.id
                            WHERE t.id = ?
                        """, (task_id,)).fetchone()

                        if result:
                            task_data.update(dict(result))

                return task_data

        except Exception as e:
            self.logger.error(f"Failed to get current task: {e}")
        return None

    def _analyze_tool_execution(self, tool_name: str, tool_input: Dict, tool_output: Dict, task: Dict) -> Optional[Dict[str, Any]]:
        """Analyze tool execution for monitoring purposes"""
        analysis = {
            'tool_name': tool_name,
            'timestamp': datetime.now().isoformat(),
            'task_id': task.get('id'),
            'project_id': task.get('project_id'),
            'plan_id': task.get('plan_id')
        }

        try:
            if tool_name in ["Write", "Edit", "MultiEdit"]:
                analysis.update(self._analyze_file_changes(tool_input, tool_output))
            elif tool_name == "Bash":
                analysis.update(self._analyze_bash_execution(tool_input, tool_output))
            elif tool_name.startswith("mcp__devflow-synthetic"):
                analysis.update(self._analyze_synthetic_execution(tool_input, tool_output))
            elif tool_name == "Task":
                analysis.update(self._analyze_subagent_execution(tool_input, tool_output))

            return analysis

        except Exception as e:
            self.logger.error(f"Tool analysis failed for {tool_name}: {e}")
            return None

    def _analyze_file_changes(self, tool_input: Dict, tool_output: Dict) -> Dict[str, Any]:
        """Analyze file modification operations"""
        file_path = tool_input.get('file_path', '')
        content = tool_input.get('content', '') or tool_input.get('new_string', '')

        return {
            'operation_type': 'file_modification',
            'affected_files': [file_path] if file_path else [],
            'content_length': len(content),
            'file_type': self._detect_file_type(file_path),
            'estimated_complexity': self._estimate_code_complexity(content),
            'security_patterns': self._detect_security_patterns(content),
            'architecture_impact': self._assess_architecture_impact(file_path)
        }

    def _analyze_bash_execution(self, tool_input: Dict, tool_output: Dict) -> Dict[str, Any]:
        """Analyze bash command execution"""
        command = tool_input.get('command', '')
        exit_code = tool_output.get('exit_code', 0)
        stdout = tool_output.get('stdout', '')
        stderr = tool_output.get('stderr', '')

        return {
            'operation_type': 'system_command',
            'command': command,
            'exit_code': exit_code,
            'success': exit_code == 0,
            'output_length': len(stdout) + len(stderr),
            'command_category': self._categorize_bash_command(command),
            'risk_level': self._assess_command_risk(command),
            'affects_deployment': self._check_deployment_impact(command)
        }

    def _analyze_synthetic_execution(self, tool_input: Dict, tool_output: Dict) -> Dict[str, Any]:
        """Analyze synthetic AI agent execution"""
        return {
            'operation_type': 'ai_generation',
            'objective': tool_input.get('objective', ''),
            'language': tool_input.get('language', ''),
            'estimated_complexity': tool_input.get('complexity', 5),
            'file_target': tool_input.get('file_path', ''),
            'success': not tool_output.get('error'),
            'ai_agent_used': self._extract_agent_from_synthetic_output(tool_output)
        }

    def _analyze_subagent_execution(self, tool_input: Dict, tool_output: Dict) -> Dict[str, Any]:
        """Analyze subagent task execution"""
        return {
            'operation_type': 'subagent_delegation',
            'subagent_type': tool_input.get('subagent_type', ''),
            'task_description': tool_input.get('description', ''),
            'task_complexity': self._estimate_task_complexity(tool_input.get('prompt', '')),
            'success': not tool_output.get('error'),
            'requires_validation': self._requires_cross_validation(tool_input.get('subagent_type', ''))
        }

    def _check_spec_adherence(self, analysis: Dict[str, Any], task: Dict) -> List[Dict[str, Any]]:
        """Check adherence to project specifications"""
        issues = []

        try:
            # Check against project description
            project_desc = task.get('project_description', '').lower()
            task_desc = task.get('description', '').lower()

            # Simple keyword matching for now (can be enhanced with NLP)
            if analysis.get('operation_type') == 'file_modification':
                # Check if file changes align with project scope
                file_path = analysis.get('affected_files', [''])[0]
                if self._is_out_of_scope_file(file_path, project_desc):
                    issues.append({
                        'type': 'scope_violation',
                        'severity': 'medium',
                        'message': f"File {file_path} may be outside project scope",
                        'file_path': file_path
                    })

            # Check for architectural consistency
            if analysis.get('architecture_impact') == 'high':
                issues.append({
                    'type': 'architecture_change',
                    'severity': 'high',
                    'message': "Significant architectural changes detected - requires review",
                    'requires_validation': True
                })

            # Check security patterns
            security_patterns = analysis.get('security_patterns', [])
            for pattern in security_patterns:
                if pattern['risk_level'] == 'high':
                    issues.append({
                        'type': 'security_risk',
                        'severity': 'critical',
                        'message': f"High security risk pattern detected: {pattern['pattern']}",
                        'requires_validation': True
                    })

        except Exception as e:
            self.logger.error(f"Spec adherence check failed: {e}")

        return issues

    def _detect_scope_drift(self, analysis: Dict[str, Any], task: Dict) -> List[Dict[str, Any]]:
        """Detect scope drift from original task definition"""
        scope_issues = []

        try:
            # Load original task context and compare with current operations
            original_scope = task.get('context_description', '')
            current_operation = analysis.get('operation_type', '')

            # Check if operation aligns with task context
            if not self._operation_aligns_with_scope(current_operation, original_scope, analysis):
                scope_issues.append({
                    'type': 'scope_drift',
                    'severity': 'medium',
                    'message': f"Operation {current_operation} may be drifting from original scope",
                    'original_scope': original_scope,
                    'current_operation': analysis
                })

        except Exception as e:
            self.logger.error(f"Scope drift detection failed: {e}")

        return scope_issues

    def _coordinate_cross_validation(self, analysis: Dict[str, Any], task: Dict) -> List[Dict[str, Any]]:
        """Coordinate cross-validation with specialized agents"""
        validation_requests = []

        try:
            operation_type = analysis.get('operation_type')

            # Determine required validators based on operation
            if operation_type == 'file_modification':
                file_type = analysis.get('file_type', '')
                if file_type in ['python', 'javascript', 'typescript']:
                    validation_requests.append({
                        'validator_type': 'code-reviewer',
                        'priority': 'medium',
                        'files': analysis.get('affected_files', []),
                        'focus': 'code_quality'
                    })

                if analysis.get('security_patterns'):
                    validation_requests.append({
                        'validator_type': 'security-auditor',
                        'priority': 'high',
                        'files': analysis.get('affected_files', []),
                        'focus': 'security_review'
                    })

            elif operation_type == 'system_command':
                if analysis.get('risk_level') == 'high':
                    validation_requests.append({
                        'validator_type': 'security-auditor',
                        'priority': 'critical',
                        'command': analysis.get('command'),
                        'focus': 'command_safety'
                    })

            elif operation_type == 'ai_generation':
                validation_requests.append({
                    'validator_type': 'code-reviewer',
                    'priority': 'medium',
                    'files': [analysis.get('file_target')],
                    'focus': 'ai_generated_code'
                })

        except Exception as e:
            self.logger.error(f"Cross-validation coordination failed: {e}")

        return validation_requests

    def _generate_alerts(self, adherence_issues: List, scope_issues: List, validation_requests: List) -> List[Dict[str, Any]]:
        """Generate monitoring alerts"""
        alerts = []

        # Critical adherence issues
        critical_issues = [issue for issue in adherence_issues if issue.get('severity') == 'critical']
        if critical_issues:
            alerts.append({
                'type': 'critical_spec_violation',
                'message': f"{len(critical_issues)} critical spec adherence issues detected",
                'issues': critical_issues,
                'action_required': True
            })

        # Scope drift alerts
        if scope_issues:
            alerts.append({
                'type': 'scope_drift_warning',
                'message': f"Potential scope drift detected in {len(scope_issues)} operations",
                'issues': scope_issues,
                'action_required': False
            })

        # High-priority validation requests
        high_priority_validations = [req for req in validation_requests if req.get('priority') in ['high', 'critical']]
        if high_priority_validations:
            alerts.append({
                'type': 'validation_required',
                'message': f"{len(high_priority_validations)} high-priority validations needed",
                'validations': high_priority_validations,
                'action_required': True
            })

        return alerts

    def _send_monitoring_alerts(self, alerts: List[Dict], task: Dict) -> None:
        """Send monitoring alerts to user/system"""
        if not alerts:
            return

        alert_message = f"\n[🔍 PROJECT MONITOR - Task {task.get('id')}]\n"

        for alert in alerts:
            if alert.get('action_required'):
                alert_message += f"⚠️  **{alert['type'].upper()}**: {alert['message']}\n"
            else:
                alert_message += f"ℹ️  **{alert['type'].upper()}**: {alert['message']}\n"

        alert_message += "\nProject Monitor is tracking all changes for spec adherence.\n"

        # In a full implementation, this could:
        # - Send to notification system
        # - Log to monitoring dashboard
        # - Trigger automated validations
        # - Update project status

        self.response.hook_specific_output = {
            "hookEventName": "PostToolUse",
            "additionalContext": alert_message
        }

    # Helper methods
    def _detect_file_type(self, file_path: str) -> str:
        """Detect file type from path"""
        if not file_path:
            return 'unknown'

        extensions = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.sql': 'sql',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.md': 'markdown',
            '.html': 'html',
            '.css': 'css'
        }

        for ext, file_type in extensions.items():
            if file_path.endswith(ext):
                return file_type

        return 'text'

    def _estimate_code_complexity(self, content: str) -> int:
        """Estimate code complexity (1-10 scale)"""
        if not content:
            return 1

        complexity = 1

        # Basic complexity indicators
        complexity += content.count('if ') * 0.1
        complexity += content.count('for ') * 0.1
        complexity += content.count('while ') * 0.1
        complexity += content.count('def ') * 0.2
        complexity += content.count('class ') * 0.3
        complexity += content.count('import ') * 0.05

        return min(int(complexity), 10)

    def _detect_security_patterns(self, content: str) -> List[Dict[str, str]]:
        """Detect security patterns in code"""
        patterns = []

        security_checks = [
            (r'os\.system\s*\(', 'command_injection', 'high'),
            (r'subprocess\.call.*shell=True', 'shell_injection', 'high'),
            (r'eval\s*\(', 'code_injection', 'critical'),
            (r'exec\s*\(', 'code_injection', 'critical'),
            (r'password\s*=\s*[\'"][^\'"]+[\'"]', 'hardcoded_password', 'high'),
            (r'api_key\s*=\s*[\'"][^\'"]+[\'"]', 'hardcoded_api_key', 'high')
        ]

        for pattern, pattern_type, risk_level in security_checks:
            if re.search(pattern, content, re.IGNORECASE):
                patterns.append({
                    'pattern': pattern_type,
                    'risk_level': risk_level,
                    'description': f"Detected {pattern_type} pattern"
                })

        return patterns

    def _assess_architecture_impact(self, file_path: str) -> str:
        """Assess architectural impact of file changes"""
        if not file_path:
            return 'none'

        high_impact_patterns = [
            r'config', r'settings', r'database', r'migration',
            r'schema', r'model', r'router', r'controller',
            r'service', r'repository', r'factory'
        ]

        for pattern in high_impact_patterns:
            if re.search(pattern, file_path, re.IGNORECASE):
                return 'high'

        return 'low'

    def _categorize_bash_command(self, command: str) -> str:
        """Categorize bash command by type"""
        command_lower = command.lower()

        categories = {
            'package_management': ['pip ', 'npm ', 'yarn ', 'apt ', 'yum '],
            'file_operations': ['cp ', 'mv ', 'rm ', 'mkdir ', 'chmod ', 'chown '],
            'system_admin': ['sudo ', 'systemctl ', 'service ', 'crontab '],
            'development': ['git ', 'docker ', 'kubectl ', 'terraform '],
            'database': ['mysql ', 'psql ', 'mongo ', 'redis-cli '],
            'testing': ['pytest ', 'npm test', 'jest ', 'mocha '],
            'build': ['make ', 'cmake ', 'gcc ', 'javac ', 'tsc ']
        }

        for category, patterns in categories.items():
            if any(pattern in command_lower for pattern in patterns):
                return category

        return 'general'

    def _assess_command_risk(self, command: str) -> str:
        """Assess risk level of bash command"""
        high_risk_patterns = [
            r'rm\s+-rf\s+/',
            r'sudo\s+rm',
            r'chmod\s+777',
            r'curl.*\|\s*bash',
            r'wget.*\|\s*sh'
        ]

        for pattern in high_risk_patterns:
            if re.search(pattern, command):
                return 'high'

        if 'sudo ' in command:
            return 'medium'

        return 'low'

    def _calculate_adherence_score(self, issues: List) -> float:
        """Calculate spec adherence score (0-1)"""
        if not issues:
            return 1.0

        total_severity = sum({
            'low': 1,
            'medium': 2,
            'high': 3,
            'critical': 5
        }.get(issue.get('severity', 'low'), 1) for issue in issues)

        # Score decreases with severity
        return max(0.0, 1.0 - (total_severity * 0.1))

    def _load_monitor_state(self) -> Dict[str, Any]:
        """Load monitoring state"""
        try:
            if self.monitor_state_file.exists():
                with open(self.monitor_state_file, 'r') as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def _save_monitor_state(self, state: Dict[str, Any]) -> None:
        """Save monitoring state"""
        try:
            self.monitor_state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.monitor_state_file, 'w') as f:
                json.dump(state, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save monitor state: {e}")

    # Placeholder methods for additional functionality
    def _check_deployment_impact(self, command: str) -> bool:
        return 'deploy' in command.lower() or 'build' in command.lower()

    def _extract_agent_from_synthetic_output(self, output: Dict) -> str:
        return output.get('agent_used', 'unknown')

    def _estimate_task_complexity(self, prompt: str) -> int:
        return min(len(prompt) // 100, 10)

    def _requires_cross_validation(self, subagent_type: str) -> bool:
        validation_required = ['code-review', 'security-audit', 'architecture-review']
        return subagent_type in validation_required

    def _is_out_of_scope_file(self, file_path: str, project_desc: str) -> bool:
        # Simple check - can be enhanced
        return False

    def _operation_aligns_with_scope(self, operation: str, scope: str, analysis: Dict) -> bool:
        # Simple alignment check - can be enhanced with NLP
        return True

if __name__ == "__main__":
    hook = ProjectImplementationMonitorHook()
    sys.exit(hook.run())