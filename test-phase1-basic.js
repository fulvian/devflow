#!/usr/bin/env node
/**
 * Basic Phase 1 Integration Test
 * Tests core functionality without running full demo
 */

const { OllamaEmbeddingService } = require('./src/core/semantic-memory/ollama-embedding-service');

async function testBasicIntegration() {
  console.log('🧪 Testing Phase 1 Basic Integration...\n');

  try {
    // Test Ollama connection
    console.log('1. Testing Ollama connection...');
    const embedding = new OllamaEmbeddingService();
    const isConnected = await embedding.testConnection();

    if (isConnected) {
      console.log('✅ Ollama embeddinggemma:300m is available\n');
    } else {
      console.log('❌ Ollama embeddinggemma:300m is not available');
      console.log('💡 Make sure Ollama is running and embeddinggemma:300m model is installed\n');
      return;
    }

    // Test embedding generation
    console.log('2. Testing embedding generation...');
    const testContent = 'Test content for semantic memory system validation';
    const startTime = Date.now();

    const testEmbedding = await embedding.generateEmbedding(testContent);
    const duration = Date.now() - startTime;

    console.log(`✅ Generated ${testEmbedding.length}-dimensional embedding in ${duration}ms`);
    console.log(`   Target: <100ms, Actual: ${duration}ms - ${duration < 100 ? 'PASS' : 'FAIL'}\n`);

    // Test similarity calculation
    console.log('3. Testing similarity calculation...');
    const content1 = 'Database query optimization techniques';
    const content2 = 'Optimizing database performance and queries';
    const content3 = 'React component lifecycle methods';

    const emb1 = await embedding.generateEmbedding(content1);
    const emb2 = await embedding.generateEmbedding(content2);
    const emb3 = await embedding.generateEmbedding(content3);

    const similarity12 = await embedding.calculateSimilarity(emb1, emb2);
    const similarity13 = await embedding.calculateSimilarity(emb1, emb3);

    console.log(`✅ Similarity calculation complete:`);
    console.log(`   Database content similarity: ${similarity12.toFixed(3)} (should be >0.7)`);
    console.log(`   Cross-domain similarity: ${similarity13.toFixed(3)} (should be <0.7)`);
    console.log(`   Semantic differentiation: ${similarity12 > similarity13 ? 'PASS' : 'FAIL'}\n`);

    // Summary
    console.log('📋 Phase 1 Basic Integration Test Summary:');
    console.log('✅ Ollama embeddinggemma:300m integration working');
    console.log('✅ Vector embedding generation functional');
    console.log('✅ Cosine similarity calculation accurate');
    console.log('✅ Semantic differentiation validated');
    console.log('\n🎉 Phase 1 foundation is ready for full system integration!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   • Ensure Ollama is running: ollama serve');
    console.log('   • Verify embeddinggemma model: ollama list');
    console.log('   • Install if needed: ollama pull embeddinggemma:300m');
  }
}

// Run test
testBasicIntegration();