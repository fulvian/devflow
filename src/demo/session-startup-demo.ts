#!/usr/bin/env ts-node
/**
 * Advanced Session Management System - Demo Script
 * 
 * This script demonstrates the complete startup flow of the session management system,
 * including session creation, task discovery, interactive selection, database integration,
 * and progress monitoring.
 */

import { SessionManager } from './session-manager';
import { TaskRegistry } from './task-registry';
import { DatabaseService } from './database-service';
import { ProgressMonitor } from './progress-monitor';
import { Session, Task } from './types';

/**
 * Demo script for the advanced session management system
 */
class SessionManagementDemo {
  private sessionManager: SessionManager;
  private taskRegistry: TaskRegistry;
  private databaseService: DatabaseService;
  private progressMonitor: ProgressMonitor;

  constructor() {
    this.sessionManager = new SessionManager();
    this.taskRegistry = new TaskRegistry();
    this.databaseService = new DatabaseService();
    this.progressMonitor = new ProgressMonitor();
  }

  /**
   * Run the complete demo flow
   */
  async run(): Promise<void> {
    console.log('🚀 Starting Advanced Session Management System Demo\n');
    
    try {
      // Step 1: Test session creation
      await this.testSessionCreation();
      
      // Step 2: Demonstrate task discovery
      await this.demonstrateTaskDiscovery();
      
      // Step 3: Simulate interactive selection
      await this.simulateInteractiveSelection();
      
      // Step 4: Verify database integration
      await this.verifyDatabaseIntegration();
      
      // Step 5: Demo progress monitoring
      await this.demoProgressMonitoring();
      
      console.log('\n✅ All demo components completed successfully!');
    } catch (error) {
      console.error('❌ Demo failed with error:', error);
      process.exit(1);
    }
  }

  /**
   * Test session creation functionality
   */
  private async testSessionCreation(): Promise<void> {
    console.log('1️⃣  Testing Session Creation...');
    
    const sessionConfig = {
      name: 'Demo Session',
      description: 'Testing session creation for demo purposes',
      tags: ['demo', 'testing'],
      maxConcurrentTasks: 3
    };
    
    const session = await this.sessionManager.createSession(sessionConfig);
    console.log(`   Created session: ${session.id} - ${session.name}`);
    console.log(`   Session status: ${session.status}`);
    
    // Verify session was created properly
    if (!session.id || session.status !== 'active') {
      throw new Error('Session creation failed');
    }
    
    console.log('   ✅ Session creation test passed\n');
  }

  /**
   * Demonstrate task discovery capabilities
   */
  private async demonstrateTaskDiscovery(): Promise<void> {
    console.log('2️⃣  Demonstrating Task Discovery...');
    
    // Register some sample tasks for discovery
    this.taskRegistry.registerTask({
      id: 'data-processing',
      name: 'Data Processing Task',
      description: 'Processes large datasets',
      category: 'processing',
      estimatedDuration: 300
    });
    
    this.taskRegistry.registerTask({
      id: 'report-generation',
      name: 'Report Generation',
      description: 'Generates analytical reports',
      category: 'reporting',
      estimatedDuration: 120
    });
    
    this.taskRegistry.registerTask({
      id: 'notification-service',
      name: 'Notification Service',
      description: 'Sends system notifications',
      category: 'communication',
      estimatedDuration: 60
    });
    
    const allTasks = this.taskRegistry.getAllTasks();
    console.log(`   Discovered ${allTasks.length} tasks:`);
    
    allTasks.forEach((task, index) => {
      console.log(`     ${index + 1}. ${task.name} (${task.category})`);
    });
    
    // Test category filtering
    const processingTasks = this.taskRegistry.getTasksByCategory('processing');
    console.log(`   \nFound ${processingTasks.length} processing tasks`);
    
    console.log('   ✅ Task discovery demonstration completed\n');
  }

