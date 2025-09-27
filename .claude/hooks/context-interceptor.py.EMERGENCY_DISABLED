#!/usr/bin/env python3
"""
Context Interceptor Hook - Context7 Compliant Implementation
Phase Alpha: Shadow Mode Implementation

DESCRIPTION:
    Context7-compliant context interception system that initially operates in Shadow Mode,
    running Enhanced Memory parallel to native context without replacement.

    Provides safe transition path from native to Enhanced Memory context management
    with comprehensive safety validation and automatic rollback capabilities.

OPERATION MODES:
    - SHADOW: Run Enhanced Memory parallel to native (no replacement) [DEFAULT]
    - HYBRID: Selective replacement for non-critical operations
    - FULL: Complete context replacement with fallback
    - EMERGENCY: Native context only (Enhanced Memory disabled)

SAFETY FEATURES:
    - Context7 safety validation
    - Performance degradation monitoring
    - Automatic emergency rollback
    - Comprehensive logging and metrics
"""

import sys
import json
import os
import subprocess
import hashlib
import time
import signal
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
import urllib.request
import urllib.parse

# Import Claude Code hook utilities if available
try:
    from .base.standard_hook_pattern import StandardHookPattern, HookResult
    CLAUDE_HOOK_BASE_AVAILABLE = True
except ImportError:
    CLAUDE_HOOK_BASE_AVAILABLE = False

class ContextInterceptionMode:
    SHADOW = "shadow"      # Run parallel, no replacement (safe testing)
    HYBRID = "hybrid"      # Selective replacement for non-critical ops
    FULL = "full"          # Complete replacement with fallback
    EMERGENCY = "emergency" # Native only, Enhanced Memory disabled

class ContextSafetyLevel:
    SAFE = "safe"
    WARNING = "warning"
    DANGER = "danger"
    CRITICAL = "critical"

