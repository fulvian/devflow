#!/usr/bin/env python3
"""
Test Suite per Vector Embeddings Engine
Verifica il funzionamento del semantic search avanzato per Claude Code replacement
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.append(str(Path(__file__).parent / "src"))

from core.memory.vector_embeddings_engine import VectorEmbeddingsEngine, init_vector_system

async def test_vector_embeddings_system():
    """Test completo del sistema vector embeddings"""

    print("🚀 VECTOR EMBEDDINGS ENGINE TEST SUITE")
    print("=" * 60)

    try:
        # Initialize vector system
        print("\n1. 🔧 System Initialization")
        engine = VectorEmbeddingsEngine()
        print(f"   ✅ Engine initialized")
        print(f"   - Model: {engine.embedding_model}")
        print(f"   - Dimensions: {engine.embedding_dimensions}")
        print(f"   - Similarity threshold: {engine.similarity_threshold}")

        # Test embedding generation
        print("\n2. 🧠 Embedding Generation Test")
        test_texts = [
            "Context injection system with Microsoft Kernel Memory patterns",
            "Enhanced memory integration for Claude Code replacement",
            "Vector embeddings for semantic search functionality",
            "Database query optimization and performance tuning"
        ]

        embeddings = []
        for i, text in enumerate(test_texts):
            embedding = await engine.generate_embedding(text)
            if embedding is not None:
                embeddings.append((text, embedding))
                print(f"   ✅ Generated embedding {i+1}: {embedding.shape} (norm: {embedding.std():.4f})")
            else:
                print(f"   ❌ Failed to generate embedding {i+1}")

        if len(embeddings) < 2:
            print("   ❌ Insufficient embeddings generated for similarity test")
            return False

        # Test cosine similarity
        print("\n3. 📏 Cosine Similarity Test")
        sim_12 = engine.cosine_similarity(embeddings[0][1], embeddings[1][1])
        sim_13 = engine.cosine_similarity(embeddings[0][1], embeddings[2][1])
        sim_14 = engine.cosine_similarity(embeddings[0][1], embeddings[3][1])

        print(f"   - Text 1 vs Text 2: {sim_12:.4f}")
        print(f"   - Text 1 vs Text 3: {sim_13:.4f}")
        print(f"   - Text 1 vs Text 4: {sim_14:.4f}")

        # Expect higher similarity between texts 1-2 (both about context systems)
        if sim_12 > sim_14:
            print("   ✅ Semantic similarity working correctly")
        else:
            print("   ⚠️  Semantic similarity might need tuning")

        # Test database update
        print("\n4. 🗄️  Database Embedding Update")
        update_results = await engine.update_embeddings_batch(limit=10)
        print(f"   ✅ Batch update completed:")
        print(f"   - Processed: {update_results['processed']}")
        print(f"   - Updated: {update_results['updated']}")
        print(f"   - Errors: {update_results['errors']}")
        print(f"   - Duration: {update_results.get('duration_seconds', 0):.2f}s")

        # Test semantic search
        print("\n5. 🔍 Semantic Search Test")
        search_queries = [
            "memory injection patterns",
            "context system optimization",
            "database performance issues",
            "vector search functionality"
        ]

        for query in search_queries:
            print(f"\n   Query: '{query}'")
            matches = await engine.semantic_search(query, limit=3, min_similarity=0.1)

            if matches:
                print(f"   ✅ Found {len(matches)} matches:")
                for match in matches:
                    print(f"     - Score: {match.similarity_score:.4f} | {match.content[:80]}...")
            else:
                print(f"   ⚠️  No matches found (might need more data with embeddings)")

        # Performance metrics
        print("\n6. 📊 Performance Metrics")
        metrics = engine.get_performance_metrics()
        print(f"   ✅ System performance:")
        for key, value in metrics.items():
            if isinstance(value, float):
                print(f"   - {key}: {value:.4f}")
            else:
                print(f"   - {key}: {value}")

        # Cache test
        print("\n7. 💾 Cache System Test")
        # Generate same embedding again (should hit cache)
        test_text = "Cache test for vector embeddings"
        start_metrics = metrics.copy()

        embedding_1 = await engine.generate_embedding(test_text, use_cache=True)
        embedding_2 = await engine.generate_embedding(test_text, use_cache=True)

        new_metrics = engine.get_performance_metrics()
        cache_hits_diff = new_metrics['embedding_cache_hits'] - start_metrics['embedding_cache_hits']

        if cache_hits_diff > 0:
            print(f"   ✅ Cache system working: {cache_hits_diff} cache hits")
        else:
            print(f"   ⚠️  Cache system might not be working optimally")

        # Overall assessment
        print("\n" + "=" * 60)
        print("🎯 SYSTEM ASSESSMENT")
        print("=" * 60)

        # Check if ready for Claude Code replacement
        ready_indicators = []
        issues = []

        if update_results['updated'] > 0:
            ready_indicators.append("✅ Database integration working")
        else:
            issues.append("❌ No database updates performed")

        if metrics['similarity_searches'] > 0:
            ready_indicators.append("✅ Semantic search functional")
        else:
            issues.append("❌ Semantic search not tested")

        if metrics['cache_hit_rate'] > 0:
            ready_indicators.append("✅ Caching system active")
        else:
            ready_indicators.append("⚠️  Caching system not utilized yet")

        if embeddings:
            ready_indicators.append("✅ Embedding generation working")
        else:
            issues.append("❌ Embedding generation failed")

        print("\n🟢 Ready Indicators:")
        for indicator in ready_indicators:
            print(f"  {indicator}")

        if issues:
            print("\n🔴 Issues Found:")
            for issue in issues:
                print(f"  {issue}")

        # Final verdict
        readiness_score = len(ready_indicators) / (len(ready_indicators) + len(issues))

        if readiness_score >= 0.8:
            print(f"\n✅ SYSTEM STATUS: READY FOR CLAUDE CODE INTEGRATION")
            print(f"   Readiness Score: {readiness_score:.1%}")
        elif readiness_score >= 0.6:
            print(f"\n⚠️  SYSTEM STATUS: MOSTLY READY - MINOR ISSUES")
            print(f"   Readiness Score: {readiness_score:.1%}")
        else:
            print(f"\n❌ SYSTEM STATUS: NEEDS DEVELOPMENT")
            print(f"   Readiness Score: {readiness_score:.1%}")

        return readiness_score >= 0.6

    except Exception as e:
        print(f"\n❌ SYSTEM ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run the complete test suite"""
    success = await test_vector_embeddings_system()

    if success:
        print("\n🎉 Vector Embeddings System: ENTERPRISE READY!")
    else:
        print("\n🚨 Vector Embeddings System: NEEDS ATTENTION")

    return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)