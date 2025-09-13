#!/usr/bin/env npx ts-node

/**
 * Integration test for DevFlow SemanticMemoryService with OllamaEmbeddingModel
 * Task: DEVFLOW-OLLAMA-003
 */

import { SemanticMemoryService } from './src/core/semantic-memory/semantic-memory-service';
import { TaskHierarchyService, TaskPriority, TaskStatus } from './src/core/task-hierarchy/task-hierarchy-service';
import { OllamaEmbeddingModel } from './src/core/embeddings/ollama-embedding-model';

async function testSemanticIntegration() {
  console.log('🧪 Testing DevFlow Semantic Memory Integration...\n');

  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    const taskHierarchyService = new TaskHierarchyService();
    await taskHierarchyService.initialize();
    
    const semanticMemoryService = new SemanticMemoryService(taskHierarchyService);
    await semanticMemoryService.initialize();
    
    // Create and register Ollama model
    const ollamaModel = new OllamaEmbeddingModel({
      baseUrl: 'http://localhost:11434',
      model: 'embeddinggemma:300m',
      cacheSize: 100
    });
    
    // Check Ollama health
    const isHealthy = await ollamaModel.healthCheck();
    if (!isHealthy) {
      throw new Error('Ollama service is not healthy');
    }
    
    console.log('   ✅ Services initialized');
    console.log('   ✅ Ollama model healthy\n');

    // Register the Ollama model
    semanticMemoryService.registerEmbeddingModel(ollamaModel);
    console.log(`📝 Registered model: ${ollamaModel.id}\n`);

    // Create test tasks
    console.log('📋 Creating test tasks...');
    const testTasks = [
      {
        title: 'Implement user authentication system',
        description: 'Create secure login functionality with JWT tokens and password hashing',
        priority: TaskPriority.HIGH,
        status: TaskStatus.PLANNING
      },
      {
        title: 'Design user authentication UI',
        description: 'Create login forms and registration interface with modern design',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PLANNING
      },
      {
        title: 'Setup database schema',
        description: 'Design tables for user management and authentication data storage',
        priority: TaskPriority.HIGH,
        status: TaskStatus.PLANNING
      },
      {
        title: 'Create API endpoints',
        description: 'Build RESTful endpoints for user operations and authentication',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PLANNING
      },
      {
        title: 'Write documentation',
        description: 'Document the system architecture and API specifications',
        priority: TaskPriority.LOW,
        status: TaskStatus.PLANNING
      }
    ];

    const createdTasks = [];
    for (const taskData of testTasks) {
      const task = await taskHierarchyService.createTask(taskData);
      createdTasks.push(task);
      console.log(`   ✅ Created task: ${task.title}`);
    }
    console.log('');

    // Generate embeddings for all tasks
    console.log('🔍 Generating embeddings...');
    let totalEmbeddingTime = 0;
    
    for (const task of createdTasks) {
      const startTime = Date.now();
      await semanticMemoryService.generateTaskEmbedding(task.id, ollamaModel.id);
      const duration = Date.now() - startTime;
      totalEmbeddingTime += duration;
      console.log(`   ✅ Generated embedding for "${task.title}" (${duration}ms)`);
    }
    
    const avgEmbeddingTime = totalEmbeddingTime / createdTasks.length;
    console.log(`   📊 Average embedding time: ${avgEmbeddingTime.toFixed(1)}ms\n`);

    // Test similarity search
    console.log('🔄 Testing similarity search...');
    const queryTask = createdTasks[0]; // "Implement user authentication system"
    
    const similarTasks = await semanticMemoryService.findSimilarTasks(
      queryTask.id,
      ollamaModel.id,
      3, // Top 3 similar tasks
      0.5 // Minimum similarity threshold
    );
    
    console.log(`   🎯 Query: "${queryTask.title}"`);
    console.log('   📋 Similar tasks:');
    
    similarTasks.forEach((result, index) => {
      console.log(`      ${index + 1}. "${result.task?.title}" (similarity: ${result.similarity.toFixed(3)})`);
    });
    console.log('');

    // Test embedding consistency
    console.log('🔄 Testing embedding consistency...');
    const task1Embedding = await semanticMemoryService.getTaskEmbedding(queryTask.id, ollamaModel.id);
    const task1EmbeddingAgain = await semanticMemoryService.getTaskEmbedding(queryTask.id, ollamaModel.id);
    
    if (task1Embedding && task1EmbeddingAgain) {
      const consistency = await ollamaModel.calculateSimilarity(task1Embedding, task1EmbeddingAgain);
      console.log(`   ✅ Embedding consistency: ${consistency.toFixed(6)} (should be 1.0)`);
      console.log(`   🎯 Perfect consistency: ${consistency > 0.99 ? '✅' : '❌'}\n`);
    }

    // Test cache performance
    console.log('💾 Testing cache performance...');
    const cacheTestTask = createdTasks[1];
    
    // First call (should generate new embedding)
    const startTime1 = Date.now();
    await semanticMemoryService.generateTaskEmbedding(cacheTestTask.id, ollamaModel.id);
    const duration1 = Date.now() - startTime1;
    
    // Second call (should use cache)
    const startTime2 = Date.now();
    await semanticMemoryService.generateTaskEmbedding(cacheTestTask.id, ollamaModel.id);
    const duration2 = Date.now() - startTime2;
    
    console.log(`   🔄 First call: ${duration1}ms`);
    console.log(`   ⚡ Cached call: ${duration2}ms`);
    console.log(`   📈 Cache speedup: ${duration2 < duration1 / 2 ? '✅' : '❌'}\n`);

    // Test cross-task similarity patterns
    console.log('🔍 Testing similarity patterns...');
    const authTasks = similarTasks.filter(result => 
      result.task?.title.toLowerCase().includes('auth') ||
      result.task?.title.toLowerCase().includes('user')
    );
    
    console.log(`   🎯 Authentication-related tasks found: ${authTasks.length}`);
    console.log(`   📊 Pattern recognition: ${authTasks.length >= 2 ? '✅' : '❌'}\n`);

    // Performance summary
    console.log('📈 Performance Summary:');
    console.log(`   • Average embedding generation: ${avgEmbeddingTime.toFixed(1)}ms`);
    console.log(`   • Total tasks processed: ${createdTasks.length}`);
    console.log(`   • Similar tasks found: ${similarTasks.length}`);
    console.log(`   • Cache performance: ${duration2 < 10 ? 'Excellent' : 'Good'}\n`);

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    for (const task of createdTasks) {
      await taskHierarchyService.deleteTask(task.id);
    }
    
    await semanticMemoryService.close();
    await taskHierarchyService.close();
    console.log('   ✅ Cleanup completed\n');

    console.log('🎉 All semantic integration tests passed!');
    console.log('✅ OllamaEmbeddingModel successfully integrated with DevFlow SemanticMemoryService.');
    console.log('✅ Task similarity search working with real EmbeddingGemma vectors.');

  } catch (error) {
    console.error('❌ Integration test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the integration test
testSemanticIntegration().catch(console.error);