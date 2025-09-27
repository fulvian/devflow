/**
 * DevFlow Automatic Task Creation System - Main Entry Point
 * Based on Context7 patterns for intelligent workflow automation
 *
 * Provides a complete task automation solution with:
 * - Event-driven architecture
 * - Approval workflows
 * - State persistence
 * - DevFlow ecosystem integration
 */

const { DevFlowIntegrationService } = require('./devflow-integration-service');
const { TaskAutomationEngine } = require('./task-automation-engine');
const { WorkflowStateManager } = require('./workflow-state-manager');

// Main service instance
let integrationService = null;

/**
 * Initialize and start the Task Automation System
 */
async function startTaskAutomationSystem(options = {}) {
  try {
    const config = {
      port: options.port || process.env.TASK_AUTOMATION_PORT || 3006,
      orchestratorUrl: options.orchestratorUrl || process.env.ORCHESTRATOR_URL || 'http://localhost:3005',
      engineOptions: {
        dbPath: options.dbPath || process.env.DEVFLOW_DB_PATH || './data/devflow_unified.sqlite',
        approvalTimeout: options.approvalTimeout || 300000, // 5 minutes
        context7QualityThreshold: options.context7QualityThreshold || 0.75,
        ...options.engineOptions
      }
    };

    console.log('🚀 Starting DevFlow Task Automation System...');
    console.log('📊 Configuration:', {
      port: config.port,
      orchestratorUrl: config.orchestratorUrl,
      dbPath: config.engineOptions.dbPath,
      qualityThreshold: config.engineOptions.context7QualityThreshold
    });

    integrationService = new DevFlowIntegrationService(config);

    // Setup event logging
    setupEventLogging(integrationService);

    // Start the service
    const startResult = await integrationService.start();

    console.log('✅ Task Automation System started successfully');
    console.log(`🌐 API Server: http://localhost:${startResult.port}`);
    console.log('📚 Available endpoints:');
    console.log('   POST /api/workflows/create-tasks - Start task creation workflow');
    console.log('   GET  /api/workflows/:id/status - Get workflow status');
    console.log('   POST /api/workflows/:id/approve - Approve/reject tasks');
    console.log('   GET  /api/workflows/pending-approvals - Get pending approvals');
    console.log('   GET  /api/workflows/active - Get active workflows');
    console.log('   GET  /health - Service health check');

    return integrationService;

  } catch (error) {
    console.error('❌ Failed to start Task Automation System:', error);
    throw error;
  }
}

/**
 * Stop the Task Automation System
 */
async function stopTaskAutomationSystem() {
  try {
    if (integrationService) {
      console.log('🛑 Stopping DevFlow Task Automation System...');
      await integrationService.stop();
      integrationService = null;
      console.log('✅ Task Automation System stopped');
    }
  } catch (error) {
    console.error('❌ Error stopping Task Automation System:', error);
    throw error;
  }
}

/**
 * Get the current service instance
 */
function getTaskAutomationService() {
  return integrationService;
}

/**
 * Setup comprehensive event logging
 */
function setupEventLogging(service) {
  // Workflow progress events
  service.on('workflow_progress', (event) => {
    console.log(`📊 [${event.data.stage}] ${event.data.message} (${event.data.progress}%)`);
  });

  // Task proposals
  service.on('tasks_proposed', (event) => {
    console.log(`💡 Tasks proposed: ${event.data.proposedTasks.length} tasks`);
    console.log(`🎯 Confidence: ${(event.data.confidence * 100).toFixed(1)}%`);
    if (event.data.requiresApproval) {
      console.log('⏳ Human approval required');
    }
  });

  // Approval requests
  service.on('approval_required', (event) => {
    console.log('🔔 APPROVAL REQUIRED:');
    console.log(`   Reason: ${event.data.reasonForApproval}`);
    console.log(`   Tasks: ${event.data.taskProposal.length}`);
    console.log(`   Timeout: ${event.data.timeoutMs / 1000}s`);
  });

  // Task creation completion
  service.on('tasks_created', (event) => {
    console.log('🎉 TASKS CREATED SUCCESSFULLY:');
    console.log(`   Created: ${event.data.createdTasks.length} tasks`);
    console.log(`   Estimated duration: ${event.data.executionPlan.estimatedDuration}h`);
  });

  // Automation failures
  service.on('automation_failed', (event) => {
    console.error('💥 AUTOMATION FAILED:');
    console.error(`   Error: ${event.data.error}`);
    console.error(`   Context: ${JSON.stringify(event.data.context)}`);
    if (event.data.recoveryOptions.canRetry) {
      console.log('🔄 Retry available');
    }
  });

  // Service lifecycle events
  service.on('service_started', (event) => {
    console.log(`✨ Service started on port ${event.port}`);
  });

  service.on('service_stopped', () => {
    console.log('🏁 Service stopped');
  });
}

/**
 * CLI interface for direct usage
 */
async function runCLI() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'start':
      try {
        await startTaskAutomationSystem();

        // Keep the process running
        process.on('SIGTERM', async () => {
          await stopTaskAutomationSystem();
          process.exit(0);
        });

        process.on('SIGINT', async () => {
          await stopTaskAutomationSystem();
          process.exit(0);
        });

      } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
      }
      break;

    case 'analyze':
      const projectId = parseInt(args[1]);
      if (!projectId) {
        console.error('Usage: node index.js analyze <projectId>');
        process.exit(1);
      }

      try {
        const service = await startTaskAutomationSystem();
        const workflowId = await service.automationEngine.analyzeProjectAndCreateTasks(
          projectId,
          'CLI analysis request'
        );

        console.log(`Analysis started: ${workflowId}`);

        // Monitor progress for 60 seconds
        setTimeout(async () => {
          await stopTaskAutomationSystem();
          process.exit(0);
        }, 60000);

      } catch (error) {
        console.error('Analysis failed:', error);
        process.exit(1);
      }
      break;

    case 'status':
      // Implementation for status checking would go here
      console.log('Status command not yet implemented');
      break;

    default:
      console.log('DevFlow Task Automation System');
      console.log('');
      console.log('Usage:');
      console.log('  node index.js start                    # Start the service');
      console.log('  node index.js analyze <projectId>      # Analyze project and create tasks');
      console.log('  node index.js status                   # Show system status');
      console.log('');
      console.log('Environment Variables:');
      console.log('  TASK_AUTOMATION_PORT=3006             # Service port');
      console.log('  ORCHESTRATOR_URL=http://localhost:3005 # Orchestrator URL');
      console.log('  DEVFLOW_DB_PATH=./data/devflow_unified.sqlite # Database path');
      break;
  }
}

// Export for programmatic usage
module.exports = {
  startTaskAutomationSystem,
  stopTaskAutomationSystem,
  getTaskAutomationService,
  TaskAutomationEngine,
  DevFlowIntegrationService,
  WorkflowStateManager
};

// CLI execution
if (require.main === module) {
  runCLI().catch(console.error);
}