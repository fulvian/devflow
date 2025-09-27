#!/usr/bin/env python3
"""
Cometa Brain Project Context Loader
Carica automaticamente contesto del progetto attivo all'avvio sessione
"""

import json
import sys
import sqlite3
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

DB_PATH = Path('./data/devflow_unified.sqlite')

class ProjectContextLoader:
    """Carica e gestisce il contesto del progetto"""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def load_project_context(self, session_id: str) -> Dict[str, Any]:
        """
        Carica il contesto completo del progetto attivo
        """
        context = {
            'session_id': session_id,
            'loaded_at': datetime.now().isoformat(),
            'git_info': self._get_git_info(),
            'active_project': self._get_active_project(),
            'active_roadmap': self._get_active_roadmap(),
            'recent_tasks': self._get_recent_tasks(),
            'environment': self._get_environment_info()
        }

        return context

    def _get_git_info(self) -> Dict[str, Any]:
        """Recupera informazioni Git"""
        try:
            branch = subprocess.run(
                ['git', 'branch', '--show-current'],
                capture_output=True, text=True
            ).stdout.strip()

            status = subprocess.run(
                ['git', 'status', '--short'],
                capture_output=True, text=True
            ).stdout.strip()

            last_commit = subprocess.run(
                ['git', 'log', '-1', '--oneline'],
                capture_output=True, text=True
            ).stdout.strip()

            return {
                'branch': branch,
                'has_changes': len(status) > 0,
                'changed_files': len(status.split('\n')) if status else 0,
                'last_commit': last_commit
            }
        except:
            return {'error': 'Git info not available'}

    def _get_active_project(self) -> Optional[Dict]:
        """Recupera progetto attivo dal database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, name, description, status
                FROM projects
                WHERE status = 'active'
                ORDER BY updated_at DESC
                LIMIT 1
            """)

            project = cursor.fetchone()
            conn.close()

            if project:
                return {
                    'id': project[0],
                    'name': project[1],
                    'description': project[2],
                    'status': project[3]
                }
            return None
        except:
            return None

    def _get_active_roadmap(self) -> Optional[Dict]:
        """Recupera roadmap attiva"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT r.id, r.title, r.phase, r.status,
                       COUNT(mt.id) as total_tasks,
                       SUM(CASE WHEN mt.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
                FROM roadmaps r
                LEFT JOIN macrotasks mt ON mt.roadmap_id = r.id
                WHERE r.status = 'active'
                GROUP BY r.id
                ORDER BY r.updated_at DESC
                LIMIT 1
            """)

            roadmap = cursor.fetchone()
            conn.close()

            if roadmap:
                return {
                    'id': roadmap[0],
                    'title': roadmap[1],
                    'phase': roadmap[2],
                    'status': roadmap[3],
                    'progress': f"{roadmap[5]}/{roadmap[4]} tasks completed"
                }
            return None
        except:
            return None

    def _get_recent_tasks(self, limit: int = 5) -> List[Dict]:
        """Recupera task recenti"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, title, status, priority, updated_at
                FROM task_contexts
                WHERE status != 'completed'
                ORDER BY updated_at DESC
                LIMIT ?
            """, (limit,))

            tasks = cursor.fetchall()
            conn.close()

            return [
                {
                    'id': t[0],
                    'title': t[1],
                    'status': t[2],
                    'priority': t[3],
                    'updated_at': t[4]
                }
                for t in tasks
            ]
        except:
            return []

    def _get_environment_info(self) -> Dict[str, Any]:
        """Recupera informazioni ambiente"""
        return {
            'python_version': sys.version.split()[0],
            'cwd': str(Path.cwd()),
            'devflow_db': str(self.db_path),
            'hooks_dir': str(Path('.claude/hooks'))
        }

def main():
    """Entry point per SessionStart hook"""
    try:
        input_data = json.loads(sys.stdin.read())
        session_id = input_data.get('session_id', 'unknown')

        loader = ProjectContextLoader(DB_PATH)
        context = loader.load_project_context(session_id)

        # Output formattato per Claude
        print("=== PROJECT CONTEXT LOADED ===")
        print(f"Session: {session_id}")

        if context['active_project']:
            print(f"\n📁 Active Project: {context['active_project']['name']}")
            print(f"   {context['active_project']['description']}")

        if context['active_roadmap']:
            print(f"\n🗺️ Active Roadmap: {context['active_roadmap']['title']}")
            print(f"   Phase: {context['active_roadmap']['phase']}")
            print(f"   Progress: {context['active_roadmap']['progress']}")

        if context['recent_tasks']:
            print("\n📋 Recent Tasks:")
            for task in context['recent_tasks'][:3]:
                print(f"   {task['priority']}{task['title']} ({task['status']})")

        print(f"\n🔧 Git Branch: {context['git_info'].get('branch', 'unknown')}")
        if context['git_info'].get('has_changes'):
            print(f"   ⚠️ {context['git_info']['changed_files']} files modified")

        print("=== END CONTEXT ===\n")

        # Salva context nel database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT OR REPLACE INTO cometa_sessions
            (id, user_id, project_id, start_time, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            session_id,
            'claude_user',
            context['active_project']['id'] if context['active_project'] else None,
            datetime.now().isoformat(),
            datetime.now().isoformat()
        ))

        conn.commit()
        conn.close()

        sys.exit(0)

    except Exception as e:
        sys.stderr.write(f"Project loader error: {e}\n")
        sys.exit(0)

if __name__ == "__main__":
    main()