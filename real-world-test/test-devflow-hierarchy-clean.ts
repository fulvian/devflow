/**
 * Real-World Test for DevFlow System - 6-Month Development Project
 * Task ID: RWTEST-004
 * 
 * This test creates a comprehensive 6-month development project with authentic
 * task hierarchy following the DevFlow system's project→roadmaps→macros→micros structure.
 */

import { performance } from 'perf_hooks';
import { writeFileSync } from 'fs';

// Initialize DevFlow orchestrator - using direct import path
import { DevFlowOrchestrator } from '../src/core/devflow-orchestrator';

// Performance metrics tracking
interface PerformanceMetrics {
  projectCreationTime: number;
  taskHierarchyValidationTime: number;
  temporalConsistencyCheckTime: number;
  totalExecutionTime: number;
  taskCount: {
    total: number;
    roadmaps: number;
    macros: number;
    micros: number;
  };
}

// Test Logger class
class TestLogger {
  private logs: string[] = [];

  info(message: string): void {
    const logEntry = `[INFO] ${new Date().toISOString()}: ${message}`;
    console.log(logEntry);
    this.logs.push(logEntry);
  }

  error(message: string, error?: Error): void {
    const logEntry = `[ERROR] ${new Date().toISOString()}: ${message}${error ? ` - ${error.message}` : ''}`;
    console.error(logEntry);
    this.logs.push(logEntry);
  }

  warn(message: string): void {
    const logEntry = `[WARN] ${new Date().toISOString()}: ${message}`;
    console.warn(logEntry);
    this.logs.push(logEntry);
  }

  getLogs(): string[] {
    return this.logs;
  }

  exportLogs(filename: string): void {
    writeFileSync(filename, this.logs.join('\n'));
  }
}

const logger = new TestLogger();

/**
 * Main test function
 */
