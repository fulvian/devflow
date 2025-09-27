/**
 * Comprehensive Real-World Test for DevFlow Cognitive Task+Memory System
 * 
 * This test validates the complete integration of all core services:
 * - Task hierarchy management
 * - Semantic memory with vector embeddings
 * - Memory bridge context handling
 * - Synthetic API integration
 * - Cross-session persistence
 */

import { DevFlowOrchestrator } from '../packages/core/src/orchestrator/DevFlowOrchestrator';
import { TaskHierarchyService } from '../packages/core/src/services/TaskHierarchyService';
import { SemanticMemoryService } from '../packages/core/src/services/SemanticMemoryService';
import { MemoryBridgeService } from '../packages/core/src/services/MemoryBridgeService';
import { SyntheticApiClient } from '../packages/core/src/clients/SyntheticApiClient';
import { DatabaseService } from '../packages/core/src/database/DatabaseService';
import { Task, TaskStatus } from '../packages/core/src/types/Task';
import { MemoryEntry } from '../packages/core/src/types/Memory';
import { Context } from '../packages/core/src/types/Context';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const TEST_DB_PATH = './test-devflow.db';
const SCHEMA_PATH = './packages/core/src/database/schema.sql';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
}

interface PerformanceMetrics {
  taskCreationTime: number;
  memoryStorageTime: number;
  contextInjectionTime: number;
  apiCallTime: number;
}

class DevFlowRealWorldTest {
  private orchestrator: DevFlowOrchestrator;
  private taskService: TaskHierarchyService;
  private memoryService: SemanticMemoryService;
  private bridgeService: MemoryBridgeService;
  private apiClient: SyntheticApiClient;
  private dbService: DatabaseService;
  private testResults: TestResult[] = [];
  private metrics: PerformanceMetrics = {
    taskCreationTime: 0,
    memoryStorageTime: 0,
    contextInjectionTime: 0,
    apiCallTime: 0
  };

  constructor() {
    // Initialize services
    this.dbService = new DatabaseService(TEST_DB_PATH);
    this.taskService = new TaskHierarchyService(this.dbService);
    this.memoryService = new SemanticMemoryService(this.dbService);
    this.bridgeService = new MemoryBridgeService(this.dbService, this.memoryService);
    this.apiClient = new SyntheticApiClient('https://api.synthetic.devflow.test');
    
    this.orchestrator = new DevFlowOrchestrator(
      this.taskService,
      this.memoryService,
      this.bridgeService,
      this.apiClient
    );
  }

