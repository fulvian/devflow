#!/usr/bin/env python3
"""
Cometa Brain UserPromptSubmit Intelligence Hook
Intercetta e analizza prompt utente per intent detection e context injection
"""

import json
import sys
import sqlite3
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List
import hashlib

# Database configuration
DB_PATH = Path('./data/devflow_unified.sqlite')
LOG_DIR = Path('./.claude/logs/cometa-brain')

class IntentAnalyzer:
    """Analizza intent dei prompt utente usando pattern matching avanzato"""

    # Order matters: more specific patterns are checked first
    INTENT_PATTERNS = {
        'testing': [
            r'\b(test|write\s+tests?|add\s+tests?|create\s+tests?)\s+',
            r'\bunit\s+test|integration\s+test|e2e\s+test',
            r'\b(?:test\s+)?coverage',
        ],
        'documentation': [
            r'\b(document|write\s+docs?|add\s+documentation)\s+',
            r'\b(explain|describe)\s+(?:how|what|why)',
            r'\bREADME|docstring|comment',
            r'\badd\s+docstrings',
        ],
        'debugging': [
            r'\b(fix|debug|resolve|solve|troubleshoot|repair)\s+',
            r'\berror\s+(?:in|with|on)\s+',
            r'(?:not|isn\'t|won\'t)\s+working',
            r'(?:failing|failed|crash|crashes)',
        ],
        'refactoring': [
            r'\b(refactor|optimize|clean|reorganize)\s+',
            r'\bmake\s+(?:the\s+)?(?:code|it)\s+(?:better|faster|cleaner|more\s+efficient)',
            r'\bperformance\s+(?:optimization|improvement)',
            r'\bimprove\s+performance',
        ],
        'architecture': [
            r'\b(design|architect|plan|structure)\s+',
            r'\bhow\s+(?:should|would|to)\s+(?:I\s+)?(?:structure|organize|design)',
            r'\bbest\s+(?:practice|approach|way)\s+(?:to|for)',
        ],
        'task_creation': [
            r'\b(create|implement|build|develop)\s+(?:a\s+)?(?:new\s+)?(?:feature|function|component|task|module)',
            r'\b(implement|build|develop|create)\s+\w+',  # Simple "implement X" pattern
            r'\b(make|add)\s+(?:a\s+)?(?:new\s+)?(?:feature|function|component)',
            r'\b(?:I\s+)?(?:need|want)\s+to\s+(add|create|implement|build)',  # "I need to add X"
            r'\b(voglio|devo|bisogna)\s+(implementare|creare|fare|aggiungere)',
            r'(?:can you|could you|please)\s+(?:help me\s+)?(implement|create|build)',
        ],
    }

    def analyze(self, prompt: str) -> Dict[str, Any]:
        """
        Analizza il prompt e determina l'intent principale

        Returns:
            Dict con intent, confidence score, e metadata
        """
        prompt_lower = prompt.lower()
        results = []

        for intent_type, patterns in self.INTENT_PATTERNS.items():
            for idx, pattern in enumerate(patterns):
                if re.search(pattern, prompt_lower, re.IGNORECASE):
                    # Calcola confidence basata su numero di match e posizione del pattern
                    matches = len(re.findall(pattern, prompt_lower, re.IGNORECASE))
                    # Pattern più specifici (primi nella lista) hanno confidence più alta
                    base_confidence = 0.9 - (idx * 0.1)
                    confidence = min(1.0, base_confidence + (matches - 1) * 0.1)

                    # Boost per keyword esplicite
                    if any(word in prompt_lower for word in ['create a task', 'create task']):
                        confidence = min(1.0, confidence + 0.15)

                    results.append({
                        'type': intent_type,
                        'confidence': confidence,
                        'pattern': pattern
                    })

        # Ordina per confidence e prendi il migliore
        if results:
            results.sort(key=lambda x: x['confidence'], reverse=True)
            primary_intent = results[0]
        else:
            primary_intent = {'type': 'general', 'confidence': 0.5}

        return {
            'primary_intent': primary_intent['type'],
            'confidence': primary_intent.get('confidence', 0.5),
            'all_intents': results[:3],  # Top 3 intents
            'prompt_hash': hashlib.md5(prompt.encode()).hexdigest(),
            'analyzed_at': datetime.now().isoformat()
        }

class ContextInjector:
    """Gestisce l'iniezione intelligente di contesto basata su intent"""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def inject_context(self, intent_data: Dict[str, Any], session_id: str) -> str:
        """
        Inietta contesto rilevante basato su intent

        Returns:
            String di contesto da prepend al prompt
        """
        context_parts = []
        intent_type = intent_data['primary_intent']

        # Header con metadata
        context_parts.append(f"=== COMETA BRAIN CONTEXT INJECTION ===")
        context_parts.append(f"Intent: {intent_type} (confidence: {intent_data['confidence']:.2f})")
        context_parts.append(f"Session: {session_id}")
        context_parts.append(f"Timestamp: {datetime.now().isoformat()}")
        context_parts.append("")

        # Context specifico per intent
        if intent_type == 'task_creation':
            context_parts.extend(self._get_task_creation_context())
        elif intent_type == 'debugging':
            context_parts.extend(self._get_debugging_context())
        elif intent_type == 'architecture':
            context_parts.extend(self._get_architecture_context())
        elif intent_type == 'refactoring':
            context_parts.extend(self._get_refactoring_context())
        elif intent_type == 'testing':
            context_parts.extend(self._get_testing_context())
        elif intent_type == 'documentation':
            context_parts.extend(self._get_documentation_context())
        else:
            context_parts.extend(self._get_general_context())

        # Aggiungi active task info
        context_parts.extend(self._get_active_task_context())

        context_parts.append("=== END CONTEXT ===")
        context_parts.append("")

        return "\n".join(context_parts)

    def _get_task_creation_context(self) -> List[str]:
        """Context per creazione task"""
        return [
            "📝 TASK CREATION CONTEXT:",
            "- Use hierarchical structure: Project > Roadmap > Macrotask > Microtask",
            "- Include complexity_score (1-10) and estimated_duration_minutes",
            "- Specify required_capabilities and primary_platform",
            "- Follow naming convention: priority-task-name (h-/m-/l-)",
            ""
        ]

    def _get_debugging_context(self) -> List[str]:
        """Context per debugging"""
        context = ["🐛 DEBUGGING CONTEXT:"]

        # Recupera errori recenti dal database
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Ultimi errori dalle memory_blocks
            cursor.execute("""
                SELECT content, created_at
                FROM memory_blocks
                WHERE type = 'error'
                ORDER BY created_at DESC
                LIMIT 3
            """)

            recent_errors = cursor.fetchall()
            if recent_errors:
                context.append("Recent errors:")
                for error, timestamp in recent_errors:
                    context.append(f"  - {error[:100]}... ({timestamp})")

            conn.close()
        except Exception as e:
            context.append(f"  (Could not retrieve recent errors: {e})")

        context.extend([
            "- Check logs in ./logs/ directory",
            "- Verify database connections and schemas",
            "- Review recent code changes with git diff",
            ""
        ])
        return context

    def _get_architecture_context(self) -> List[str]:
        """Context per decisioni architetturali"""
        return [
            "🏗️ ARCHITECTURE CONTEXT:",
            "- Current stack: Python 3.11+, Node.js 18+, SQLite",
            "- Database: ./data/devflow_unified.sqlite",
            "- Services: TaskHierarchy, SemanticMemory, UnifiedOrchestrator",
            "- Follow DevFlow patterns: Service classes, error handling, async operations",
            "- Consider scalability, maintainability, and testability",
            ""
        ]

    def _get_refactoring_context(self) -> List[str]:
        """Context per refactoring"""
        return [
            "♻️ REFACTORING CONTEXT:",
            "- Maintain backward compatibility",
            "- Preserve all tests passing",
            "- Follow 100-line limit per file (MANDATORY)",
            "- Use TypeScript/JavaScript standards",
            "- Consider performance implications",
            ""
        ]

    def _get_testing_context(self) -> List[str]:
        """Context per testing"""
        return [
            "🧪 TESTING CONTEXT:",
            "- Test frameworks: Jest for JS/TS, pytest for Python",
            "- Coverage target: >80%",
            "- Include unit, integration, and e2e tests",
            "- Mock external dependencies",
            "- Test edge cases and error conditions",
            ""
        ]

    def _get_documentation_context(self) -> List[str]:
        """Context per documentazione"""
        return [
            "📚 DOCUMENTATION CONTEXT:",
            "- Follow markdown format",
            "- Include code examples",
            "- Document API endpoints and parameters",
            "- Add inline comments for complex logic",
            "- Update CLAUDE.md files for services",
            ""
        ]

    def _get_general_context(self) -> List[str]:
        """Context generale"""
        return [
            "ℹ️ GENERAL CONTEXT:",
            "- Project: DevFlow Cometa Brain v2.0",
            "- Goal: Cognitive task and memory management system",
            "- Follow existing patterns and conventions",
            ""
        ]

    def _get_active_task_context(self) -> List[str]:
        """Recupera info sul task attivo"""
        context = ["📌 ACTIVE TASK:"]

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, title, status, priority
                FROM task_contexts
                WHERE status IN ('active', 'in_progress')
                ORDER BY updated_at DESC
                LIMIT 1
            """)

            active_task = cursor.fetchone()
            if active_task:
                task_id, title, status, priority = active_task
                context.append(f"  {priority}{title} (ID: {task_id}, Status: {status})")
            else:
                context.append("  No active task")

            conn.close()
        except Exception as e:
            context.append(f"  (Could not retrieve active task: {e})")

        context.append("")
        return context

class SecurityValidator:
    """Valida prompt per security e compliance"""

    DANGEROUS_PATTERNS = [
        (r'rm\s+-rf\s+/', 'Dangerous system deletion command'),
        (r'sudo\s+rm', 'Sudo deletion command'),
        (r'DROP\s+TABLE|TRUNCATE\s+TABLE', 'Dangerous SQL command'),
        (r'eval\s*\(|exec\s*\(', 'Code execution vulnerability'),
        (r'(password|secret|key|token)\s*=\s*["\']', 'Hardcoded credentials'),
    ]

    def validate(self, prompt: str) -> Dict[str, Any]:
        """
        Valida il prompt per pattern pericolosi

        Returns:
            Dict con is_valid, violations list
        """
        violations = []

        for pattern, description in self.DANGEROUS_PATTERNS:
            if re.search(pattern, prompt, re.IGNORECASE):
                violations.append({
                    'pattern': pattern,
                    'description': description,
                    'severity': 'high'
                })

        return {
            'is_valid': len(violations) == 0,
            'violations': violations,
            'checked_at': datetime.now().isoformat()
        }

def main():
    """Entry point principale del hook"""
    try:
        # Setup logging
        LOG_DIR.mkdir(parents=True, exist_ok=True)

        # Leggi input JSON
        input_data = json.loads(sys.stdin.read())
        session_id = input_data.get('session_id', 'unknown')
        prompt = input_data.get('prompt', '')

        # Log del prompt
        log_file = LOG_DIR / f"{session_id}_prompts.json"
        log_data = []
        if log_file.exists():
            with open(log_file, 'r') as f:
                log_data = json.load(f)

        log_data.append({
            'timestamp': datetime.now().isoformat(),
            'prompt': prompt,
            'session_id': session_id
        })

        with open(log_file, 'w') as f:
            json.dump(log_data, f, indent=2)

        # Analizza intent
        analyzer = IntentAnalyzer()
        intent_data = analyzer.analyze(prompt)

        # Valida sicurezza
        validator = SecurityValidator()
        validation_result = validator.validate(prompt)

        if not validation_result['is_valid']:
            # Blocca prompt pericoloso
            output = {
                'decision': 'block',
                'reason': f"Security violation: {validation_result['violations'][0]['description']}"
            }
            print(json.dumps(output))
            sys.exit(0)

        # Inietta contesto
        injector = ContextInjector(DB_PATH)
        context = injector.inject_context(intent_data, session_id)

        # Output context che verrà prepended al prompt
        print(context)

        # Salva analisi nel database
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO cometa_sessions (id, user_id, intent_patterns, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    intent_patterns = ?,
                    updated_at = ?
            """, (
                session_id,
                'claude_user',
                json.dumps(intent_data),
                datetime.now().isoformat(),
                json.dumps(intent_data),
                datetime.now().isoformat()
            ))

            conn.commit()
            conn.close()
        except Exception as e:
            # Log errore ma non bloccare
            sys.stderr.write(f"Database error: {e}\n")

        sys.exit(0)

    except Exception as e:
        # In caso di errore, non bloccare il prompt
        sys.stderr.write(f"Hook error: {e}\n")
        sys.exit(0)

if __name__ == "__main__":
    main()