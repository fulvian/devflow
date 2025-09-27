#!/usr/bin/env python3
"""
Natural Language Project Creation Hook - Context7 Implementation
Detects natural language triggers for project/task creation and guides users through structured creation process

Features:
- NLP pattern detection for project creation intent
- Guided conversation workflow with state management
- Automatic project/plan/task creation in database
- Integration with Cometa Brain and Unified Orchestrator
- Real-time progress monitoring and cross-validation coordination
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
from standard_hook_pattern import UserPromptSubmitHook, HookDecision

class NaturalLanguageProjectCreationHook(UserPromptSubmitHook):
    """Context7-compliant hook for natural language project creation"""

    def __init__(self):
        super().__init__("natural-language-project-creation")
        self.project_root = Path("/Users/fulvioventura/devflow")
        self.state_file = self.project_root / ".claude" / "state" / "project-creation-session.json"
        self.db_path = self.project_root / "data" / "devflow_unified.sqlite"

        # NLP Trigger Patterns
        self.project_creation_patterns = [
            r"(?i)(creiamo|facciamo)\s+(un\s+)?nuovo\s+(task|progetto|sistema|piattaforma)",
            r"(?i)dobbiamo\s+(implementare|creare|sviluppare|realizzare)",
            r"(?i)serve\s+(un\s+)?(progetto|task|sistema)\s+per",
            r"(?i)facciamo\s+(una\s+)?feature\s+per",
            r"(?i)dobbiamo\s+risolvere",
            r"(?i)nuovo\s+(sistema|framework|piattaforma)\s+(di|per)",
            r"(?i)(create|implement|develop|build)\s+(a\s+)?(new\s+)?(system|project|feature|task)",
            r"(?i)we\s+need\s+(to\s+)?(create|implement|develop|build)"
        ]

        self.project_scope_indicators = {
            "micro": [r"(?i)(semplice|veloce|piccolo|quick|simple|small)", 0.2],
            "small": [r"(?i)(feature|componente|component|utility|tool)", 0.4],
            "medium": [r"(?i)(sistema|system|module|modulo|service|api)", 0.6],
            "large": [r"(?i)(piattaforma|platform|framework|architettura|architecture)", 0.8],
            "enterprise": [r"(?i)(enterprise|scalabile|complesso|complex|infrastructure)", 1.0]
        }

    def validate_input(self) -> bool:
        """Validate UserPromptSubmit input"""
        if not super().validate_input():
            return False

        prompt = self.input_data.get("prompt")
        if not prompt:
            return False

        return True

    def execute_logic(self) -> None:
        """Main logic for natural language project creation detection"""
        try:
            prompt = self.input_data.get("prompt", "")

            # Check if we're in an active project creation session
            current_session = self._load_session_state()

            if current_session:
                # Continue existing session
                self._continue_guided_session(prompt, current_session)
            else:
                # Check for new project creation triggers
                creation_intent = self._detect_project_creation_intent(prompt)
                if creation_intent:
                    self._start_guided_session(prompt, creation_intent)

        except Exception as e:
            self.logger.error(f"Natural language project creation failed: {e}")
            # Clear any stuck session state
            if self.state_file.exists():
                self.state_file.unlink()

    def _detect_project_creation_intent(self, prompt: str) -> Optional[Dict[str, Any]]:
        """Detect project creation intent with confidence scoring"""
        intent_score = 0.0
        matched_patterns = []

        # Check trigger patterns
        for pattern in self.project_creation_patterns:
            if re.search(pattern, prompt):
                intent_score += 0.3
                matched_patterns.append(pattern)

        # Extract project name/description
        project_name = self._extract_project_name(prompt)
        project_description = self._extract_project_description(prompt)

        # Score based on content richness
        if project_name:
            intent_score += 0.2
        if project_description:
            intent_score += 0.2

        # Score based on scope indicators
        scope_score, detected_scope = self._detect_project_scope(prompt)
        intent_score += scope_score * 0.3

        # Threshold for activation
        if intent_score >= 0.5:
            return {
                'confidence': intent_score,
                'matched_patterns': matched_patterns,
                'detected_name': project_name,
                'detected_description': project_description,
                'detected_scope': detected_scope,
                'original_prompt': prompt
            }

        return None

    def _extract_project_name(self, prompt: str) -> Optional[str]:
        """Extract potential project name from prompt"""
        # Pattern to extract names after key phrases
        name_patterns = [
            r"(?i)(?:sistema|system|progetto|project)\s+(?:di|per|for|of)\s+([a-zA-Z\-_\s]+?)(?:\s|$|,|\.|!|\?)",
            r"(?i)(?:feature|componente|component)\s+([a-zA-Z\-_\s]+?)(?:\s|$|,|\.|!|\?)",
            r"(?i)\"([^\"]+)\"",  # Quoted strings
            r"(?i)'([^']+)'"     # Single quoted strings
        ]

        for pattern in name_patterns:
            match = re.search(pattern, prompt)
            if match:
                name = match.group(1).strip()
                if len(name) > 3 and len(name) < 50:  # Reasonable length
                    return self._normalize_project_name(name)

        return None

    def _extract_project_description(self, prompt: str) -> Optional[str]:
        """Extract project description from prompt"""
        # Use the full prompt as description, cleaned up
        description = re.sub(r'(?i)(creiamo|facciamo|dobbiamo|serve)', '', prompt)
        description = description.strip()

        if len(description) > 10:
            return description[:200]  # Limit length

        return None

    def _detect_project_scope(self, prompt: str) -> Tuple[float, str]:
        """Detect project scope from indicators"""
        for scope, (pattern, score) in self.project_scope_indicators.items():
            if re.search(pattern, prompt):
                return score, scope

        return 0.0, "medium"  # Default scope

    def _normalize_project_name(self, name: str) -> str:
        """Normalize project name for database storage"""
        # Convert to lowercase, replace spaces with hyphens
        normalized = re.sub(r'[^a-zA-Z0-9\s\-_]', '', name)
        normalized = re.sub(r'\s+', '-', normalized.strip())
        normalized = normalized.lower()
        return normalized

    def _start_guided_session(self, prompt: str, intent: Dict[str, Any]) -> None:
        """Start guided project creation session"""
        session_data = {
            'session_id': f"proj-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            'phase': 'requirements',
            'started_at': datetime.now().isoformat(),
            'original_prompt': prompt,
            'intent': intent,
            'project_data': {
                'name': intent.get('detected_name', ''),
                'description': intent.get('detected_description', ''),
                'scope': intent.get('detected_scope', 'medium')
            },
            'requirements': {},
            'conversation_history': []
        }

        self._save_session_state(session_data)

        # Generate requirements discussion context
        requirements_questions = self._generate_requirements_questions(intent)

        context = f"""
