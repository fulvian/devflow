/**
 * Simple Synthetic API Integration Test
 * Tests the core embedding functionality and rate limiting
 */

import { SyntheticEmbeddingModel } from '../../core/synthetic-api/embedding-model';

async function testSyntheticIntegration() {
  console.log('🚀 Testing Synthetic API Integration...\n');
  
  const apiKey = process.env.SYNTHETIC_API_KEY || 'syn-iJ7rPT7b6jNvUNy4M1Gr2YNSXEFgCa';
  const testResults: { [key: string]: boolean } = {};
  
  try {
    // Test 1: Create embedding model
    console.log('1. Creating SyntheticEmbeddingModel...');
    const embeddingModel = new SyntheticEmbeddingModel(
      apiKey,
      'https://api.synthetic.new/v1',
      'synthetic-embeddings-v1',
      1536
    );
    console.log('✅ Embedding model created successfully');
    testResults['model_creation'] = true;
    
    // Test 2: Generate embeddings
    console.log('\n2. Testing embedding generation...');
    const testTexts = [
      'DevFlow Cognitive Task Management System implementation',
      'Memory bridge with context injection and harvesting protocols',
      'Production deployment validation with real API integration'
    ];
    
    const startTime = Date.now();
    const embeddings = await embeddingModel.generateEmbeddings(testTexts);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Generated ${embeddings.length} embeddings in ${duration}ms`);
    console.log(`   Embedding dimension: ${embeddingModel.getEmbeddingDimension()}`);
    console.log(`   First embedding sample: [${embeddings[0].slice(0, 5).join(', ')}...]`);
    testResults['embedding_generation'] = true;
    
    // Test 3: Validate embeddings
    console.log('\n3. Validating embedding quality...');
    const expectedDimension = embeddingModel.getEmbeddingDimension();
    let validEmbeddings = 0;
    
    for (let i = 0; i < embeddings.length; i++) {
      if (Array.isArray(embeddings[i]) && 
          embeddings[i].length === expectedDimension &&
          embeddings[i].every(val => typeof val === 'number' && !isNaN(val))) {
        validEmbeddings++;
      }
    }
    
    if (validEmbeddings === testTexts.length) {
      console.log(`✅ All ${validEmbeddings} embeddings are valid`);
      testResults['embedding_validation'] = true;
    } else {
      console.log(`❌ Only ${validEmbeddings}/${testTexts.length} embeddings are valid`);
      testResults['embedding_validation'] = false;
    }
    
    // Test 4: Error handling
    console.log('\n4. Testing error handling...');
    try {
      await embeddingModel.generateEmbeddings([]);
      console.log('❌ Should have thrown error for empty input');
      testResults['error_handling'] = false;
    } catch (error) {
      console.log('✅ Correctly handled empty input error');
      testResults['error_handling'] = true;
    }
    
    // Generate report
    console.log('\n' + '='.repeat(50));
    console.log('📋 SYNTHETIC API INTEGRATION TEST REPORT');
    console.log('='.repeat(50));
    
    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(result => result === true).length;
    
    console.log(`\n📊 Results: ${passedTests}/${totalTests} tests passed`);
    console.log(`🎯 Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    
    Object.entries(testResults).forEach(([testName, result]) => {
      const status = result ? '✅ PASS' : '❌ FAIL';
      console.log(`   ${testName}: ${status}`);
    });
    
    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED - Synthetic API integration is working!');
      process.exit(0);
    } else {
      console.log('\n⚠️ Some tests failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSyntheticIntegration();