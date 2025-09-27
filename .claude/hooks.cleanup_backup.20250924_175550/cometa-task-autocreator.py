#!/usr/bin/env python3
"""
Cometa Brain Task Auto-Creator
Rileva intent di creazione task e genera automaticamente struttura gerarchica
"""

import json
import sys
import sqlite3
import re
import uuid
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

DB_PATH = Path('./data/devflow_unified.sqlite')
STATE_FILE = Path('.claude/state/current_task.json')

class TaskPatternDetector:
    """Rileva pattern di creazione task nel linguaggio naturale"""

    TASK_PATTERNS = {
        'explicit_creation': [
            r'create\s+(?:a\s+)?task\s+(?:for|to)\s+(.+)',
            r'add\s+(?:a\s+)?(?:new\s+)?task\s*:\s*(.+)',
            r'task\s*:\s*(.+)',
        ],
        'implicit_creation': [
            r'(?:i\s+)?(?:need|want|have)\s+to\s+(.+)',
            r'(?:let\'s|lets)\s+(.+)',
            r'(?:we\s+)?(?:should|must|need\s+to)\s+(.+)',
            r'implement\s+(.+)',
            r'create\s+(.+)',
            r'build\s+(.+)',
            r'develop\s+(.+)',
            r'fix\s+(.+)',
            r'debug\s+(.+)',
            r'refactor\s+(.+)',
        ],
        'feature_request': [
            r'add\s+(?:a\s+)?(?:new\s+)?feature\s*(?:for|to)?\s*(.+)',
            r'(?:new\s+)?feature\s*:\s*(.+)',
            r'enhancement\s*:\s*(.+)',
        ],
        'bug_report': [
            r'bug\s*:\s*(.+)',
            r'issue\s*:\s*(.+)',
            r'problem\s*:\s*(.+)',
            r'(.+)\s+(?:is|isn\'t|not)\s+working',
            r'error\s+(?:in|with)\s+(.+)',
        ]
    }

    def detect(self, prompt: str) -> Dict[str, Any]:
        """
        Rileva se il prompt richiede creazione task

        Returns:
            Dict con should_create_task, task_info
        """
        prompt_lower = prompt.lower()

        for category, patterns in self.TASK_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, prompt_lower, re.IGNORECASE)
                if match:
                    task_description = match.group(1) if match.groups() else prompt

                    return {
                        'should_create_task': True,
                        'category': category,
                        'pattern': pattern,
                        'task_description': task_description.strip(),
                        'original_prompt': prompt,
                        'confidence': self._calculate_confidence(category, prompt_lower)
                    }

        return {'should_create_task': False}

    def _calculate_confidence(self, category: str, prompt: str) -> float:
        """Calcola confidence score per la detection"""
        base_scores = {
            'explicit_creation': 0.95,
            'implicit_creation': 0.75,
            'feature_request': 0.85,
            'bug_report': 0.80
        }

        score = base_scores.get(category, 0.5)

        # Boost per keyword aggiuntive
        boost_keywords = ['urgent', 'important', 'asap', 'critical', 'high priority']
        for keyword in boost_keywords:
            if keyword in prompt:
                score = min(1.0, score + 0.05)

        return score

