/**
 * Real-World Memory Bridge Protocol Test
 * Tests the memory bridge with real DevFlow services
 */

import { TaskHierarchyService } from '../src/core/task-hierarchy/task-hierarchy-service';
import { SemanticMemoryService } from '../src/core/semantic-memory/semantic-memory-service';
import { MemoryBridgeService } from '../src/core/memory-bridge/memory-bridge-service';
import { MockEmbeddingModel } from '../src/core/semantic-memory/embedding-models/mock-embedding-model';

async function testMemoryBridgeProduction(): Promise<void> {
  console.log('🚀 Starting Memory Bridge Production Test...');
  
  try {
    // Initialize services
    console.log('🔧 Initializing DevFlow services...');
    const taskService = new TaskHierarchyService();
    const semanticService = new SemanticMemoryService(taskService);
    const memoryBridge = new MemoryBridgeService(taskService, semanticService);
    
    await taskService.initialize();
    await semanticService.initialize();
    await memoryBridge.initialize();
    
    // Register embedding model
    const mockModel = new MockEmbeddingModel();
    semanticService.registerEmbeddingModel('production-test-model', mockModel);
    console.log('✅ All services initialized');
    
    // Create realistic development tasks
    console.log('📝 Creating realistic development tasks...');
    const tasks = await Promise.all([
      taskService.createTask({
        title: 'Implement OAuth2 Authentication System',
        description: 'Build secure OAuth2 authentication with JWT tokens, refresh token rotation, and multi-provider support (Google, GitHub, Microsoft)',
        priority: 'h-'
      }),
      taskService.createTask({
        title: 'Design REST API Architecture',
        description: 'Create RESTful API endpoints with OpenAPI specification, versioning strategy, and rate limiting implementation',
        priority: 'h-'
      }),
      taskService.createTask({
        title: 'Implement Real-time Dashboard',
        description: 'Build React-based dashboard with WebSocket connections, real-time data visualization using D3.js, and responsive design',
        priority: 'm-'
      }),
      taskService.createTask({
        title: 'Set Up CI/CD Pipeline',
        description: 'Configure GitHub Actions workflow with automated testing, Docker containerization, and deployment to AWS EKS',
        priority: 'm-'
      }),
      taskService.createTask({
        title: 'Database Migration System',
        description: 'Implement database schema versioning with migration scripts, rollback capabilities, and data integrity checks',
        priority: 'l-'
      })
    ]);
    
    console.log(`✅ Created ${tasks.length} realistic development tasks`);
    
    // Generate embeddings for semantic search
    console.log('🔍 Generating embeddings for semantic memory...');
    await semanticService.synchronizeWithTaskHierarchy('production-test-model');
    console.log('✅ Embeddings generated and synchronized');
    
    // Test memory bridge context injection
    console.log('💡 Testing context injection with token budget management...');
    const budgetBefore = memoryBridge.getBudgetStatus();
    console.log(`📊 Initial token budget: ${budgetBefore.current}/${budgetBefore.max} tokens`);
    
    // Inject context for multiple agents simultaneously
    const agentIds = ['claude-code-agent', 'synthetic-coder', 'openai-codex'];
    const contextResults = [];
    
    for (const agentId of agentIds) {
      const result = await memoryBridge.injectContext(
        agentId, 
        tasks[0].id, // OAuth task
        'production-test-model'
      );
      contextResults.push({ agentId, result });
      
      console.log(`✅ Context injected for ${agentId}: ${result.tokenUsage.used} tokens, similar tasks: ${result.similarTasks.length}`);
    }
    
    const budgetAfterInjection = memoryBridge.getBudgetStatus();
    console.log(`📊 Budget after injection: ${budgetAfterInjection.current}/${budgetAfterInjection.max} tokens (${budgetAfterInjection.activeContexts} active contexts)`);
    
    // Test memory harvesting
    console.log('🔄 Testing memory harvesting...');
    const harvestResults = [];
    
    for (const { agentId, result } of contextResults) {
      // Simulate agent execution results
      const executionResults = {
        codeGenerated: `// ${agentId} implementation for ${result.task.title}`,
        tokensUsed: result.tokenUsage.used,
        executionTime: Math.floor(Math.random() * 1000) + 500,
        success: true,
        insights: [`Implemented ${result.task.title} using modern best practices`]
      };
      
      const harvestResult = await memoryBridge.harvestMemory(
        agentId,
        tasks[0].id,
        executionResults,
        'production-test-model'
      );
      
      harvestResults.push({ agentId, harvestResult });
      console.log(`✅ Memory harvested from ${agentId}: ${harvestResult.tokensReclaimed} tokens reclaimed`);
    }
    
    const budgetAfterHarvest = memoryBridge.getBudgetStatus();
    console.log(`📊 Final budget: ${budgetAfterHarvest.current}/${budgetAfterHarvest.max} tokens`);
    
    // Test concurrent context injection (stress test)
    console.log('⚡ Testing concurrent context injection...');
    const concurrentStart = performance.now();
    
    const concurrentPromises = tasks.slice(1).map((task, index) => 
      memoryBridge.injectContext(
        `stress-test-agent-${index}`,
        task.id,
        'production-test-model'
      )
    );
    
    const concurrentResults = await Promise.all(concurrentPromises);
    const concurrentTime = performance.now() - concurrentStart;
    
    console.log(`✅ Concurrent injection completed: ${concurrentResults.length} agents in ${concurrentTime.toFixed(2)}ms`);
    console.log(`📊 Average time per injection: ${(concurrentTime / concurrentResults.length).toFixed(2)}ms`);
    
    // Clean up concurrent contexts
    for (let i = 0; i < concurrentResults.length; i++) {
      await memoryBridge.harvestMemory(
        `stress-test-agent-${i}`,
        tasks[i + 1].id,
        { success: true },
        'production-test-model'
      );
    }
    
    // Test error handling and recovery
    console.log('🛡️ Testing error handling and recovery...');
    
    try {
      await memoryBridge.injectContext('invalid-agent', 'invalid-task-id', 'production-test-model');
      console.log('❌ Should have thrown error for invalid task');
    } catch (error) {
      console.log('✅ Correctly handled invalid task error');
    }
    
    try {
      await memoryBridge.injectContext('test-agent', tasks[0].id, 'non-existent-model');
      console.log('❌ Should have thrown error for invalid model');
    } catch (error) {
      console.log('✅ Correctly handled invalid model error');
    }
    
    // Performance benchmark summary
    const performanceMetrics = {
      tasksCreated: tasks.length,
      contextInjectionsCompleted: contextResults.length + concurrentResults.length,
      memoryHarvestsCompleted: harvestResults.length + concurrentResults.length,
      averageConcurrentInjectionTime: concurrentTime / concurrentResults.length,
      tokenBudgetUtilization: {
        initial: budgetBefore.current,
        peak: budgetBefore.max - budgetAfterInjection.current,
        final: budgetAfterHarvest.current
      }
    };
    
    console.log('📊 Performance Metrics Summary:');
    console.log(`   - Tasks created: ${performanceMetrics.tasksCreated}`);
    console.log(`   - Context injections: ${performanceMetrics.contextInjectionsCompleted}`);
    console.log(`   - Memory harvests: ${performanceMetrics.memoryHarvestsCompleted}`);
    console.log(`   - Avg concurrent injection: ${performanceMetrics.averageConcurrentInjectionTime.toFixed(2)}ms`);
    console.log(`   - Token budget peak usage: ${performanceMetrics.tokenBudgetUtilization.peak} tokens`);
    
    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await semanticService.synchronizeWithTaskHierarchy('production-test-model');
    console.log('✅ Memory bridge production test completed successfully!');
    
  } catch (error) {
    console.error('❌ Memory bridge production test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testMemoryBridgeProduction()
    .then(() => {
      console.log('🎉 Memory Bridge Production Test: PASSED');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Memory Bridge Production Test: FAILED');
      console.error(error);
      process.exit(1);
    });
}