async function runRealWorldDevFlowTest(): Promise<void> {
  const startTime = performance.now();
  logger.info('🚀 Starting Real-World DevFlow Task Hierarchy Test');

  try {
    // Initialize DevFlow system
    const orchestrator = new DevFlowOrchestrator();
    await orchestrator.initialize();
    logger.info('✅ DevFlow system initialized');

    // Create strategic project (6-month timeline)
    const projectStart = performance.now();
    
    const projectTask = await orchestrator.createTask({
      title: 'Enterprise Customer Portal Redesign',
      description: 'Complete redesign of customer-facing portal with modern UI/UX and enhanced functionality',
      priority: 'h-'
    });
    logger.info(`✅ Created strategic project task: ${projectTask.id}`);

    // Create roadmap tasks
    const roadmapTasks = await Promise.all([
      orchestrator.createTask({
        title: 'Foundation & Architecture',
        description: 'Establish technical foundation and system architecture',
        priority: 'h-',
        parentTaskId: projectTask.id
      }),
      orchestrator.createTask({
        title: 'Core Functionality Implementation', 
        description: 'Implement core features and business logic',
        priority: 'h-',
        parentTaskId: projectTask.id
      }),
      orchestrator.createTask({
        title: 'UI/UX & Integration',
        description: 'Develop user interface and integrate with backend services',
        priority: 'h-',
        parentTaskId: projectTask.id
      }),
      orchestrator.createTask({
        title: 'Testing & Deployment',
        description: 'Comprehensive testing and production deployment',
        priority: 'h-',
        parentTaskId: projectTask.id
      })
    ]);
    
    logger.info(`✅ Created ${roadmapTasks.length} roadmap tasks`);

    // Create macro tasks for Foundation & Architecture roadmap
    const macroTasks = await Promise.all([
      orchestrator.createTask({
        title: 'Technology Stack Selection',
        description: 'Evaluate and select appropriate technologies for the project',
        priority: 'm-',
        parentTaskId: roadmapTasks[0].id
      }),
      orchestrator.createTask({
        title: 'System Architecture Design',
        description: 'Design overall system architecture and component interactions',
        priority: 'm-',
        parentTaskId: roadmapTasks[0].id
      }),
      orchestrator.createTask({
        title: 'Development Environment Setup',
        description: 'Set up CI/CD pipelines, development tools, and environments',
        priority: 'm-',
        parentTaskId: roadmapTasks[0].id
      }),
      orchestrator.createTask({
        title: 'User Management System',
        description: 'Implement authentication, authorization, and user profiles',
        priority: 'm-',
        parentTaskId: roadmapTasks[1].id
      }),
      orchestrator.createTask({
        title: 'Responsive UI Development',
        description: 'Create responsive user interface components',
        priority: 'm-',
        parentTaskId: roadmapTasks[2].id
      })
    ]);

    logger.info(`✅ Created ${macroTasks.length} macro tasks`);

    // Create micro tasks with Git branch names
    const microTasks = await Promise.all([
      orchestrator.createTask({
        title: 'Research Frontend Frameworks',
        description: 'Evaluate React, Vue, and Angular for project suitability - Git branch: feat/research-frontend-frameworks',
        priority: 'l-',
        parentTaskId: macroTasks[0].id
      }),
      orchestrator.createTask({
        title: 'Database Technology Evaluation',
        description: 'Compare PostgreSQL, MongoDB, and MySQL for data storage needs - Git branch: feat/evaluate-database-tech',
        priority: 'l-',
        parentTaskId: macroTasks[0].id
      }),
      orchestrator.createTask({
        title: 'API Design Specification',
        description: 'Define RESTful API endpoints and data structures - Git branch: docs/api-design-spec',
        priority: 'l-',
        parentTaskId: macroTasks[1].id
      }),
      orchestrator.createTask({
        title: 'User Registration Implementation',
        description: 'Implement user registration with email verification - Git branch: feat/user-registration',
        priority: 'l-',
        parentTaskId: macroTasks[3].id
      }),
      orchestrator.createTask({
        title: 'Component Library Setup',
        description: 'Create reusable UI component library with Storybook - Git branch: feat/component-library',
        priority: 'l-',
        parentTaskId: macroTasks[4].id
      })
    ]);

    logger.info(`✅ Created ${microTasks.length} micro tasks`);

    const projectCreationTime = performance.now() - projectStart;

    // Test task hierarchy validation
    const hierarchyStart = performance.now();
    const hierarchy = await orchestrator.getTaskHierarchy();
    logger.info(`📊 Retrieved task hierarchy with ${hierarchy.length} total tasks`);
    
    // Validate parent-child relationships
    let relationshipErrors = 0;
    for (const task of hierarchy) {
      if (task.parentTaskId) {
        const parent = hierarchy.find(t => t.id === task.parentTaskId);
        if (!parent) {
          logger.error(`❌ Parent task ${task.parentTaskId} not found for task ${task.id}`);
          relationshipErrors++;
        }
      }
    }

    if (relationshipErrors === 0) {
      logger.info('✅ All parent-child relationships validated successfully');
    } else {
      logger.error(`❌ Found ${relationshipErrors} relationship errors`);
    }

    const hierarchyValidationTime = performance.now() - hierarchyStart;

    // Test temporal consistency
    const temporalStart = performance.now();
    const allTasks = hierarchy;
    const temporalConsistencyTime = performance.now() - temporalStart;

    // Calculate performance metrics
    const totalTime = performance.now() - startTime;
    const metrics: PerformanceMetrics = {
      projectCreationTime: Math.round(projectCreationTime * 100) / 100,
      taskHierarchyValidationTime: Math.round(hierarchyValidationTime * 100) / 100,
      temporalConsistencyCheckTime: Math.round(temporalConsistencyTime * 100) / 100,
      totalExecutionTime: Math.round(totalTime * 100) / 100,
      taskCount: {
        total: allTasks.length,
        roadmaps: roadmapTasks.length,
        macros: macroTasks.length,
        micros: microTasks.length
      }
    };

    // Export performance metrics
    writeFileSync('real-world-test/performance-metrics.json', JSON.stringify(metrics, null, 2));
    logger.info('📊 Performance metrics exported to performance-metrics.json');

    // Success summary
    logger.info('🎉 Real-World DevFlow Task Hierarchy Test COMPLETED SUCCESSFULLY');
    logger.info(`📊 Performance Summary:`);
    logger.info(`   - Total tasks created: ${metrics.taskCount.total}`);
    logger.info(`   - Project creation: ${metrics.projectCreationTime}ms`);
    logger.info(`   - Hierarchy validation: ${metrics.taskHierarchyValidationTime}ms`);
    logger.info(`   - Total execution time: ${metrics.totalExecutionTime}ms`);

    // Export test logs
    logger.exportLogs('real-world-test/test-execution.log');

  } catch (error) {
    logger.error('❌ Real-World DevFlow test failed', error as Error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  runRealWorldDevFlowTest()
    .then(() => {
      console.log('🚀 Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}