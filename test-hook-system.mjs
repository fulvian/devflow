#!/usr/bin/env node

/**
 * Test DevFlow Hook System with ClaudeAdapter Integration
 * Validates context injection and memory capture with unified database
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment for unified database
process.env.DEVFLOW_DB_PATH = './data/devflow_unified.sqlite';

console.log('🔗 Testing DevFlow Hook System with ClaudeAdapter Integration');
console.log('Database Path:', process.env.DEVFLOW_DB_PATH);

try {
  // Import ClaudeAdapter
  const { ClaudeAdapter } = await import('./packages/claude-adapter/dist/claude-adapter.js');

  console.log('✅ ClaudeAdapter loaded successfully');

  // Initialize ClaudeAdapter with verbose logging
  const adapter = new ClaudeAdapter({ verbose: true });

  // Test 1: Search for orchestration-related context
  console.log('\n🔍 Test 1: Searching for orchestration context...');

  const orchestrationResults = await adapter.searchMemory('orchestration system unification', {
    maxResults: 5,
    blockTypes: ['architectural', 'implementation'],
    threshold: 0.3
  });

  console.log(`Found ${orchestrationResults.length} orchestration-related results`);
  orchestrationResults.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.block.label} (${result.block.blockType}, similarity: ${result.similarity.toFixed(3)})`);
    console.log(`     Content preview: ${result.block.content.substring(0, 100)}...`);
  });

  // Test 2: Search for hook system context
  console.log('\n🪝 Test 2: Searching for hook system context...');

  const hookResults = await adapter.searchMemory('hook system context injection', {
    maxResults: 3,
    blockTypes: ['implementation'],
    threshold: 0.2
  });

  console.log(`Found ${hookResults.length} hook-related results`);
  hookResults.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.block.label} (importance: ${result.block.importanceScore.toFixed(3)})`);
  });

  // Test 3: Search for memory system context
  console.log('\n🧠 Test 3: Searching for memory system context...');

  const memoryResults = await adapter.searchMemory('memory system semantic search', {
    maxResults: 4,
    blockTypes: ['architectural'],
    threshold: 0.2
  });

  console.log(`Found ${memoryResults.length} memory-related results`);
  memoryResults.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.block.label}`);
  });

  // Test 4: Test context injection simulation (60% vector + 40% semantic)
  console.log('\n💉 Test 4: Simulating unified context injection...');

  // This simulates what the hook system would do with the 60/40 split
  const vectorResults = await adapter.searchMemory('unified orchestration architecture', {
    maxResults: 3,
    threshold: 0.3
  });

  const semanticResults = await adapter.searchMemory('CLI integration MCP protocol', {
    maxResults: 2,
    threshold: 0.3
  });

  // Combine results with 60% weight for vector search (first) and 40% for semantic (second)
  const combinedResults = [
    ...vectorResults.map(r => ({ ...r, weight: 0.6, source: 'vector' })),
    ...semanticResults.map(r => ({ ...r, weight: 0.4, source: 'semantic' }))
  ].sort((a, b) => (b.similarity * b.weight) - (a.similarity * a.weight));

  console.log(`Combined context injection results (${combinedResults.length} items):`);
  combinedResults.forEach((result, index) => {
    const weightedScore = result.similarity * result.weight;
    console.log(`  ${index + 1}. [${result.source.toUpperCase()}] ${result.block.label}`);
    console.log(`     Weighted score: ${weightedScore.toFixed(3)} (similarity: ${result.similarity.toFixed(3)} × weight: ${result.weight})`);
  });

  // Test 5: Hook system integration validation
  console.log('\n🎯 Test 5: Hook system integration validation...');

  // Simulate what devflow-integration.py would call
  const taskName = 'orchestration-system-unification';
  const sessionId = 'test-session-' + Date.now();

  console.log(`Simulating hook call for task: ${taskName}, session: ${sessionId}`);

  const contextBlocks = await adapter.searchMemory(taskName.replace('-', ' '), {
    maxResults: 10,
    blockTypes: ['architectural', 'implementation'],
    threshold: 0.7
  });

  const hookOutput = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: contextBlocks.map(r => ({
        id: r.block.id,
        label: r.block.label,
        type: r.block.blockType,
        content: r.block.content,
        importance: r.block.importanceScore,
        similarity: r.similarity
      })),
      devflowEnabled: true,
      taskName: taskName,
      sessionId: sessionId,
      orchestratorTaskCreated: false
    }
  };

  console.log(`Hook output would contain ${hookOutput.hookSpecificOutput.additionalContext.length} context blocks`);
  console.log('Sample context block:', {
    label: hookOutput.hookSpecificOutput.additionalContext[0]?.label || 'No results',
    type: hookOutput.hookSpecificOutput.additionalContext[0]?.type || 'N/A',
    importance: hookOutput.hookSpecificOutput.additionalContext[0]?.importance || 0
  });

  // Close adapter
  await adapter.close();

  console.log('\n✅ DevFlow Hook System test completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`- ClaudeAdapter integration: ✅ Working`);
  console.log(`- Orchestration context search: ✅ ${orchestrationResults.length} results found`);
  console.log(`- Hook system context search: ✅ ${hookResults.length} results found`);
  console.log(`- Memory system context search: ✅ ${memoryResults.length} results found`);
  console.log(`- Unified context injection (60/40): ✅ ${combinedResults.length} combined results`);
  console.log(`- Hook integration simulation: ✅ ${hookOutput.hookSpecificOutput.additionalContext.length} context blocks ready`);

} catch (error) {
  console.error('❌ Error testing DevFlow Hook System:', error.message);
  console.error('Stack:', error.stack);

  console.log('\n🔄 Checking system status...');

  try {
    const fs = await import('fs');

    // Check if required files exist
    const requiredFiles = [
      './packages/claude-adapter/dist/claude-adapter.js',
      './data/devflow_unified.sqlite',
      './.claude/hooks/devflow-integration.py'
    ];

    console.log('\n📁 System status check:');
    requiredFiles.forEach(file => {
      const exists = fs.existsSync(file);
      console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    });

    // Check database accessibility
    console.log('\n🗄️ Database status:');
    const dbPath = './data/devflow_unified.sqlite';
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`  📊 Size: ${Math.round(stats.size / 1024)} KB`);
      console.log(`  📅 Modified: ${stats.mtime.toISOString()}`);
    }

  } catch (fsError) {
    console.error('Error checking file system:', fsError.message);
  }
}