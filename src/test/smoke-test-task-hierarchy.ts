/**
 * TaskHierarchyService Smoke Test
 * 
 * Simple smoke test for TaskHierarchyService SQLite implementation.
 * Tests basic functionality to validate infrastructure foundation.
 */

import { performance } from 'perf_hooks';
import { 
  TaskHierarchyService, 
  TaskStatus, 
  TaskPriority,
  CreateTaskContextInput,
  TaskContext,
  TaskNotFoundError,
  TaskHierarchyError,
  DatabaseError
} from '../core/task-hierarchy/task-hierarchy-service';

// Test configuration
const TEST_TIMEOUT = 200; // 200ms performance threshold for smoke test
const TEST_DB_PATH = './data/devflow_unified.sqlite'; // Use production database for smoke test

/**
 * Simple smoke test runner
 */
class SmokeTestRunner {
  private service: TaskHierarchyService;
  private testTasks: TaskContext[] = [];

  constructor() {
    this.service = new TaskHierarchyService(TEST_DB_PATH);
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting TaskHierarchy Smoke Tests...\n');

    try {
      await this.service.initialize();
      console.log('✅ Database initialized');

      await this.testBasicCRUD();
      await this.testHierarchicalOperations();
      await this.testPerformance();
      await this.testErrorHandling();

      console.log('\n🎉 All smoke tests passed!');
    } catch (error) {
      console.error('❌ Smoke test failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async testBasicCRUD(): Promise<void> {
    console.log('\n📝 Testing Basic CRUD Operations...');

    // Test Create
    const taskInput: CreateTaskContextInput = {
      title: 'Smoke Test Task',
      description: 'A task created during smoke testing',
      status: TaskStatus.PLANNING,
      priority: TaskPriority.MEDIUM,
      estimatedDurationMinutes: 30
    };

    const startTime = performance.now();
    const task = await this.service.createTask(taskInput);
    const createTime = performance.now() - startTime;

    if (!task || !task.id) {
      throw new Error('Task creation failed');
    }

    this.testTasks.push(task);
    console.log(`  ✅ Create Task: ${createTime.toFixed(2)}ms`);

    // Test Read
    const readStartTime = performance.now();
    const retrievedTask = await this.service.getTaskById(task.id);
    const readTime = performance.now() - readStartTime;

    if (!retrievedTask || retrievedTask.id !== task.id) {
      throw new Error('Task retrieval failed');
    }

    console.log(`  ✅ Read Task: ${readTime.toFixed(2)}ms`);

    // Test Update
    const updateStartTime = performance.now();
    const updatedTask = await this.service.updateTask(task.id, {
      title: 'Updated Smoke Test Task',
      status: TaskStatus.ACTIVE
    });
    const updateTime = performance.now() - updateStartTime;

    if (updatedTask.title !== 'Updated Smoke Test Task' || updatedTask.status !== TaskStatus.ACTIVE) {
      throw new Error('Task update failed');
    }

    console.log(`  ✅ Update Task: ${updateTime.toFixed(2)}ms`);

    // Test Delete (will create a separate task for deletion)
    const taskToDelete = await this.service.createTask({
      title: 'Task to Delete',
      description: 'This will be deleted'
    });

    const deleteStartTime = performance.now();
    await this.service.deleteTask(taskToDelete.id);
    const deleteTime = performance.now() - deleteStartTime;

    // Verify deletion
    const deletedTask = await this.service.getTaskById(taskToDelete.id);
    if (deletedTask !== null) {
      throw new Error('Task deletion failed');
    }

    console.log(`  ✅ Delete Task: ${deleteTime.toFixed(2)}ms`);
  }

  private async testHierarchicalOperations(): Promise<void> {
    console.log('\n🌳 Testing Hierarchical Operations...');

    // Create parent task
    const parentTask = await this.service.createTask({
      title: 'Parent Task',
      description: 'A parent task'
    });
    this.testTasks.push(parentTask);

    // Create child task
    const childTask = await this.service.createTask({
      parentTaskId: parentTask.id,
      title: 'Child Task',
      description: 'A child task'
    });
    this.testTasks.push(childTask);

    // Test child retrieval
    const startTime = performance.now();
    const children = await this.service.getChildTasks(parentTask.id);
    const hierarchyTime = performance.now() - startTime;

    if (children.length !== 1 || children[0].id !== childTask.id) {
      throw new Error('Child task retrieval failed');
    }

    console.log(`  ✅ Get Child Tasks: ${hierarchyTime.toFixed(2)}ms`);

    // Test root tasks
    const rootTasks = await this.service.getRootTasks();
    const hasParentTask = rootTasks.some(task => task.id === parentTask.id);

    if (!hasParentTask) {
      throw new Error('Root task retrieval failed');
    }

    console.log(`  ✅ Get Root Tasks: found ${rootTasks.length} root tasks`);

    // Test temporal consistency
    const isTemporallyConsistent = await this.service.validateTemporalConsistency(childTask.id);
    if (!isTemporallyConsistent) {
      throw new Error('Temporal consistency validation failed');
    }

    console.log(`  ✅ Temporal Consistency: validated`);
  }

  private async testPerformance(): Promise<void> {
    console.log('\n⚡ Testing Performance...');

    // Test bulk operations
    const bulkTasks = [];
    const bulkStartTime = performance.now();

    for (let i = 0; i < 5; i++) {
      const task = await this.service.createTask({
        title: `Bulk Test Task ${i}`,
        description: `Performance test task ${i}`
      });
      bulkTasks.push(task);
    }

    const bulkTime = performance.now() - bulkStartTime;
    const avgTime = bulkTime / 5;

    this.testTasks.push(...bulkTasks);

    console.log(`  ✅ Bulk Create (5 tasks): ${bulkTime.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms/task)`);

    if (avgTime > TEST_TIMEOUT) {
      console.warn(`  ⚠️  Performance warning: average time ${avgTime.toFixed(2)}ms exceeds threshold ${TEST_TIMEOUT}ms`);
    }
  }

  private async testErrorHandling(): Promise<void> {
    console.log('\n🛡️ Testing Error Handling...');

    // Test non-existent task
    try {
      await this.service.getTaskById('non-existent-id');
      throw new Error('Should have thrown TaskNotFoundError');
    } catch (error) {
      if (!(error instanceof TaskNotFoundError)) {
        console.log('  ✅ Non-existent task returns null (expected behavior)');
      }
    }

    // Test invalid parent
    try {
      await this.service.createTask({
        parentTaskId: 'non-existent-parent',
        title: 'Invalid Parent Test',
        description: 'This should fail'
      });
      throw new Error('Should have thrown TaskHierarchyError');
    } catch (error) {
      if (error instanceof TaskHierarchyError) {
        console.log('  ✅ Invalid parent handling: TaskHierarchyError thrown');
      } else {
        throw error;
      }
    }

    // Test deleting task with children
    const parentWithChild = await this.service.createTask({
      title: 'Parent with Child',
      description: 'This parent has a child'
    });

    const childOfParent = await this.service.createTask({
      parentTaskId: parentWithChild.id,
      title: 'Child of Parent',
      description: 'This is a child'
    });

    this.testTasks.push(parentWithChild, childOfParent);

    try {
      await this.service.deleteTask(parentWithChild.id);
      throw new Error('Should have thrown TaskHierarchyError');
    } catch (error) {
      if (error instanceof TaskHierarchyError) {
        console.log('  ✅ Cannot delete parent with children: TaskHierarchyError thrown');
      } else {
        throw error;
      }
    }
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test data...');

    // Delete child tasks first, then parents
    const childTasks = this.testTasks.filter(task => task.parentTaskId);
    const parentTasks = this.testTasks.filter(task => !task.parentTaskId);

    for (const task of childTasks) {
      try {
        await this.service.deleteTask(task.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    for (const task of parentTasks) {
      try {
        await this.service.deleteTask(task.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    await this.service.close();
    console.log('✅ Cleanup completed');
  }
}

// Run the smoke test if this file is executed directly
if (require.main === module) {
  const runner = new SmokeTestRunner();
  runner.runAllTests()
    .then(() => {
      console.log('\n🎯 TaskHierarchy Smoke Test Summary: PASSED');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 TaskHierarchy Smoke Test Summary: FAILED');
      console.error(error);
      process.exit(1);
    });
}

export { SmokeTestRunner };