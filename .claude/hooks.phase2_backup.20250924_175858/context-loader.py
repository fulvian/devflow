#!/usr/bin/env python3
"""
Context Loader Script for Enhanced Pre-Tool Hook
Enhanced with Context Bridge Service integration for embeddinggemma support
Combines vector search (60%) and semantic search (40%) for optimal context injection
Called by enhanced-pre-tool-hook.js
"""

import json
import sys
import sqlite3
import os
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

class ContextLoader:
    def __init__(self, db_path: str = "./data/devflow_unified.sqlite"):
        self.db_path = db_path
        self.context_bridge_url = "http://localhost:3007"
        self.use_enhanced_context = True  # Use Context Bridge Service if available

    def _call_context_bridge(self, agent_name: str, query: str, max_tokens: int = 2000) -> Optional[Dict[str, Any]]:
        """Call Context Bridge Service for enhanced context injection"""
        try:
            data = {
                "agent": agent_name,
                "query": query,
                "maxTokens": max_tokens,
                "threshold": 0.7
            }

            req_data = json.dumps(data).encode('utf-8')
            req = urllib.request.Request(
                f"{self.context_bridge_url}/context/inject",
                data=req_data,
                headers={'Content-Type': 'application/json'}
            )

            with urllib.request.urlopen(req, timeout=5) as response:
                result = json.loads(response.read().decode('utf-8'))
                if result.get('success'):
                    return result['context']
                else:
                    print(f"Context Bridge error: {result.get('error')}", file=sys.stderr)
                    return None

        except Exception as e:
            print(f"Context Bridge Service unavailable: {str(e)}", file=sys.stderr)
            return None

    def load_context_for_agent(self, agent_name: str, task_context: Dict[str, Any]) -> Dict[str, Any]:
        """Load relevant context for a specific agent using enhanced Context Bridge Service"""
        try:
            # Extract task information
            task_name = task_context.get('task_name', 'coding_task')
            tool_params = task_context.get('tool_parameters', {})

            # Build query for Context Bridge Service
            query_parts = [task_name]
            if tool_params.get('objective'):
                query_parts.append(tool_params['objective'])
            if tool_params.get('language'):
                query_parts.append(f"language:{tool_params['language']}")

            query = " ".join(query_parts)

            # Try enhanced context injection first
            if self.use_enhanced_context:
                enhanced_context = self._call_context_bridge(agent_name, query)
                if enhanced_context:
                    # Convert enhanced context to legacy format
                    context_blocks = self._format_enhanced_context(enhanced_context, agent_name)
                    return {
                        "context": context_blocks,
                        "success": True,
                        "agent": agent_name,
                        "task_name": task_name,
                        "blocks_count": len(context_blocks),
                        "enhanced": True,
                        "source": "context_bridge_service"
                    }

            # Fallback to legacy context loading
            if not os.path.exists(self.db_path):
                return {"context": [], "success": False, "error": "Database not found"}

            context_blocks = []

            # Load context based on agent type (legacy method)
            if 'synthetic' in agent_name.lower():
                context_blocks = self._load_synthetic_context(task_name, tool_params)
            elif 'gemini' in agent_name.lower():
                context_blocks = self._load_gemini_context(task_name, tool_params)
            elif 'qwen' in agent_name.lower():
                context_blocks = self._load_qwen_context(task_name, tool_params)
            elif 'codex' in agent_name.lower():
                context_blocks = self._load_codex_context(task_name, tool_params)
            elif agent_name == 'Task':
                context_blocks = self._load_task_context(task_name, tool_params)
            else:
                context_blocks = self._load_generic_context(task_name, tool_params)

            return {
                "context": context_blocks,
                "success": True,
                "agent": agent_name,
                "task_name": task_name,
                "blocks_count": len(context_blocks),
                "enhanced": False,
                "source": "legacy_database"
            }

        except Exception as e:
            return {
                "context": [],
                "success": False,
                "error": str(e),
                "agent": agent_name
            }

    def _format_enhanced_context(self, enhanced_context: Dict[str, Any], agent_name: str) -> List[str]:
        """Format enhanced context from Context Bridge Service into legacy format"""
        context_blocks = []

        # Add header
        context_blocks.append(f"=== CONTESTO {agent_name.upper()} ENHANCED ===")
        context_blocks.append(f"Vector Results: {len(enhanced_context.get('vectorResults', []))}")
        context_blocks.append(f"Semantic Results: {len(enhanced_context.get('semanticResults', []))}")
        context_blocks.append(f"Processing Time: {enhanced_context.get('metadata', {}).get('processingTime', 0)}ms")
        context_blocks.append("")

        # Add combined context directly
        combined_context = enhanced_context.get('combinedContext', '')
        if combined_context:
            context_blocks.extend(combined_context.split('\n'))

        return context_blocks

    def _load_synthetic_context(self, task_name: str, tool_params: Dict) -> List[str]:
        """Load context optimized for Synthetic agents"""
        context_blocks = []

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # 1. Carica contesto da progetti correlati
            cursor.execute("""
                SELECT name, description, status, metadata
                FROM projects
                WHERE name LIKE ? OR description LIKE ?
                ORDER BY updated_at DESC LIMIT 3
            """, (f"%{task_name}%", f"%{task_name}%"))

            projects = cursor.fetchall()
            if projects:
                context_blocks.append("=== PROGETTI CORRELATI ===")
                for project in projects:
                    context_blocks.append(f"Progetto: {project[0]}")
                    context_blocks.append(f"Descrizione: {project[1]}")
                    context_blocks.append(f"Stato: {project[2]}")
                    if project[3]:  # metadata
                        context_blocks.append(f"Metadata: {project[3]}")
                    context_blocks.append("")

            # 2. Carica task simili completati
            cursor.execute("""
                SELECT name, description, status, task_context_id
                FROM tasks
                WHERE status = 'completed'
                AND (name LIKE ? OR description LIKE ?)
                ORDER BY updated_at DESC LIMIT 5
            """, (f"%{task_name}%", f"%{task_name}%"))

            completed_tasks = cursor.fetchall()
            if completed_tasks:
                context_blocks.append("=== TASK SIMILI COMPLETATI ===")
                for task in completed_tasks:
                    context_blocks.append(f"Task: {task[0]}")
                    context_blocks.append(f"Descrizione: {task[1]}")
                    context_blocks.append(f"Status: {task[2]}")
                    if task[3]:  # task_context_id
                        context_blocks.append(f"Context ID: {task[3]}")
                    context_blocks.append("")

            # 3. Contesto specifico per obiettivo/linguaggio
            objective = tool_params.get('objective', '')
            language = tool_params.get('language', '')

            if objective:
                context_blocks.append(f"=== OBIETTIVO SPECIFICO ===")
                context_blocks.append(f"Obiettivo: {objective}")
                context_blocks.append("")

            if language:
                # Carica knowledge entities per linguaggio
                cursor.execute("""
                    SELECT name, value FROM knowledge_entities
                    WHERE name LIKE ? OR value LIKE ?
                    ORDER BY created_at DESC LIMIT 3
                """, (f"%{language}%", f"%{language}%"))

                knowledge = cursor.fetchall()
                if knowledge:
                    context_blocks.append(f"=== KNOWLEDGE {language.upper()} ===")
                    for item in knowledge:
                        context_blocks.append(f"{item[0]}: {item[1]}")
                        context_blocks.append("")

            conn.close()

        except Exception as e:
            context_blocks.append(f"=== ERRORE CARICAMENTO CONTESTO ===")
            context_blocks.append(f"Errore: {str(e)}")

        return context_blocks

    def _load_gemini_context(self, task_name: str, tool_params: Dict) -> List[str]:
        """Load context optimized for Gemini CLI"""
        # Context ottimizzato per Gemini (multimodal, reasoning)
        return self._load_reasoning_context(task_name, tool_params, "Gemini")

    def _load_qwen_context(self, task_name: str, tool_params: Dict) -> List[str]:
        """Load context optimized for Qwen Code"""
        # Context ottimizzato per Qwen (coding, implementation)
        return self._load_coding_context(task_name, tool_params, "Qwen")

    def _load_codex_context(self, task_name: str, tool_params: Dict) -> List[str]:
        """Load context optimized for Codex CLI"""
        # Context ottimizzato per Codex (autonomous coding)
        return self._load_autonomous_context(task_name, tool_params, "Codex")

    def _load_task_context(self, task_name: str, tool_params: Dict) -> List[str]:
        """Load context for Task tool delegation"""
        return self._load_generic_context(task_name, tool_params)

    def _load_reasoning_context(self, task_name: str, tool_params: Dict, agent_type: str) -> List[str]:
        """Load context for reasoning-focused agents"""
        context_blocks = []

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            context_blocks.append(f"=== CONTESTO {agent_type.upper()} REASONING ===")

            # Carica task correlati (usano tabelle esistenti)
            cursor.execute("""
                SELECT name, description, status, task_context_id
                FROM tasks
                WHERE (name LIKE ? OR description LIKE ?)
                AND status = 'completed'
                ORDER BY updated_at DESC LIMIT 3
            """, (f"%{task_name}%", f"%{task_name}%"))

            decisions = cursor.fetchall()
            if decisions:
                context_blocks.append("--- TASK CORRELATI COMPLETATI ---")
                for decision in decisions:
                    context_blocks.append(f"Task: {decision[0]}")
                    context_blocks.append(f"Descrizione: {decision[1]}")
                    context_blocks.append(f"Status: {decision[2]}")
                    if decision[3]:  # task_context_id
                        context_blocks.append(f"Context ID: {decision[3]}")
                    context_blocks.append("")

            conn.close()

        except Exception:
            pass

        return context_blocks + self._load_generic_context(task_name, tool_params)

    def _load_coding_context(self, task_name: str, tool_params: Dict, agent_type: str) -> List[str]:
        """Load context for coding-focused agents"""
        context_blocks = []

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            context_blocks.append(f"=== CONTESTO {agent_type.upper()} CODING ===")

            # Carica pattern di codice utilizzati
            language = tool_params.get('language', '')
            if language:
                # Usa memory_blocks per pattern di codice
                cursor.execute("""
                    SELECT content FROM memory_blocks
                    WHERE content LIKE ? OR content LIKE ?
                    ORDER BY created_at DESC LIMIT 5
                """, (f"%{language}%", f"%pattern%"))

                patterns = cursor.fetchall()
                if patterns:
                    context_blocks.append(f"--- MEMORY BLOCKS {language.upper()} ---")
                    for pattern in patterns:
                        context_blocks.append(f"Content: {pattern[0][:200]}...")  # Primi 200 caratteri
                        context_blocks.append("")

            conn.close()

        except Exception:
            pass

        return context_blocks + self._load_generic_context(task_name, tool_params)

    def _load_autonomous_context(self, task_name: str, tool_params: Dict, agent_type: str) -> List[str]:
        """Load context for autonomous agents"""
        context_blocks = []

        context_blocks.append(f"=== CONTESTO {agent_type.upper()} AUTONOMOUS ===")
        context_blocks.append("ISTRUZIONI AUTONOME:")
        context_blocks.append("- Implementa soluzione completa e robusta")
        context_blocks.append("- Includi gestione errori e validazione")
        context_blocks.append("- Segui best practices del linguaggio specificato")
        context_blocks.append("- Documenta decisioni implementative importanti")
        context_blocks.append("")

        return context_blocks + self._load_coding_context(task_name, tool_params, agent_type)

    def _load_generic_context(self, task_name: str, tool_params: Dict) -> List[str]:
        """Load generic context from database"""
        context_blocks = []

        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # Carica contesto generale progetto
            cursor.execute("""
                SELECT name, description, status
                FROM projects
                WHERE status = 'active'
                ORDER BY updated_at DESC LIMIT 1
            """)

            active_project = cursor.fetchone()
            if active_project:
                context_blocks.append("=== PROGETTO ATTIVO ===")
                context_blocks.append(f"Nome: {active_project[0]}")
                context_blocks.append(f"Descrizione: {active_project[1]}")
                context_blocks.append(f"Stato: {active_project[2]}")
                context_blocks.append("")

            # Carica task in corso
            cursor.execute("""
                SELECT name, description, status
                FROM tasks
                WHERE status IN ('active', 'in_progress', 'pending')
                ORDER BY updated_at DESC LIMIT 5
            """)

            active_tasks = cursor.fetchall()
            if active_tasks:
                context_blocks.append("=== TASK IN CORSO ===")
                for task in active_tasks:
                    context_blocks.append(f"• {task[0]} ({task[2]})")
                    if task[1]:
                        context_blocks.append(f"  {task[1]}")
                context_blocks.append("")

            conn.close()

        except Exception as e:
            context_blocks.append(f"Errore caricamento contesto: {str(e)}")

        return context_blocks

def main():
    """CLI interface for context loading"""
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python context-loader.py <agent_name> <task_context_json>"}))
        sys.exit(1)

    agent_name = sys.argv[1]

    try:
        task_context = json.loads(sys.argv[2])
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid task context JSON"}))
        sys.exit(1)

    loader = ContextLoader()
    result = loader.load_context_for_agent(agent_name, task_context)

    print(json.dumps(result))

if __name__ == "__main__":
    main()