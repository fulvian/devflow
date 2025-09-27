#!/usr/bin/env python3
"""
Test semplice dell'Enhanced Memory Integration con query dirette
"""

import sqlite3
import re
from pathlib import Path

def extract_semantic_keywords(prompt):
    """Estrai keywords semantiche dal prompt"""
    stop_words = {'the', 'is', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an',
                  'che', 'con', 'per', 'del', 'della', 'dei', 'delle', 'il', 'la', 'le', 'gli', 'lo', 'una', 'un'}

    words = re.findall(r'\b[a-zA-Z]{3,}\b', prompt.lower())
    keywords = list(set([word for word in words if word not in stop_words]))
    return keywords[:8]

def query_cometa_memory(keywords, prompt):
    """Query Cometa database per contesti rilevanti"""
    db_path = Path(__file__).parent / "data" / "devflow_unified.sqlite"
    if not db_path.exists():
        return []

    contexts = []

    with sqlite3.connect(str(db_path)) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Query memory stream
        search_conditions = []
        for keyword in keywords:
            search_conditions.append(f"cms.context_data LIKE '%{keyword}%'")

        if search_conditions:
            search_terms = " OR ".join(search_conditions)

            query = f"""
            SELECT DISTINCT cms.context_data, cms.event_type, cms.created_at, cms.significance_score
            FROM cometa_memory_stream cms
            WHERE ({search_terms})
               AND cms.event_type IN ('task_creation', 'bug_fix', 'architecture', 'config')
               AND LENGTH(cms.context_data) > 50
            ORDER BY cms.significance_score DESC, cms.created_at DESC
            LIMIT 3
            """

            cursor.execute(query)
            results = cursor.fetchall()

            for row in results:
                context_entry = f"[Memory/{row['event_type'].title()}] {row['context_data'][:180]}..."
                contexts.append(context_entry)

    return contexts

# Test con frasi in linguaggio naturale
test_prompts = [
    "come posso migliorare le performance del sistema di database?",
    "ho bisogno di aiuto con la configurazione dei task",
    "quali sono i problemi di memory injection recentemente risolti?",
    "dammi informazioni sui cognitive memory systems"
]

print("🧪 Test Enhanced Memory Integration - Linguaggio Naturale")
print("=" * 60)

for i, prompt in enumerate(test_prompts, 1):
    print(f"\n{i}. Prompt: '{prompt}'")

    # Estrai keywords
    keywords = extract_semantic_keywords(prompt)
    print(f"   📝 Keywords: {keywords}")

    # Query memoria
    contexts = query_cometa_memory(keywords, prompt)
    print(f"   🎯 Contesti trovati: {len(contexts)}")

    if contexts:
        for j, context in enumerate(contexts, 1):
            print(f"      {j}. {context[:120]}...")
    else:
        print("      Nessun contesto trovato")

print(f"\n✅ Test completato")
print("=" * 60)