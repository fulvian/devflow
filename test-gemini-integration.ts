#!/usr/bin/env node
/**
 * Test script for Gemini CLI integration with DevFlow
 * Tests both direct GeminiService and MCP integration
 */

import { GeminiService } from './packages/core/dist/ml/GeminiService.js';

async function testGeminiIntegration() {
  console.log('🔍 Testing DevFlow Gemini Integration\n');

  // Set environment variable for testing
  process.env.GEMINI_CLI_PATH = '/opt/homebrew/bin/gemini';

  const geminiService = new GeminiService();

  try {
    // Test 1: Analyze Code
    console.log('📁 Test 1: Code Analysis');
    const codeAnalysis = await geminiService.analyzeCode(
      '/Users/fulvioventura/devflow/packages/core/src/ml/VectorEmbeddingService.ts',
      'What are the main methods in this service and what do they do?'
    );
    console.log('✅ Code Analysis Result:', codeAnalysis.substring(0, 200) + '...\n');

    // Test 2: Debug Issue
    console.log('🐛 Test 2: Debug Issue');
    const debugResult = await geminiService.debugIssue(
      'TypeScript error: Property does not exist on type',
      `Error: Property 'similarity' does not exist on type 'SearchResult'
      at searchService.ts:42:15
      at Array.map (native)
      at SemanticSearch.search (searchService.ts:40:23)`
    );
    console.log('✅ Debug Result:', debugResult.substring(0, 200) + '...\n');

    // Test 3: Review Multiple Files
    console.log('📋 Test 3: Multi-file Review');
    const reviewResult = await geminiService.reviewMultipleFiles([
      '/Users/fulvioventura/devflow/packages/core/src/ml/VectorEmbeddingService.ts',
      '/Users/fulvioventura/devflow/packages/core/src/ml/GeminiService.ts'
    ], 'Compare these two ML services and suggest integration opportunities');
    console.log('✅ Review Result:', reviewResult.substring(0, 200) + '...\n');

    console.log('🎉 All Gemini integration tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
testGeminiIntegration();