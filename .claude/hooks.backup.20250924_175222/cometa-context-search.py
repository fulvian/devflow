#!/usr/bin/env python3
"""
Cometa Brain Advanced Context Search Engine
Ricerca semantica avanzata per contesto e pattern storici
"""

import json
import sys
import sqlite3
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from sklearn.metrics.pairwise import cosine_similarity

DB_PATH = Path('./data/devflow_unified.sqlite')

class SemanticSearchEngine:
    """Motore di ricerca semantica avanzato"""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def search_similar_contexts(self,
                               query_embedding: np.ndarray,
                               context_type: str = 'all',
                               limit: int = 10,
                               threshold: float = 0.7) -> List[Dict]:
        """
        Ricerca contesti simili usando embeddings

        Args:
            query_embedding: Embedding della query
            context_type: Tipo di contesto da cercare
            limit: Numero massimo di risultati
            threshold: Soglia minima di similarità

        Returns:
            Lista di contesti simili ordinati per rilevanza
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Query base per memory blocks
        query = """
            SELECT mb.id, mb.content, mb.type, mb.metadata,
                   mbe.embedding, mb.created_at
            FROM memory_blocks mb
            JOIN memory_block_embeddings mbe ON mb.id = mbe.block_id
        """

        conditions = []
        params = []

        if context_type != 'all':
            conditions.append("mb.type = ?")
            params.append(context_type)

        # Solo contenuti recenti (ultimi 30 giorni)
        thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
        conditions.append("mb.created_at > ?")
        params.append(thirty_days_ago)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY mb.created_at DESC LIMIT 100"

        cursor.execute(query, params)
        candidates = cursor.fetchall()
        conn.close()

        if not candidates:
            return []

        # Calcola similarità usando scikit-learn
        results = []
        for candidate in candidates:
            block_id, content, block_type, metadata, embedding_bytes, created_at = candidate

            # Deserializza embedding
            try:
                candidate_embedding = np.frombuffer(embedding_bytes, dtype=np.float32)

                # Usa cosine_similarity di scikit-learn
                similarity = cosine_similarity(
                    query_embedding.reshape(1, -1),
                    candidate_embedding.reshape(1, -1)
                )[0][0]

                if similarity >= threshold:
                    results.append({
                        'id': block_id,
                        'content': content,
                        'type': block_type,
                        'metadata': json.loads(metadata) if metadata else {},
                        'similarity': float(similarity),
                        'created_at': created_at
                    })
            except Exception as e:
                # Skip malformed embeddings
                continue

        # Ordina per similarità e prendi top N
        results.sort(key=lambda x: x['similarity'], reverse=True)

        # Boost per recency
        for result in results:
            days_old = (datetime.now() - datetime.fromisoformat(result['created_at'])).days
            recency_boost = max(0, 1 - (days_old / 30)) * 0.1
            result['final_score'] = result['similarity'] + recency_boost

        results.sort(key=lambda x: x['final_score'], reverse=True)

        return results[:limit]

    def search_task_patterns(self, task_description: str) -> List[Dict]:
        """
        Cerca pattern storici per task simili

        Returns:
            Lista di pattern applicabili
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Cerca task simili completati con successo
        cursor.execute("""
            SELECT t.id, t.title, t.description, t.complexity_score,
                   t.estimated_duration_minutes, t.completed_at,
                   COUNT(st.id) as subtask_count
            FROM task_contexts t
            LEFT JOIN task_contexts st ON st.parent_task_id = t.id
            WHERE t.status = 'completed'
                AND t.description LIKE ?
            GROUP BY t.id
            ORDER BY t.completed_at DESC
            LIMIT 20
        """, (f"%{task_description[:30]}%",))

        similar_tasks = cursor.fetchall()

        patterns = []
        for task in similar_tasks:
            task_id = task[0]

            # Recupera memory events associati
            cursor.execute("""
                SELECT event_type, COUNT(*) as count
                FROM cometa_memory_stream
                WHERE context_data LIKE ?
                GROUP BY event_type
            """, (f"%{task_id}%",))

            events = cursor.fetchall()

            if events:
                patterns.append({
                    'task_id': task_id,
                    'title': task[1],
                    'complexity': task[3],
                    'duration_minutes': task[4],
                    'subtasks': task[6],
                    'event_pattern': {e[0]: e[1] for e in events},
                    'completed_at': task[5]
                })

        conn.close()
        return patterns

