#!/usr/bin/env python3
"""
Universal Memory Injection System - SOLUZIONE DEFINITIVA
Bypassa i bug di Claude Code con attivazione automatica universale.

Features:
- Pattern recognition UNIVERSALE per TUTTE le operazioni
- Automatic memory injection per OGNI query tecnica
- Bypass completo dei bug PreToolUse/PostToolUse
- Context injection SEMPRE attivo su UserPromptSubmit
- Database query intelligente con relevance scoring
- Cache sistema embeddings per performance
"""

import sys
import os
import json
import re
import sqlite3
import hashlib
import logging
import asyncio
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UniversalMemoryInjector:
    """Sistema di iniezione memoria universale - bypass bug Claude Code"""

    def __init__(self):
        self.project_root = Path("/Users/fulvioventura/devflow")
        self.db_path = self.project_root / "data" / "devflow_unified.sqlite"
        self.cache_dir = self.project_root / ".claude" / "cache" / "memory"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        # Hybrid Search Configuration (Context7-compliant weights)
        self.hybrid_weights = {
            'semantic_sql': 0.2,    # Traditional LIKE queries
            'vector_similarity': 0.8  # Ollama embeddings (prioritized)
        }

        # Vector search setup
        self.vector_engine = None
        self._init_vector_engine()

        # Pattern universali per attivazione automatica (COPRIRE TUTTO)
        self.universal_patterns = [
            # Sviluppo e programmazione
            r'(?i)(code|coding|program|implement|function|class|method|variable)',
            r'(?i)(debug|error|fix|bug|issue|problem|troubleshoot)',
            r'(?i)(test|testing|unit.*test|integration.*test|coverage)',
            r'(?i)(refactor|optimize|improve|enhance|upgrade|migrate)',
            r'(?i)(api|endpoint|service|database|query|schema)',
            r'(?i)(frontend|backend|client|server|architecture)',

            # DevFlow specifico
            r'(?i)(devflow|cometa|vector.*embedding|semantic.*search)',
            r'(?i)(memory.*injection|context.*injection|enhanced.*memory)',
            r'(?i)(ollama|embeddinggemma|claude.*code|hook)',
            r'(?i)(performance|optimization|cache|latency)',

            # Operazioni tecniche generali
            r'(?i)(install|setup|configure|deploy|build)',
            r'(?i)(git|commit|push|pull|merge|branch)',
            r'(?i)(npm|node|python|typescript|javascript)',
            r'(?i)(docker|kubernetes|container|service)',

            # Analisi e documentazione
            r'(?i)(analyze|analysis|understand|explain|document)',
            r'(?i)(how.*to|what.*is|why.*does|where.*can)',
            r'(?i)(best.*practice|pattern|approach|solution)',
            r'(?i)(guide|tutorial|example|sample|demo)',

            # Gestione progetti
            r'(?i)(task|project|workflow|process|management)',
            r'(?i)(plan|strategy|roadmap|milestone|goal)',
            r'(?i)(review|audit|check|validate|verify)',

            # Tecnologie specifiche
            r'(?i)(react|vue|angular|next\.?js|express|fastify)',
            r'(?i)(postgres|mysql|mongodb|redis|sqlite)',
            r'(?i)(aws|azure|gcp|cloud|serverless)',
            r'(?i)(ai|ml|machine.*learning|neural|model)',

            # File operations (SEMPRE attivo per operazioni file)
            r'(?i)(file|folder|directory|path|create|edit|write|read)',
            r'(?i)(config|settings|environment|env|json|yaml|toml)',

            # ENHANCED: Semantic pattern specializzati (da enhanced-memory-integration)
            # 1. Implementation/architecture questions (IT/EN)
            r'\b(cosa|what)\s+(abbiamo|have we)\s+(fatto|done|implementato|implemented)\b',
            r'\b(come|how)\s+(funziona|works?|è implementato|is implemented)\b',
            r'\b(quali|which|what)\s+.*(cambiamenti|changes|modifiche|updates)\b',
            r'\b(status|stato)\s+(del|of)\s+(progetto|project|sistema|system)\b',
            r'\b(progresso|progress|avanzamento|advancement)\b',
            r'\banalizza.*architettura\b',
            r'\bintegra.*con\b',
            r'\bcome.*si.*integra\b',

            # 2. Technical analysis requests
            r'\banalizza\b.*\b(sistema|system|architettura|architecture|codice|code)\b',
            r'\b(confronta|compare|compara)\b.*\b(con|with|patterns?)\b',
            r'\b(esamina|examine|studia|study)\b.*\b(implementazione|implementation)\b',
            r'\b(documenta|document)\b.*\b(integrazione|integration)\b',

            # 3. Task and project queries
            r'\b(critical.?issues?.?todos?|task|compito|attività)\b',
            r'\b(per\s+implementare|to\s+implement|implementazione\s+di)\b',
            r'\b(memoria|memory).*\b(sistema|system|integrazione|integration)\b',
            r'\b(enhanced.*memory|kernel.*memory|microsoft.*patterns)\b',

            # 4. System debugging and troubleshooting
            r'\b(problema|problem|issue|errore|error)\b.*\b(log|sessione|session)\b',
            r'\b(hook|trigger|attiva|attivare|activate)\b.*\b(memory|memoria)\b',
            r'\b(perché|why|because).*\b(non|not|doesn\'t)\s+(si\s+attiva|activate)\b',

            # Sicurezza e monitoraggio
            r'(?i)(security|auth|permission|access|token|key)',
            r'(?i)(log|monitor|metric|alert|notification)',
            r'(?i)(backup|restore|recovery|migration|sync)'
        ]

        # Keywords high-priority per ranking
        self.high_priority_keywords = [
            'devflow', 'cometa', 'vector', 'embedding', 'semantic', 'search',
            'ollama', 'claude', 'memory', 'injection', 'context', 'hook',
            'performance', 'optimization', 'cache', 'error', 'bug', 'fix'
        ]

    def _init_vector_engine(self):
        """Initialize Ollama vector engine for hybrid search"""
        try:
            # Import vector engine dynamically to avoid dependency issues
            sys.path.append(str(self.project_root / "src" / "core" / "memory"))
            from vector_embeddings_engine import OllamaEmbeddingsEngine

            self.vector_engine = OllamaEmbeddingsEngine(str(self.project_root))
            logger.info("✅ Ollama vector engine initialized for hybrid search")
        except Exception as e:
            logger.warning(f"Vector engine initialization failed: {e}")
            logger.info("Hybrid search will fall back to semantic-only mode")
            self.vector_engine = None

    def should_activate(self, prompt: str) -> tuple[bool, int, List[str]]:
        """
        Determina se attivare memory injection usando pattern universali.
        Returns: (should_activate, score, matched_patterns)
        """
        if not prompt or len(prompt.strip()) < 5:
            return False, 0, []

        prompt_lower = prompt.lower()
        matched_patterns = []
        score = 0

        # Check universal patterns
        for pattern in self.universal_patterns:
            if re.search(pattern, prompt):
                matched_patterns.append(pattern)
                score += 10

        # Boost score per high-priority keywords
        for keyword in self.high_priority_keywords:
            if keyword in prompt_lower:
                score += 25
                matched_patterns.append(f"high-priority:{keyword}")

        # Length bonus (queries più lunghe sono spesso più tecniche)
        if len(prompt) > 100:
            score += 15
        elif len(prompt) > 50:
            score += 10

        # Question patterns bonus
        question_patterns = [r'\?', r'(?i)how.*to', r'(?i)what.*is', r'(?i)why.*does']
        for pattern in question_patterns:
            if re.search(pattern, prompt):
                score += 5

        # SOGLIA UNIVERSALE BASSA = Cattura quasi tutto
        should_activate = score >= 10

        logger.info(f"Activation check: score={score}, patterns={len(matched_patterns)}, activate={should_activate}")

        return should_activate, score, matched_patterns

    def extract_keywords(self, prompt: str) -> List[str]:
        """Estrae keywords rilevanti dal prompt per database query"""
        # Rimuovi stop words comuni
        stop_words = {
            'the', 'is', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'a', 'an', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
            'your', 'he', 'she', 'it', 'they', 'them', 'their', 'can', 'could', 'should',
            'would', 'will', 'have', 'has', 'had', 'do', 'does', 'did', 'be', 'being', 'been',
            'il', 'la', 'le', 'lo', 'gli', 'un', 'una', 'di', 'da', 'in', 'con', 'su', 'per',
            'come', 'cosa', 'dove', 'quando', 'perche', 'che', 'non', 'sono', 'hai', 'posso'
        }

        # Extract words (3+ chars, alphanumeric + common tech symbols)
        words = re.findall(r'\b[a-zA-Z0-9._-]{3,}\b', prompt.lower())
        keywords = [word for word in words if word not in stop_words]

        # Priority ranking per relevance
        keyword_scores = {}
        for keyword in keywords:
            score = 1

            # Boost technical terms
            if keyword in self.high_priority_keywords:
                score += 5
            elif any(tech in keyword for tech in ['api', 'db', 'sql', 'js', 'ts', 'py']):
                score += 3
            elif len(keyword) > 6:  # Longer terms often more specific
                score += 2

            keyword_scores[keyword] = score

        # Return top keywords sorted by score
        sorted_keywords = sorted(keyword_scores.keys(), key=lambda k: keyword_scores[k], reverse=True)
        return sorted_keywords[:15]  # Top 15 keywords

    async def hybrid_search(self, query: str, keywords: List[str], limit: int = 4) -> List[Dict[str, Any]]:
        """
        Hybrid search combinando SQL semantico + Ollama vector similarity.
        Weights: 0.2 semantic + 0.8 vector (Context7 best practices).
        """
        contexts = []

        try:
            # 1. Traditional semantic SQL search (20% weight)
            semantic_contexts = self.query_memory_database(keywords, query)
            for ctx in semantic_contexts:
                ctx['search_type'] = 'semantic'
                ctx['base_score'] = ctx['relevance'] * self.hybrid_weights['semantic_sql']
                contexts.append(ctx)

            # 2. Vector similarity search (80% weight) - se disponibile
            if self.vector_engine:
                try:
                    vector_matches = await self.vector_engine.semantic_search(
                        query, limit=limit, min_similarity=0.7
                    )

                    for match in vector_matches:
                        contexts.append({
                            'content': match.content[:200] + "..." if len(match.content) > 200 else match.content,
                            'source': f"Vector/{match.event_type}",
                            'relevance': match.similarity_score,
                            'search_type': 'vector',
                            'base_score': match.similarity_score * self.hybrid_weights['vector_similarity'],
                            'date': match.created_at
                        })
                    logger.info(f"🎯 Vector search found {len(vector_matches)} matches with Ollama")
                except Exception as e:
                    logger.warning(f"Vector search failed, falling back to semantic: {e}")

            # 3. Combine and rank by hybrid score
            contexts.sort(key=lambda x: x['base_score'], reverse=True)

            # 4. Deduplicate similar content (simple content overlap check)
            unique_contexts = []
            seen_content = set()

            for ctx in contexts:
                content_key = ctx['content'][:100].lower()  # First 100 chars for similarity
                if content_key not in seen_content:
                    seen_content.add(content_key)
                    unique_contexts.append(ctx)

                    if len(unique_contexts) >= limit:
                        break

            logger.info(f"🔄 Hybrid search: {len(unique_contexts)} unique contexts from {len(contexts)} total")
            return unique_contexts

        except Exception as e:
            logger.error(f"Hybrid search failed: {e}")
            # Fallback to traditional semantic search
            return self.query_memory_database(keywords, query)

    def query_memory_database(self, keywords: List[str], original_prompt: str) -> List[Dict[str, Any]]:
        """Query database per relevant contexts usando multiple sources (traditional semantic)"""
        if not self.db_path.exists():
            logger.warning(f"Database not found: {self.db_path}")
            return []

        contexts = []

        try:
            with sqlite3.connect(str(self.db_path)) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # 1. Query Cometa Memory Stream (main source)
                if keywords:
                    memory_conditions = []
                    for keyword in keywords[:8]:  # Limit per performance
                        memory_conditions.append(f"cms.context_data LIKE '%{keyword}%'")

                    if memory_conditions:
                        memory_query = f"""
                        SELECT DISTINCT
                            cms.context_data,
                            cms.event_type,
                            cms.created_at,
                            cms.significance_score,
                            cms.tool_name,
                            'memory_stream' as source_type
                        FROM cometa_memory_stream cms
                        WHERE ({' OR '.join(memory_conditions)})
                           AND cms.event_type IN ('task_creation', 'file_creation', 'tool_usage', 'bug_fix', 'architecture')
                           AND LENGTH(cms.context_data) > 30
                           AND cms.context_data NOT LIKE '%test%test%'
                        ORDER BY cms.significance_score DESC, cms.created_at DESC
                        LIMIT 4
                        """

                        cursor.execute(memory_query)
                        for row in cursor.fetchall():
                            contexts.append({
                                'content': row['context_data'][:200] + "..." if len(row['context_data']) > 200 else row['context_data'],
                                'source': f"Memory/{row['event_type']}",
                                'relevance': row['significance_score'] or 0.5,
                                'date': row['created_at']
                            })

                # 2. Query Task Contexts (current work)
                task_conditions = []
                for keyword in keywords[:5]:
                    task_conditions.append(f"tc.description LIKE '%{keyword}%' OR tc.title LIKE '%{keyword}%'")

                if task_conditions:
                    task_query = f"""
                    SELECT DISTINCT
                        tc.title,
                        tc.description,
                        tc.created_at,
                        t.status,
                        'task_context' as source_type
                    FROM task_contexts tc
                    JOIN tasks t ON tc.id = t.task_context_id
                    WHERE ({' OR '.join(task_conditions)})
                       AND t.status IN ('in_progress', 'pending')
                       AND LENGTH(tc.description) > 20
                    ORDER BY tc.created_at DESC
                    LIMIT 3
                    """

                    cursor.execute(task_query)
                    for row in cursor.fetchall():
                        contexts.append({
                            'content': f"{row['title']}: {row['description'][:150]}..." if len(row['description']) > 150 else f"{row['title']}: {row['description']}",
                            'source': f"Task/{row['status']}",
                            'relevance': 0.8,
                            'date': row['created_at']
                        })

                # 3. Query Cometa Patterns (proven solutions) - Handle missing columns gracefully
                try:
                    pattern_conditions = []
                    for keyword in keywords[:5]:
                        pattern_conditions.append(f"pattern_data LIKE '%{keyword}%'")

                    if pattern_conditions:
                        pattern_query = f"""
                        SELECT DISTINCT
                            pattern_data,
                            success_rate,
                            domain,
                            'pattern' as source_type
                        FROM cometa_patterns
                        WHERE ({' OR '.join(pattern_conditions)})
                           AND success_rate > 0.3
                           AND LENGTH(pattern_data) > 20
                        ORDER BY success_rate DESC
                        LIMIT 2
                        """

                        cursor.execute(pattern_query)
                        for row in cursor.fetchall():
                            contexts.append({
                                'content': row['pattern_data'][:120] + "..." if len(row['pattern_data']) > 120 else row['pattern_data'],
                                'source': f"Pattern/{row['domain']} ({row['success_rate']:.1%})",
                                'relevance': float(row['success_rate']),
                                'date': datetime.now().isoformat()
                            })
                except sqlite3.OperationalError as e:
                    if "no such table" in str(e) or "no such column" in str(e):
                        logger.debug(f"Patterns table/column not available: {e}")
                    else:
                        raise

        except Exception as e:
            logger.error(f"Database query failed: {e}")

        return contexts

    def format_memory_context(self, contexts: List[Dict[str, Any]], activation_score: int, matched_patterns: List[str]) -> str:
        """Format contexts per injection in Claude prompt (Hybrid Search Enhanced)"""
        if not contexts:
            return ""

        # Detect search types
        has_vector = any(ctx.get('search_type') == 'vector' for ctx in contexts)
        has_semantic = any(ctx.get('search_type') == 'semantic' for ctx in contexts)

        search_mode = "🔄 HYBRID" if (has_vector and has_semantic) else "🎯 VECTOR" if has_vector else "📝 SEMANTIC"

        context_parts = [
            f"\n🧠 [ENHANCED MEMORY CONTEXT - AUTO-ACTIVATED] Score: {activation_score}",
            f"📊 {search_mode} | Patterns: {len(matched_patterns)} | Contexts: {len(contexts)}\n"
        ]

        for i, ctx in enumerate(contexts, 1):
            # Enhanced relevance indicators with search type
            search_type = ctx.get('search_type', 'semantic')
            base_score = ctx.get('base_score', ctx.get('relevance', 0))

            if search_type == 'vector':
                indicator = "🎯" if base_score > 0.6 else "🔍" if base_score > 0.4 else "🔎"
            else:
                indicator = "🔥" if base_score > 0.7 else "⚡" if base_score > 0.5 else "💡"

            # Show hybrid score if available
            score_display = f"({base_score:.2f})" if 'base_score' in ctx else ""

            context_parts.append(f"[{i}] {indicator} {ctx['source']}{score_display}: {ctx['content']}")

        footer = f"\n📝 Above contexts auto-injected based on {search_mode.lower()} relevance to your query.\n"
        context_parts.append(footer)

        return "\n".join(context_parts)

    def log_activation(self, prompt: str, score: int, patterns: List[str], contexts_found: int):
        """Log activation per monitoring e debugging"""
        try:
            log_entry = {
                'timestamp': datetime.now().isoformat(),
                'activation_score': score,
                'patterns_matched': len(patterns),
                'contexts_injected': contexts_found,
                'prompt_length': len(prompt),
                'prompt_preview': prompt[:100] + "..." if len(prompt) > 100 else prompt,
                'top_patterns': patterns[:5]  # Top 5 patterns for analysis
            }

            log_file = self.project_root / ".claude" / "logs" / "universal-memory-activation.jsonl"
            log_file.parent.mkdir(parents=True, exist_ok=True)

            with open(log_file, 'a') as f:
                f.write(json.dumps(log_entry) + '\n')

        except Exception as e:
            logger.error(f"Activation logging failed: {e}")

