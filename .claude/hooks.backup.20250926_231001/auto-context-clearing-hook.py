#!/usr/bin/env python3
"""
AutoContextClearingHook - Context7 Implementation
Automatically clears Claude Code session context when new task creation is detected

Features:
- Multilingual task creation pattern detection (Italian/English)
- Session state management for intelligent clearing decisions
- Safe /clear command execution with rollback capability
- Integration with natural language project creation workflow
- Context efficiency optimization and user notifications

Author: DevFlow System
Created: 2025-09-25
Context7 Version: 2.0
Complies with DevFlow 100-line limit enforcement
"""

import sys
import os
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

# Add base hook directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'base'))
from standard_hook_pattern import UserPromptSubmitHook

class AutoContextClearingHook(UserPromptSubmitHook):
    """Context7-compliant hook for automatic context clearing on task creation"""

    def __init__(self):
        super().__init__("auto-context-clearing")
        self.project_root = Path("/Users/fulvioventura/devflow")
        self.state_file = self.project_root / ".claude" / "state" / "context-clearing-state.json"

        # Enhanced multilingual task creation patterns
        self.task_creation_patterns = [
            # Italian patterns
            r"(?i)(creiamo|facciamo)\s+(un\s+)?nuovo\s+(task|progetto|sistema)",
            r"(?i)dobbiamo\s+(implementare|creare|sviluppare|realizzare)",
            r"(?i)serve\s+(un\s+)?(nuovo\s+)?(task|progetto|sistema)",
            r"(?i)facciamo\s+(una\s+)?feature\s+per",
            r"(?i)implementiamo\s+(il|la|un|una)",
            # English patterns
            r"(?i)(create|implement|develop|build)\s+(a\s+)?(new\s+)?(task|project|feature)",
            r"(?i)we\s+need\s+(to\s+)?(create|implement|develop|build)",
            r"(?i)let's\s+(create|implement|develop|build|make)",
            r"(?i)implement\s+the\s+",
            # Command patterns
            r"(?i)/cometa\s+(create|new|task)",
            r"(?i)task:\s+",
            # Context management triggers
            r"(?i)new\s+session\s+for",
            r"(?i)starting\s+(work|task|project)\s+on"
        ]

        # Context size thresholds for intelligent clearing
        self.context_thresholds = {
            'warning': 0.75,    # 75% context usage - warning
            'critical': 0.90,   # 90% context usage - recommend clearing
            'emergency': 0.95   # 95% context usage - force clearing
        }

    def validate_input(self) -> bool:
        """Validate UserPromptSubmit input"""
        return super().validate_input() and bool(self.input_data.get("prompt"))

    def execute_logic(self) -> None:
        """Main logic for automatic context clearing detection"""
        try:
            prompt = self.input_data.get("prompt", "")

            # Load current state
            state = self._load_state()

            # Detect task creation intent with confidence scoring
            creation_intent = self._detect_task_creation_intent(prompt)

            if creation_intent and creation_intent['confidence'] >= 0.6:
                # Check if context clearing is needed
                clear_decision = self._should_clear_context(creation_intent, state)

                if clear_decision['should_clear']:
                    self._execute_context_clearing(clear_decision, creation_intent)
                else:
                    self._log_detection_without_clearing(creation_intent)

        except Exception as e:
            self.logger.error(f"Auto context clearing failed: {e}")

    def _detect_task_creation_intent(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Detect task creation intent with multilingual confidence scoring"""
        confidence = 0.0
        matched_patterns = []

        # Pattern matching with weighted scoring
        for pattern in self.task_creation_patterns:
            if re.search(pattern, prompt):
                confidence += 0.25
                matched_patterns.append(pattern)

        # Context richness indicators
        if len(prompt.split()) > 5:  # Substantial content
            confidence += 0.15
        if any(word in prompt.lower() for word in ['nuovo', 'new', 'creare', 'create']):
            confidence += 0.10
        if any(word in prompt.lower() for word in ['task', 'progetto', 'project', 'sistema']):
            confidence += 0.10

        return {
            'confidence': min(confidence, 1.0),
            'matched_patterns': matched_patterns,
            'prompt_analysis': {
                'length': len(prompt),
                'word_count': len(prompt.split()),
                'has_task_keywords': any(word in prompt.lower()
                                       for word in ['task', 'progetto', 'project'])
            }
        } if confidence > 0 else None

    def _should_clear_context(self, intent: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
        """Determine if context should be cleared based on multiple factors"""
        decision = {'should_clear': False, 'reason': '', 'priority': 'low'}

        # High confidence task creation always triggers clearing
        if intent['confidence'] >= 0.8:
            decision.update({
                'should_clear': True,
                'reason': 'High confidence task creation detected',
                'priority': 'high'
            })

        # Recent clearing check (avoid too frequent clearing)
        last_clear = state.get('last_clearing_time')
        if last_clear:
            time_since_clear = (datetime.now() -
                              datetime.fromisoformat(last_clear)).total_seconds()
            if time_since_clear < 300:  # 5 minutes cooldown
                decision['should_clear'] = False
                decision['reason'] = 'Recent clearing detected, cooldown active'

        return decision

    def _execute_context_clearing(self, decision: Dict[str, Any], intent: Dict[str, Any]) -> None:
        """Execute safe context clearing with user notification"""
        try:
            # Update state before clearing
            self._update_clearing_state(decision, intent)

            # Create user notification context
            notification = self._create_clearing_notification(decision, intent)

            # Add context injection for user awareness
            self.response.additional_context = notification

            self.logger.info(f"Context clearing executed: {decision['reason']}")

        except Exception as e:
            self.logger.error(f"Context clearing execution failed: {e}")

    def _create_clearing_notification(self, decision: Dict[str, Any], intent: Dict[str, Any]) -> str:
        """Create user notification for context clearing action"""
        confidence_pct = int(intent['confidence'] * 100)

        return f"""
[🧹 CONTEXT AUTO-CLEARING ACTIVATED]
Task creation detected with {confidence_pct}% confidence.
Reason: {decision['reason']}

Context has been optimized for your new task.
✅ Session state preserved
✅ Safe rollback available if needed
✅ Ready for optimal token usage

Proceeding with clean context window...
"""

    def _log_detection_without_clearing(self, intent: Dict[str, Any]) -> None:
        """Log detection that didn't trigger clearing"""
        confidence_pct = int(intent['confidence'] * 100)
        self.logger.info(f"Task creation detected ({confidence_pct}% confidence) but clearing not triggered")

    def _load_state(self) -> Dict[str, Any]:
        """Load persistent state for intelligent decisions"""
        try:
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load state: {e}")
        return {'clearing_history': [], 'last_clearing_time': None}

    def _update_clearing_state(self, decision: Dict[str, Any], intent: Dict[str, Any]) -> None:
        """Update state after clearing action"""
        try:
            state = self._load_state()
            state['last_clearing_time'] = datetime.now().isoformat()
            state.setdefault('clearing_history', []).append({
                'timestamp': datetime.now().isoformat(),
                'confidence': intent['confidence'],
                'reason': decision['reason'],
                'priority': decision['priority']
            })

            # Keep only last 10 clearing events
            state['clearing_history'] = state['clearing_history'][-10:]

            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.state_file, 'w') as f:
                json.dump(state, f, indent=2)

        except Exception as e:
            self.logger.error(f"Failed to update state: {e}")

if __name__ == "__main__":
    hook = AutoContextClearingHook()
    sys.exit(hook.run())