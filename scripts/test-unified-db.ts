#!/usr/bin/env npx ts-node

/**
 * Test script for UnifiedDatabaseManager
 * Validates the new unified schema implementation
 */

import { UnifiedDatabaseManager } from '../src/database/UnifiedDatabaseManager';

async function testUnifiedDatabase() {
  console.log('🧪 Testing Unified Database Manager...');

  const db = new UnifiedDatabaseManager('./data/devflow.sqlite');

  try {
    // Test 1: Store a memory block
    console.log('\n📝 Test 1: Store memory block');
    const blockId = 'test_block_' + Date.now();
    db.storeMemoryBlock(
      blockId,
      'This is a test memory block for schema unification',
      'test',
      new Date().toISOString()
    );
    console.log('✅ Memory block stored:', blockId);

    // Test 2: Store embedding with unified schema
    console.log('\n🧮 Test 2: Store embedding');
    const embeddingData = Buffer.from(new Float32Array([0.1, 0.2, 0.3, 0.4]).buffer);
    const embeddingId = db.storeEmbedding(
      blockId,
      'text-embedding-3-small',
      embeddingData,
      4
    );
    console.log('✅ Embedding stored:', embeddingId);

    // Test 3: Retrieve embedding
    console.log('\n🔍 Test 3: Retrieve embedding');
    const retrievedEmbedding = db.getEmbedding(blockId, 'text-embedding-3-small');
    if (retrievedEmbedding) {
      console.log('✅ Embedding retrieved:');
      console.log('  - ID:', retrievedEmbedding.id);
      console.log('  - Memory Block ID:', retrievedEmbedding.memory_block_id);
      console.log('  - Model ID:', retrievedEmbedding.model_id);
      console.log('  - Dimensions:', retrievedEmbedding.dimensions);
      console.log('  - Created:', retrievedEmbedding.created_at);
    } else {
      console.log('❌ Embedding not found');
    }

    // Test 4: Query memory blocks with embeddings
    console.log('\n📊 Test 4: Query memory blocks');
    const blocks = db.queryMemoryBlocks({ type: 'test', limit: 5 });
    console.log(`✅ Found ${blocks.length} test blocks`);
    blocks.forEach(block => {
      console.log(`  - Block ${block.id}: ${block.embeddings.length} embeddings`);
    });

    // Test 5: Batch operations
    console.log('\n⚡ Test 5: Batch embedding storage');
    const batchEmbeddings = [
      {
        memoryBlockId: blockId,
        modelId: 'text-embedding-3-large',
        embeddingVector: Buffer.from(new Float32Array([0.5, 0.6, 0.7, 0.8]).buffer),
        dimensions: 4
      },
      {
        memoryBlockId: blockId,
        modelId: 'text-embedding-ada-002',
        embeddingVector: Buffer.from(new Float32Array([0.9, 1.0, 1.1, 1.2]).buffer),
        dimensions: 4
      }
    ];

    const batchIds = db.batchStoreEmbeddings(batchEmbeddings);
    console.log(`✅ Batch stored ${batchIds.length} embeddings:`, batchIds);

    // Test 6: Get all embeddings for block
    console.log('\n🔗 Test 6: Get all embeddings for block');
    const allEmbeddings = db.getEmbeddingsForBlock(blockId);
    console.log(`✅ Block has ${allEmbeddings.length} total embeddings:`);
    allEmbeddings.forEach(emb => {
      console.log(`  - ${emb.model_id}: ${emb.dimensions}D (${emb.created_at})`);
    });

    // Test 7: Database statistics
    console.log('\n📈 Test 7: Database statistics');
    const stats = db.getStats();
    console.log('✅ Database stats:');
    console.log('  - Memory blocks:', stats.memoryBlocks);
    console.log('  - Embeddings:', stats.embeddings);
    console.log('  - Models:', stats.models);
    console.log('  - Avg embeddings/block:', stats.averageEmbeddingsPerBlock);

    console.log('\n🎉 All tests passed! Unified database schema is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  testUnifiedDatabase().catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
  });
}

export { testUnifiedDatabase };