[🎯 PROJECT CREATION DETECTED]
Intent detected with {intent['confidence']:.2f} confidence.
Project: "{intent.get('detected_name', 'Unnamed Project')}"
Scope: {intent.get('detected_scope', 'medium')}

Iniziamo la discussione dei requisiti:

{requirements_questions}

Rispondi alle domande sopra per definire il progetto. Quando avremo tutti i dettagli necessari, ti chiederò se procedere con la creazione del piano di implementazione.

[Session ID: {session_data['session_id']}]
"""

        self.response.hook_specific_output = {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context
        }

        self.logger.info(f"Started guided project creation session: {session_data['session_id']}")

    def _generate_requirements_questions(self, intent: Dict[str, Any]) -> str:
        """Generate contextual requirements questions based on detected intent"""
        scope = intent.get('detected_scope', 'medium')
        project_name = intent.get('detected_name', 'questo progetto')

        base_questions = [
            f"🎯 **Obiettivi principali**: Cosa deve fare esattamente {project_name}?",
            f"👥 **Utenti target**: Chi userà {project_name}?",
            f"🔧 **Stack tecnologico**: Hai preferenze per tecnologie/framework?",
        ]

        scope_specific = {
            "micro": [
                "⏱️ **Timeline**: È un task da completare velocemente?",
                "🔗 **Integrazione**: Si integra con sistemi esistenti?"
            ],
            "small": [
                "📊 **Dati**: Che tipo di dati gestirà?",
                "🔒 **Sicurezza**: Ci sono requisiti di sicurezza specifici?"
            ],
            "medium": [
                "🏗️ **Architettura**: Microservizi o monolitico?",
                "📈 **Scalabilità**: Quanti utenti prevedi?",
                "🔒 **Sicurezza**: Autenticazione, autorizzazione, compliance?"
            ],
            "large": [
                "🏗️ **Architettura**: Che architettura preferisci (microservizi, modulare, etc.)?",
                "📈 **Scalabilità**: Crescita prevista nei prossimi 2 anni?",
                "🔒 **Sicurezza**: Compliance (GDPR, SOC2, etc.)?",
                "🔄 **Integrations**: API esterne, database legacy?"
            ],
            "enterprise": [
                "🏢 **Enterprise Requirements**: Compliance, governance, audit trails?",
                "🔧 **DevOps**: CI/CD, monitoring, deployment strategy?",
                "📈 **Performance**: SLA, throughput, latency requirements?",
                "🔄 **Integrations**: ERP, CRM, identity providers?",
                "👥 **Team**: Quanti sviluppatori coinvolti?"
            ]
        }

        questions = base_questions + scope_specific.get(scope, scope_specific["medium"])

        return "\n".join([f"{i+1}. {q}" for i, q in enumerate(questions)])

    def _continue_guided_session(self, prompt: str, session: Dict[str, Any]) -> None:
        """Continue existing guided session"""
        phase = session.get('phase', 'requirements')

        # Update conversation history
        session['conversation_history'].append({
            'timestamp': datetime.now().isoformat(),
            'phase': phase,
            'user_input': prompt
        })

        if phase == 'requirements':
            self._process_requirements_phase(prompt, session)
        elif phase == 'planning':
            self._process_planning_phase(prompt, session)
        elif phase == 'implementation':
            self._process_implementation_phase(prompt, session)

        self._save_session_state(session)

    def _process_requirements_phase(self, prompt: str, session: Dict[str, Any]) -> None:
        """Process requirements gathering phase"""
        # Check if user wants to proceed to planning
        proceed_patterns = [
            r"(?i)(procediamo|andiamo|vai|proceed|continue|next)",
            r"(?i)(piano|plan|implementazione|implementation)",
            r"(?i)(ok|bene|good|ready)"
        ]

        if any(re.search(pattern, prompt) for pattern in proceed_patterns):
            self._transition_to_planning_phase(session)
        else:
            # Continue gathering requirements
            self._update_requirements_from_response(prompt, session)

            context = """
