#!/usr/bin/env python3
"""
Enhanced Memory Integration Hook
Integrates semantic memory system with DevFlow hook lifecycle
Handles automatic memory storage and intelligent context injection
"""

import sys
import json
import os
import subprocess
import hashlib
from datetime import datetime
from pathlib import Path

class EnhancedMemoryIntegrationHook:
    def __init__(self):
        self.project_dir = os.environ.get('CLAUDE_PROJECT_DIR', os.getcwd())
        self.session_id = self._generate_session_id()
        self.memory_bridge_enabled = self._check_bridge_availability()

    def _generate_session_id(self):
        """Generate unique session ID for this Claude Code session"""
        timestamp = str(datetime.now().timestamp())
        return hashlib.md5(timestamp.encode()).hexdigest()[:8]

    def _check_bridge_availability(self):
        """Check if memory bridge system is available and initialized"""
        bridge_path = os.path.join(
            self.project_dir,
            'src/core/semantic-memory/memory-hook-integration-bridge.ts'
        )
        return os.path.exists(bridge_path)

    def _log_hook_activity(self, event_type, data):
        """Log hook activity for debugging and monitoring"""
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'event_type': event_type,
            'session_id': self.session_id,
            'data': data
        }

        log_path = os.path.join(self.project_dir, 'logs', 'memory-integration.log')
        os.makedirs(os.path.dirname(log_path), exist_ok=True)

        with open(log_path, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')

    def handle_user_prompt_submit(self, prompt_data):
        """Handle UserPromptSubmit hook - inject intelligent context"""
        if not self.memory_bridge_enabled:
            return prompt_data

        try:
            # Extract prompt from hook data
            user_prompt = prompt_data.get('prompt', '')
            if len(user_prompt.strip()) < 10:
                return prompt_data

            # Check if context injection is enabled
            if not self._is_context_injection_enabled():
                return prompt_data

            # Phase 3: Check for dual-trigger integration
            dual_trigger_context = self._check_dual_trigger_integration(user_prompt)
            if dual_trigger_context:
                # Handle dual-trigger context restoration
                enhanced_prompt = self._handle_dual_trigger_context_restoration(
                    user_prompt,
                    dual_trigger_context
                )

                if enhanced_prompt and enhanced_prompt != user_prompt:
                    self._log_hook_activity('dual_trigger_context_restoration', {
                        'original_length': len(user_prompt),
                        'enhanced_length': len(enhanced_prompt),
                        'trigger_type': dual_trigger_context.get('trigger_type', 'unknown')
                    })

                    enhanced_data = prompt_data.copy()
                    enhanced_data['prompt'] = enhanced_prompt
                    return enhanced_data

            # Phase 2a: Check for natural language patterns that indicate need for context
            if self._should_activate_context_injection(user_prompt):
                # Standard context injection (Phase 2)
                enhanced_prompt = self._call_memory_bridge_context_injection(user_prompt)

                if enhanced_prompt and enhanced_prompt != user_prompt:
                    self._log_hook_activity('context_injection', {
                        'original_length': len(user_prompt),
                        'enhanced_length': len(enhanced_prompt),
                        'injection_applied': True
                    })

                    # Check if debug mode is enabled
                    if self._is_debug_mode_enabled():
                        # Add visible debug header to show what's happening
                        debug_header = f"\n\n💾 [COMETA BRAIN DATABASE QUERY RESULTS]\n"
                        debug_header += f"📊 Original query: '{user_prompt}'\n"
                        debug_header += f"🗄️ Database search completed\n"
                        debug_header += f"📈 Enhanced with {len(enhanced_prompt) - len(user_prompt)} characters from Cometa Brain\n"
                        debug_header += f"🔍 Pattern matched: semantic_pattern_detection\n"
                        debug_header += f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"

                        enhanced_prompt = debug_header + enhanced_prompt

                    # Return enhanced prompt data
                    enhanced_data = prompt_data.copy()
                    enhanced_data['prompt'] = enhanced_prompt
                    return enhanced_data

            return prompt_data

        except Exception as e:
            self._log_hook_activity('context_injection_error', {
                'error': str(e),
                'prompt_length': len(prompt_data.get('prompt', ''))
            })
            return prompt_data

    def handle_post_tool_use(self, tool_data):
        """Handle PostToolUse hook - store significant interactions"""
        if not self.memory_bridge_enabled:
            return

        try:
            tool_name = tool_data.get('tool_name', '')
            tool_params = tool_data.get('parameters', {})

            # Check if tool interaction should be stored
            if not self._is_significant_tool_interaction(tool_name, tool_params):
                return

            # Prepare hook context for memory bridge
            hook_context = {
                'toolName': tool_name,
                'toolParams': tool_params,
                'sessionId': self.session_id,
                'timestamp': datetime.now().isoformat(),
                'projectContext': self._get_current_project_context()
            }

            # Call TypeScript memory bridge for storage
            storage_result = self._call_memory_bridge_storage(hook_context)

            self._log_hook_activity('memory_storage', {
                'tool_name': tool_name,
                'storage_success': storage_result,
                'content_length': len(str(tool_params))
            })

        except Exception as e:
            self._log_hook_activity('memory_storage_error', {
                'error': str(e),
                'tool_name': tool_data.get('tool_name', 'unknown')
            })

    def handle_session_start(self):
        """Handle SessionStart hook - restore session context"""
        if not self.memory_bridge_enabled:
            return None

        try:
            # Call TypeScript memory bridge for context restoration
            restored_context = self._call_memory_bridge_session_restore()

            if restored_context:
                self._log_hook_activity('session_restoration', {
                    'context_length': len(restored_context),
                    'restoration_success': True
                })

                # Store restored context for use in prompts
                self._store_session_context(restored_context)
                return restored_context

            return None

        except Exception as e:
            self._log_hook_activity('session_restoration_error', {
                'error': str(e)
            })
            return None

    def _is_context_injection_enabled(self):
        """Check if context injection is enabled in configuration"""
        try:
            config_path = os.path.join(
                self.project_dir,
                '.devflow/context-management-config.json'
            )

            if not os.path.exists(config_path):
                return True  # Default enabled

            with open(config_path, 'r') as f:
                config = json.load(f)

            return config.get('enable_context_injection', True)

        except:
            return True  # Default enabled on error

    def _is_significant_tool_interaction(self, tool_name, tool_params):
        """Determine if tool interaction is significant enough for memory storage"""
        significant_tools = [
            'Write', 'Edit', 'MultiEdit', 'Task', 'Bash', 'Read'
        ]

        if tool_name not in significant_tools:
            return False

        # Check minimum content requirements
        if tool_name in ['Write', 'Edit', 'MultiEdit']:
            content = tool_params.get('content', '') or tool_params.get('new_string', '')
            return len(content.strip()) >= 50

        if tool_name == 'Task':
            prompt = tool_params.get('prompt', '')
            return len(prompt.strip()) >= 20

        if tool_name == 'Bash':
            command = tool_params.get('command', '')
            description = tool_params.get('description', '')
            return len(command + description) >= 10

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
            task_state_path = os.path.join(
                self.project_dir,
                '.claude/state/current_task.json'
            )

            if os.path.exists(task_state_path):
                with open(task_state_path, 'r') as f:
                    task_state = json.load(f)

                return {
                    'id': 1,  # Default project ID - should be enhanced
                    'name': task_state.get('task', 'unknown'),
                    'branch': task_state.get('branch', 'main')
                }

        except:
            pass

        return {'id': 1, 'name': 'devflow', 'branch': 'main'}

    def _call_memory_bridge_context_injection(self, user_prompt):
        """Call Node.js memory bridge for context injection"""
        try:
            bridge_script = os.path.join(self.project_dir, 'scripts', 'memory-bridge-runner.js')
            if not os.path.exists(bridge_script):
                return user_prompt

            # Prepare data for bridge call
            bridge_data = {
                'user_prompt': user_prompt,
                'session_id': self.session_id,
                'project_id': 1  # Default project ID
            }

            # Call Node.js bridge
            result = subprocess.run([
                'node', bridge_script, 'context-injection', json.dumps(bridge_data)
            ], capture_output=True, text=True, timeout=10)

            if result.returncode == 0 and result.stdout:
                response = json.loads(result.stdout.strip())
                if response.get('success') and response.get('context_applied'):
                    return response.get('enhanced_prompt', user_prompt)

            return user_prompt

        except Exception as e:
            self._log_hook_activity('bridge_call_error', {
                'operation': 'context_injection',
                'error': str(e)
            })
            return user_prompt

    def _call_memory_bridge_storage(self, hook_context):
        """Call Node.js memory bridge for memory storage"""
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

            # Call Node.js bridge
            result = subprocess.run([
                'node', bridge_script, 'memory-storage', json.dumps(bridge_data)
            ], capture_output=True, text=True, timeout=15)

            if result.returncode == 0 and result.stdout:
                response = json.loads(result.stdout.strip())
                return response.get('success', False)

            return False

        except Exception as e:
            self._log_hook_activity('bridge_call_error', {
                'operation': 'memory_storage',
                'error': str(e)
            })
            return False

    def _call_memory_bridge_session_restore(self):
        """Call Node.js memory bridge for session context restoration"""
        try:
            bridge_script = os.path.join(self.project_dir, 'scripts', 'memory-bridge-runner.js')
            if not os.path.exists(bridge_script):
                return None

            # Prepare data for bridge call
            bridge_data = {
                'session_id': self.session_id,
                'project_id': 1  # Default project ID
            }

            # Call Node.js bridge
            result = subprocess.run([
                'node', bridge_script, 'session-restore', json.dumps(bridge_data)
            ], capture_output=True, text=True, timeout=10)

            if result.returncode == 0 and result.stdout:
                response = json.loads(result.stdout.strip())
                if response.get('success') and response.get('context_restored'):
                    return response.get('restored_context')

            return None

        except Exception as e:
            self._log_hook_activity('bridge_call_error', {
                'operation': 'session_restore',
                'error': str(e)
            })
            return None

    def _store_session_context(self, context):
        """Store restored session context for use in current session"""
        try:
            context_path = os.path.join(
                self.project_dir,
                '.devflow/session-context.md'
            )

            os.makedirs(os.path.dirname(context_path), exist_ok=True)

            with open(context_path, 'w') as f:
                f.write(context)

        except Exception as e:
            self._log_hook_activity('context_storage_error', {'error': str(e)})

    def _check_dual_trigger_integration(self, user_prompt):
        """Check if dual-trigger context restoration should be activated"""
        try:
            # Check if there's a saved session state from dual-trigger
            trigger_metadata_path = os.path.join(
                self.project_dir,
                '.devflow/dual-trigger-log.json'
            )

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
            self._log_hook_activity('dual_trigger_check_error', {'error': str(e)})
            return None

    def _handle_dual_trigger_context_restoration(self, user_prompt, dual_trigger_context):
        """Handle context restoration using dual-trigger saved state"""
        try:
            # Call TypeScript cross-session memory bridge for restoration
            bridge_script = os.path.join(self.project_dir, 'scripts', 'memory-bridge-runner.js')
            if not os.path.exists(bridge_script):
                return user_prompt

            # Prepare data for cross-session restoration
            bridge_data = {
                'operation': 'session_restoration',
                'session_id': dual_trigger_context['session_id'],
                'project_id': 1,  # Default project ID
                'trigger_type': dual_trigger_context['trigger_type']
            }

            # Call Node.js bridge for session restoration
            result = subprocess.run([
                'node', bridge_script, 'session-restoration', json.dumps(bridge_data)
            ], capture_output=True, text=True, timeout=15)

            if result.returncode == 0 and result.stdout:
                response = json.loads(result.stdout.strip())

                if response.get('success') and response.get('data', {}).get('contextRestored'):
                    restored_context = response['data']['restoredContext']
                    context_quality = response['data'].get('contextQuality', 0)

                    if restored_context and context_quality > 0.3:  # Minimum quality threshold
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

                        # Mark context as restored in trigger log
                        self._mark_trigger_context_restored(dual_trigger_context['session_id'])

                        return enhanced_prompt

            return user_prompt

        except Exception as e:
            self._log_hook_activity('dual_trigger_restoration_error', {
                'error': str(e),
                'session_id': dual_trigger_context.get('session_id', 'unknown')
            })
            return user_prompt

    def _mark_trigger_context_restored(self, session_id):
        """Mark dual-trigger context as restored to prevent duplicate restoration"""
        try:
            trigger_metadata_path = os.path.join(
                self.project_dir,
                '.devflow/dual-trigger-log.json'
            )

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
            self._log_hook_activity('mark_restoration_error', {'error': str(e)})

    def _should_activate_context_injection(self, user_prompt):
        """Determine if natural language prompt should trigger context injection"""
        try:
            prompt_lower = user_prompt.lower().strip()

            # Skip very short prompts
            if len(prompt_lower) < 15:
                return False

            # Skip if already a slash command (handled elsewhere)
            if prompt_lower.startswith('/'):
                return False

            # Pattern categories that indicate need for context

            # 1. Questions about implementation/architecture
            implementation_patterns = [
                r'\b(cosa|what)\s+(abbiamo|have we)\s+(fatto|done|implementato|implemented)\b',
                r'\b(come|how)\s+(funziona|works?|è implementato|is implemented)\b',
                r'\b(quali|which|what)\s+.*(cambiamenti|changes|modifiche|updates)\b',
                r'\b(status|stato)\s+(del|of)\s+(progetto|project|sistema|system)\b',
                r'\b(progresso|progress|avanzamento|advancement)\b',
                r'\banalizza.*architettura\b',
                r'\bintegra.*con\b',
                r'\bcome.*si.*integra\b'
            ]

            # 2. Technical analysis requests
            analysis_patterns = [
                r'\banalizza\b.*\b(sistema|system|architettura|architecture|codice|code)\b',
                r'\b(confronta|compare|compara)\b.*\b(con|with|patterns?)\b',
                r'\b(esamina|examine|studia|study)\b.*\b(implementazione|implementation)\b',
                r'\b(documenta|document)\b.*\b(integrazione|integration)\b'
            ]

            # 3. Task and project queries
            task_patterns = [
                r'\b(critical.?issues?.?todos?|task|compito|attività)\b',
                r'\b(per\s+implementare|to\s+implement|implementazione\s+di)\b',
                r'\b(memoria|memory).*\b(sistema|system|integrazione|integration)\b',
                r'\b(enhanced.*memory|kernel.*memory|microsoft.*patterns)\b'
            ]

            # 4. System status and debugging
            debug_patterns = [
                r'\b(problema|problem|issue|errore|error)\b.*\b(log|sessione|session)\b',
                r'\b(hook|trigger|attiva|attivare|activate)\b.*\b(memory|memoria)\b',
                r'\b(perché|why|because).*\b(non|not|doesn\'t)\s+(si\s+attiva|activate)\b'
            ]

            all_patterns = implementation_patterns + analysis_patterns + task_patterns + debug_patterns

            # Check if any pattern matches
            import re
            for pattern in all_patterns:
                if re.search(pattern, prompt_lower, re.IGNORECASE | re.MULTILINE):
                    self._log_hook_activity('natural_language_pattern_matched', {
                        'pattern': pattern,
                        'prompt_length': len(user_prompt),
                        'activation_reason': 'semantic_pattern_detection'
                    })
                    return True

            # 5. Keyword-based fallback (less strict)
            context_keywords = [
                'implementazione', 'implementation', 'architettura', 'architecture',
                'sistema', 'system', 'memoria', 'memory', 'integrazione', 'integration',
                'critical-issues', 'kernel-memory', 'enhanced-memory', 'patterns',
                'problema', 'problem', 'soluzione', 'solution', 'hook', 'trigger'
            ]

            keyword_count = sum(1 for keyword in context_keywords if keyword in prompt_lower)
            if keyword_count >= 2:  # At least 2 relevant keywords
                self._log_hook_activity('natural_language_keywords_matched', {
                    'keyword_count': keyword_count,
                    'activation_reason': 'keyword_threshold_met'
                })
                return True

            return False

        except Exception as e:
            self._log_hook_activity('pattern_detection_error', {'error': str(e)})
            # Default to activation on error to be safe
            return True

    def _is_debug_mode_enabled(self):
        """Check if debug mode is enabled for visible context injection"""
        try:
            debug_file = os.path.join(
                self.project_dir,
                '.devflow/enhanced-memory-debug.json'
            )

            if os.path.exists(debug_file):
                with open(debug_file, 'r') as f:
                    debug_config = json.load(f)
                    return debug_config.get('show_context_injection', False)

            return False

        except:
            return False


def main():
    """Main hook entry point"""
    if len(sys.argv) < 2:
        # No hook type provided; treat as a no-op to avoid noisy warnings.
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
            # Use select to avoid blocking indefinitely
            import select
            if select.select([sys.stdin], [], [], 0.1)[0]:
                hook_data = json.loads(sys.stdin.read())
        except (json.JSONDecodeError, ImportError):
            pass

    # Initialize hook handler
    hook = EnhancedMemoryIntegrationHook()

    # Route to appropriate handler
    if hook_type == "UserPromptSubmit":
        enhanced_data = hook.handle_user_prompt_submit(hook_data)
        print(json.dumps(enhanced_data))

    elif hook_type == "PostToolUse":
        hook.handle_post_tool_use(hook_data)

    elif hook_type == "SessionStart":
        context = hook.handle_session_start()
        if context:
            print(context)

    else:
        hook._log_hook_activity('unknown_hook_type', {'hook_type': hook_type})


if __name__ == "__main__":
    main()
