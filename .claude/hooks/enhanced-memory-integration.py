#!/usr/bin/env python3
"""
Enhanced Memory Integration Hook - SAFE VERSION
Memory-safe implementation with proper subprocess cleanup and resource management
Prevents macOS system crashes through controlled resource usage
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
from typing import Optional, Dict, Any

class ProcessManager:
    """Manages subprocess lifecycle with proper cleanup"""

    def __init__(self, max_concurrent=3, timeout=8):
        self.max_concurrent = max_concurrent
        self.timeout = timeout
        self.active_processes = {}
        self.lock = threading.Lock()

    def cleanup_process(self, proc, timeout=5):
        """Safely cleanup a subprocess with proper termination"""
        if proc.poll() is not None:
            return  # Already terminated

        try:
            # First attempt: graceful termination
            proc.terminate()
            proc.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            # Force kill if graceful termination fails
            proc.kill()
            proc.wait(timeout=2)
        except:
            pass

    def run_subprocess(self, cmd, input_data=None):
        """Run subprocess with automatic cleanup and resource limits"""
        with self.lock:
            if len(self.active_processes) >= self.max_concurrent:
                return None, "Too many concurrent processes"

        proc = None
        try:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                preexec_fn=os.setsid if hasattr(os, 'setsid') else None
            )

            with self.lock:
                self.active_processes[proc.pid] = proc

            try:
                stdout, stderr = proc.communicate(
                    input=input_data,
                    timeout=self.timeout
                )
                return stdout, stderr

            except subprocess.TimeoutExpired:
                self.cleanup_process(proc)
                return None, f"Process timeout after {self.timeout}s"

        except Exception as e:
            if proc:
                self.cleanup_process(proc)
            return None, f"Process error: {str(e)}"

        finally:
            if proc:
                with self.lock:
                    self.active_processes.pop(proc.pid, None)
                self.cleanup_process(proc)

class RateLimiter:
    """Prevents hook flooding with rate limiting"""

    def __init__(self, max_calls=5, window=60):
        self.max_calls = max_calls
        self.window = window
        self.calls = []

    def allow_call(self):
        now = time.time()
        # Clean old calls
        self.calls = [call for call in self.calls if now - call < self.window]

        if len(self.calls) >= self.max_calls:
            return False

        self.calls.append(now)
        return True

    def get_remaining_time(self):
        if not self.calls:
            return 0
        return max(0, self.window - (time.time() - self.calls[0]))

class CircuitBreaker:
    """Circuit breaker pattern for failing operations"""

    def __init__(self, failure_threshold=3, recovery_timeout=300):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN

    def call(self, func, *args, **kwargs):
        if self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = 'HALF_OPEN'
            else:
                return None, "Circuit breaker OPEN"

        try:
            result = func(*args, **kwargs)
            if self.state == 'HALF_OPEN':
                self.state = 'CLOSED'
                self.failure_count = 0
            return result, None

        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()

            if self.failure_count >= self.failure_threshold:
                self.state = 'OPEN'

            return None, str(e)

class EnhancedMemoryIntegrationHookSafe:
    """Memory-safe version of Enhanced Memory Integration Hook"""

    def __init__(self):
        self.project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
        self.session_id = self._generate_session_id()
        self.process_manager = ProcessManager(max_concurrent=2, timeout=5)
        self.rate_limiter = RateLimiter(max_calls=3, window=60)
        self.circuit_breaker = CircuitBreaker(failure_threshold=2, recovery_timeout=180)
        self.memory_bridge_enabled = self._check_bridge_availability()

        # Health metrics
        self.stats = {
            'calls_made': 0,
            'calls_successful': 0,
            'calls_rate_limited': 0,
            'calls_circuit_broken': 0,
            'total_processing_time': 0
        }

    def _generate_session_id(self):
        """Generate unique session ID for this Claude Code session"""
        timestamp = str(datetime.now().timestamp())
        return hashlib.md5(timestamp.encode()).hexdigest()[:8]

    def _check_bridge_availability(self):
        """Check if memory bridge system is available and safe to use"""
        bridge_path = os.path.join(self.project_dir, 'scripts', 'memory-bridge-runner.js')
        return os.path.exists(bridge_path)

    def _log_hook_activity(self, event_type, data):
        """Log hook activity for debugging and monitoring with size limits"""
        try:
            # Limit log entry size to prevent memory bloat
            data_str = str(data)[:500] if len(str(data)) > 500 else data

            log_entry = {
                'timestamp': datetime.now().isoformat(),
                'event_type': event_type,
                'session_id': self.session_id,
                'data': data_str,
                'stats': self.stats.copy()
            }

            log_path = os.path.join(self.project_dir, 'logs', 'memory-integration-safe.log')
            os.makedirs(os.path.dirname(log_path), exist_ok=True)

            # Rotate log if too large (>10MB)
            if os.path.exists(log_path) and os.path.getsize(log_path) > 10 * 1024 * 1024:
                os.rename(log_path, f"{log_path}.old")

            with open(log_path, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')

        except Exception:
            pass  # Fail silently to not break hook functionality

    def handle_user_prompt_submit(self, prompt_data):
        """Handle UserPromptSubmit hook - inject intelligent context with safety checks"""
        start_time = time.time()
        self.stats['calls_made'] += 1

        if not self.memory_bridge_enabled:
            return prompt_data

        try:
            # Rate limiting check
            if not self.rate_limiter.allow_call():
                self.stats['calls_rate_limited'] += 1
                self._log_hook_activity('rate_limited', {
                    'remaining_time': self.rate_limiter.get_remaining_time()
                })
                return prompt_data

            # Extract prompt from hook data
            user_prompt = prompt_data.get('prompt', '')
            if len(user_prompt.strip()) < 10:
                return prompt_data

            # Check if context injection is enabled
            if not self._is_context_injection_enabled():
                return prompt_data

            # Phase 3: Check for dual-trigger integration (with circuit breaker)
            dual_trigger_context, error = self.circuit_breaker.call(
                self._check_dual_trigger_integration, user_prompt
            )

            if error:
                self.stats['calls_circuit_broken'] += 1
                self._log_hook_activity('circuit_breaker_open', {'error': error})
                return prompt_data

            if dual_trigger_context:
                # Handle dual-trigger context restoration
                enhanced_prompt = self._handle_dual_trigger_context_restoration(
                    user_prompt, dual_trigger_context
                )

                if enhanced_prompt and enhanced_prompt != user_prompt:
                    self.stats['calls_successful'] += 1
                    self._log_hook_activity('dual_trigger_context_restoration', {
                        'original_length': len(user_prompt),
                        'enhanced_length': min(len(enhanced_prompt), 2000),  # Limit logged length
                        'trigger_type': dual_trigger_context.get('trigger_type', 'unknown')
                    })

                    enhanced_data = prompt_data.copy()
                    enhanced_data['prompt'] = enhanced_prompt
                    return enhanced_data

            # Standard context injection (with memory limits)
            if len(user_prompt) > 1000:  # Skip context injection for very long prompts
                return prompt_data

            enhanced_prompt = self._call_memory_bridge_context_injection(user_prompt)

            if enhanced_prompt and enhanced_prompt != user_prompt and len(enhanced_prompt) < 5000:
                self.stats['calls_successful'] += 1
                self.stats['total_processing_time'] += time.time() - start_time

                self._log_hook_activity('context_injection', {
                    'original_length': len(user_prompt),
                    'enhanced_length': len(enhanced_prompt),
                    'injection_applied': True,
                    'processing_time': round(time.time() - start_time, 2)
                })

                # Return enhanced prompt data
                enhanced_data = prompt_data.copy()
                enhanced_data['prompt'] = enhanced_prompt
                return enhanced_data

            return prompt_data

        except Exception as e:
            self._log_hook_activity('context_injection_error', {
                'error': str(e)[:200],  # Limit error message length
                'prompt_length': len(prompt_data.get('prompt', ''))
            })
            return prompt_data

    def handle_post_tool_use(self, tool_data):
        """Handle PostToolUse hook - store significant interactions with safety checks"""
        if not self.memory_bridge_enabled:
            return

        # Skip if rate limited
        if not self.rate_limiter.allow_call():
            return

        try:
            tool_name = tool_data.get('tool_name', '')
            tool_params = tool_data.get('parameters', {})

            # Check if tool interaction should be stored
            if not self._is_significant_tool_interaction(tool_name, tool_params):
                return

            # Limit data size to prevent memory bloat
            if len(str(tool_params)) > 2000:
                return

            # Prepare hook context for memory bridge
            hook_context = {
                'toolName': tool_name,
                'toolParams': tool_params,
                'sessionId': self.session_id,
                'timestamp': datetime.now().isoformat(),
                'projectContext': self._get_current_project_context()
            }

            # Call TypeScript memory bridge for storage (with circuit breaker)
            storage_result, error = self.circuit_breaker.call(
                self._call_memory_bridge_storage, hook_context
            )

            self._log_hook_activity('memory_storage', {
                'tool_name': tool_name,
                'storage_success': storage_result and not error,
                'content_length': min(len(str(tool_params)), 1000),
                'error': error[:100] if error else None
            })

        except Exception as e:
            self._log_hook_activity('memory_storage_error', {
                'error': str(e)[:200],
                'tool_name': tool_data.get('tool_name', 'unknown')
            })

    def _is_context_injection_enabled(self):
        """Check if context injection is enabled in configuration"""
        try:
            config_path = os.path.join(self.project_dir, '.devflow/context-management-config.json')
            if not os.path.exists(config_path):
                return True  # Default enabled

            with open(config_path, 'r') as f:
                config = json.load(f)

            return config.get('enable_context_injection', True)
        except:
            return True  # Default enabled on error

    def _is_significant_tool_interaction(self, tool_name, tool_params):
        """Determine if tool interaction is significant enough for memory storage"""
        significant_tools = ['Write', 'Edit', 'MultiEdit', 'Task', 'Bash', 'Read']

        if tool_name not in significant_tools:
            return False

        # Check minimum content requirements
        if tool_name in ['Write', 'Edit', 'MultiEdit']:
            content = tool_params.get('content', '') or tool_params.get('new_string', '')
            return 50 <= len(content.strip()) <= 2000  # Size limits

        if tool_name == 'Task':
            prompt = tool_params.get('prompt', '')
            return 20 <= len(prompt.strip()) <= 1000

        if tool_name == 'Bash':
            command = tool_params.get('command', '')
            description = tool_params.get('description', '')
            return 10 <= len(command + description) <= 500

        if tool_name == 'Read':
            file_path = tool_params.get('file_path', '').lower()
            significant_files = [
                'claude.md', 'readme.md', 'package.json', 'tsconfig.json',
                '.env', 'config.', 'settings.json'
            ]
            return any(sig_file in file_path for sig_file in significant_files)

        return True

    def _get_current_project_context(self):
        """Get current project context from task state"""
        try:
            task_state_path = os.path.join(self.project_dir, '.claude/state/current_task.json')
            if os.path.exists(task_state_path):
                with open(task_state_path, 'r') as f:
                    task_state = json.load(f)

                return {
                    'id': 1,  # Default project ID
                    'name': task_state.get('task', 'unknown')[:50],  # Limit length
                    'branch': task_state.get('branch', 'main')[:50]
                }
        except:
            pass

        return {'id': 1, 'name': 'devflow', 'branch': 'main'}

    def _call_memory_bridge_context_injection(self, user_prompt):
        """Call Node.js memory bridge for context injection with safety checks"""
        try:
            bridge_script = os.path.join(self.project_dir, 'scripts', 'memory-bridge-runner.js')
            if not os.path.exists(bridge_script):
                return user_prompt

            # Limit input size
            if len(user_prompt) > 1000:
                user_prompt = user_prompt[:1000] + "..."

            # Prepare data for bridge call
            bridge_data = {
                'user_prompt': user_prompt,
                'session_id': self.session_id,
                'project_id': 1
            }

            # Call Node.js bridge with process manager
            stdout, stderr = self.process_manager.run_subprocess([
                'node', bridge_script, 'context-injection', json.dumps(bridge_data)
            ])

            if stdout and not stderr:
                try:
                    response = json.loads(stdout.strip())
                    if response.get('success') and response.get('context_applied'):
                        enhanced = response.get('enhanced_prompt', user_prompt)
                        # Limit response size
                        if len(enhanced) > 5000:
                            return user_prompt
                        return enhanced
                except json.JSONDecodeError:
                    pass

            return user_prompt

        except Exception as e:
            self._log_hook_activity('bridge_call_error', {
                'operation': 'context_injection',
                'error': str(e)[:200]
            })
            return user_prompt

    def _call_memory_bridge_storage(self, hook_context):
        """Call Node.js memory bridge for memory storage with safety checks"""
        try:
            bridge_script = os.path.join(self.project_dir, 'scripts', 'memory-bridge-runner.js')
            if not os.path.exists(bridge_script):
                return False

            # Prepare data for bridge call
            bridge_data = {
                'tool_name': hook_context['toolName'],
                'tool_params': hook_context['toolParams'],
                'session_id': hook_context['sessionId'],
                'project_id': hook_context.get('projectContext', {}).get('id', 1)
            }

            # Call Node.js bridge with process manager
            stdout, stderr = self.process_manager.run_subprocess([
                'node', bridge_script, 'memory-storage', json.dumps(bridge_data)
            ])

            if stdout and not stderr:
                try:
                    response = json.loads(stdout.strip())
                    return response.get('success', False)
                except json.JSONDecodeError:
                    pass

            return False

        except Exception as e:
            self._log_hook_activity('bridge_call_error', {
                'operation': 'memory_storage',
                'error': str(e)[:200]
            })
            return False

    def _check_dual_trigger_integration(self, user_prompt):
        """Check if dual-trigger context restoration should be activated"""
        try:
            trigger_metadata_path = os.path.join(self.project_dir, '.devflow/dual-trigger-log.json')
            if not os.path.exists(trigger_metadata_path):
                return None

            with open(trigger_metadata_path, 'r') as f:
                trigger_log = json.load(f)

            if not trigger_log:
                return None

            # Get most recent dual-trigger event
            recent_trigger = trigger_log[-1]

            # Check if trigger is recent (within last 30 minutes)
            trigger_time = datetime.fromisoformat(recent_trigger['timestamp'])
            time_diff = datetime.now() - trigger_time

            if time_diff.total_seconds() > 1800:  # 30 minutes
                return None

            # Check if this is the first prompt after trigger
            if recent_trigger.get('context_restored', False):
                return None

            return {
                'trigger_type': recent_trigger['triggerType'],
                'session_id': recent_trigger['sessionId'],
                'confidence': recent_trigger['confidence'],
                'context_tokens': recent_trigger.get('contextTokens', 0)
            }

        except Exception as e:
            self._log_hook_activity('dual_trigger_check_error', {'error': str(e)[:200]})
            return None

    def _handle_dual_trigger_context_restoration(self, user_prompt, dual_trigger_context):
        """Handle context restoration using dual-trigger saved state"""
        try:
            bridge_script = os.path.join(self.project_dir, 'scripts', 'memory-bridge-runner.js')
            if not os.path.exists(bridge_script):
                return user_prompt

            # Prepare data for cross-session restoration
            bridge_data = {
                'operation': 'session_restoration',
                'session_id': dual_trigger_context['session_id'],
                'project_id': 1,
                'trigger_type': dual_trigger_context['trigger_type']
            }

            # Call Node.js bridge for session restoration
            stdout, stderr = self.process_manager.run_subprocess([
                'node', bridge_script, 'session-restoration', json.dumps(bridge_data)
            ])

            if stdout and not stderr:
                try:
                    response = json.loads(stdout.strip())

                    if response.get('success') and response.get('data', {}).get('contextRestored'):
                        restored_context = response['data']['restoredContext']
                        context_quality = response['data'].get('contextQuality', 0)

                        if restored_context and context_quality > 0.3:
                            # Limit context size
                            if len(restored_context) > 2000:
                                restored_context = restored_context[:2000] + "..."

                            # Create enhanced prompt with restored context
                            enhanced_sections = [
                                '## Previous Session Context',
                                '',
                                restored_context,
                                '',
                                '## Current Request',
                                '',
                                user_prompt
                            ]

                            enhanced_prompt = '\n'.join(enhanced_sections)

                            # Final size check
                            if len(enhanced_prompt) > 5000:
                                return user_prompt

                            # Mark context as restored in trigger log
                            self._mark_trigger_context_restored(dual_trigger_context['session_id'])

                            return enhanced_prompt
                except json.JSONDecodeError:
                    pass

            return user_prompt

        except Exception as e:
            self._log_hook_activity('dual_trigger_restoration_error', {
                'error': str(e)[:200],
                'session_id': dual_trigger_context.get('session_id', 'unknown')
            })
            return user_prompt

    def _mark_trigger_context_restored(self, session_id):
        """Mark dual-trigger context as restored to prevent duplicate restoration"""
        try:
            trigger_metadata_path = os.path.join(self.project_dir, '.devflow/dual-trigger-log.json')
            if not os.path.exists(trigger_metadata_path):
                return

            with open(trigger_metadata_path, 'r') as f:
                trigger_log = json.load(f)

            # Mark the most recent matching session as restored
            for entry in reversed(trigger_log):
                if entry['sessionId'] == session_id:
                    entry['context_restored'] = True
                    entry['restoration_timestamp'] = datetime.now().isoformat()
                    break

            with open(trigger_metadata_path, 'w') as f:
                json.dump(trigger_log, f, indent=2)

        except Exception as e:
            self._log_hook_activity('mark_restoration_error', {'error': str(e)[:200]})

def main():
    """Main hook entry point with signal handling"""
    def signal_handler(signum, frame):
        sys.exit(0)

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    if len(sys.argv) < 2:
        return

    hook_type = sys.argv[1]
    hook_data = {}

    # Parse hook data from stdin if available
    if len(sys.argv) > 2:
        try:
            hook_data = json.loads(sys.argv[2])
        except json.JSONDecodeError:
            pass
    elif not sys.stdin.isatty():
        try:
            # Use select with timeout to avoid blocking
            import select
            if select.select([sys.stdin], [], [], 0.1)[0]:
                hook_data_str = sys.stdin.read(4096)  # Limit input size
                hook_data = json.loads(hook_data_str)
        except (json.JSONDecodeError, ImportError):
            pass

    # Initialize hook handler
    hook = EnhancedMemoryIntegrationHookSafe()

    # Route to appropriate handler
    if hook_type == "UserPromptSubmit":
        enhanced_data = hook.handle_user_prompt_submit(hook_data)
        print(json.dumps(enhanced_data))

    elif hook_type == "PostToolUse":
        hook.handle_post_tool_use(hook_data)

    else:
        hook._log_hook_activity('unknown_hook_type', {'hook_type': hook_type})

if __name__ == "__main__":
    main()