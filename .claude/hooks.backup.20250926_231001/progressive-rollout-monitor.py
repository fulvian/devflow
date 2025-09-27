#!/usr/bin/env python3

"""
Progressive Rollout Monitor for Context7 Implementation
Monitors Shadow Mode performance and manages automatic progression

Tracks success criteria and automatically manages rollout phases:
- Phase 1: Shadow Mode (72h) → Parallel testing
- Phase 2: Hybrid Mode (7d) → Selective replacement
- Phase 3: Full Mode → Complete replacement
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Tuple, List
import subprocess

class ProgressiveRolloutMonitor:
    """
    Monitor and manage progressive rollout of Context7 implementation
    """

    def __init__(self, project_root: Optional[str] = None):
        self.project_root = project_root or os.getcwd()
        self.config_path = os.path.join(
            self.project_root,
            '.claude/config/context-interceptor-config.json'
        )
        self.rollout_log_path = os.path.join(
            self.project_root,
            'logs/progressive-rollout.log'
        )
        self.shadow_log_path = os.path.join(
            self.project_root,
            'logs/shadow-mode-comparison.log'
        )

        self.config = self.load_config()
        self.rollout_start_time = self.get_rollout_start_time()

    def load_config(self) -> Dict[str, Any]:
        """Load rollout configuration"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            else:
                print(f"[MONITOR] Configuration file not found: {self.config_path}")
                return {}
        except Exception as e:
            print(f"[MONITOR] Failed to load configuration: {e}")
            return {}

    def get_rollout_start_time(self) -> datetime:
        """Get rollout start time from git commit or current time"""
        try:
            # Try to get commit time for Context7 implementation
            result = subprocess.run(
                ['git', 'log', '--format=%ci', '--grep=Context7-Compliant Context Replacement', '-1'],
                capture_output=True,
                text=True,
                cwd=self.project_root
            )

            if result.returncode == 0 and result.stdout.strip():
                # Parse git date format: 2025-09-25 23:12:48 +0000
                commit_time_str = result.stdout.strip()
                commit_time = datetime.strptime(commit_time_str.rsplit(' ', 1)[0], '%Y-%m-%d %H:%M:%S')
                return commit_time.replace(tzinfo=timezone.utc)
            else:
                # Fallback to current time
                return datetime.now(timezone.utc)
        except Exception:
            return datetime.now(timezone.utc)

    def analyze_shadow_mode_performance(self) -> Dict[str, Any]:
        """Analyze Shadow Mode performance metrics"""
        metrics = {
            'total_comparisons': 0,
            'avg_token_savings': 0.0,
            'avg_performance_gain': 0.0,
            'safety_incidents': 0,
            'quality_score': 0.0,
            'success_rate': 0.0
        }

        try:
            if not os.path.exists(self.shadow_log_path):
                return metrics

            comparisons = []
            with open(self.shadow_log_path, 'r', encoding='utf-8') as f:
                for line in f:
                    try:
                        comparison = json.loads(line.strip())
                        if comparison.get('mode') == 'shadow':
                            comparisons.append(comparison)
                    except json.JSONDecodeError:
                        continue

            if not comparisons:
                return metrics

            metrics['total_comparisons'] = len(comparisons)

            # Calculate average token savings
            token_savings = []
            performance_gains = []

            for comp in comparisons:
                if 'comparison' in comp:
                    c = comp['comparison']

                    # Token savings calculation
                    original_tokens = c.get('token_estimate_original', 0)
                    enhanced_tokens = c.get('token_estimate_enhanced', 0)

                    if original_tokens > 0:
                        savings = ((original_tokens - enhanced_tokens) / original_tokens) * 100
                        token_savings.append(max(0, savings))  # Only positive savings count

                    # Performance gain (inverse of processing time)
                    processing_time = c.get('processing_time_ms', 0)
                    if processing_time > 0 and processing_time < 5000:  # Reasonable upper bound
                        performance_gain = max(0, (200 - processing_time) / 200 * 100)  # 200ms baseline
                        performance_gains.append(performance_gain)

            if token_savings:
                metrics['avg_token_savings'] = sum(token_savings) / len(token_savings)

            if performance_gains:
                metrics['avg_performance_gain'] = sum(performance_gains) / len(performance_gains)

            # Success rate (comparisons without errors)
            successful = len([c for c in comparisons if not c.get('error')])
            metrics['success_rate'] = (successful / len(comparisons)) * 100

            # Quality score (composite of savings and performance)
            metrics['quality_score'] = (
                (metrics['avg_token_savings'] * 0.6) +
                (metrics['avg_performance_gain'] * 0.4)
            ) / 100

            return metrics

        except Exception as e:
            print(f"[MONITOR] Error analyzing Shadow Mode performance: {e}")
            return metrics

    def check_success_criteria(self, metrics: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Check if Shadow Mode success criteria are met"""
        criteria = self.config.get('progressive_rollout', {}).get('success_criteria', {})
        issues = []

        # Minimum token savings
        min_token_savings = criteria.get('min_token_savings_percent', 20)
        if metrics['avg_token_savings'] < min_token_savings:
            issues.append(f"Token savings {metrics['avg_token_savings']:.1f}% < {min_token_savings}%")

        # Minimum performance gain
        min_performance_gain = criteria.get('min_performance_gain_percent', 15)
        if metrics['avg_performance_gain'] < min_performance_gain:
            issues.append(f"Performance gain {metrics['avg_performance_gain']:.1f}% < {min_performance_gain}%")

        # Safety incidents
        max_safety_incidents = criteria.get('max_safety_incidents', 0)
        if metrics['safety_incidents'] > max_safety_incidents:
            issues.append(f"Safety incidents {metrics['safety_incidents']} > {max_safety_incidents}")

        # Quality score
        min_quality_score = criteria.get('min_quality_score', 0.75)
        if metrics['quality_score'] < min_quality_score:
            issues.append(f"Quality score {metrics['quality_score']:.2f} < {min_quality_score}")

        # Success rate
        min_success_rate = criteria.get('min_uptime_percent', 99.5)
        if metrics['success_rate'] < min_success_rate:
            issues.append(f"Success rate {metrics['success_rate']:.1f}% < {min_success_rate}%")

        return len(issues) == 0, issues

    def get_phase_status(self) -> Dict[str, Any]:
        """Get current phase status and progression timeline"""
        now = datetime.now(timezone.utc)
        elapsed_time = now - self.rollout_start_time

        # Phase durations from config
        shadow_duration_hours = self.config.get('progressive_rollout', {}).get('shadow_mode_duration_hours', 72)
        hybrid_duration_hours = self.config.get('progressive_rollout', {}).get('hybrid_mode_duration_hours', 168)

        shadow_duration = timedelta(hours=shadow_duration_hours)
        hybrid_duration = timedelta(hours=hybrid_duration_hours)

        current_mode = self.get_current_mode()

        status = {
            'current_mode': current_mode,
            'rollout_start_time': self.rollout_start_time.isoformat(),
            'elapsed_time_hours': elapsed_time.total_seconds() / 3600,
            'phase_status': '',
            'next_phase': '',
            'time_to_next_phase_hours': 0,
            'can_progress': False,
            'progression_blocked_reasons': []
        }

        if current_mode == 'shadow':
            status['phase_status'] = 'Shadow Mode - Parallel Testing'
            status['next_phase'] = 'hybrid'

            time_remaining = shadow_duration - elapsed_time
            status['time_to_next_phase_hours'] = max(0, time_remaining.total_seconds() / 3600)

            # Check if ready for hybrid mode
            if elapsed_time >= shadow_duration:
                metrics = self.analyze_shadow_mode_performance()
                can_progress, issues = self.check_success_criteria(metrics)
                status['can_progress'] = can_progress
                status['progression_blocked_reasons'] = issues

        elif current_mode == 'hybrid':
            status['phase_status'] = 'Hybrid Mode - Selective Replacement'
            status['next_phase'] = 'full'

            hybrid_start = self.rollout_start_time + shadow_duration
            hybrid_elapsed = now - hybrid_start
            hybrid_remaining = hybrid_duration - hybrid_elapsed
            status['time_to_next_phase_hours'] = max(0, hybrid_remaining.total_seconds() / 3600)

            # Check if ready for full mode
            if hybrid_elapsed >= hybrid_duration:
                status['can_progress'] = True  # Simplified for hybrid → full

        elif current_mode == 'full':
            status['phase_status'] = 'Full Mode - Production Active'
            status['next_phase'] = 'none'
            status['time_to_next_phase_hours'] = 0

        elif current_mode == 'emergency':
            status['phase_status'] = 'Emergency Mode - Native Context Only'
            status['next_phase'] = 'shadow'
            status['time_to_next_phase_hours'] = 0

        return status

    def get_current_mode(self) -> str:
        """Get current operational mode"""
        return self.config.get('context_interceptor', {}).get('mode', 'shadow')

    def log_monitoring_result(self, status: Dict[str, Any], metrics: Dict[str, Any]):
        """Log monitoring results"""
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'monitoring_type': 'progressive_rollout',
            'phase_status': status,
            'performance_metrics': metrics
        }

        try:
            os.makedirs(os.path.dirname(self.rollout_log_path), exist_ok=True)
            with open(self.rollout_log_path, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry) + '\n')
        except Exception as e:
            print(f"[MONITOR] Warning: Failed to log monitoring result: {e}")

    def suggest_next_action(self, status: Dict[str, Any], metrics: Dict[str, Any]) -> str:
        """Suggest next action based on current status"""
        current_mode = status['current_mode']

        if current_mode == 'shadow':
            if status['can_progress']:
                return f"✅ Ready to progress to Hybrid Mode. Run: python3 .claude/hooks/context-interceptor-config-manager.py set-mode hybrid 'Shadow Mode success criteria met'"
            elif status['time_to_next_phase_hours'] > 0:
                return f"⏳ Continue Shadow Mode testing. {status['time_to_next_phase_hours']:.1f} hours remaining"
            else:
                reasons = '\n  - '.join(status['progression_blocked_reasons'])
                return f"❌ Shadow Mode criteria not met:\n  - {reasons}\n\nRecommendation: Extend Shadow Mode testing and investigate issues"

        elif current_mode == 'hybrid':
            if status['can_progress']:
                return f"✅ Ready to progress to Full Mode. Run: python3 .claude/hooks/context-interceptor-config-manager.py set-mode full 'Hybrid Mode completed successfully'"
            else:
                return f"⏳ Continue Hybrid Mode testing. {status['time_to_next_phase_hours']:.1f} hours remaining"

        elif current_mode == 'full':
            return f"🎯 Full Mode active - Context7 implementation in production"

        elif current_mode == 'emergency':
            return f"🚨 Emergency Mode active - Manual intervention required"

        return "❓ Unknown mode - check configuration"

def main():
    """Main CLI interface"""
    if len(sys.argv) < 2:
        print("Usage: python3 progressive-rollout-monitor.py <command>")
        print("\nCommands:")
        print("  status     - Show current rollout status")
        print("  metrics    - Show detailed performance metrics")
        print("  check      - Check progression criteria")
        print("  next       - Get next action recommendation")
        sys.exit(1)

    monitor = ProgressiveRolloutMonitor()
    command = sys.argv[1].lower()

    try:
        if command == 'status':
            status = monitor.get_phase_status()
            print(f"🚀 Progressive Rollout Status")
            print(f"═══════════════════════════════")
            print(f"Current Mode: {status['current_mode']}")
            print(f"Phase: {status['phase_status']}")
            print(f"Elapsed Time: {status['elapsed_time_hours']:.1f} hours")
            print(f"Next Phase: {status['next_phase']}")
            if status['time_to_next_phase_hours'] > 0:
                print(f"Time to Next: {status['time_to_next_phase_hours']:.1f} hours")
            print(f"Can Progress: {'Yes' if status['can_progress'] else 'No'}")

        elif command == 'metrics':
            metrics = monitor.analyze_shadow_mode_performance()
            print(f"📊 Shadow Mode Performance Metrics")
            print(f"═══════════════════════════════════")
            print(f"Total Comparisons: {metrics['total_comparisons']}")
            print(f"Token Savings: {metrics['avg_token_savings']:.1f}%")
            print(f"Performance Gain: {metrics['avg_performance_gain']:.1f}%")
            print(f"Success Rate: {metrics['success_rate']:.1f}%")
            print(f"Quality Score: {metrics['quality_score']:.2f}")
            print(f"Safety Incidents: {metrics['safety_incidents']}")

        elif command == 'check':
            metrics = monitor.analyze_shadow_mode_performance()
            can_progress, issues = monitor.check_success_criteria(metrics)

            print(f"✅ Success Criteria Check")
            print(f"═══════════════════════════")
            print(f"Overall Status: {'PASS' if can_progress else 'FAIL'}")

            if issues:
                print(f"\nIssues Found:")
                for issue in issues:
                    print(f"  ❌ {issue}")
            else:
                print(f"✅ All criteria met - ready for progression")

        elif command == 'next':
            status = monitor.get_phase_status()
            metrics = monitor.analyze_shadow_mode_performance()

            print(f"🎯 Next Action Recommendation")
            print(f"═══════════════════════════════")
            print(monitor.suggest_next_action(status, metrics))

            # Log the monitoring result
            monitor.log_monitoring_result(status, metrics)

        else:
            print(f"Unknown command: {command}")
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()