class TaskBreakdownGenerator:
    """Genera breakdown gerarchico dei task"""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def generate_breakdown(self, task_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Genera struttura gerarchica del task

        Returns:
            Dict con macrotask e microtasks
        """
        description = task_info['task_description']
        category = task_info['category']

        # Determina priorità
        priority = self._determine_priority(description)

        # Genera macrotask
        macrotask = {
            'id': f"macro_{uuid.uuid4().hex[:8]}",
            'title': self._generate_title(description),
            'description': description,
            'priority': priority,
            'status': 'planning',
            'category': category,
            'estimated_duration_minutes': self._estimate_duration(category),
            'complexity_score': self._calculate_complexity(description),
            'created_at': datetime.now().isoformat()
        }

        # Genera microtasks
        microtasks = self._generate_microtasks(macrotask)

        return {
            'macrotask': macrotask,
            'microtasks': microtasks,
            'total_estimated_minutes': sum(mt['estimated_duration_minutes'] for mt in microtasks),
            'dependencies': self._identify_dependencies(description)
        }

    def _determine_priority(self, description: str) -> str:
        """Determina priorità del task"""
        high_keywords = ['urgent', 'critical', 'asap', 'immediately', 'bug', 'broken', 'error']
        low_keywords = ['maybe', 'eventually', 'later', 'nice to have', 'optional']

        desc_lower = description.lower()

        for keyword in high_keywords:
            if keyword in desc_lower:
                return 'h-'

        for keyword in low_keywords:
            if keyword in desc_lower:
                return 'l-'

        return 'm-'

    def _generate_title(self, description: str) -> str:
        """Genera titolo conciso dal description"""
        # Rimuovi articoli e parole comuni
        stop_words = ['the', 'a', 'an', 'to', 'for', 'in', 'on', 'at', 'with']
        words = description.split()[:5]  # Max 5 parole

        title_words = [w for w in words if w.lower() not in stop_words]

        if not title_words:
            title_words = words[:3]

        return '-'.join(title_words).lower()

    def _estimate_duration(self, category: str) -> int:
        """Stima durata in minuti basata su categoria"""
        estimates = {
            'explicit_creation': 120,
            'implicit_creation': 90,
            'feature_request': 240,
            'bug_report': 60
        }

        return estimates.get(category, 120)

    def _calculate_complexity(self, description: str) -> int:
        """Calcola complexity score (1-10)"""
        complexity_keywords = {
            'simple': 2,
            'easy': 2,
            'basic': 3,
            'standard': 5,
            'complex': 7,
            'advanced': 8,
            'difficult': 8,
            'architecture': 9,
            'refactor': 7,
            'integrate': 8,
            'migrate': 9
        }

        desc_lower = description.lower()

        for keyword, score in complexity_keywords.items():
            if keyword in desc_lower:
                return score

        return 5  # Default medium complexity

    def _generate_microtasks(self, macrotask: Dict) -> List[Dict]:
        """Genera microtasks automatici per il macrotask"""
        microtasks = []
        category = macrotask['category']

        if category == 'feature_request':
            task_templates = [
                ("Design API/Interface", 30),
                ("Implement core functionality", 60),
                ("Add validation and error handling", 30),
                ("Write unit tests", 45),
                ("Add integration tests", 30),
                ("Update documentation", 30),
            ]
        elif category == 'bug_report':
            task_templates = [
                ("Reproduce the issue", 15),
                ("Identify root cause", 30),
                ("Implement fix", 30),
                ("Test fix thoroughly", 20),
                ("Add regression test", 15),
            ]
        elif category == 'implicit_creation':
            task_templates = [
                ("Analyze requirements", 20),
                ("Design solution", 30),
                ("Implement solution", 45),
                ("Test implementation", 30),
                ("Document changes", 15),
            ]
        else:
            task_templates = [
                ("Planning and design", 30),
                ("Implementation", 60),
                ("Testing", 30),
                ("Documentation", 20),
            ]

        for idx, (title, duration) in enumerate(task_templates):
            microtasks.append({
                'id': f"micro_{macrotask['id']}_{idx}",
                'parent_id': macrotask['id'],
                'title': title,
                'status': 'pending',
                'estimated_duration_minutes': duration,
                'order': idx + 1,
                'created_at': datetime.now().isoformat()
            })

        return microtasks

    def _identify_dependencies(self, description: str) -> List[str]:
        """Identifica possibili dipendenze"""
        dependencies = []

        dependency_keywords = {
            'after': 'sequential',
            'before': 'prerequisite',
            'depends on': 'dependency',
            'requires': 'requirement',
            'based on': 'foundation'
        }

        desc_lower = description.lower()

        for keyword, dep_type in dependency_keywords.items():
            if keyword in desc_lower:
                dependencies.append({
                    'type': dep_type,
                    'keyword': keyword,
                    'detected': True
                })

        return dependencies

class TaskDatabaseManager:
    """Gestisce persistenza task nel database"""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def create_task_hierarchy(self, breakdown: Dict[str, Any]) -> str:
        """
        Crea macrotask e microtasks nel database

        Returns:
            ID del macrotask creato
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        try:
            # Inizia transazione
            cursor.execute("BEGIN TRANSACTION")

            macrotask = breakdown['macrotask']

            # Inserisci macrotask
            cursor.execute("""
                INSERT INTO task_contexts (
                    title, description, priority, status,
                    complexity_score, estimated_duration_minutes,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                macrotask['title'],
                macrotask['description'],
                macrotask['priority'],
                macrotask['status'],
                macrotask['complexity_score'],
                macrotask['estimated_duration_minutes'],
                macrotask['created_at'],
                macrotask['created_at']
            ))

            macrotask_id = cursor.lastrowid

            # Inserisci microtasks
            for microtask in breakdown['microtasks']:
                cursor.execute("""
                    INSERT INTO task_contexts (
                        title, description, priority, status,
                        parent_task_id, estimated_duration_minutes,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    microtask['title'],
                    f"Subtask of {macrotask['title']}",
                    macrotask['priority'],
                    microtask['status'],
                    macrotask_id,
                    microtask['estimated_duration_minutes'],
                    microtask['created_at'],
                    microtask['created_at']
                ))

            # Commit transazione
            cursor.execute("COMMIT")

            conn.close()
            return str(macrotask_id)

        except Exception as e:
            cursor.execute("ROLLBACK")
            conn.close()
            raise Exception(f"Failed to create task hierarchy: {e}")

    def update_claude_state(self, task_id: str, task_title: str):
        """Aggiorna file di stato Claude Code"""
        try:
            state_data = {
                'task': task_title,
                'task_id': task_id,
                'created_by': 'cometa-brain',
                'created_at': datetime.now().isoformat(),
                'auto_generated': True
            }

            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)

            with open(STATE_FILE, 'w') as f:
                json.dump(state_data, f, indent=2)

        except Exception as e:
            sys.stderr.write(f"Failed to update Claude state: {e}\n")

