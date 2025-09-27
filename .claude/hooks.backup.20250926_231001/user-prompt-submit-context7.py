#!/usr/bin/env python3
"""
UserPromptSubmit Hook Context7 - Critical Implementation
Replaces user-messages.py with Context7-compliant architecture

Features:
- DAIC trigger phrase processing and mode switching
- /cometa command detection and processing
- Context injection with security filtering
- Protocol detection and routing
- Token usage monitoring and warnings
- Task detection and creation suggestions
"""

import sys
import os
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import UserPromptSubmitHook, HookDecision

class UserPromptSubmitContext7Hook(UserPromptSubmitHook):
    """Context7-compliant UserPromptSubmit hook with enhanced functionality"""

    def __init__(self):
        super().__init__("user-prompt-submit-context7")
        self.project_root = Path("/Users/fulvioventura/devflow")
        self.config_file = self.project_root / "sessions" / "sessions-config.json"
        self.daic_state_file = self.project_root / ".claude" / "state" / "daic-mode.json"

        # Load configuration
        self.config = self._load_config()

        # Default trigger phrases
        self.default_trigger_phrases = ["make it so", "run that", "yert"]
        self.trigger_phrases = self.config.get("trigger_phrases", self.default_trigger_phrases)

    def validate_input(self) -> bool:
        """Validate UserPromptSubmit input"""
        if not super().validate_input():
            return False

        prompt = self.input_data.get("prompt")
        if not prompt:
            self.logger.warning("No prompt provided in UserPromptSubmit hook")
            return False

        # Log prompt for security analysis
        self.logger.debug(f"Processing prompt: {prompt[:100]}...")
        return True

    def execute_logic(self) -> None:
        """Main logic for UserPromptSubmit processing"""
        try:
            prompt = self.input_data.get("prompt", "")
            transcript_path = self.input_data.get("transcript_path", "")

            context_additions = []

            # 1. Process /cometa commands
            if prompt.strip().startswith('/cometa'):
                context_additions.append(self._process_cometa_command(prompt))

            # 2. Handle API mode and ultrathink injection
            if not self._is_add_trigger_command(prompt):
                context_additions.extend(self._handle_api_mode())

            # 3. Process DAIC mode and triggers
            context_additions.extend(self._process_daic_mode(prompt))

            # 4. Monitor token usage and add warnings
            if transcript_path:
                context_additions.extend(self._monitor_token_usage(transcript_path))

            # 5. Detect Context7 documentation needs
            context_additions.extend(self._detect_context7_needs(prompt))

            # 6. ENHANCED MEMORY INTEGRATION - Context7 Automatic Injection
            context_additions.extend(self._inject_enhanced_memory_context(prompt))

            # 7. Detect protocol triggers
            context_additions.extend(self._detect_protocol_triggers(prompt))

            # 7. Detect potential tasks
            context_additions.extend(self._detect_task_creation(prompt))

            # 8. Security filtering
            filtered_context = self._apply_security_filters(context_additions)

            # 9. Build response
            if filtered_context:
                self.response.metadata.update({
                    'context_injected': True,
                    'context_length': len(''.join(filtered_context)),
                    'processors_triggered': len([c for c in filtered_context if c.strip()])
                })

                # Set hookSpecificOutput for Context7 compliance
                self.response.hook_specific_output = {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": ''.join(filtered_context)
                }

            self.logger.info(f"UserPromptSubmit processed: {len(filtered_context)} context additions")

        except Exception as e:
            self.logger.error(f"UserPromptSubmit processing failed: {e}")
            # Continue execution even if processing fails

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from sessions-config.json"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            self.logger.warning(f"Failed to load config: {e}")
        return {}

    def _process_cometa_command(self, prompt: str) -> str:
        """Process /cometa commands for NLP delegation"""
        try:
            # Extract command after /cometa
            command = prompt.strip()[7:].strip()  # Remove '/cometa '

            if not command:
                return "\n[COMETA] /cometa command detected but no parameters provided. Usage: /cometa <natural language task>\n"

            # Log cometa command for processing
            cometa_log = {
                'timestamp': datetime.now().isoformat(),
                'command': command,
                'session_id': self.input_data.get('session_id'),
                'processed': True
            }

            cometa_log_file = self.project_root / ".claude" / "state" / "cometa-commands.jsonl"
            cometa_log_file.parent.mkdir(parents=True, exist_ok=True)

            with open(cometa_log_file, 'a') as f:
                f.write(json.dumps(cometa_log) + '\n')

            return f"\n[COMETA BRAIN] Processing command: '{command}' - Delegating to natural language task processor\n"

        except Exception as e:
            self.logger.error(f"Cometa command processing failed: {e}")
            return "\n[COMETA ERROR] Failed to process /cometa command\n"

    def _is_add_trigger_command(self, prompt: str) -> bool:
        """Check if this is an /add-trigger command"""
        return prompt.strip().startswith('/add-trigger')

    def _handle_api_mode(self) -> List[str]:
        """Handle API mode and ultrathink injection"""
        context_additions = []

        if not self.config.get("api_mode", False):
            context_additions.append("[[ ultrathink ]]\n")

        return context_additions

    def _process_daic_mode(self, prompt: str) -> List[str]:
        """Process DAIC mode switching and triggers"""
        context_additions = []

        try:
            current_mode = self._check_daic_mode()

            # Implementation triggers (only work in discussion mode)
            if not self._is_add_trigger_command(prompt) and current_mode:
                if any(phrase in prompt.lower() for phrase in self.trigger_phrases):
                    self._set_daic_mode(False)  # Switch to implementation
                    context_additions.append(
                        "[DAIC: Implementation Mode Activated] You may now implement ONLY the immediately discussed steps. "
                        "DO NOT take **any** actions beyond what was explicitly agreed upon. If instructions were vague, "
                        "consider the bounds of what was requested and *DO NOT* cross them. When you're done, run the command: daic\n"
                    )

            # Emergency stop (works in any mode)
            if any(word in prompt for word in ["SILENCE", "STOP"]):  # Case sensitive
                self._set_daic_mode(True)  # Force discussion mode
                context_additions.append(
                    "[DAIC: EMERGENCY STOP] All tools locked. You are now in discussion mode. Re-align with your pair programmer.\n"
                )

            # Iterloop detection
            if "iterloop" in prompt.lower():
                context_additions.append(
                    "You have been instructed to iteratively loop over a list. Identify what list the user is referring to, "
                    "then follow this loop: present one item, wait for the user to respond with questions and discussion points, "
                    "only continue to the next item when the user explicitly says 'continue' or something similar\n"
                )

        except Exception as e:
            self.logger.error(f"DAIC processing failed: {e}")

        return context_additions

    def _check_daic_mode(self) -> bool:
        """Check current DAIC mode"""
        try:
            if self.daic_state_file.exists():
                with open(self.daic_state_file, 'r') as f:
                    state = json.load(f)
                    return state.get('discussion_mode', True)
        except:
            pass
        return True  # Default to discussion mode

    def _set_daic_mode(self, discussion_mode: bool) -> None:
        """Set DAIC mode"""
        try:
            self.daic_state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.daic_state_file, 'w') as f:
                json.dump({
                    'discussion_mode': discussion_mode,
                    'last_updated': datetime.now().isoformat()
                }, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to set DAIC mode: {e}")

    def _monitor_token_usage(self, transcript_path: str) -> List[str]:
        """Monitor token usage and provide warnings"""
        context_additions = []

        try:
            if not os.path.exists(transcript_path):
                return context_additions

            context_length = self._get_context_length_from_transcript(transcript_path)

            if context_length > 0:
                # Calculate percentage of usable context (160k practical limit)
                usable_percentage = (context_length / 160000) * 100

                # Check for warning flag files
                warning_75_flag = self.project_root / ".claude" / "state" / "context-warning-75.flag"
                warning_90_flag = self.project_root / ".claude" / "state" / "context-warning-90.flag"

                # Token warnings (only show once per session)
                if usable_percentage >= 90 and not warning_90_flag.exists():
                    context_additions.append(
                        f"\n[90% WARNING] {context_length:,}/160,000 tokens used ({usable_percentage:.1f}%). "
                        "CRITICAL: Run sessions/protocols/task-completion.md to wrap up this task cleanly!\n"
                    )
                    warning_90_flag.parent.mkdir(parents=True, exist_ok=True)
                    warning_90_flag.touch()
                elif usable_percentage >= 75 and not warning_75_flag.exists():
                    context_additions.append(
                        f"\n[{usable_percentage:.0f}% WARNING] {context_length:,}/160,000 tokens used ({usable_percentage:.1f}%). "
                        "Context is getting low. Be aware of coming context compaction trigger.\n"
                    )
                    warning_75_flag.parent.mkdir(parents=True, exist_ok=True)
                    warning_75_flag.touch()

        except Exception as e:
            self.logger.error(f"Token monitoring failed: {e}")

        return context_additions

    def _get_context_length_from_transcript(self, transcript_path: str) -> int:
        """Get current context length from transcript"""
        try:
            with open(transcript_path, 'r') as f:
                lines = f.readlines()

            most_recent_usage = None
            most_recent_timestamp = None

            # Parse each JSONL entry
            for line in lines:
                try:
                    data = json.loads(line.strip())
                    # Skip sidechain entries
                    if data.get('isSidechain', False):
                        continue

                    # Check if this entry has usage data
                    if data.get('message', {}).get('usage'):
                        entry_time = data.get('timestamp')
                        if entry_time and (not most_recent_timestamp or entry_time > most_recent_timestamp):
                            most_recent_timestamp = entry_time
                            most_recent_usage = data['message']['usage']
                except json.JSONDecodeError:
                    continue

            # Calculate context length from most recent usage
            if most_recent_usage:
                return (
                    most_recent_usage.get('input_tokens', 0) +
                    most_recent_usage.get('cache_read_input_tokens', 0) +
                    most_recent_usage.get('cache_creation_input_tokens', 0)
                )
        except Exception:
            pass
        return 0

    def _detect_context7_needs(self, prompt: str) -> List[str]:
        """Detect when Context7 documentation is needed using Microsoft Kernel Memory patterns"""
        context_additions = []

        if not self.config.get("context7_detection", {}).get("enabled", True):
            return context_additions

        try:
            # ENHANCED TRIGGERS - Microsoft Kernel Memory patterns (Context7 compliance)

            # 1. Documentation/Analysis request patterns
            analysis_patterns = [
                r'(?i)(analisi|analysis|analyze|best practice|practice|pattern|approach)',
                r'(?i)(how to|what is|explain|documentation|docs|api reference|guide)',
                r'(?i)(usage|example|tutorial|reference|implement|integration)',
                r'(?i)(error|failed|not working|issue|broken|bug|troubleshoot)',
                r'(?i)(setup|configure|install|deploy|production|ready)',
                r'(?i)(gap|missing|improve|optimize|enhance|upgrade)',
                r'(?i)(architecture|design|structure|framework|system)',
                r'(?i)(context|memory|injection|hook|trigger|activation)'
            ]

            # 2. Technical conversation patterns (should auto-trigger Context7)
            technical_conversation_patterns = [
                r'(?i)(microsoft kernel memory|kernel memory|memory patterns)',
                r'(?i)(context injection|automatic injection|memory integration)',
                r'(?i)(production ready|enterprise|scalability|performance)',
                r'(?i)(vector embedding|semantic search|relevance scoring)',
                r'(?i)(claude code|native context|context system replacement)',
                r'(?i)(hook.*activation|trigger.*sensitivity|automatic.*trigger)',
                r'(?i)(database.*query|sqlite|cometa|memory.*stream)',
                r'(?i)(natural language|nlp|semantic.*analysis|keyword.*extraction)'
            ]

            # 3. Technology ecosystem patterns (expanded with DevFlow-specific terms)
            tech_patterns = [
                r'(?i)(react|vue|angular|svelte|next\.?js|nuxt|gatsby)',
                r'(?i)(typescript|javascript|python|node\.?js|rust|go|java)',
                r'(?i)(express|fastify|koa|nest\.?js|django|flask)',
                r'(?i)(mongodb|postgres|mysql|redis|sqlite|elasticsearch)',
                r'(?i)(docker|kubernetes|aws|gcp|azure|terraform)',
                r'(?i)(git|github|gitlab|bitbucket|ci/cd)',
                r'(?i)(jest|mocha|cypress|playwright|testing|pytest)',
                r'(?i)(webpack|vite|rollup|parcel|esbuild|babel)',
                r'(?i)(tailwind|css|scss|sass|styled|emotion)',
                r'(?i)(api|rest|graphql|websocket|grpc|microservice)',
                r'(?i)(auth|oauth|jwt|session|security|encryption)',
                r'(?i)(deployment|pipeline|build|automation|devops)',
                # DevFlow-specific patterns (HIGH PRIORITY)
                r'(?i)(vector.*embedding|embedding.*vector|semantic.*search)',
                r'(?i)(ollama|embeddinggemma|cosine.*similarity|performance.*optimization)',
                r'(?i)(devflow|cometa|claude.*code|memory.*integration)',
                r'(?i)(enhanced.*memory|context.*injection|hook.*system)'
            ]

            # 4. Error/Problem patterns
            error_patterns = [
                r'(?i)(cannot find|module not found|import.*error|dependency)',
                r'(?i)(type.*error|syntax.*error|reference.*error|runtime)',
                r'(?i)(undefined|null reference|missing|not found)',
                r'(?i)(configuration|config.*error|setup.*failed)',
                r'(?i)(version.*conflict|compatibility|breaking.*change)',
                r'(?i)(permission.*denied|access.*error|authentication)',
                r'(?i)(timeout|connection|network|cors|ssl)'
            ]

            # ADVANCED TRIGGERING LOGIC (Microsoft Kernel Memory inspired)

            # Check analysis/documentation requests
            has_analysis_request = any(re.search(pattern, prompt) for pattern in analysis_patterns)

            # Check technical conversation patterns (HIGH PRIORITY - should always trigger)
            has_technical_conversation = any(re.search(pattern, prompt) for pattern in technical_conversation_patterns)

            # Check mentioned technologies
            mentioned_techs = []
            for pattern in tech_patterns:
                matches = re.findall(pattern, prompt, re.IGNORECASE)
                mentioned_techs.extend(matches)

            # Check error patterns
            has_error_pattern = any(re.search(pattern, prompt) for pattern in error_patterns)

            # TRIGGER DECISION ENGINE (based on Microsoft Kernel Memory "Verdict" system)
            trigger_score = 0
            trigger_reasons = []

            # Score calculation
            if has_technical_conversation:
                trigger_score += 100  # Always trigger for technical conversations
                trigger_reasons.append("technical_conversation_detected")

            if has_analysis_request:
                trigger_score += 60
                trigger_reasons.append("analysis_request")

            if len(mentioned_techs) >= 2:
                trigger_score += 40
                trigger_reasons.append("multiple_technologies")
            elif len(mentioned_techs) >= 1:
                trigger_score += 20
                trigger_reasons.append("single_technology")

            if has_error_pattern:
                trigger_score += 30
                trigger_reasons.append("error_pattern")

            # Length-based scoring (longer prompts more likely to need context)
            if len(prompt) > 200:
                trigger_score += 10
                trigger_reasons.append("long_prompt")

            # CONTEXT7 ACTIVATION THRESHOLD (Microsoft Kernel Memory pattern)
            activation_threshold = 35  # Enhanced sensitivity for DevFlow technical queries

            if trigger_score >= activation_threshold:
                unique_techs = list(set([tech.lower() for tech in mentioned_techs]))

                if has_technical_conversation:
                    context_additions.append(
                        f"\n[Context7 AUTO-TRIGGER] Technical conversation detected (Score: {trigger_score})\n"
                        f"Reasons: {', '.join(trigger_reasons)}\n"
                        f"Auto-activating Context7 for: {', '.join(unique_techs) if unique_techs else 'general technical context'}\n"
                        f"Using Microsoft Kernel Memory patterns for context injection.\n"
                    )
                elif has_analysis_request and mentioned_techs:
                    context_additions.append(
                        f"\n[Context7 Documentation Needed] Analysis/documentation request for {', '.join(unique_techs)}\n"
                        f"Score: {trigger_score} | Reasons: {', '.join(trigger_reasons)}\n"
                        f"Consider using: mcp__context7__resolve-library-id, mcp__context7__get-library-docs\n"
                    )
                elif has_error_pattern and mentioned_techs:
                    context_additions.append(
                        f"\n[Context7 Error Resolution] Technical issue detected with {', '.join(unique_techs)}\n"
                        f"Score: {trigger_score} | Auto-triggering Context7 for troubleshooting assistance.\n"
                    )
                elif len(mentioned_techs) >= 2:
                    context_additions.append(
                        f"\n[Context7 Integration Docs] Multi-technology integration: {', '.join(unique_techs)}\n"
                        f"Score: {trigger_score} | Context7 can provide integration patterns.\n"
                    )

            # Enhanced logging with trigger scoring
            if context_additions or trigger_score > 25:  # Log near-misses too
                self._log_context7_detection(prompt, mentioned_techs, has_analysis_request,
                                           has_error_pattern, trigger_score, trigger_reasons)

        except Exception as e:
            self.logger.error(f"Enhanced Context7 detection failed: {e}")

        return context_additions

    def _log_context7_detection(self, prompt: str, techs: List[str], doc_request: bool,
                              error_pattern: bool, trigger_score: int = 0, trigger_reasons: List[str] = None) -> None:
        """Log Context7 detection events with enhanced analytics"""
        try:
            detection_log = {
                'timestamp': datetime.now().isoformat(),
                'trigger_type': 'context7_enhanced_detection',
                'technologies_detected': list(set([tech.lower() for tech in techs])),
                'has_documentation_request': doc_request,
                'has_error_pattern': error_pattern,
                'trigger_score': trigger_score,
                'trigger_reasons': trigger_reasons or [],
                'activation_threshold': 50,
                'activated': trigger_score >= 50,
                'prompt_length': len(prompt),
                'session_id': self.input_data.get('session_id', 'unknown'),
                'improvement_version': 'context7_kernel_memory_v2'
            }

            log_file = self.project_root / ".claude" / "state" / "context7-detections.jsonl"
            log_file.parent.mkdir(parents=True, exist_ok=True)

            with open(log_file, 'a') as f:
                f.write(json.dumps(detection_log) + '\n')

        except Exception as e:
            self.logger.error(f"Enhanced Context7 detection logging failed: {e}")

    def _detect_protocol_triggers(self, prompt: str) -> List[str]:
        """Detect protocol triggers and add context"""
        context_additions = []
        prompt_lower = prompt.lower()

        # Context compaction detection
        if any(phrase in prompt_lower for phrase in ["compact", "restart session", "context compaction"]):
            context_additions.append(
                "If the user is asking to compact context, read and follow sessions/protocols/context-compaction.md protocol.\n"
            )

        # Task completion detection
        if any(phrase in prompt_lower for phrase in ["complete the task", "finish the task", "task is done",
                                                       "mark as complete", "close the task", "wrap up the task"]):
            context_additions.append(
                "If the user is asking to complete the task, read and follow sessions/protocols/task-completion.md protocol.\n"
            )

        # Task creation detection
        if any(phrase in prompt_lower for phrase in ["create a new task", "create a task", "make a task",
                                                       "new task for", "add a task"]):
            context_additions.append(
                "If the user is asking to create a task, read and follow sessions/protocols/task-creation.md protocol.\n"
            )

        # Task switching detection
        if any(phrase in prompt_lower for phrase in ["switch to task", "work on task", "change to task"]):
            context_additions.append(
                "If the user is asking to switch tasks, read and follow sessions/protocols/task-startup.md protocol.\n"
            )

        return context_additions

    def _detect_task_creation(self, prompt: str) -> List[str]:
        """Detect potential task creation patterns"""
        context_additions = []

        if not self.config.get("task_detection", {}).get("enabled", True):
            return context_additions

        task_patterns = [
            r"(?i)we (should|need to|have to) (implement|fix|refactor|migrate|test|research)",
            r"(?i)create a task for",
            r"(?i)add this to the (task list|todo|backlog)",
            r"(?i)we'll (need to|have to) (do|handle|address) (this|that) later",
            r"(?i)that's a separate (task|issue|problem)",
            r"(?i)file this as a (bug|task|issue)"
        ]

        task_mentioned = any(re.search(pattern, prompt) for pattern in task_patterns)

        if task_mentioned:
            context_additions.append("""
[Task Detection Notice]
The message may reference something that could be a task.

IF you or the user have discovered a potential task that is sufficiently unrelated to the current task, ask if they'd like to create a task file.

Tasks are:
• More than a couple commands to complete
• Semantically distinct units of work
• Work that takes meaningful context
• Single focused goals (not bundled multiple goals)
• Things that would take multiple days should be broken down
• NOT subtasks of current work (those go in the current task file/directory)

If they want to create a task, follow the task creation protocol.
""")

        return context_additions

    def _apply_security_filters(self, context_additions: List[str]) -> List[str]:
        """Apply security filters to context additions"""
        filtered = []

        for context in context_additions:
            # Check for potential security issues
            if self._is_security_safe(context):
                filtered.append(context)
            else:
                self.logger.warning(f"Filtered potentially unsafe context: {context[:50]}...")

        return filtered

    def _inject_enhanced_memory_context(self, prompt: str) -> List[str]:
        """
        Inject enhanced memory context using Microsoft Kernel Memory patterns.
        Automatically queries Cometa database for relevant context based on prompt analysis.
        """
        context_additions = []

        try:
            # Check if enhanced memory injection is enabled
            if not self.config.get("enhanced_memory", {}).get("enabled", True):
                return context_additions

            self.logger.info("Enhanced Memory Integration: Starting automatic context injection")

            # Extract key terms from prompt for semantic search
            key_terms = self._extract_semantic_keywords(prompt)
            if not key_terms:
                return context_additions

            # Query Cometa database for relevant context
            relevant_contexts = self._query_cometa_memory(key_terms, prompt)

            if relevant_contexts:
                context_additions.append(
                    f"\n[Enhanced Memory Context - {len(relevant_contexts)} items]\n" +
                    "\n".join(relevant_contexts) + "\n"
                )

                self.logger.info(f"Enhanced Memory: Injected {len(relevant_contexts)} relevant contexts")
            else:
                self.logger.debug("Enhanced Memory: No relevant context found")

        except Exception as e:
            self.logger.error(f"Enhanced Memory Integration failed: {e}")
            # Don't fail the hook if memory injection fails

        return context_additions

    def _extract_semantic_keywords(self, prompt: str) -> List[str]:
        """Extract semantic keywords using Microsoft Kernel Memory patterns"""
        try:
            # Enhanced stop words (multilingual - IT/EN)
            stop_words = {
                'the', 'is', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an',
                'il', 'la', 'le', 'lo', 'gli', 'un', 'una', 'di', 'da', 'in', 'con', 'su', 'per', 'fra', 'tra',
                'che', 'non', 'sono', 'hai', 'have', 'has', 'will', 'would', 'could', 'should', 'can', 'may',
                'this', 'that', 'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves'
            }

            # Technical term boosting (Microsoft Kernel Memory pattern)
            technical_boosters = [
                r'(?i)(context|memory|injection|hook|trigger|activation)',
                r'(?i)(database|sqlite|query|schema|table)',
                r'(?i)(kernel|microsoft|pattern|system|integration)',
                r'(?i)(semantic|search|relevance|score|embedding)',
                r'(?i)(production|enterprise|scalability|performance)',
                r'(?i)(claude|code|native|replacement|enhanced)',
                r'(?i)(automatic|intelligent|sensitivity|threshold)',
                r'(?i)(cometa|devflow|unified|orchestrator)'
            ]

            # Extract base words (minimum 3 characters, alphanumeric + technical symbols)
            words = re.findall(r'\b[a-zA-Z0-9._-]{3,}\b', prompt.lower())

            # Filter out stop words
            meaningful_words = [word for word in words if word not in stop_words]

            # Priority scoring for keywords (Microsoft Kernel Memory approach)
            keyword_scores = {}
            for word in meaningful_words:
                score = 1  # Base score

                # Boost technical terms
                for booster_pattern in technical_boosters:
                    if re.search(booster_pattern, word, re.IGNORECASE):
                        score += 3
                        break

                # Boost longer terms (more specific)
                if len(word) > 8:
                    score += 2
                elif len(word) > 5:
                    score += 1

                # Boost terms with numbers/special chars (technical identifiers)
                if re.search(r'[0-9._-]', word):
                    score += 1

                keyword_scores[word] = score

            # Sort by relevance score and return top keywords
            sorted_keywords = sorted(keyword_scores.keys(), key=lambda k: keyword_scores[k], reverse=True)

            # Return top 12 keywords (increased from 10 for better context coverage)
            return sorted_keywords[:12]

        except Exception as e:
            self.logger.error(f"Enhanced keyword extraction failed: {e}")
            return []

    def _query_cometa_memory(self, keywords: List[str], prompt: str) -> List[str]:
        """Query Cometa database for relevant memory contexts using Microsoft Kernel Memory patterns"""
        try:
            import sqlite3

            # Connect to Cometa database
            db_path = self.project_root / "data" / "devflow_unified.sqlite"
            if not db_path.exists():
                self.logger.warning(f"Cometa database not found: {db_path}")
                return []

            contexts = []

            with sqlite3.connect(str(db_path)) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # Query Cometa memory stream for relevant contexts (using correct schema)
                memory_search_conditions = []
                for keyword in keywords:
                    memory_search_conditions.append(f"cms.context_data LIKE '%{keyword}%'")

                memory_search_terms = " OR ".join(memory_search_conditions)

                memory_stream_query = f"""
                SELECT DISTINCT cms.context_data, cms.event_type, cms.created_at, cms.significance_score
                FROM cometa_memory_stream cms
                WHERE ({memory_search_terms})
                   AND cms.event_type IN ('task_creation', 'bug_fix', 'architecture', 'config')
                   AND LENGTH(cms.context_data) > 50
                ORDER BY cms.significance_score DESC, cms.created_at DESC
                LIMIT 3
                """

                cursor.execute(memory_stream_query)
                memory_results = cursor.fetchall()

                for row in memory_results:
                    context_entry = f"[Memory/{row['event_type'].title()}] {row['context_data'][:180]}..."
                    contexts.append(context_entry)

                # Query task contexts for current work-related context (using correct schema)
                task_search_conditions = []
                for keyword in keywords:
                    task_search_conditions.append(f"tc.title LIKE '%{keyword}%'")
                    task_search_conditions.append(f"tc.description LIKE '%{keyword}%'")

                task_search_terms = " OR ".join(task_search_conditions)

                task_context_query = f"""
                SELECT DISTINCT tc.title, tc.description, tc.created_at, tc.status
                FROM task_contexts tc
                JOIN tasks t ON tc.id = t.task_context_id
                WHERE ({task_search_terms})
                   AND t.status = 'in_progress'
                   AND LENGTH(tc.description) > 30
                ORDER BY tc.created_at DESC
                LIMIT 2
                """

                cursor.execute(task_context_query)
                task_results = cursor.fetchall()

                for row in task_results:
                    context_entry = f"[Task Context/{row['status']}] {row['title']}: {row['description'][:120]}..."
                    contexts.append(context_entry)

                # Query cometa patterns for solution patterns
                pattern_search_terms = " OR ".join([f"pattern_data LIKE '%{keyword}%'" for keyword in keywords])
                pattern_query = f"""
                SELECT pattern_name, pattern_data, success_rate, domain
                FROM cometa_patterns
                WHERE ({pattern_search_terms})
                   AND success_rate > 0.5
                ORDER BY success_rate DESC, created_at DESC
                LIMIT 2
                """

                cursor.execute(pattern_query)
                pattern_results = cursor.fetchall()

                for row in pattern_results:
                    context_entry = f"[Pattern/{row['domain']}] {row['pattern_name']}: {row['pattern_data'][:120]}... (Success: {row['success_rate']:.1%})"
                    contexts.append(context_entry)

            return contexts

        except Exception as e:
            self.logger.error(f"Cometa memory query failed: {e}")
            return []

    def _is_security_safe(self, context: str) -> bool:
        """Check if context is security safe"""
        # Basic security patterns to avoid
        dangerous_patterns = [
            r'rm\s+-rf\s+/',
            r'sudo\s+chmod\s+777',
            r'eval\s*\(',
            r'exec\s*\(',
            r'__import__\s*\(',
            r'os\.system\s*\(',
            r'subprocess\.call.*shell=True'
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, context, re.IGNORECASE):
                return False

        return True

if __name__ == "__main__":
    hook = UserPromptSubmitContext7Hook()
    sys.exit(hook.run())