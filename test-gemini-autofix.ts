#!/usr/bin/env node
/**
 * Test script per GeminiAutoFixService
 * Testa la correzione automatica di errori reali nel codebase
 */

import { GeminiAutoFixService } from './packages/core/dist/ml/GeminiAutoFixService.js';
import { readFileSync } from 'fs';

async function testGeminiAutoFix() {
  console.log('🔧 Testing GeminiAutoFixService with real errors\n');

  // Set environment variables for testing
  process.env.GEMINI_AUTOFIX_ENABLED = 'true';
  process.env.GEMINI_SAFETY_LEVEL = 'medium';
  process.env.GEMINI_CLI_PATH = '/opt/homebrew/bin/gemini';

  const targetFile = '/Users/fulvioventura/devflow/packages/adapters/openrouter/src/cost-monitor.ts';
  const autoFixService = new GeminiAutoFixService();

  try {
    console.log(`📁 Target file: ${targetFile}`);
    
    // Read current file content to show before state
    const beforeContent = readFileSync(targetFile, 'utf-8');
    const beforeLines = beforeContent.split('\n').length;
    console.log(`📊 File stats before: ${beforeLines} lines\n`);

    // Test 1: Fix syntax and type errors
    console.log('🔍 Test 1: Auto-fixing syntax and type issues');
    const syntaxResult = await autoFixService.autoFixIssues(targetFile, ['syntax']);
    console.log(`✅ Syntax fix result: ${syntaxResult ? 'SUCCESS' : 'FAILED'}\n`);

    // Test 2: Debug specific TypeScript error
    console.log('🐛 Test 2: Debug specific TypeScript error');
    const errorContext = {
      message: "Type 'string | undefined' is not assignable to type 'string'",
      type: 'TypeScript',
      timestamp: new Date()
    };
    
    const stackTrace = `
      at cost-monitor.ts:185:4
      return recommendations[taskComplexity]?.[0] || 'gpt-4o-mini';
                            ~~~~~~~~~~~~~~~~~~~~~~
    `;

    const debugResult = await autoFixService.debugAndFix(targetFile, errorContext, stackTrace);
    console.log(`✅ Debug fix result: ${debugResult ? 'SUCCESS' : 'FAILED'}\n`);

    // Test 3: Apply safe modifications for code quality
    console.log('🛡️ Test 3: Apply safe modifications for code quality');
    const safeModsResult = await autoFixService.applySafeModifications(targetFile, [
      'console.log', 'console.warn', 'console.error'
    ]);
    console.log(`✅ Safe modifications result: ${safeModsResult ? 'SUCCESS' : 'FAILED'}\n`);

    // Show final state
    const afterContent = readFileSync(targetFile, 'utf-8');
    const afterLines = afterContent.split('\n').length;
    console.log(`📊 File stats after: ${afterLines} lines`);
    
    console.log('🎉 GeminiAutoFixService test completed!');
    console.log(`📂 Backup directory: ${autoFixService['backupDir']}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test directly
testGeminiAutoFix();

export { testGeminiAutoFix };