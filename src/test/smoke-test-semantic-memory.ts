/**
 * SemanticMemoryService Smoke Test
 * 
 * Tests cross-layer validation between SQLite TaskHierarchy and Vector embeddings.
 * Validates the semantic memory integration pipeline.
 */

import { performance } from 'perf_hooks';
import { 
  TaskHierarchyService, 
  TaskStatus, 
  TaskPriority,
  TaskContext
} from '../core/task-hierarchy/task-hierarchy-service';
import { 
  SemanticMemoryService, 
  MockEmbeddingModel,
  EmbeddingError,
  ModelNotFoundError,
  SimilarityResult
} from '../core/semantic-memory/semantic-memory-service';

// Test configuration
const TEST_TIMEOUT = 500; // 500ms for embedding operations
const TEST_DB_PATH = './data/devflow_unified.sqlite';
const TEST_MODEL_ID = 'test-embedding-model';

/**
 * Semantic Memory Smoke Test Runner
 */
class SemanticMemorySmokeTestRunner {
  private taskService: TaskHierarchyService;
  private semanticService: SemanticMemoryService;
  private testTasks: TaskContext[] = [];
  private mockModel: MockEmbeddingModel;

  constructor() {
    this.taskService = new TaskHierarchyService(TEST_DB_PATH);
    this.semanticService = new SemanticMemoryService(this.taskService, TEST_DB_PATH);
    this.mockModel = new MockEmbeddingModel(TEST_MODEL_ID, 'Test Embedding Model', 384);
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Semantic Memory Smoke Tests...\n');

    try {
      await this.initializeServices();
      await this.testBasicEmbeddingOperations();
      await this.testSimilaritySearch();
      await this.testCrossLayerSynchronization();
      await this.testPerformanceBenchmarks();
      await this.testErrorHandling();

      console.log('\n🎉 All semantic memory smoke tests passed!');
    } catch (error) {
      console.error('❌ Semantic memory smoke test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeServices(): Promise<void> {
    console.log('🔧 Initializing services...');
    
    // Initialize task hierarchy service
    await this.taskService.initialize();
    console.log('  ✅ TaskHierarchyService initialized');
    
    // Initialize semantic memory service
    await this.semanticService.initialize();
    console.log('  ✅ SemanticMemoryService initialized');
    
    // Register mock embedding model
    this.semanticService.registerEmbeddingModel(this.mockModel);
    console.log('  ✅ Mock embedding model registered');
  }

  private async testBasicEmbeddingOperations(): Promise<void> {
    console.log('\n📝 Testing Basic Embedding Operations...');

    // Create test tasks with diverse content
    const testTasksData = [
      {
        title: 'Implement user authentication system',
        description: 'Create secure login and registration functionality with JWT tokens',
        priority: TaskPriority.HIGH,
        status: TaskStatus.PLANNING
      },
      {
        title: 'Design database schema',
        description: 'Create normalized database tables for user data and application entities',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PLANNING
      },
      {
        title: 'Setup CI/CD pipeline',
        description: 'Configure automated testing and deployment using GitHub Actions',
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PLANNING
      }
    ];

    // Create tasks in hierarchy
    const startTime = performance.now();
    for (const taskData of testTasksData) {
      const task = await this.taskService.createTask(taskData);
      this.testTasks.push(task);
    }
    const createTime = performance.now() - startTime;
    console.log(`  ✅ Created ${testTasksData.length} test tasks: ${createTime.toFixed(2)}ms`);

    // Generate embeddings for all test tasks
    const embeddingStartTime = performance.now();
    const taskIds = this.testTasks.map(t => t.id);
    await this.semanticService.generateTaskEmbeddings(taskIds, TEST_MODEL_ID);
    const embeddingTime = performance.now() - embeddingStartTime;
    const avgEmbeddingTime = embeddingTime / taskIds.length;
    
    console.log(`  ✅ Generated embeddings for ${taskIds.length} tasks: ${embeddingTime.toFixed(2)}ms (avg: ${avgEmbeddingTime.toFixed(2)}ms/task)`);

    if (avgEmbeddingTime > TEST_TIMEOUT) {
      console.warn(`  ⚠️  Performance warning: average embedding time ${avgEmbeddingTime.toFixed(2)}ms exceeds threshold ${TEST_TIMEOUT}ms`);
    }

    // Verify embeddings were stored
    for (const task of this.testTasks) {
      const embedding = await this.semanticService.getTaskEmbedding(task.id, TEST_MODEL_ID);
      if (!embedding || embedding.length !== 384) {
        throw new Error(`Invalid embedding for task ${task.id}`);
      }
    }
    console.log(`  ✅ Verified all embeddings stored correctly (${this.mockModel.dimensions} dimensions)`);
  }

  private async testSimilaritySearch(): Promise<void> {
    console.log('\n🔍 Testing Similarity Search...');

    if (this.testTasks.length < 2) {
      throw new Error('Need at least 2 tasks for similarity testing');
    }

    const sourceTask = this.testTasks[0]; // "Implement user authentication system"
    
    const startTime = performance.now();
    const similarTasks = await this.semanticService.findSimilarTasks(
      sourceTask.id, 
      TEST_MODEL_ID,
      5, // limit
      0.1 // lower threshold for testing
    );
    const searchTime = performance.now() - startTime;

    console.log(`  ✅ Similarity search completed: ${searchTime.toFixed(2)}ms`);
    console.log(`  📊 Found ${similarTasks.length} similar tasks to "${sourceTask.title}"`);

    // Verify similarity results structure
    for (const result of similarTasks) {
      if (!result.taskId || typeof result.similarity !== 'number') {
        throw new Error('Invalid similarity result structure');
      }
      
      if (result.similarity < 0 || result.similarity > 1) {
        throw new Error(`Invalid similarity score: ${result.similarity}`);
      }
    }

    // Verify results are sorted by similarity (descending)
    for (let i = 1; i < similarTasks.length; i++) {
      if (similarTasks[i].similarity > similarTasks[i-1].similarity) {
        throw new Error('Similarity results not properly sorted');
      }
    }

    console.log(`  ✅ Similarity scores valid and sorted correctly`);
    
    // Display top similarities
    similarTasks.slice(0, 2).forEach((result, index) => {
      console.log(`  📋 #${index + 1}: "${result.task?.title}" (${(result.similarity * 100).toFixed(1)}% similar)`);
    });
  }

  private async testCrossLayerSynchronization(): Promise<void> {
    console.log('\n🔄 Testing Cross-Layer Synchronization...');

    // Create a new task
    const newTask = await this.taskService.createTask({
      title: 'Test synchronization task',
      description: 'A task created to test sync functionality',
      priority: TaskPriority.LOW,
      status: TaskStatus.PLANNING
    });
    this.testTasks.push(newTask);

    // Synchronize - should detect missing embedding
    const syncStartTime = performance.now();
    await this.semanticService.synchronizeWithTaskHierarchy(TEST_MODEL_ID);
    const syncTime = performance.now() - syncStartTime;

    console.log(`  ✅ Synchronization completed: ${syncTime.toFixed(2)}ms`);

    // Verify new task has embedding
    const newTaskEmbedding = await this.semanticService.getTaskEmbedding(newTask.id, TEST_MODEL_ID);
    if (!newTaskEmbedding || newTaskEmbedding.length !== 384) {
      throw new Error('Synchronization failed to create embedding for new task');
    }
    console.log(`  ✅ New task embedding generated during sync`);

    // Test deletion synchronization
    const taskToDelete = this.testTasks.pop()!; // Remove last task
    await this.taskService.deleteTask(taskToDelete.id);

    // Synchronize again - should remove orphaned embedding
    await this.semanticService.synchronizeWithTaskHierarchy(TEST_MODEL_ID);

    // Verify embedding was removed
    const deletedTaskEmbedding = await this.semanticService.getTaskEmbedding(taskToDelete.id, TEST_MODEL_ID);
    if (deletedTaskEmbedding !== null) {
      throw new Error('Synchronization failed to remove orphaned embedding');
    }
    console.log(`  ✅ Orphaned embedding removed during sync`);
  }

  private async testPerformanceBenchmarks(): Promise<void> {
    console.log('\n⚡ Testing Performance Benchmarks...');

    const benchmarkTasks = [];
    
    // Create additional tasks for performance testing
    for (let i = 0; i < 3; i++) {
      const task = await this.taskService.createTask({
        title: `Performance test task ${i}`,
        description: `This is a performance test task with various content to test embedding generation speed ${i}`,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PLANNING
      });
      benchmarkTasks.push(task);
    }

    this.testTasks.push(...benchmarkTasks);

    // Test batch embedding generation
    const batchStartTime = performance.now();
    await this.semanticService.generateTaskEmbeddings(
      benchmarkTasks.map(t => t.id),
      TEST_MODEL_ID
    );
    const batchTime = performance.now() - batchStartTime;
    const avgBatchTime = batchTime / benchmarkTasks.length;

    console.log(`  ✅ Batch embedding generation (${benchmarkTasks.length} tasks): ${batchTime.toFixed(2)}ms (avg: ${avgBatchTime.toFixed(2)}ms/task)`);

    // Test multiple similarity searches
    const searchTasks = this.testTasks.slice(0, 2);
    const multiSearchStartTime = performance.now();
    
    const searchPromises = searchTasks.map(task =>
      this.semanticService.findSimilarTasks(task.id, TEST_MODEL_ID, 3, 0.1)
    );
    
    const searchResults = await Promise.all(searchPromises);
    const multiSearchTime = performance.now() - multiSearchStartTime;
    const avgSearchTime = multiSearchTime / searchTasks.length;

    console.log(`  ✅ Multiple similarity searches (${searchTasks.length} queries): ${multiSearchTime.toFixed(2)}ms (avg: ${avgSearchTime.toFixed(2)}ms/query)`);

    // Performance validation
    if (avgBatchTime > TEST_TIMEOUT) {
      console.warn(`  ⚠️  Performance warning: batch embedding time ${avgBatchTime.toFixed(2)}ms exceeds threshold`);
    }
    
    if (avgSearchTime > TEST_TIMEOUT / 2) {
      console.warn(`  ⚠️  Performance warning: search time ${avgSearchTime.toFixed(2)}ms is high`);
    }
  }

  private async testErrorHandling(): Promise<void> {
    console.log('\n🛡️ Testing Error Handling...');

    // Test non-existent model
    try {
      await this.semanticService.generateTaskEmbedding(this.testTasks[0].id, 'non-existent-model');
      throw new Error('Should have thrown ModelNotFoundError');
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        console.log('  ✅ Non-existent model error handling: ModelNotFoundError thrown');
      } else {
        throw error;
      }
    }

    // Test non-existent task
    try {
      await this.semanticService.generateTaskEmbedding('non-existent-task', TEST_MODEL_ID);
      throw new Error('Should have thrown EmbeddingError');
    } catch (error) {
      if (error instanceof EmbeddingError) {
        console.log('  ✅ Non-existent task error handling: EmbeddingError thrown');
      } else {
        throw error;
      }
    }

    // Test similarity search for task without embedding
    const taskWithoutEmbedding = await this.taskService.createTask({
      title: 'Task without embedding',
      description: 'This task will not have an embedding generated',
      priority: TaskPriority.LOW,
      status: TaskStatus.PLANNING
    });
    
    this.testTasks.push(taskWithoutEmbedding);

    try {
      await this.semanticService.findSimilarTasks(taskWithoutEmbedding.id, TEST_MODEL_ID);
      throw new Error('Should have thrown EmbeddingError');
    } catch (error) {
      if (error instanceof EmbeddingError) {
        console.log('  ✅ Missing embedding error handling: EmbeddingError thrown');
      } else {
        throw error;
      }
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');

    // Delete test tasks (will cascade to embeddings via sync)
    for (const task of this.testTasks) {
      try {
        await this.taskService.deleteTask(task.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Clean up any remaining embeddings
    try {
      await this.semanticService.synchronizeWithTaskHierarchy(TEST_MODEL_ID);
    } catch (error) {
      // Ignore cleanup errors
    }

    // Close services
    await this.semanticService.close();
    await this.taskService.close();
    
    console.log('✅ Cleanup completed');
  }
}

// Run the smoke test if this file is executed directly
if (require.main === module) {
  const runner = new SemanticMemorySmokeTestRunner();
  runner.runAllTests()
    .then(() => {
      console.log('\n🎯 Semantic Memory Smoke Test Summary: PASSED');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Semantic Memory Smoke Test Summary: FAILED');
      console.error(error);
      process.exit(1);
    });
}

export { SemanticMemorySmokeTestRunner };