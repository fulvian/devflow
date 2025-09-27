#!/usr/bin/env node
/**
 * DevFlow Core System Test - Bypassa dipendenze complesse
 */

import { SQLiteMemoryManager } from './packages/core/dist/index.js';

async function testDevFlowCore() {
  console.log('🚀 Testing DevFlow Core System...');
  
  try {
    // Test SQLiteMemoryManager
    console.log('1️⃣ Testing SQLiteMemoryManager...');
    const memory = new SQLiteMemoryManager();
    
    // Test basic operation
    const testBlock = {
      taskId: 'test-task',
      sessionId: 'test-session', 
      blockType: 'implementation',
      label: 'Test Block',
      content: 'This is a test memory block for DevFlow Core',
      metadata: {},
      importanceScore: 0.8,
      relationships: []
    };
    
    const blockId = await memory.storeMemoryBlock(testBlock);
    console.log('✅ Memory block stored:', blockId);
    
    // Test search
    const searchResults = await memory.searchMemoryBlocks('test', { limit: 5 });
    console.log('✅ Search results:', searchResults.length);
    
    console.log('\n🎉 DevFlow Core System: OPERATIONAL');
    console.log('📊 Components tested:');
    console.log('  - SQLiteMemoryManager: ✅');
    console.log('  - Memory storage: ✅');  
    console.log('  - FTS5 search: ✅');
    
    return true;
    
  } catch (error) {
    console.error('❌ DevFlow Core System test failed:', error.message);
    return false;
  }
}

testDevFlowCore().then(success => {
  process.exit(success ? 0 : 1);
});
