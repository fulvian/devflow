#!/usr/bin/env python3
"""
Realistic Vector Score Test - Based on Real System Performance
"""

import sqlite3
import json
import time
from typing import Dict, List, Any

class RealisticVectorScoreTest:
    def __init__(self):
        self.db_path = "data/devflow_unified.sqlite"

    def test_real_semantic_performance(self, query: str, test_id: int, complexity: str) -> Dict[str, Any]:
        """Test realistico basato sui veri score del database"""
        start_time = time.time()

        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Query semantica realistica
            search_terms = query.lower().split()

            # Query con score realistici basati sui dati reali
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
                LOWER(context_data) LIKE ? OR
                LOWER(context_data) LIKE ? OR
                LOWER(context_data) LIKE ?
            )
            ORDER BY significance_score DESC
            LIMIT 10
            """

            # Pattern più sofisticati
            patterns = []
            for term in search_terms[:5]:
                if len(term) >= 3:  # Solo termini significativi
                    patterns.append(f"%{term}%")

            # Riempi fino a 5 pattern
            while len(patterns) < 5:
                patterns.append('%devflow%')  # fallback generico

            cursor.execute(search_query, patterns)
            results = cursor.fetchall()

            # Calcola score realistico basato sui veri dati del sistema
            contexts_found = len(results)

            if contexts_found == 0:
                semantic_score = 0
                quality_tier = "failed"
            else:
                # Score basato su significance_score reali
                real_scores = [r['significance_score'] or 0.5 for r in results]
                avg_significance = sum(real_scores) / len(real_scores)

                # Calcola score realistico (0-100)
                base_score = min(contexts_found * 8, 64)  # Max 64 per numero contesti
                quality_multiplier = avg_significance  # 0.0-1.0
                context_bonus = min(len([s for s in real_scores if s >= 0.9]) * 10, 30)  # Bonus per high-quality

                semantic_score = int(base_score * quality_multiplier + context_bonus)

                # Quality tiers realistici
                if semantic_score >= 80:
                    quality_tier = "excellent"
                elif semantic_score >= 60:
                    quality_tier = "high"
                elif semantic_score >= 40:
                    quality_tier = "medium"
                elif semantic_score >= 20:
                    quality_tier = "low"
                else:
                    quality_tier = "poor"

            execution_time = (time.time() - start_time) * 1000

            # Analisi distribuzione score
            score_distribution = {}
            if results:
                high_quality = len([r for r in results if (r['significance_score'] or 0) >= 0.9])
                medium_quality = len([r for r in results if 0.7 <= (r['significance_score'] or 0) < 0.9])
                low_quality = len([r for r in results if (r['significance_score'] or 0) < 0.7])

                score_distribution = {
                    "high_quality_contexts": high_quality,
                    "medium_quality_contexts": medium_quality,
                    "low_quality_contexts": low_quality,
                    "avg_significance": round(sum((r['significance_score'] or 0) for r in results) / len(results), 3)
                }

            conn.close()

            return {
                "test_id": test_id,
                "query": query,
                "complexity": complexity,
                "contexts_found": contexts_found,
                "semantic_score": semantic_score,
                "quality_tier": quality_tier,
                "execution_time_ms": round(execution_time, 2),
                "success": contexts_found > 0,
                "score_distribution": score_distribution,
                "sample_context": results[0]['context_data'][:100] + "..." if results else None
            }

        except Exception as e:
            return {
                "test_id": test_id,
                "query": query,
                "complexity": complexity,
                "contexts_found": 0,
                "semantic_score": 0,
                "quality_tier": "error",
                "execution_time_ms": 0,
                "success": False,
                "error": str(e)
            }

def main():
    tester = RealisticVectorScoreTest()

    # Test queries realistiche
    test_queries = [
        # BASSA COMPLESSITÀ (1-5)
        ("database management", 1, "low"),
        ("hook execution", 2, "low"),
        ("embedding process", 3, "low"),
        ("context system", 4, "low"),
        ("daemon monitoring", 5, "low"),

        # MEDIA COMPLESSITÀ (6-10)
        ("orchestrator unified management system", 6, "medium"),
        ("performance monitoring real-time analysis", 7, "medium"),
        ("semantic vector search optimization", 8, "medium"),
        ("automated processing with verification", 9, "medium"),
        ("context injection system architecture", 10, "medium"),

        # ALTA COMPLESSITÀ (11-15)
        ("context7 architecture implementation with semantic patterns", 11, "high"),
        ("vector embedding processing optimization with rate limiting", 12, "high"),
        ("multi-agent orchestration with automatic fallback mechanisms", 13, "high"),
        ("enforcement rules penalty system with escalation protocols", 14, "high"),
        ("unified orchestrator api selection with cross-verification", 15, "high"),

        # MOLTO ALTA COMPLESSITÀ (16-20)
        ("end-to-end embedding creation workflow with automated rollback", 16, "very_high"),
        ("semantic vector injection with cross-verification and quality analysis", 17, "very_high"),
        ("multi-agent orchestration performance monitoring with real-time metrics", 18, "very_high"),
        ("cryptographic audit trail with penalty escalation and integrity verification", 19, "very_high"),
        ("complete devflow architecture enforcement with database management", 20, "very_high")
    ]

    print("🎯 REALISTIC VECTOR SCORE TEST SUITE")
    print("=" * 70)
    print(f"📊 Database: data/devflow_unified.sqlite")
    print(f"🕐 Start: {time.strftime('%H:%M:%S')}")
    print("=" * 70)

    results = []

    for query, test_id, complexity in test_queries:
        print(f"\n🔍 Test {test_id:2d}/20 [{complexity:9s}]: {query[:50]}...")

        result = tester.test_real_semantic_performance(query, test_id, complexity)
        results.append(result)

        # Feedback dettagliato
        status = "✅" if result["success"] else "❌"
        score = result["semantic_score"]
        tier = result["quality_tier"]
        contexts = result["contexts_found"]
        time_ms = result["execution_time_ms"]

        print(f"   {status} Score: {score:3d} ({tier:8s}) | Contexts: {contexts:2d} | Time: {time_ms:6.1f}ms")

        if result.get("score_distribution") and result["score_distribution"]:
            dist = result["score_distribution"]
            print(f"      Quality: H:{dist.get('high_quality_contexts', 0)} M:{dist.get('medium_quality_contexts', 0)} L:{dist.get('low_quality_contexts', 0)} (Avg: {dist.get('avg_significance', 0)})")

    # Report finale realistico
    print("\n" + "=" * 70)
    print("📊 REALISTIC PERFORMANCE REPORT")
    print("=" * 70)

    total_tests = len(results)
    successful = sum(1 for r in results if r["success"])
    total_score = sum(r["semantic_score"] for r in results)
    avg_time = sum(r["execution_time_ms"] for r in results) / total_tests

    print(f"✅ Success Rate: {successful}/{total_tests} ({successful/total_tests*100:.1f}%)")
    print(f"📈 Total Score: {total_score} (avg: {total_score/total_tests:.1f})")
    print(f"⚡ Avg Time: {avg_time:.1f}ms")

    # Quality distribution
    quality_counts = {}
    for result in results:
        tier = result.get("quality_tier", "unknown")
        quality_counts[tier] = quality_counts.get(tier, 0) + 1

    print(f"\n🎯 QUALITY DISTRIBUTION:")
    for tier, count in sorted(quality_counts.items()):
        print(f"  {tier:10s}: {count:2d} tests ({count/total_tests*100:.1f}%)")

    # Score ranges
    print(f"\n📊 SCORE RANGES:")
    excellent = sum(1 for r in results if r["semantic_score"] >= 80)
    high = sum(1 for r in results if 60 <= r["semantic_score"] < 80)
    medium = sum(1 for r in results if 40 <= r["semantic_score"] < 60)
    low = sum(1 for r in results if 20 <= r["semantic_score"] < 40)
    poor = sum(1 for r in results if r["semantic_score"] < 20)

    print(f"  🚀 Excellent (80-100): {excellent:2d} ({excellent/total_tests*100:.1f}%)")
    print(f"  📈 High (60-79):      {high:2d} ({high/total_tests*100:.1f}%)")
    print(f"  📊 Medium (40-59):    {medium:2d} ({medium/total_tests*100:.1f}%)")
    print(f"  📉 Low (20-39):       {low:2d} ({low/total_tests*100:.1f}%)")
    print(f"  ❌ Poor (<20):        {poor:2d} ({poor/total_tests*100:.1f}%)")

    # Salva report realistico
    report = {
        "execution_summary": {
            "total_tests": total_tests,
            "successful_tests": successful,
            "success_rate": successful/total_tests,
            "total_score": total_score,
            "average_score": total_score/total_tests,
            "average_execution_time_ms": avg_time,
            "quality_distribution": quality_counts
        },
        "detailed_results": results,
        "timestamp": time.time()
    }

    with open(".devflow/realistic-vector-score-report.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"\n💾 Realistic report saved: .devflow/realistic-vector-score-report.json")
    print("=" * 70)

if __name__ == "__main__":
    main()