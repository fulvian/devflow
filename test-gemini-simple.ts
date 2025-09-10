#!/usr/bin/env node
/**
 * Simple test for Gemini CLI file modification
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

async function testGeminiSimple() {
  console.log('🔧 Testing simple Gemini CLI integration\n');

  const testFile = '/Users/fulvioventura/devflow/test-file-debug.ts';
  
  try {
    // Read current file
    const originalContent = readFileSync(testFile, 'utf-8');
    console.log('📁 Original file length:', originalContent.split('\n').length, 'lines');

    // Simple prompt to Gemini
    const prompt = `Fix the TypeScript errors in this code and return ONLY the corrected code:

${originalContent}`;

    console.log('🤖 Sending to Gemini CLI...');
    
    // Use synchronous exec for simplicity
    const result = execSync(`echo '${prompt.replace(/'/g, "'\\''")}' | gemini`, { 
      encoding: 'utf-8', 
      timeout: 15000 
    });
    
    console.log('✅ Gemini response received');
    console.log('📊 Response length:', result.length, 'characters');
    
    // Check if response contains valid TypeScript
    if (result.includes('interface') && result.includes('class')) {
      console.log('✅ Response appears to contain valid TypeScript code');
      
      // Create backup
      const backupFile = `${testFile}.backup-${Date.now()}`;
      writeFileSync(backupFile, originalContent);
      console.log(`💾 Backup created: ${backupFile}`);
      
      // Apply changes
      writeFileSync(testFile, result);
      console.log('🎉 File successfully modified by Gemini!');
      
      const modifiedContent = readFileSync(testFile, 'utf-8');
      console.log('📊 Modified file length:', modifiedContent.split('\n').length, 'lines');
      
    } else {
      console.log('⚠️  Response does not appear to contain valid code');
      console.log('First 200 chars:', result.substring(0, 200));
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGeminiSimple();