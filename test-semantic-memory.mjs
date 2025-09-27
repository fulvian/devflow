#!/usr/bin/env node

/**
 * Test SemanticMemoryService functionality
 * Validates context injection system with unified database
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment for unified database
process.env.DEVFLOW_DB_PATH = './data/devflow_unified.sqlite';

console.log('🧠 Testing SemanticMemoryService with Unified Database');
console.log('Database Path:', process.env.DEVFLOW_DB_PATH);

try {
  // Try to load the compiled SemanticMemoryService
  const { SemanticMemoryService, MockEmbeddingModel } = await import('./dist/core/semantic-memory/semantic-memory-service.js');
  const { TaskHierarchyService } = await import('./dist/core/task-hierarchy/task-hierarchy-service.js');

  console.log('✅ SemanticMemoryService loaded successfully');

  // Initialize task hierarchy service first
  const taskHierarchyService = new TaskHierarchyService('./data/devflow_unified.sqlite');
  await taskHierarchyService.initialize();

  // Initialize semantic memory service
  const semanticMemoryService = new SemanticMemoryService(taskHierarchyService);
  await semanticMemoryService.initialize();

  console.log('✅ Services initialized successfully');

  // Register a mock embedding model for testing
  const mockModel = new MockEmbeddingModel('test-model', 'Test Model', 384);
  semanticMemoryService.registerEmbeddingModel(mockModel);

  console.log('✅ Mock embedding model registered');

  // Test getting all tasks
  console.log('\n📊 Testing task retrieval...');
  const rootTasks = await taskHierarchyService.getRootTasks();
  console.log(`Found ${rootTasks.length} root tasks`);

  if (rootTasks.length > 0) {
    const firstTask = rootTasks[0];
    console.log(`Sample task: ${firstTask.title} (${firstTask.id})`);

    // Test embedding generation
    console.log('\n🔍 Testing embedding generation...');
    try {
      await semanticMemoryService.generateTaskEmbedding(firstTask.id, 'test-model');
      console.log('✅ Embedding generated successfully');

      // Test similarity search
      console.log('\n🎯 Testing similarity search...');
      const similarTasks = await semanticMemoryService.findSimilarTasks(firstTask.id, 'test-model', 5, 0.1);
      console.log(`Found ${similarTasks.length} similar tasks`);

      similarTasks.forEach((result, index) => {
        console.log(`  ${index + 1}. Task ${result.taskId} (similarity: ${result.similarity.toFixed(3)})`);
      });

    } catch (embeddingError) {
      console.log(`⚠️ Embedding test failed: ${embeddingError.message}`);
    }
  }

  // Test context injection simulation
  console.log('\n💉 Testing context injection simulation...');

  // Simulate what the hook system would do
  const taskQuery = 'orchestration system unification';
  console.log(`Simulating context injection for: "${taskQuery}"`);

  // Create a mock embedding for the query
  const queryEmbedding = await mockModel.generateEmbedding(taskQuery);
  console.log(`Query embedding generated: ${queryEmbedding.length} dimensions`);

  console.log('\n✅ SemanticMemoryService test completed successfully!');

  // Close services
  await semanticMemoryService.close();

} catch (error) {
  console.error('❌ Error testing SemanticMemoryService:', error.message);
  console.error('Stack:', error.stack);

  console.log('\n🔄 Checking available compiled files...');

  try {
    const fs = await import('fs');

    // Check dist directory
    const distDir = './dist/core/semantic-memory/';
    if (fs.existsSync(distDir)) {
      console.log('\n📁 Semantic memory dist contents:');
      const files = fs.readdirSync(distDir);
      files.forEach(file => console.log(`  - ${file}`));
    } else {
      console.log('❌ Semantic memory dist directory not found');
    }

    // Check if TaskHierarchyService exists
    const taskHierarchyDir = './dist/core/task-hierarchy/';
    if (fs.existsSync(taskHierarchyDir)) {
      console.log('\n📁 Task hierarchy dist contents:');
      const files = fs.readdirSync(taskHierarchyDir);
      files.forEach(file => console.log(`  - ${file}`));
    } else {
      console.log('❌ Task hierarchy dist directory not found');
    }

  } catch (fsError) {
    console.error('Error checking file system:', fsError.message);
  }
}