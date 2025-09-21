/**
 * Full Integration Smoke Test
 * 
 * Tests complete DevFlow Cognitive Task+Memory System integration:
 * TaskHierarchy + SemanticMemory + MemoryBridge Protocol
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
  MockEmbeddingModel
} from '../core/semantic-memory/semantic-memory-service';
import { 
  MemoryBridgeService,
  AgentContext,
  MemoryHarvestResult,
  TokenBudgetExceededError
} from '../core/memory-bridge/memory-bridge-service';

const TEST_DB_PATH = './data/devflow_unified.sqlite';
const TEST_MODEL_ID = 'integration-test-model';

class FullIntegrationSmokeTestRunner {
  private taskService: TaskHierarchyService;
  private semanticService: SemanticMemoryService;
  private bridgeService: MemoryBridgeService;
  private mockModel: MockEmbeddingModel;
  private testTasks: TaskContext[] = [];

  constructor() {
    this.taskService = new TaskHierarchyService(TEST_DB_PATH);
    this.semanticService = new SemanticMemoryService(this.taskService, TEST_DB_PATH);
    this.bridgeService = new MemoryBridgeService(this.taskService, this.semanticService, 2000);
    this.mockModel = new MockEmbeddingModel(TEST_MODEL_ID, 'Integration Test Model', 384);
  }

  async runFullIntegrationTest(): Promise<void> {
    console.log('🚀 Starting Full DevFlow Integration Test...\n');

    try {
      await this.initializeSystem();
      await this.testEndToEndWorkflow();
      await this.testTokenBudgetManagement();
      await this.testCrossLayerConsistency();
      await this.testPerformanceUnderLoad();

      console.log('\n🎉 Full integration test PASSED!');
    } catch (error) {
      console.error('❌ Full integration test FAILED:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeSystem(): Promise<void> {
    console.log('🔧 Initializing full system...');
    
    const startTime = performance.now();
    
    await this.taskService.initialize();
    await this.semanticService.initialize();
    await this.bridgeService.initialize();
    
    this.semanticService.registerEmbeddingModel(this.mockModel);
    
    const initTime = performance.now() - startTime;
    console.log(`  ✅ Full system initialized: ${initTime.toFixed(2)}ms`);
  }

  private async testEndToEndWorkflow(): Promise<void> {
    console.log('\n🔄 Testing End-to-End Workflow...');

    // 1. Create task hierarchy
    const parentTask = await this.taskService.createTask({
      title: 'Build AI-powered task management system',
      description: 'Create a comprehensive system for managing tasks with AI assistance',
      priority: TaskPriority.HIGH,
      status: TaskStatus.PLANNING
    });

    const childTask1 = await this.taskService.createTask({
      parentTaskId: parentTask.id,
      title: 'Implement database layer',
      description: 'Create SQLite database schema and operations',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.ACTIVE
    });

    const childTask2 = await this.taskService.createTask({
      parentTaskId: parentTask.id,
      title: 'Add vector embeddings',
      description: 'Integrate semantic search capabilities using vector embeddings',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.PLANNING
    });

    this.testTasks.push(parentTask, childTask1, childTask2);
    console.log(`  ✅ Created task hierarchy (${this.testTasks.length} tasks)`);

    // 2. Generate embeddings
    const startTime = performance.now();
    await this.semanticService.generateTaskEmbeddings(
      this.testTasks.map(t => t.id), 
      TEST_MODEL_ID
    );
    const embeddingTime = performance.now() - startTime;
    console.log(`  ✅ Generated embeddings: ${embeddingTime.toFixed(2)}ms`);

    // 3. Test memory bridge workflow
    const agentId = 'test-synthetic-agent-001';
    
    // Inject context
    const injectionResult = await this.bridgeService.injectContext(agentId, parentTask.id, TEST_MODEL_ID);
    if (!injectionResult.success) {
      throw new Error('Context injection failed');
    }
    console.log(`  ✅ Context injected: ${injectionResult.context.tokenUsage.totalTokens} tokens used`);

    // Simulate agent execution
    const executionResults = {
      success: true,
      output: 'Successfully analyzed task requirements and created implementation plan',
      decisions: ['Use TypeScript for type safety', 'Implement with SQLite for persistence'],
      learnings: 'Complex tasks benefit from hierarchical breakdown'
    };

    // Harvest memory
    const harvestResult = await this.bridgeService.harvestMemory(
      agentId, 
      parentTask.id, 
      executionResults, 
      TEST_MODEL_ID
    );
    console.log(`  ✅ Memory harvested: ${harvestResult.tokensSaved} tokens returned`);

    // 4. Test similarity search
    const similarTasks = await this.semanticService.findSimilarTasks(
      childTask1.id, 
      TEST_MODEL_ID, 
      5, 
      0.1
    );
    console.log(`  ✅ Found ${similarTasks.length} similar tasks`);

    console.log('  🎯 End-to-end workflow completed successfully');
  }

  private async testTokenBudgetManagement(): Promise<void> {
    console.log('\n💰 Testing Token Budget Management...');

    const initialBudget = this.bridgeService.getBudgetStatus();
    console.log(`  📊 Initial budget: ${initialBudget.current}/${initialBudget.max} tokens`);

    // Create multiple contexts to test budget
    const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4'];
    const contexts: AgentContext[] = [];

    for (const agentId of agents) {
      try {
        const result = await this.bridgeService.injectContext(agentId, this.testTasks[0].id, TEST_MODEL_ID);
        contexts.push(result.context);
        
        const budgetAfter = this.bridgeService.getBudgetStatus();
        console.log(`  💳 Agent ${agentId}: ${result.context.tokenUsage.totalTokens} tokens, ${budgetAfter.current} remaining`);
        
        if (result.compressionApplied) {
          console.log(`  📦 Compression applied for ${agentId}`);
        }
      } catch (error) {
        if (error instanceof TokenBudgetExceededError) {
          console.log(`  ⚠️ Token budget exceeded for ${agentId} (expected)`);
          break;
        }
        throw error;
      }
    }

    // Test budget recovery through harvesting
    for (let i = 0; i < contexts.length; i++) {
      const context = contexts[i];
      const mockResults = { success: true, output: `Results from ${context.agentId}` };
      
      await this.bridgeService.harvestMemory(
        context.agentId,
        context.taskId,
        mockResults,
        TEST_MODEL_ID
      );
      
      const budgetAfter = this.bridgeService.getBudgetStatus();
      console.log(`  🔄 Harvested from ${context.agentId}: ${budgetAfter.current} tokens available`);
    }

    const finalBudget = this.bridgeService.getBudgetStatus();
    console.log(`  ✅ Budget management test completed: ${finalBudget.current}/${finalBudget.max} tokens`);
  }

  private async testCrossLayerConsistency(): Promise<void> {
    console.log('\n🔗 Testing Cross-Layer Consistency...');

    // Add a new task
    const newTask = await this.taskService.createTask({
      title: 'Test cross-layer consistency',
      description: 'This task tests synchronization between layers',
      priority: TaskPriority.LOW,
      status: TaskStatus.PLANNING
    });
    this.testTasks.push(newTask);

    // Synchronize semantic memory
    const syncStartTime = performance.now();
    await this.semanticService.synchronizeWithTaskHierarchy(TEST_MODEL_ID);
    const syncTime = performance.now() - syncStartTime;
    console.log(`  ✅ Semantic memory synchronized: ${syncTime.toFixed(2)}ms`);

    // Verify new task has embedding
    const embedding = await this.semanticService.getTaskEmbedding(newTask.id, TEST_MODEL_ID);
    if (!embedding) {
      throw new Error('Cross-layer consistency failed: missing embedding');
    }
    console.log(`  ✅ New task embedding verified: ${embedding.length} dimensions`);

    // Test memory bridge with new task
    const testAgentId = 'consistency-test-agent';
    const injectionResult = await this.bridgeService.injectContext(testAgentId, newTask.id, TEST_MODEL_ID);
    
    if (!injectionResult.success) {
      throw new Error('Memory bridge failed with new task');
    }
    console.log(`  ✅ Memory bridge works with new task: ${injectionResult.context.tokenUsage.totalTokens} tokens`);

    // Clean up test context
    await this.bridgeService.harvestMemory(testAgentId, newTask.id, { test: true }, TEST_MODEL_ID);
    console.log('  🧹 Test context cleaned up');

    console.log('  🎯 Cross-layer consistency verified');
  }

  private async testPerformanceUnderLoad(): Promise<void> {
    console.log('\n⚡ Testing Performance Under Load...');

    const loadTestTasks = [];
    
    // Create additional tasks for load testing
    const taskCount = 5;
    const startTime = performance.now();
    
    for (let i = 0; i < taskCount; i++) {
      const task = await this.taskService.createTask({
        title: `Load test task ${i}`,
        description: `Performance testing task number ${i} with detailed description for embedding generation`,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.PLANNING
      });
      loadTestTasks.push(task);
    }
    
    const createTime = performance.now() - startTime;
    console.log(`  ⏱️ Created ${taskCount} tasks: ${createTime.toFixed(2)}ms (${(createTime/taskCount).toFixed(2)}ms/task)`);

    // Generate embeddings concurrently
    const embeddingStartTime = performance.now();
    await this.semanticService.generateTaskEmbeddings(
      loadTestTasks.map(t => t.id),
      TEST_MODEL_ID
    );
    const embeddingTime = performance.now() - embeddingStartTime;
    console.log(`  🔍 Generated embeddings: ${embeddingTime.toFixed(2)}ms (${(embeddingTime/taskCount).toFixed(2)}ms/task)`);

    // Test concurrent context injections
    this.bridgeService.resetBudget(); // Reset for load test
    
    const concurrentStartTime = performance.now();
    const injectionPromises = loadTestTasks.slice(0, 3).map((task, index) => 
      this.bridgeService.injectContext(`load-test-agent-${index}`, task.id, TEST_MODEL_ID)
    );
    
    const injectionResults = await Promise.all(injectionPromises);
    const concurrentTime = performance.now() - concurrentStartTime;
    
    console.log(`  🚀 Concurrent injections (${injectionResults.length}): ${concurrentTime.toFixed(2)}ms`);
    
    // Verify all injections succeeded
    const allSuccessful = injectionResults.every(r => r.success);
    if (!allSuccessful) {
      throw new Error('Some concurrent injections failed');
    }
    console.log(`  ✅ All concurrent injections successful`);

    // Clean up load test contexts
    for (let i = 0; i < injectionResults.length; i++) {
      await this.bridgeService.harvestMemory(
        `load-test-agent-${i}`,
        loadTestTasks[i].id,
        { loadTest: true },
        TEST_MODEL_ID
      );
    }

    // Add load test tasks to cleanup list
    this.testTasks.push(...loadTestTasks);

    // Performance validation
    const avgTaskCreation = createTime / taskCount;
    const avgEmbeddingGeneration = embeddingTime / taskCount;
    const avgConcurrentInjection = concurrentTime / injectionResults.length;

    if (avgTaskCreation > 10) {
      console.warn(`  ⚠️ Task creation slower than expected: ${avgTaskCreation.toFixed(2)}ms/task`);
    }
    if (avgEmbeddingGeneration > 50) {
      console.warn(`  ⚠️ Embedding generation slower than expected: ${avgEmbeddingGeneration.toFixed(2)}ms/task`);
    }
    if (avgConcurrentInjection > 100) {
      console.warn(`  ⚠️ Concurrent injection slower than expected: ${avgConcurrentInjection.toFixed(2)}ms/injection`);
    }

    console.log('  🎯 Performance under load test completed');
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up integration test...');

    // Delete all test tasks
    for (const task of this.testTasks) {
      try {
        await this.taskService.deleteTask(task.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Synchronize to clean embeddings
    try {
      await this.semanticService.synchronizeWithTaskHierarchy(TEST_MODEL_ID);
    } catch (error) {
      // Ignore cleanup errors
    }

    // Reset bridge budget
    this.bridgeService.resetBudget();

    // Close services
    await this.semanticService.close();
    await this.taskService.close();

    console.log('✅ Integration test cleanup completed');
  }
}

// Run integration test if executed directly
if (require.main === module) {
  const runner = new FullIntegrationSmokeTestRunner();
  runner.runFullIntegrationTest()
    .then(() => {
      console.log('\n🎯 DevFlow Integration Test Summary: PASSED');
      console.log('🚀 System ready for production deployment!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 DevFlow Integration Test Summary: FAILED');
      console.error(error);
      process.exit(1);
    });
}

export { FullIntegrationSmokeTestRunner };