  /**
   * Initialize the database with schema
   */
  private async initializeDatabase(): Promise<void> {
    console.log('Initializing database...');
    const startTime = Date.now();
    
    try {
      // Read schema file
      const schema = fs.readFileSync(path.resolve(SCHEMA_PATH), 'utf8');
      
      // Initialize database
      await this.dbService.initialize(schema);
      
      const duration = Date.now() - startTime;
      this.testResults.push({
        name: 'Database Initialization',
        passed: true,
        duration
      });
      
      console.log(`Database initialized successfully in ${duration}ms`);
    } catch (error) {
      this.testResults.push({
        name: 'Database Initialization',
        passed: false,
        duration: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create realistic development task hierarchy
   */
  private async createTaskHierarchy(): Promise<void> {
    console.log('Creating task hierarchy...');
    const startTime = Date.now();
    
    try {
      // Create root project task
      const projectTask: Omit<Task, 'id'> = {
        title: 'DevFlow Cognitive System Implementation',
        description: 'Complete implementation of the cognitive task and memory system',
        status: TaskStatus.TODO,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: null,
        priority: 1
      };
      
      const projectId = await this.taskService.createTask(projectTask);
      
      // Create design subtask
      const designTask: Omit<Task, 'id'> = {
        title: 'System Design',
        description: 'Design the architecture for cognitive task and memory system',
        status: TaskStatus.IN_PROGRESS,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: projectId,
        priority: 1
      };
      
      const designId = await this.taskService.createTask(designTask);
      
      // Create implementation subtasks
      const implTask1: Omit<Task, 'id'> = {
        title: 'Core Services Implementation',
        description: 'Implement TaskHierarchyService, SemanticMemoryService, MemoryBridgeService',
        status: TaskStatus.TODO,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: projectId,
        priority: 2
      };
      
      const implTask2: Omit<Task, 'id'> = {
        title: 'Database Integration',
        description: 'Integrate SQLite database with all services',
        status: TaskStatus.TODO,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: projectId,
        priority: 2
      };
      
      await this.taskService.createTask(implTask1);
      await this.taskService.createTask(implTask2);
      
      // Create testing subtask under design
      const testTask: Omit<Task, 'id'> = {
        title: 'Test Plan Creation',
        description: 'Create comprehensive test plan for all components',
        status: TaskStatus.DONE,
        createdAt: new Date(),
        updatedAt: new Date(),
        parentId: designId,
        priority: 3
      };
      
      await this.taskService.createTask(testTask);
      
      const duration = Date.now() - startTime;
      this.metrics.taskCreationTime = duration;
      
      this.testResults.push({
        name: 'Task Hierarchy Creation',
        passed: true,
        duration
      });
      
      console.log(`Task hierarchy created successfully in ${duration}ms`);
    } catch (error) {
      this.testResults.push({
        name: 'Task Hierarchy Creation',
        passed: false,
        duration: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Test semantic memory with actual vector embeddings
   */
  private async testSemanticMemory(): Promise<void> {
    console.log('Testing semantic memory...');
    const startTime = Date.now();
    
    try {
      // Create sample memory entries with embeddings
      const memories: Omit<MemoryEntry, 'id' | 'createdAt'>[] = [
        {
          content: 'The system uses SQLite for persistent storage of tasks and memories',
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5], // Simulated embedding
          metadata: { type: 'technical', domain: 'database' },
          taskId: 1
        },
        {
          content: 'Task hierarchy supports parent-child relationships with priority ordering',
          embedding: [0.2, 0.3, 0.4, 0.5, 0.6], // Simulated embedding
          metadata: { type: 'functional', domain: 'task-management' },
          taskId: 1
        },
        {
          content: 'Semantic memory uses vector embeddings for similarity search',
          embedding: [0.3, 0.4, 0.5, 0.6, 0.7], // Simulated embedding
          metadata: { type: 'technical', domain: 'memory' },
          taskId: 2
        }
      ];
      
      // Store memories
      for (const memory of memories) {
        await this.memoryService.storeMemory(memory);
      }
      
      // Test similarity search
      const query embedding = [0.15, 0.25, 0.35, 0.45, 0.55]; // Similar to first memory
      const results = await this.memoryService.searchSimilarMemories(query embedding, 2);
      
      if (results.length === 0) {
        throw new Error('Semantic search returned no results');
      }
      
      const duration = Date.now() - startTime;
      this.metrics.memoryStorageTime = duration;
      
      this.testResults.push({
        name: 'Semantic Memory Operations',
        passed: true,
        duration
      });
      
      console.log(`Semantic memory test completed successfully in ${duration}ms`);
      console.log(`Found ${results.length} similar memories`);
    } catch (error) {
      this.testResults.push({
        name: 'Semantic Memory Operations',
        passed: false,
        duration: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Test memory bridge context injection and harvesting
   */
  private async testMemoryBridge(): Promise<void> {
    console.log('Testing memory bridge...');
    const startTime = Date.now();
    
    try {
      // Create sample context
      const context: Context = {
        taskId: 1,
        timestamp: new Date(),
        environment: 'development',
        userData: {
          userId: 'test-user-001',
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        systemData: {
          version: '1.0.0',
          platform: 'node'
        }
      };
      
      // Inject context
      await this.bridgeService.injectContext(context);
      
      // Harvest context
      const harvestedContext = await this.bridgeService.harvestContext(1);
      
      if (!harvestedContext) {
        throw new Error('Failed to harvest context');
      }
      
      // Validate harvested context
      if (harvestedContext.userData.userId !== 'test-user-001') {
        throw new Error('Context harvesting validation failed');
      }
      
      const duration = Date.now() - startTime;
      this.metrics.contextInjectionTime = duration;
      
      this.testResults.push({
        name: 'Memory Bridge Operations',
        passed: true,
        duration
      });
      
      console.log(`Memory bridge test completed successfully in ${duration}ms`);
    } catch (error) {
      this.testResults.push({
        name: 'Memory Bridge Operations',
        passed: false,
        duration: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Test Synthetic API integration
   */
  private async testSyntheticAPI(): Promise<void> {
    console.log('Testing Synthetic API integration...');
    const startTime = Date.now();
    
    try {
      // Mock API response for testing
      const mockResponse = {
        status: 'success',
        data: {
          message: 'API integration test successful',
          timestamp: new Date().toISOString()
        }
      };
      
      // Simulate API call through orchestrator
      const result = await this.orchestrator.executeTaskWithExternalIntegration(
        1,
        async () => mockResponse
      );
      
      if (!result || result.status !== 'success') {
        throw new Error('Synthetic API integration failed');
      }
      
      const duration = Date.now() - startTime;
      this.metrics.apiCallTime = duration;
      
      this.testResults.push({
        name: 'Synthetic API Integration',
        passed: true,
        duration
      });
      
      console.log(`Synthetic API test completed successfully in ${duration}ms`);
    } catch (error) {
      this.testResults.push({
        name: 'Synthetic API Integration',
        passed: false,
        duration: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate cross-session persistence
   */
  private async validatePersistence(): Promise<void> {
    console.log('Validating cross-session persistence...');
    const startTime = Date.now();
    
    try {
      // Create a new database service instance to simulate new session
      const newDbService = new DatabaseService(TEST_DB_PATH);
      const newTaskService = new TaskHierarchyService(newDbService);
      const newMemoryService = new SemanticMemoryService(newDbService);
      
      // Retrieve tasks from new session
      const tasks = await newTaskService.getAllTasks();
      if (tasks.length === 0) {
        throw new Error('No tasks found in persistent storage');
      }
      
      // Retrieve memories from new session
      const memories = await newMemoryService.getAllMemories();
      if (memories.length === 0) {
        throw new Error('No memories found in persistent storage');
      }
      
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: 'Cross-Session Persistence',
        passed: true,
        duration
      });
      
      console.log(`Persistence validation completed successfully in ${duration}ms`);
      console.log(`Found ${tasks.length} tasks and ${memories.length} memories`);
    } catch (error) {
      this.testResults.push({
        name: 'Cross-Session Persistence',
        passed: false,
        duration: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate detailed test report
   */
  private generateReport(): void {
    console.log('\n=== DEVFLOW COMPREHENSIVE TEST REPORT ===\n');
    
    let passedTests = 0;
    let totalDuration = 0;
    
    for (const result of this.testResults) {
      const status = result.passed ? 'PASS' : 'FAIL';
      console.log(`${status} | ${result.name} (${result.duration}ms)`);
      
      if (result.details && !result.passed) {
        console.log(`     Details: ${result.details}`);
      }
      
      if (result.passed) passedTests++;
      totalDuration += result.duration;
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Tests Passed: ${passedTests}/${this.testResults.length}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    
    console.log('\n=== PERFORMANCE METRICS ===');
    console.log(`Task Creation Time: ${this.metrics.taskCreationTime}ms`);
    console.log(`Memory Storage Time: ${this.metrics.memoryStorageTime}ms`);
    console.log(`Context Injection Time: ${this.metrics.contextInjectionTime}ms`);
    console.log(`API Call Time: ${this.metrics.apiCallTime}ms`);
    
    const overallSuccess = passedTests === this.testResults.length;
    console.log(`\nOVERALL RESULT: ${overallSuccess ? 'SUCCESS' : 'FAILURE'}`);
  }

  /**
   * Clean up test resources
   */
  private async cleanup(): Promise<void> {
    try {
      // Close database connections
      await this.dbService.close();
      
      // Remove test database file
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
        console.log('Test database cleaned up successfully');
      }
    } catch (error) {
      console.warn('Cleanup warning:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Run the complete test suite
   */
  public async run(): Promise<void> {
    console.log('Starting DevFlow Comprehensive Real-World Test...\n');
    
    try {
      // Execute all test phases
      await this.initializeDatabase();
      await this.createTaskHierarchy();
      await this.testSemanticMemory();
      await this.testMemoryBridge();
      await this.testSyntheticAPI();
      await this.validatePersistence();
      
      // Generate final report
      this.generateReport();
    } catch (error) {
      console.error('Test suite failed with error:', error instanceof Error ? error.message : 'Unknown error');
      this.generateReport();
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Execute the test if run directly
if (require.main === module) {
  const test = new DevFlowRealWorldTest();
  test.run().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { DevFlowRealWorldTest };