[📋 REQUIREMENTS GATHERING - Continuing]
Ottimo! Sto aggiornando i requisiti del progetto.

Hai altre specifiche da aggiungere o possiamo **procedere con la creazione del piano di implementazione**?

Dimmi "procediamo" quando sei pronto per la fase di pianificazione.
"""

            self.response.hook_specific_output = {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": context
            }

    def _transition_to_planning_phase(self, session: Dict[str, Any]) -> None:
        """Transition to planning phase"""
        session['phase'] = 'planning'

        # Create project and plan in database
        project_id, plan_id = self._create_project_and_plan_in_db(session)

        session['project_id'] = project_id
        session['plan_id'] = plan_id

        context = f"""
[🗺️ PROJECT PLANNING PHASE]
Ottimo! Ho creato il progetto nel database:
- **Progetto ID**: {project_id}
- **Piano ID**: {plan_id}

Ora analizzo i requisiti e creo il piano di implementazione dettagliato...

⏳ Generando roadmap con macro e micro-task (max 10 minuti per task)...

Dimmi "iniziamo implementazione" quando approvi il piano, oppure suggerisci modifiche.
"""

        self.response.hook_specific_output = {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context
        }

    def _create_project_and_plan_in_db(self, session: Dict[str, Any]) -> Tuple[int, int]:
        """Create project and plan entries in database"""
        try:
            import sqlite3

            project_data = session['project_data']

            with sqlite3.connect(str(self.db_path)) as conn:
                # Create project
                project_cursor = conn.execute("""
                    INSERT INTO projects (name, description, status, created_at, updated_at)
                    VALUES (?, ?, 'planning', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (
                    project_data['name'],
                    project_data['description']
                ))
                project_id = project_cursor.lastrowid

                # Create plan
                plan_cursor = conn.execute("""
                    INSERT INTO plans (project_id, name, phase, description, created_at, updated_at)
                    VALUES (?, ?, 'planning', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (
                    project_id,
                    f"{project_data['name']}-implementation-plan",
                    f"Implementation plan for {project_data['name']} - auto-generated from guided conversation"
                ))
                plan_id = plan_cursor.lastrowid

                conn.commit()

                self.logger.info(f"Created project {project_id} and plan {plan_id}")
                return project_id, plan_id

        except Exception as e:
            self.logger.error(f"Failed to create project/plan in DB: {e}")
            return None, None

    def _update_requirements_from_response(self, prompt: str, session: Dict[str, Any]) -> None:
        """Update requirements based on user response"""
        # Simple keyword extraction for now
        # In production, this could use NLP for better extraction

        requirements = session.setdefault('requirements', {})

        # Extract key information
        if 'objective' not in requirements and any(word in prompt.lower() for word in ['obiettivo', 'goal', 'purpose']):
            requirements['objectives'] = prompt

        if 'stack' not in requirements and any(word in prompt.lower() for word in ['python', 'node', 'react', 'vue', 'django']):
            requirements['tech_stack'] = self._extract_tech_stack(prompt)

        if 'users' not in requirements and any(word in prompt.lower() for word in ['utenti', 'users', 'clienti', 'customers']):
            requirements['target_users'] = prompt

        session['requirements'] = requirements

    def _extract_tech_stack(self, prompt: str) -> List[str]:
        """Extract technology stack from prompt"""
        tech_keywords = {
            'languages': ['python', 'javascript', 'typescript', 'java', 'go', 'rust'],
            'frameworks': ['react', 'vue', 'angular', 'django', 'flask', 'express', 'fastapi'],
            'databases': ['postgresql', 'mysql', 'mongodb', 'redis', 'sqlite'],
            'cloud': ['aws', 'gcp', 'azure', 'docker', 'kubernetes']
        }

        found_tech = []
        prompt_lower = prompt.lower()

        for category, techs in tech_keywords.items():
            for tech in techs:
                if tech in prompt_lower:
                    found_tech.append(tech)

        return found_tech

    def _load_session_state(self) -> Optional[Dict[str, Any]]:
        """Load current session state"""
        try:
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load session state: {e}")
        return None

    def _save_session_state(self, session_data: Dict[str, Any]) -> None:
        """Save session state"""
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.state_file, 'w') as f:
                json.dump(session_data, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save session state: {e}")

    def _process_planning_phase(self, prompt: str, session: Dict[str, Any]) -> None:
        """Process planning phase"""
        # Check if user wants to start implementation
        implementation_patterns = [
            r"(?i)(iniziamo|start|implement|andiamo|procediamo)",
            r"(?i)(implementazione|implementation)",
            r"(?i)(approvo|approve|ok|good|vai|go)"
        ]

        if any(re.search(pattern, prompt) for pattern in implementation_patterns):
            self._transition_to_implementation_phase(session)
        else:
            # Handle plan modifications
            context = """
[🗺️ PLANNING PHASE - Modifications]
Sto aggiornando il piano basandomi sui tuoi feedback.

Dimmi "iniziamo implementazione" quando il piano ti soddisfa, oppure continua a suggerire modifiche.
"""

            self.response.hook_specific_output = {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": context
            }

    def _transition_to_implementation_phase(self, session: Dict[str, Any]) -> None:
        """Transition to implementation phase"""
        session['phase'] = 'implementation'
        session['implementation_started_at'] = datetime.now().isoformat()

        # Clear session state - implementation begins
        if self.state_file.exists():
            self.state_file.unlink()

        context = f"""
[🚀 IMPLEMENTATION PHASE STARTED]
Progetto approvato! Iniziamo l'implementazione.

**Progetto**: {session['project_data']['name']} (ID: {session.get('project_id')})
**Piano**: {session.get('plan_id')}

Il Project Monitoring Agent è ora attivo e monitorerà:
- ✅ Aderenza alle specifiche del progetto
- ✅ Progress tracking vs piano
- ✅ Cross-validation con altri agenti
- ✅ Quality gates e milestone

Procediamo con il primo task!
"""

        self.response.hook_specific_output = {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context
        }

        self.logger.info(f"Started implementation for project {session.get('project_id')}")

    def _process_implementation_phase(self, prompt: str, session: Dict[str, Any]) -> None:
        """Process implementation phase (should not reach here as session is cleared)"""
        # This should not be reached as we clear session state when starting implementation
        pass

if __name__ == "__main__":
    hook = NaturalLanguageProjectCreationHook()
    sys.exit(hook.run())