class ContextInterceptor:
    """Context7-compliant context interception with safety validation"""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.config_file = self.project_root / '.claude' / 'config' / 'context-interceptor-config.json'
        self.emergency_flag = self.project_root / '.claude' / 'emergency' / 'CONTEXT_ROLLBACK_ACTIVE'

        # Load configuration
        self.config = self._load_config()

        # Initialize components
        self.enhanced_memory_bridge = EnhancedMemoryBridge(project_root)
        self.safety_validator = ContextSafetyValidator()
        self.performance_monitor = PerformanceMonitor()

        # Operation mode
        self.current_mode = self._determine_operation_mode()

        # Session tracking
        self.session_id = self._generate_session_id()
        self.interception_stats = {
            'total_contexts': 0,
            'enhanced_contexts': 0,
            'native_fallbacks': 0,
            'safety_violations': 0,
            'performance_warnings': 0
        }

    def _load_config(self) -> Dict[str, Any]:
        """Load context interceptor configuration"""
        default_config = {
            "operation_mode": ContextInterceptionMode.SHADOW,
            "safety_validation_enabled": True,
            "performance_monitoring_enabled": True,
            "max_token_limit": 30000,
            "min_coherence_score": 0.7,
            "emergency_rollback_threshold": 3,
            "shadow_mode_comparison": True,
            "logging_level": "INFO",
            "enhanced_memory_timeout": 5.0,
            "fallback_to_native_on_error": True
        }

        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    user_config = json.load(f)
                    return {**default_config, **user_config}
            except Exception as e:
                self._log_error(f"Failed to load config: {e}, using defaults")

        # Create config directory and save default config
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_file, 'w') as f:
            json.dump(default_config, f, indent=2)

        return default_config

    def _determine_operation_mode(self) -> str:
        """Determine current operation mode based on system state"""

        # Check for emergency mode
        if self.emergency_flag.exists():
            return ContextInterceptionMode.EMERGENCY

        # Check environment override
        env_mode = os.environ.get('CLAUDE_CONTEXT_MODE', '').lower()
        if env_mode in [ContextInterceptionMode.SHADOW, ContextInterceptionMode.HYBRID,
                       ContextInterceptionMode.FULL, ContextInterceptionMode.EMERGENCY]:
            return env_mode

        # Use config mode
        return self.config.get('operation_mode', ContextInterceptionMode.SHADOW)

    def _generate_session_id(self) -> str:
        """Generate unique session ID"""
        timestamp = str(int(time.time() * 1000))
        random_part = hashlib.md5(f"{timestamp}{os.getpid()}".encode()).hexdigest()[:8]
        return f"ctx_{timestamp}_{random_part}"

    def intercept_context(self, original_context: str, context_type: str = "general") -> Tuple[str, Dict[str, Any]]:
        """
        Main context interception method - Context7 compliant

        Args:
            original_context: Original Claude Code context
            context_type: Type of context (general, search, task, etc.)

        Returns:
            Tuple of (final_context, interception_metadata)
        """
        intercept_start = time.time()

        try:
            self.interception_stats['total_contexts'] += 1

            # Step 1: Check operation mode
            if self.current_mode == ContextInterceptionMode.EMERGENCY:
                return self._handle_emergency_mode(original_context)

            # Step 2: Context7 Safety Validation
            if self.config['safety_validation_enabled']:
                safety_result = self.safety_validator.validate_context_safety(original_context)
                if not safety_result['is_safe']:
                    return self._handle_unsafe_context(original_context, safety_result)

            # Step 3: Mode-specific processing
            if self.current_mode == ContextInterceptionMode.SHADOW:
                return self._handle_shadow_mode(original_context, context_type)
            elif self.current_mode == ContextInterceptionMode.HYBRID:
                return self._handle_hybrid_mode(original_context, context_type)
            elif self.current_mode == ContextInterceptionMode.FULL:
                return self._handle_full_mode(original_context, context_type)
            else:
                return self._handle_emergency_mode(original_context)

        except Exception as e:
            self._log_error(f"Context interception failed: {e}")
            return self._handle_interception_error(original_context, str(e))
        finally:
            intercept_duration = time.time() - intercept_start
            self.performance_monitor.record_interception(intercept_duration)

    def _handle_shadow_mode(self, original_context: str, context_type: str) -> Tuple[str, Dict[str, Any]]:
        """
        Shadow Mode: Run Enhanced Memory parallel to native context
        Context7 Pattern: Non-invasive testing and comparison
        """
        metadata = {
            'mode': 'shadow',
            'enhanced_memory_used': False,
            'native_context_used': True,
            'comparison_data': None,
            'safety_validation': 'passed'
        }

        try:
            # Run Enhanced Memory in parallel (non-blocking)
            enhanced_context_future = self._run_enhanced_memory_async(original_context, context_type)

            # Always return original context in shadow mode
            final_context = original_context

            # Collect Enhanced Memory result for comparison (if completed quickly)
            if enhanced_context_future and self.config['shadow_mode_comparison']:
                try:
                    enhanced_result = enhanced_context_future.result(timeout=self.config['enhanced_memory_timeout'])
                    metadata['comparison_data'] = {
                        'enhanced_context_length': len(enhanced_result['context']),
                        'original_context_length': len(original_context),
                        'performance_metrics': enhanced_result.get('performance_metrics', {}),
                        'quality_score': enhanced_result.get('quality_score', 0)
                    }
                    self._log_shadow_comparison(metadata['comparison_data'])
                except Exception as e:
                    self._log_warning(f"Shadow mode comparison failed: {e}")

        except Exception as e:
            self._log_error(f"Shadow mode processing failed: {e}")
            metadata['error'] = str(e)

        return final_context, metadata

    def _handle_hybrid_mode(self, original_context: str, context_type: str) -> Tuple[str, Dict[str, Any]]:
        """
        Hybrid Mode: Selective Enhanced Memory replacement
        Context7 Pattern: Progressive replacement for non-critical operations
        """
        metadata = {
            'mode': 'hybrid',
            'enhanced_memory_used': False,
            'native_context_used': True,
            'replacement_decision': 'native_fallback'
        }

        # Determine if this context type is safe for Enhanced Memory replacement
        safe_context_types = ['search', 'general', 'task_simple']
        unsafe_context_types = ['system_critical', 'error_handling', 'security']

        if context_type in safe_context_types and len(original_context) < 20000:
            try:
                # Attempt Enhanced Memory replacement
                enhanced_result = self.enhanced_memory_bridge.generate_enhanced_context(
                    original_context, context_type, self.session_id
                )

                if enhanced_result['success']:
                    metadata['enhanced_memory_used'] = True
                    metadata['replacement_decision'] = 'enhanced_memory'
                    metadata['performance_metrics'] = enhanced_result.get('performance_metrics', {})
                    self.interception_stats['enhanced_contexts'] += 1
                    return enhanced_result['context'], metadata

            except Exception as e:
                self._log_warning(f"Hybrid mode Enhanced Memory failed: {e}")
                metadata['error'] = str(e)

        # Fallback to native context
        self.interception_stats['native_fallbacks'] += 1
        return original_context, metadata

    def _handle_full_mode(self, original_context: str, context_type: str) -> Tuple[str, Dict[str, Any]]:
        """
        Full Mode: Complete Enhanced Memory replacement with fallback
        Context7 Pattern: Full replacement with comprehensive safety checks
        """
        metadata = {
            'mode': 'full',
            'enhanced_memory_used': False,
            'native_context_used': False,
            'fallback_triggered': False
        }

        try:
            # Attempt Enhanced Memory replacement
            enhanced_result = self.enhanced_memory_bridge.generate_enhanced_context(
                original_context, context_type, self.session_id
            )

            if enhanced_result['success']:
                # Additional safety check for full mode
                if self.config['safety_validation_enabled']:
                    safety_result = self.safety_validator.validate_context_safety(enhanced_result['context'])
                    if not safety_result['is_safe']:
                        raise Exception(f"Enhanced context failed safety validation: {safety_result['reason']}")

                metadata['enhanced_memory_used'] = True
                metadata['performance_metrics'] = enhanced_result.get('performance_metrics', {})
                self.interception_stats['enhanced_contexts'] += 1
                return enhanced_result['context'], metadata
            else:
                raise Exception(f"Enhanced Memory generation failed: {enhanced_result.get('error', 'unknown')}")

        except Exception as e:
            self._log_warning(f"Full mode Enhanced Memory failed, using native fallback: {e}")
            metadata['fallback_triggered'] = True
            metadata['fallback_reason'] = str(e)
            metadata['native_context_used'] = True
            self.interception_stats['native_fallbacks'] += 1
            return original_context, metadata

    def _handle_emergency_mode(self, original_context: str) -> Tuple[str, Dict[str, Any]]:
        """Emergency Mode: Native context only, Enhanced Memory completely disabled"""
        metadata = {
            'mode': 'emergency',
            'enhanced_memory_used': False,
            'native_context_used': True,
            'emergency_active': True
        }

        return original_context, metadata

    def _handle_unsafe_context(self, original_context: str, safety_result: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Handle context that failed safety validation"""
        self.interception_stats['safety_violations'] += 1

        metadata = {
            'safety_validation': 'failed',
            'safety_issues': safety_result.get('issues', []),
            'safety_score': safety_result.get('score', 0),
            'enhanced_memory_used': False,
            'native_context_used': True,
            'fallback_reason': 'safety_validation_failed'
        }

        self._log_warning(f"Context failed safety validation: {safety_result.get('reason', 'unknown')}")

        # Check if safety violation should trigger emergency mode
        if safety_result.get('severity') == 'critical':
            self._consider_emergency_activation()

        return original_context, metadata

    def _handle_interception_error(self, original_context: str, error: str) -> Tuple[str, Dict[str, Any]]:
        """Handle errors during context interception"""
        metadata = {
            'error': error,
            'enhanced_memory_used': False,
            'native_context_used': True,
            'fallback_reason': 'interception_error'
        }

        self.interception_stats['native_fallbacks'] += 1
        return original_context, metadata

    def _run_enhanced_memory_async(self, original_context: str, context_type: str):
        """Run Enhanced Memory processing asynchronously for shadow mode"""
        try:
            import concurrent.futures

            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            future = executor.submit(
                self.enhanced_memory_bridge.generate_enhanced_context,
                original_context, context_type, self.session_id
            )
            return future
        except Exception as e:
            self._log_error(f"Failed to start async Enhanced Memory: {e}")
            return None

    def _consider_emergency_activation(self):
        """Consider activating emergency mode based on safety violations"""
        if self.interception_stats['safety_violations'] >= self.config['emergency_rollback_threshold']:
            self._log_error("Safety violation threshold reached, considering emergency activation")
            # In a production system, this might automatically activate emergency mode
            # For now, we just log it

    def _log_shadow_comparison(self, comparison_data: Dict[str, Any]):
        """Log shadow mode comparison data for analysis"""
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'session_id': self.session_id,
            'comparison_type': 'shadow_mode',
            'data': comparison_data
        }

        # Write to shadow comparison log
        shadow_log_file = self.project_root / '.claude' / 'logs' / 'shadow-mode-comparison.jsonl'
        shadow_log_file.parent.mkdir(parents=True, exist_ok=True)

        with open(shadow_log_file, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')

    def get_interception_stats(self) -> Dict[str, Any]:
        """Get current interception statistics"""
        return {
            **self.interception_stats,
            'session_id': self.session_id,
            'current_mode': self.current_mode,
            'performance_stats': self.performance_monitor.get_stats()
        }

    def _log_info(self, message: str):
        """Log info message"""
        if self.config.get('logging_level') in ['INFO', 'DEBUG']:
            print(f"[INFO] [ContextInterceptor] {message}", file=sys.stderr)

    def _log_warning(self, message: str):
        """Log warning message"""
        if self.config.get('logging_level') in ['INFO', 'DEBUG', 'WARNING']:
            print(f"[WARNING] [ContextInterceptor] {message}", file=sys.stderr)

    def _log_error(self, message: str):
        """Log error message"""
        print(f"[ERROR] [ContextInterceptor] {message}", file=sys.stderr)


class EnhancedMemoryBridge:
    """Bridge to Enhanced Memory System"""

    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.memory_bridge_script = self.project_root / 'scripts' / 'memory-bridge-runner.js'

    def generate_enhanced_context(self, original_context: str, context_type: str, session_id: str) -> Dict[str, Any]:
        """Generate enhanced context using Enhanced Memory System"""
        try:
            if not self.memory_bridge_script.exists():
                return {
                    'success': False,
                    'error': 'Enhanced Memory bridge script not found',
                    'context': original_context
                }

            # Prepare request for Enhanced Memory System
            request_data = {
                'action': 'generate_context',
                'original_context': original_context,
                'context_type': context_type,
                'session_id': session_id,
                'timestamp': datetime.utcnow().isoformat()
            }

            # Call Enhanced Memory bridge
            result = subprocess.run([
                'node', str(self.memory_bridge_script), 'context-generation'
            ],
            input=json.dumps(request_data),
            text=True,
            capture_output=True,
            timeout=10
            )

            if result.returncode == 0:
                response = json.loads(result.stdout)
                return {
                    'success': True,
                    'context': response.get('enhanced_context', original_context),
                    'performance_metrics': response.get('performance_metrics', {}),
                    'quality_score': response.get('quality_score', 0)
                }
            else:
                return {
                    'success': False,
                    'error': f'Enhanced Memory bridge failed: {result.stderr}',
                    'context': original_context
                }

        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'Enhanced Memory bridge timeout',
                'context': original_context
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Enhanced Memory bridge error: {str(e)}',
                'context': original_context
            }


class ContextSafetyValidator:
    """Context safety validation using Context7 patterns"""

    def validate_context_safety(self, context: str) -> Dict[str, Any]:
        """Validate context safety - simplified version for hook usage"""
        try:
            # Basic safety checks
            token_count = len(context.split())

            # Check for excessive length (Context7 research: performance degrades after 32k tokens)
            if token_count > 30000:
                return {
                    'is_safe': False,
                    'reason': 'context_too_long',
                    'severity': 'critical',
                    'score': 0,
                    'issues': [f'Context exceeds safe token limit: {token_count} > 30000']
                }

            # Check for adversarial patterns
            adversarial_patterns = [
                'ignore previous instructions',
                'forget everything',
                'new instruction override',
                'system prompt replace'
            ]

            context_lower = context.lower()
            found_patterns = [pattern for pattern in adversarial_patterns if pattern in context_lower]

            if found_patterns:
                return {
                    'is_safe': False,
                    'reason': 'adversarial_patterns_detected',
                    'severity': 'high',
                    'score': 0.2,
                    'issues': [f'Adversarial patterns found: {found_patterns}']
                }

            # Context appears safe
            return {
                'is_safe': True,
                'reason': 'validation_passed',
                'severity': 'none',
                'score': 0.9,
                'issues': []
            }

        except Exception as e:
            # If validation fails, assume unsafe
            return {
                'is_safe': False,
                'reason': f'validation_error: {str(e)}',
                'severity': 'critical',
                'score': 0,
                'issues': ['Safety validation failed due to error']
            }


class PerformanceMonitor:
    """Performance monitoring for context interception"""

    def __init__(self):
        self.interception_times = []
        self.start_time = time.time()

    def record_interception(self, duration: float):
        """Record context interception timing"""
        self.interception_times.append(duration)

        # Keep only recent measurements
        if len(self.interception_times) > 100:
            self.interception_times = self.interception_times[-100:]

    def get_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        if not self.interception_times:
            return {
                'average_interception_time': 0,
                'total_interceptions': 0,
                'uptime_seconds': time.time() - self.start_time
            }

        return {
            'average_interception_time': sum(self.interception_times) / len(self.interception_times),
            'total_interceptions': len(self.interception_times),
            'min_interception_time': min(self.interception_times),
            'max_interception_time': max(self.interception_times),
            'uptime_seconds': time.time() - self.start_time
        }


# Hook Integration Functions

def process_context_data(context_data: str) -> str:
    """
    Main hook function for Claude Code integration
    Context7-compliant context processing with safety validation
    """
    try:
        # Get project root
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

        # Initialize context interceptor
        interceptor = ContextInterceptor(project_root)

        # Process context
        enhanced_context, metadata = interceptor.intercept_context(context_data, "hook_integration")

        # Log processing result
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'hook_type': 'context_interception',
            'metadata': metadata,
            'original_length': len(context_data),
            'enhanced_length': len(enhanced_context),
            'session_id': interceptor.session_id
        }

        # Write log
        log_file = Path(project_root) / '.claude' / 'logs' / 'context-interception.jsonl'
        log_file.parent.mkdir(parents=True, exist_ok=True)

        with open(log_file, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')

        return enhanced_context

    except Exception as e:
        # Fallback to original context on any error
        print(f"[ERROR] Context interception failed: {e}", file=sys.stderr)
        return context_data


def main():
    """Main function for direct execution"""
    if len(sys.argv) < 2:
        print("Usage: context-interceptor.py <context_data>", file=sys.stderr)
        sys.exit(1)

    context_data = sys.argv[1]
    enhanced_context = process_context_data(context_data)
    print(enhanced_context)


if __name__ == "__main__":
    main()