def main():
    """Entry point per Universal Memory Injection"""
    try:
        # Read input from stdin (Claude Code hook data) or command line for testing
        if len(sys.argv) > 1:
            # Command line testing mode
            prompt = ' '.join(sys.argv[1:])
            input_data = {'prompt': prompt}
        elif not sys.stdin.isatty():
            # Hook mode - read from stdin
            stdin_content = sys.stdin.read().strip()
            if stdin_content:
                input_data = json.loads(stdin_content)
            else:
                input_data = {'prompt': ''}
        else:
            # No input
            input_data = {'prompt': ''}

        prompt = input_data.get('prompt', '')

        if not prompt:
            logger.debug("No prompt provided, skipping memory injection")
            sys.exit(0)

        # Initialize memory injector
        injector = UniversalMemoryInjector()

        # Check activation
        should_activate, score, patterns = injector.should_activate(prompt)

        if not should_activate:
            logger.debug(f"Memory injection not activated (score: {score})")
            sys.exit(0)

        # Extract keywords and perform hybrid search
        keywords = injector.extract_keywords(prompt)

        # Use async hybrid search (with fallback to sync semantic search)
        try:
            contexts = asyncio.run(injector.hybrid_search(prompt, keywords))
            logger.info(f"🔥 Hybrid search completed with {len(contexts)} contexts")
        except Exception as e:
            logger.warning(f"Hybrid search failed, using fallback semantic: {e}")
            contexts = injector.query_memory_database(keywords, prompt)

        # Log activation
        injector.log_activation(prompt, score, patterns, len(contexts))

        # Generate and output context
        if contexts:
            memory_context = injector.format_memory_context(contexts, score, patterns)
            print(memory_context)
            logger.info(f"Memory context injected: {len(contexts)} contexts, {len(memory_context)} chars")
        else:
            logger.info("No relevant contexts found in database")

        sys.exit(0)

    except Exception as e:
        logger.error(f"Universal Memory Injection failed: {e}")
        # Don't fail the hook - continue without memory injection
        sys.exit(0)

if __name__ == "__main__":
    main()