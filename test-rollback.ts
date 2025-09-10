#!/usr/bin/env node
/**
 * Test rollback functionality of GeminiAutoFixService
 */

import { GeminiAutoFixService } from './packages/core/dist/ml/GeminiAutoFixService.js';
import { readFileSync, writeFileSync } from 'fs';

async function testRollback() {
  console.log('🔄 Testing GeminiAutoFixService Rollback Functionality\n');

  process.env.GEMINI_AUTOFIX_ENABLED = 'true';
  process.env.GEMINI_SAFETY_LEVEL = 'medium';
  process.env.GEMINI_CLI_PATH = '/opt/homebrew/bin/gemini';

  const testFile = '/Users/fulvioventura/devflow/test-rollback-target.ts';
  const autoFixService = new GeminiAutoFixService();

  // Create a test file with intentional errors
  const originalContent = `
// Test file with intentional errors
function testFunction(param: string | undefined): string {
  return param; // TypeScript error: might be undefined
}

const unusedVariable = 'test'; // Unused variable error
console.log('test'); // Console statement error
`;

  const modifiedContent = `
// Modified test file 
function testFunction(param: string | undefined): string {
  return 'modified content that might fail validation';
}
`;

  try {
    // Step 1: Create test file
    writeFileSync(testFile, originalContent, 'utf-8');
    console.log('✅ Created test file with intentional errors');

    // Step 2: Create backup
    const backupId = autoFixService.createBackup(testFile);
    console.log(`✅ Created backup: ${backupId}`);

    // Step 3: Modify the file to simulate failed fix
    writeFileSync(testFile, modifiedContent, 'utf-8');
    console.log('✅ Modified file (simulating failed fix)');

    // Step 4: Test rollback
    const rollbackResult = autoFixService.rollbackChanges(testFile, backupId);
    console.log(`✅ Rollback result: ${rollbackResult ? 'SUCCESS' : 'FAILED'}`);

    // Step 5: Verify rollback
    const restoredContent = readFileSync(testFile, 'utf-8');
    const isRestored = restoredContent.trim() === originalContent.trim();
    console.log(`✅ File restored correctly: ${isRestored ? 'YES' : 'NO'}`);

    if (isRestored) {
      console.log('\n🎉 Rollback functionality works perfectly!');
    } else {
      console.log('\n❌ Rollback failed - file content mismatch');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    try {
      const fs = await import('fs');
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
        console.log('🧹 Cleaned up test file');
      }
    } catch (cleanupError) {
      console.warn('Warning: Failed to cleanup test file:', cleanupError);
    }
  }
}

testRollback();