  /**
   * Simulate interactive task selection
   */
  private async simulateInteractiveSelection(): Promise<void> {
    console.log('3️⃣  Simulating Interactive Selection...');
    
    const availableTasks = this.taskRegistry.getAllTasks();
    console.log('   Available tasks for selection:');
    
    availableTasks.forEach((task, index) => {
      console.log(`     [${index + 1}] ${task.name}`);
    });
    
    // Simulate user selection (in a real app, this would be interactive)
    const selectedTaskIds = ['data-processing', 'report-generation'];
    console.log(`   \nSimulating selection of tasks: ${selectedTaskIds.join(', ')}`);
    
    const selectedTasks = selectedTaskIds
      .map(id => this.taskRegistry.getTaskById(id))
      .filter((task): task is Task => task !== undefined);
    
    if (selectedTasks.length !== selectedTaskIds.length) {
      throw new Error('Failed to retrieve all selected tasks');
    }
    
    console.log('   Selected tasks:');
    selectedTasks.forEach(task => {
      console.log(`     - ${task.name}: ${task.description}`);
    });
    
    console.log('   ✅ Interactive selection simulation completed\n');
  }

  /**
   * Verify database integration
   */
  private async verifyDatabaseIntegration(): Promise<void> {
    console.log('4️⃣  Verifying Database Integration...');
    
    // Test connection
    const isConnected = await this.databaseService.connect();
    console.log(`   Database connection: ${isConnected ? '✅ Connected' : '❌ Failed'}`);
    
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    
    // Test session persistence
    const testSession: Session = {
      id: 'test-session-001',
      name: 'Database Test Session',
      description: 'Session for testing database integration',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: ['test'],
      maxConcurrentTasks: 2
    };
    
    const savedSession = await this.databaseService.saveSession(testSession);
    console.log(`   Session saved to database: ${savedSession.id}`);
    
    // Test retrieval
    const retrievedSession = await this.databaseService.getSessionById(testSession.id);
    if (!retrievedSession) {
      throw new Error('Failed to retrieve session from database');
    }
    
    console.log(`   Session retrieved from database: ${retrievedSession.name}`);
    
    // Test task logging
    const testTask: Task = {
      id: 'db-test-task',
      name: 'Database Test Task',
      description: 'Task for testing database operations',
      category: 'testing',
      estimatedDuration: 45
    };
    
    await this.databaseService.logTaskExecution(testTask, testSession.id, 'completed');
    console.log('   Task execution logged to database');
    
    console.log('   ✅ Database integration verification completed\n');
  }

  /**
   * Demonstrate progress monitoring
   */
  private async demoProgressMonitoring(): Promise<void> {
    console.log('5️⃣  Demonstrating Progress Monitoring...');
    
    // Create a mock session for monitoring
    const session = await this.sessionManager.createSession({
      name: 'Progress Demo Session',
      description: 'Session for progress monitoring demo',
      tags: ['demo', 'progress'],
      maxConcurrentTasks: 1
    });
    
    console.log(`   Monitoring session: ${session.id}`);
    
    // Simulate task progress updates
    const task = this.taskRegistry.getTaskById('data-processing');
    if (!task) {
      throw new Error('Required task not found');
    }
    
    console.log(`   Tracking progress for task: ${task.name}`);
    
    // Simulate progress updates
    for (let i = 0; i <= 100; i += 20) {
      this.progressMonitor.updateTaskProgress(session.id, task.id, i);
      console.log(`     Progress: ${i}%`);
      
      // Simulate work delay
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Mark task as completed
    this.progressMonitor.completeTask(session.id, task.id);
    console.log('     Task completed successfully');
    
    // Show final session status
    const sessionStatus = this.progressMonitor.getSessionStatus(session.id);
    console.log(`   Final session status: ${sessionStatus.progress}% complete`);
    
    console.log('   ✅ Progress monitoring demonstration completed\n');
  }
}

// Execute the demo when run directly
if (require.main === module) {
  const demo = new SessionManagementDemo();
  demo.run().catch(console.error);
}

export { SessionManagementDemo };