def main():
    """Entry point per PreToolUse hook"""
    try:
        input_data = json.loads(sys.stdin.read())
        tool_name = input_data.get('tool_name', '')

        # Solo per tool di editing/creazione
        if tool_name not in ['Edit', 'Write', 'MultiEdit', 'Bash']:
            sys.exit(0)

        # Recupera ultimo prompt dalla sessione
        session_id = input_data.get('session_id', 'unknown')

        # Leggi ultimo prompt dal log
        log_file = Path(f'.claude/logs/cometa-brain/{session_id}_prompts.json')

        if not log_file.exists():
            sys.exit(0)

        with open(log_file, 'r') as f:
            prompts = json.load(f)

        if not prompts:
            sys.exit(0)

        last_prompt = prompts[-1]['prompt']

        # Rileva intent di creazione task
        detector = TaskPatternDetector()
        detection_result = detector.detect(last_prompt)

        if not detection_result['should_create_task']:
            sys.exit(0)

        # Alta confidence richiesta per auto-creazione
        if detection_result['confidence'] < 0.7:
            sys.exit(0)

        print(f"🎯 TASK CREATION DETECTED (confidence: {detection_result['confidence']:.2f})")
        print(f"   Category: {detection_result['category']}")
        print(f"   Description: {detection_result['task_description']}")

        # Genera breakdown
        generator = TaskBreakdownGenerator(DB_PATH)
        breakdown = generator.generate_breakdown(detection_result)

        print(f"\n📋 AUTO-GENERATING TASK HIERARCHY:")
        print(f"   Macrotask: {breakdown['macrotask']['title']}")
        print(f"   Priority: {breakdown['macrotask']['priority']}")
        print(f"   Complexity: {breakdown['macrotask']['complexity_score']}/10")
        print(f"   Estimated: {breakdown['total_estimated_minutes']} minutes")
        print(f"   Microtasks: {len(breakdown['microtasks'])}")

        # Crea nel database
        manager = TaskDatabaseManager(DB_PATH)
        task_id = manager.create_task_hierarchy(breakdown)

        print(f"\n✅ Task created with ID: {task_id}")

        # Aggiorna stato Claude
        manager.update_claude_state(task_id, breakdown['macrotask']['title'])

        # Log creazione
        creation_log = {
            'timestamp': datetime.now().isoformat(),
            'task_id': task_id,
            'detection': detection_result,
            'breakdown': breakdown
        }

        log_file = Path(f'.claude/logs/cometa-brain/task_creations.json')
        log_file.parent.mkdir(parents=True, exist_ok=True)

        logs = []
        if log_file.exists():
            with open(log_file, 'r') as f:
                logs = json.load(f)

        logs.append(creation_log)

        with open(log_file, 'w') as f:
            json.dump(logs, f, indent=2)

        sys.exit(0)

    except Exception as e:
        sys.stderr.write(f"Task auto-creator error: {e}\n")
        sys.exit(0)

if __name__ == "__main__":
    main()