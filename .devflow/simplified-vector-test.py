#!/usr/bin/env python3
"""
Simplified Vector Injection Test - Diretto su database reale
"""

import sqlite3
import json
import time
from typing import Dict, List, Any

class SimplifiedVectorTest:
    def __init__(self):
        self.db_path = "data/devflow_unified.sqlite"

    def test_semantic_search(self, query: str, test_id: int, complexity: str) -> Dict[str, Any]:
        """Test ricerca semantica diretta nel database"""
        start_time = time.time()

        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Simula ricerca semantica basata su parole chiave
            search_terms = query.lower().split()

            # Query per trovare contesti correlati
            search_query = """
            SELECT
                id,
                context_data,
                significance_score,
                created_at,
                LENGTH(context_data) as context_length
            FROM cometa_memory_stream
            WHERE semantic_embedding IS NOT NULL
            AND (
                LOWER(context_data) LIKE ? OR
                LOWER(context_data) LIKE ? OR
                LOWER(context_data) LIKE ?
            )
            ORDER BY significance_score DESC
            LIMIT 5
            """

            # Preparazione pattern di ricerca
            patterns = [f"%{term}%" for term in search_terms[:3]]
            if len(patterns) < 3:
                patterns.extend(['%'] * (3 - len(patterns)))

            cursor.execute(search_query, patterns)
            results = cursor.fetchall()

            # Calcola score basato su risultati
            contexts_found = len(results)
            if contexts_found == 0:
                semantic_score = 0
            else:
                # Score basato su numero di risultati e loro significance
                base_score = min(contexts_found * 10, 50)
                avg_significance = sum(r['significance_score'] or 0.5 for r in results) / contexts_found
                semantic_score = int(base_score * avg_significance)

            execution_time = (time.time() - start_time) * 1000

            conn.close()

            return {
                "test_id": test_id,
                "query": query,
                "complexity": complexity,
                "contexts_found": contexts_found,
                "semantic_score": semantic_score,
                "execution_time_ms": round(execution_time, 2),
                "success": contexts_found > 0,
                "sample_context": results[0]['context_data'][:100] + "..." if results else None
            }

        except Exception as e:
            return {
                "test_id": test_id,
                "query": query,
                "complexity": complexity,
                "contexts_found": 0,
                "semantic_score": 0,
                "execution_time_ms": 0,
                "success": False,
                "error": str(e)
            }

def main():
    tester = SimplifiedVectorTest()

    # 20 test di varia complessità
    test_queries = [
        # BASSA COMPLESSITÀ (1-5)
        ("database", 1, "low"),
        ("hook", 2, "low"),
        ("embedding", 3, "low"),
        ("context", 4, "low"),
        ("daemon", 5, "low"),

        # MEDIA COMPLESSITÀ (6-10)
        ("orchestrator management", 6, "medium"),
        ("performance monitoring", 7, "medium"),
        ("semantic vector search", 8, "medium"),
        ("automated processing", 9, "medium"),
        ("context injection system", 10, "medium"),

        # ALTA COMPLESSITÀ (11-15)
        ("context7 architecture implementation", 11, "high"),
        ("vector embedding processing optimization", 12, "high"),
        ("multi-agent orchestration with fallback", 13, "high"),
        ("enforcement rules penalty system", 14, "high"),
        ("unified orchestrator api selection", 15, "high"),

        # MOLTO ALTA COMPLESSITÀ (16-20)
        ("end-to-end embedding creation with rollback", 16, "very_high"),
        ("semantic vector injection with cross-verification", 17, "very_high"),
        ("multi-agent orchestration performance monitoring", 18, "very_high"),
        ("cryptographic audit trail penalty escalation", 19, "very_high"),
        ("complete devflow architecture enforcement", 20, "very_high")
    ]

    print("🧪 DEVFLOW VECTOR INJECTION TEST SUITE")
    print("=" * 60)
    print(f"📊 Database: data/devflow_unified.sqlite")
    print(f"🕐 Start: {time.strftime('%H:%M:%S')}")
    print("=" * 60)

    results = []

    for query, test_id, complexity in test_queries:
        print(f"\n🔍 Test {test_id:2d}/20 [{complexity:9s}]: {query[:45]}...")

        result = tester.test_semantic_search(query, test_id, complexity)
        results.append(result)

        # Feedback immediato
        status = "✅" if result["success"] else "❌"
        score = result["semantic_score"]
        contexts = result["contexts_found"]
        time_ms = result["execution_time_ms"]

        print(f"   {status} Score: {score:3d} | Contexts: {contexts:2d} | Time: {time_ms:6.1f}ms")

        if result.get("sample_context"):
            print(f"   📝 Sample: {result['sample_context'][:60]}...")

    # Genera report finale
    print("\n" + "=" * 60)
    print("📊 REPORT FINALE")
    print("=" * 60)

    total_tests = len(results)
    successful = sum(1 for r in results if r["success"])
    total_score = sum(r["semantic_score"] for r in results)
    total_contexts = sum(r["contexts_found"] for r in results)
    avg_time = sum(r["execution_time_ms"] for r in results) / total_tests

    print(f"✅ Success Rate: {successful}/{total_tests} ({successful/total_tests*100:.1f}%)")
    print(f"📈 Total Score: {total_score} (avg: {total_score/total_tests:.1f})")
    print(f"🔍 Total Contexts: {total_contexts} (avg: {total_contexts/total_tests:.1f})")
    print(f"⚡ Avg Time: {avg_time:.1f}ms")

    # Analisi per complessità
    print("\n📊 ANALISI PER COMPLESSITÀ:")
    for complexity in ["low", "medium", "high", "very_high"]:
        comp_results = [r for r in results if r["complexity"] == complexity]
        if comp_results:
            comp_success = sum(1 for r in comp_results if r["success"])
            comp_score = sum(r["semantic_score"] for r in comp_results) / len(comp_results)
            print(f"  {complexity:9s}: {comp_success}/{len(comp_results)} success, avg score: {comp_score:.1f}")

    # Performance tiers
    print("\n🎯 PERFORMANCE TIERS:")
    high_perf = sum(1 for r in results if r["semantic_score"] >= 30)
    medium_perf = sum(1 for r in results if 15 <= r["semantic_score"] < 30)
    low_perf = sum(1 for r in results if 5 <= r["semantic_score"] < 15)
    failed_perf = sum(1 for r in results if r["semantic_score"] < 5)

    print(f"  🚀 High (≥30):   {high_perf:2d} ({high_perf/total_tests*100:.1f}%)")
    print(f"  📈 Medium (15-29): {medium_perf:2d} ({medium_perf/total_tests*100:.1f}%)")
    print(f"  📊 Low (5-14):    {low_perf:2d} ({low_perf/total_tests*100:.1f}%)")
    print(f"  ❌ Failed (<5):   {failed_perf:2d} ({failed_perf/total_tests*100:.1f}%)")

    # Salva report dettagliato
    report = {
        "execution_summary": {
            "total_tests": total_tests,
            "successful_tests": successful,
            "success_rate": successful/total_tests,
            "total_score": total_score,
            "average_score": total_score/total_tests,
            "total_contexts_found": total_contexts,
            "average_execution_time_ms": avg_time
        },
        "detailed_results": results,
        "timestamp": time.time()
    }

    with open(".devflow/vector-test-report.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n💾 Report saved: .devflow/vector-test-report.json")
    print("=" * 60)

if __name__ == "__main__":
    main()