class HistoricalPatternMatcher:
    """Trova pattern storici rilevanti"""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def find_successful_patterns(self,
                                intent_type: str,
                                technology_stack: List[str]) -> List[Dict]:
        """
        Trova pattern di successo per intent e stack tecnologico

        Returns:
            Lista di pattern con success metrics
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Cerca pattern con alto success rate
        cursor.execute("""
            SELECT id, pattern_type, domain, pattern_data,
                   success_rate, usage_count, last_used
            FROM cometa_patterns
            WHERE success_rate > 0.7
                AND (pattern_type LIKE ? OR domain LIKE ?)
            ORDER BY success_rate DESC, usage_count DESC
            LIMIT 10
        """, (f"%{intent_type}%", f"%{intent_type}%"))

        patterns = cursor.fetchall()

        results = []
        for pattern in patterns:
            pattern_data = json.loads(pattern[3])

            # Check tech stack compatibility
            compatible = True
            if 'technologies' in pattern_data:
                pattern_techs = pattern_data['technologies']
                compatible = any(tech in technology_stack for tech in pattern_techs)

            if compatible:
                results.append({
                    'id': pattern[0],
                    'type': pattern[1],
                    'domain': pattern[2],
                    'data': pattern_data,
                    'success_rate': pattern[4],
                    'usage_count': pattern[5],
                    'last_used': pattern[6],
                    'relevance_score': self._calculate_relevance(pattern, intent_type)
                })

        conn.close()

        # Ordina per relevance
        results.sort(key=lambda x: x['relevance_score'], reverse=True)

        return results[:5]

    def _calculate_relevance(self, pattern: Tuple, intent_type: str) -> float:
        """Calcola relevance score per il pattern"""
        base_score = pattern[4]  # success_rate

        # Boost per usage recente
        if pattern[6]:  # last_used
            days_since_use = (datetime.now() - datetime.fromisoformat(pattern[6])).days
            recency_boost = max(0, 1 - (days_since_use / 90)) * 0.2
            base_score += recency_boost

        # Boost per high usage
        usage_boost = min(pattern[5] / 100, 0.2)  # Cap at 0.2
        base_score += usage_boost

        # Boost per exact match
        if intent_type.lower() in pattern[1].lower():
            base_score += 0.1

        return min(base_score, 1.0)

class CrossProjectLearner:
    """Apprende pattern cross-project"""

    def __init__(self, db_path: Path):
        self.db_path = db_path

    def get_cross_project_insights(self, domain: str) -> Dict[str, Any]:
        """
        Recupera insights da progetti simili

        Returns:
            Dict con best practices e lessons learned
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        insights = {
            'domain': domain,
            'best_practices': [],
            'common_pitfalls': [],
            'recommended_stack': [],
            'success_patterns': []
        }

        # Best practices da progetti di successo
        cursor.execute("""
            SELECT p.name, p.description,
                   COUNT(DISTINCT t.id) as total_tasks,
                   SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tasks
            FROM projects p
            JOIN roadmaps r ON r.project_id = p.id
            JOIN macrotasks mt ON mt.roadmap_id = r.id
            JOIN task_contexts t ON t.parent_task_id = mt.id
            WHERE p.status = 'completed'
                AND p.description LIKE ?
            GROUP BY p.id
            HAVING completed_tasks > total_tasks * 0.8
        """, (f"%{domain}%",))

        successful_projects = cursor.fetchall()

        for project in successful_projects:
            insights['best_practices'].append({
                'project': project[0],
                'description': project[1],
                'completion_rate': project[3] / project[2] if project[2] > 0 else 0
            })

        # Common pitfalls da progetti con problemi
        cursor.execute("""
            SELECT DISTINCT cms.context_data
            FROM cometa_memory_stream cms
            WHERE cms.event_type IN ('error', 'bug_fix')
                AND cms.significance_score > 0.7
            ORDER BY cms.created_at DESC
            LIMIT 10
        """, ())

        errors = cursor.fetchall()

        for error in errors:
            try:
                error_data = json.loads(error[0])
                if 'description' in error_data:
                    insights['common_pitfalls'].append(error_data['description'][:100])
            except json.JSONDecodeError:
                continue

        # Stack tecnologico raccomandato
        cursor.execute("""
            SELECT cp.pattern_data, cp.success_rate
            FROM cometa_patterns cp
            WHERE cp.domain = ?
                AND cp.success_rate > 0.8
            ORDER BY cp.usage_count DESC
            LIMIT 5
        """, (domain,))

        tech_patterns = cursor.fetchall()

        tech_stack = set()
        for pattern in tech_patterns:
            try:
                pattern_data = json.loads(pattern[0])
                if 'technologies' in pattern_data:
                    tech_stack.update(pattern_data['technologies'])
            except json.JSONDecodeError:
                continue

        insights['recommended_stack'] = list(tech_stack)

        conn.close()

        return insights

def create_dummy_embedding(text: str) -> np.ndarray:
    """Crea embedding dummy per testing (sostituire con modello reale)"""
    # Hash del testo per consistenza
    import hashlib
    hash_object = hashlib.md5(text.encode())
    hash_hex = hash_object.hexdigest()

    # Converti hash in vettore
    np.random.seed(int(hash_hex[:8], 16))
    return np.random.randn(768).astype(np.float32)

def main():
    """Entry point per ricerca contestuale"""
    try:
        # Questo hook può essere chiamato da altri hooks
        # o direttamente per ricerca

        if len(sys.argv) > 1:
            query = sys.argv[1]
        else:
            input_data = json.loads(sys.stdin.read())
            query = input_data.get('query', '')

        if not query:
            sys.exit(0)

        # Genera embedding per la query (sostituire con modello reale)
        query_embedding = create_dummy_embedding(query)

        # Ricerca semantica
        search_engine = SemanticSearchEngine(DB_PATH)
        similar_contexts = search_engine.search_similar_contexts(
            query_embedding,
            context_type='all',
            limit=5
        )

        print("🔍 SEMANTIC SEARCH RESULTS:")
        for idx, context in enumerate(similar_contexts, 1):
            print(f"\n{idx}. Similarity: {context['similarity']:.3f}")
            print(f"   Type: {context['type']}")
            print(f"   Content: {context['content'][:150]}...")
            print(f"   Created: {context['created_at']}")

        # Pattern matching
        pattern_matcher = HistoricalPatternMatcher(DB_PATH)
        patterns = pattern_matcher.find_successful_patterns(
            intent_type='implementation',
            technology_stack=['python', 'sqlite', 'typescript']
        )

        if patterns:
            print("\n📊 SUCCESSFUL PATTERNS:")
            for pattern in patterns[:3]:
                print(f"\n   {pattern['type']} (success: {pattern['success_rate']:.2f})")
                print(f"   Used {pattern['usage_count']} times")
                print(f"   Relevance: {pattern['relevance_score']:.2f}")

        sys.exit(0)

    except Exception as e:
        sys.stderr.write(f"Context search error: {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()