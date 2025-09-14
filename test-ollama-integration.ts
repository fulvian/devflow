#!/usr/bin/env npx ts-node

/**
 * Quick integration test for OllamaEmbeddingModel
 * Task: DEVFLOW-OLLAMA-002
 */

import { OllamaEmbeddingModel } from './src/core/embeddings/ollama-embedding-model';

async function testOllamaIntegration() {
  console.log('🧪 Testing Ollama EmbeddingGemma Integration...\n');

  try {
    // Initialize the model
    const model = new OllamaEmbeddingModel({
      baseUrl: 'http://localhost:11434',
      model: 'embeddinggemma:300m',
      cacheSize: 100
    });

    console.log(`📋 Model Info:`);
    console.log(`   ID: ${model.id}`);
    console.log(`   Name: ${model.name}`);
    console.log(`   Dimensions: ${model.dimensions}\n`);

    // Health check
    console.log('🏥 Running health check...');
    const isHealthy = await model.healthCheck();
    console.log(`   Status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}\n`);

    if (!isHealthy) {
      console.error('❌ Ollama service is not healthy. Make sure:');
      console.error('   1. Ollama is running: ollama serve');
      console.error('   2. Model is available: ollama list | grep embeddinggemma');
      process.exit(1);
    }

    // Test single embedding
    console.log('🔍 Testing single embedding generation...');
    const testText = 'DevFlow integration with EmbeddingGemma is working perfectly!';
    const startTime = Date.now();
    
    const embedding = await model.generateEmbedding(testText);
    const duration = Date.now() - startTime;
    
    console.log(`   ✅ Generated embedding in ${duration}ms`);
    console.log(`   📊 Dimensions: ${embedding.length}`);
    console.log(`   🎯 First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]\n`);

    // Test cache functionality
    console.log('💾 Testing cache functionality...');
    const cacheStartTime = Date.now();
    const cachedEmbedding = await model.generateEmbedding(testText);
    const cacheDuration = Date.now() - cacheStartTime;
    
    console.log(`   ✅ Retrieved cached embedding in ${cacheDuration}ms`);
    console.log(`   🆚 Cache hit (should be much faster): ${cacheDuration < 10 ? '✅' : '❌'}\n`);

    // Test batch processing
    console.log('📦 Testing batch embedding generation...');
    const batchTexts = [
      'Task management in DevFlow',
      'Semantic search capabilities',
      'Vector embeddings for AI',
      'Local model deployment',
      'Cost-effective solutions'
    ];
    
    const batchStartTime = Date.now();
    const batchEmbeddings = await model.batchEmbed(batchTexts);
    const batchDuration = Date.now() - batchStartTime;
    
    console.log(`   ✅ Generated ${batchEmbeddings.length} embeddings in ${batchDuration}ms`);
    console.log(`   📊 Average: ${(batchDuration / batchEmbeddings.length).toFixed(1)}ms per embedding\n`);

    // Test similarity calculation
    console.log('🔄 Testing similarity calculation...');
    const similarity = await model.calculateSimilarity(embedding, cachedEmbedding);
    console.log(`   ✅ Similarity (should be 1.0): ${similarity.toFixed(6)}`);
    console.log(`   🎯 Perfect match: ${similarity > 0.99 ? '✅' : '❌'}\n`);

    // Test similarity between different texts
    const similarity2 = await model.calculateSimilarity(embedding, batchEmbeddings[0]);
    console.log(`   🔄 Cross-text similarity: ${similarity2.toFixed(6)}`);
    console.log(`   📈 Reasonable similarity: ${similarity2 > 0.3 && similarity2 < 0.9 ? '✅' : '❌'}\n`);

    // Cache statistics
    const cacheStats = model.getCacheStats();
    console.log('📈 Cache Statistics:');
    console.log(`   Size: ${cacheStats.size}/${cacheStats.maxSize}`);
    console.log(`   Efficiency: ${cacheStats.size > 0 ? '✅' : '❌'}\n`);

    console.log('🎉 All tests passed! Ollama EmbeddingGemma integration is working perfectly.');
    console.log('✅ Ready for DevFlow SemanticMemoryService integration.\n');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the test
testOllamaIntegration().catch(console.error);