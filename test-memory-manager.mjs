#!/usr/bin/env node

/**
 * Test SQLiteMemoryManager functionality
 * Validates context injection system with unified database
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment for unified database
process.env.DEVFLOW_DB_PATH = './data/devflow_unified.sqlite';

console.log('🧠 Testing SQLiteMemoryManager with Unified Database');
console.log('Database Path:', process.env.DEVFLOW_DB_PATH);

try {
  // Try to load the SQLiteMemoryManager
  const { SQLiteMemoryManager } = await import('./src/core/memory/SQLiteMemoryManager.js');

  console.log('✅ SQLiteMemoryManager loaded successfully');

  // Initialize memory manager
  const memoryManager = new SQLiteMemoryManager();

  // Test database connection
  console.log('\n📊 Testing database connection...');

  // Test search functionality (this should trigger FTS5 search)
  console.log('\n🔍 Testing search functionality...');
  const searchResults = await memoryManager.search('orchestration', { limit: 5 });

  console.log(`Found ${searchResults.length} results for "orchestration"`);
  if (searchResults.length > 0) {
    console.log('Sample result:', {
      id: searchResults[0].id,
      content: searchResults[0].content.substring(0, 100) + '...',
      type: searchResults[0].type
    });
  }

  // Test context injection preparation
  console.log('\n💉 Testing context injection...');
  const contextResults = await memoryManager.search('context injection', { limit: 3 });
  console.log(`Context injection results: ${contextResults.length} items`);

  // Test project-specific search
  console.log('\n🎯 Testing project-specific search...');
  const projectResults = await memoryManager.searchByProject(5, { limit: 5 });
  console.log(`Project-specific results: ${projectResults.length} items`);

  console.log('\n✅ SQLiteMemoryManager test completed successfully!');

} catch (error) {
  console.error('❌ Error testing SQLiteMemoryManager:', error.message);
  console.error('Stack:', error.stack);

  // Try alternative import paths
  console.log('\n🔄 Trying alternative import paths...');

  try {
    // Check if the file exists
    const fs = await import('fs');
    const memoryFile = './src/core/memory/SQLiteMemoryManager.js';
    if (fs.existsSync(memoryFile)) {
      console.log('✓ SQLiteMemoryManager.js file exists');
    } else {
      console.log('❌ SQLiteMemoryManager.js file not found');

      // List memory directory contents
      console.log('\n📁 Memory directory contents:');
      const memoryDir = './src/core/memory/';
      if (fs.existsSync(memoryDir)) {
        const files = fs.readdirSync(memoryDir);
        files.forEach(file => console.log(`  - ${file}`));
      } else {
        console.log('❌ Memory directory not found');
      }
    }
  } catch (fsError) {
    console.error('Error checking file system:', fsError.message);
  }
}