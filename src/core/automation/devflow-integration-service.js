/**
 * DevFlow Integration Service
 * Integrates Task Automation Engine with DevFlow orchestrator and existing services
 *
 * Provides seamless integration with Cometa Brain, Context7, and monitoring systems
 */

const express = require('express');
const { TaskAutomationEngine } = require('./task-automation-engine');
const { EventEmitter } = require('events');

class DevFlowIntegrationService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = options.port || 3006;
    this.orchestratorUrl = options.orchestratorUrl || 'http://localhost:3005';
    this.automationEngine = new TaskAutomationEngine(options.engineOptions);
    this.app = express();
    this.server = null;
    this.activeRequests = new Map();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS for DevFlow ecosystem
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request tracking middleware
    this.app.use((req, res, next) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.requestId = requestId;
      req.startTime = performance.now();

      this.activeRequests.set(requestId, {
        method: req.method,
        url: req.url,
        startTime: req.startTime,
        userAgent: req.get('User-Agent')
      });

      res.on('finish', () => {
        this.activeRequests.delete(requestId);
      });

      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'devflow-integration-service',
        timestamp: new Date().toISOString(),
        activeRequests: this.activeRequests.size,
        automationEngine: this.automationEngine.initialized ? 'ready' : 'initializing'
      });
    });

    // Start automatic task creation workflow
    this.app.post('/api/workflows/create-tasks', async (req, res) => {
      try {
        const { projectId, userIntent, options = {} } = req.body;

        if (!projectId) {
          return res.status(400).json({
            error: 'projectId is required'
          });
        }

        const workflowId = await this.automationEngine.analyzeProjectAndCreateTasks(
          projectId,
          userIntent,
          { ...options, requestId: req.requestId }
        );

        res.json({
          success: true,
          workflowId,
          message: 'Task creation workflow started',
          estimatedDuration: '2-5 minutes'
        });

      } catch (error) {
        console.error('Error starting task creation workflow:', error);
        res.status(500).json({
          error: 'Failed to start task creation workflow',
          details: error.message
        });
      }
    });

    // Get workflow status
    this.app.get('/api/workflows/:workflowId/status', async (req, res) => {
      try {
        const { workflowId } = req.params;
        const workflowState = await this.automationEngine.stateManager.loadWorkflowState(workflowId);

        if (!workflowState) {
          return res.status(404).json({
            error: 'Workflow not found'
          });
        }

        res.json({
          workflowId: workflowState.workflowId,
          projectId: workflowState.projectId,
          currentStage: workflowState.currentStage,
          status: workflowState.status,
          proposedTasks: workflowState.proposedTasks,
          approvedTasks: workflowState.approvedTasks,
          pendingApprovals: workflowState.pendingApprovals,
          metadata: workflowState.metadata,
          createdAt: workflowState.createdAt,
          updatedAt: workflowState.updatedAt
        });

      } catch (error) {
        console.error('Error getting workflow status:', error);
        res.status(500).json({
          error: 'Failed to get workflow status',
          details: error.message
        });
      }
    });

    // Handle user approval
    this.app.post('/api/workflows/:workflowId/approve', async (req, res) => {
      try {
        const { workflowId } = req.params;
        const { approved, modifications, feedback } = req.body;

        await this.automationEngine.processApproval(workflowId, {
          approved,
          modifications,
          feedback
        });

        res.json({
          success: true,
          message: approved ? 'Tasks approved and creation in progress' : 'Tasks rejected'
        });

      } catch (error) {
        console.error('Error processing approval:', error);
        res.status(500).json({
          error: 'Failed to process approval',
          details: error.message
        });
      }
    });

    // Get pending approvals across all workflows
    this.app.get('/api/workflows/pending-approvals', async (req, res) => {
      try {
        const pendingWorkflows = await this.automationEngine.stateManager.getPendingApprovals();

        const approvals = pendingWorkflows.map(workflow => ({
          workflowId: workflow.workflowId,
          projectId: workflow.projectId,
          proposedTasks: workflow.proposedTasks,
          pendingApprovals: workflow.pendingApprovals,
          updatedAt: workflow.updatedAt
        }));

        res.json({
          pendingApprovals: approvals,
          count: approvals.length
        });

      } catch (error) {
        console.error('Error getting pending approvals:', error);
        res.status(500).json({
          error: 'Failed to get pending approvals',
          details: error.message
        });
      }
    });

    // Get active workflows
    this.app.get('/api/workflows/active', async (req, res) => {
      try {
        const activeWorkflows = await this.automationEngine.stateManager.getActiveWorkflows();

        res.json({
          activeWorkflows: activeWorkflows.map(w => ({
            workflowId: w.workflowId,
            projectId: w.projectId,
            currentStage: w.currentStage,
            status: w.status,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt
          })),
          count: activeWorkflows.length
        });

      } catch (error) {
        console.error('Error getting active workflows:', error);
        res.status(500).json({
          error: 'Failed to get active workflows',
          details: error.message
        });
      }
    });

    // Manual project analysis trigger (for debugging/testing)
    this.app.post('/api/projects/:projectId/analyze', async (req, res) => {
      try {
        const { projectId } = req.params;
        const { userIntent } = req.body;

        const workflowId = await this.automationEngine.analyzeProjectAndCreateTasks(
          parseInt(projectId),
          userIntent || 'Manual analysis trigger'
        );

        res.json({
          success: true,
          workflowId,
          message: 'Project analysis started'
        });

      } catch (error) {
        console.error('Error analyzing project:', error);
        res.status(500).json({
          error: 'Failed to analyze project',
          details: error.message
        });
      }
    });

    // System metrics endpoint
    this.app.get('/api/metrics', (req, res) => {
      const metrics = {
        activeWorkflows: this.automationEngine.activeWorkflows.size,
        activeRequests: this.activeRequests.size,
        engineInitialized: this.automationEngine.initialized,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };

      res.json(metrics);
    });

    // Orchestrator integration endpoint
    this.app.post('/api/orchestrator/task-request', async (req, res) => {
      try {
        const { projectId, taskType, context } = req.body;

        // This endpoint is called by the orchestrator when it needs tasks created
        const workflowId = await this.automationEngine.analyzeProjectAndCreateTasks(
          projectId,
          `Orchestrator request: ${taskType}`,
          {
            source: 'orchestrator',
            taskType,
            context,
            autoApprove: true // Orchestrator requests can be auto-approved
          }
        );

        res.json({
          success: true,
          workflowId,
          message: 'Task creation workflow initiated by orchestrator'
        });

      } catch (error) {
        console.error('Error handling orchestrator task request:', error);
        res.status(500).json({
          error: 'Failed to handle orchestrator request',
          details: error.message
        });
      }
    });
  }

  setupEventHandlers() {
    // Forward automation engine events
    this.automationEngine.on('progress', (event) => {
      this.emit('workflow_progress', event);
    });

    this.automationEngine.on('tasks_proposed', (event) => {
      this.emit('tasks_proposed', event);
    });

    this.automationEngine.on('approval_required', (event) => {
      this.emit('approval_required', event);
    });

    this.automationEngine.on('tasks_created', (event) => {
      this.emit('tasks_created', event);
      // Notify orchestrator of new tasks
      this.notifyOrchestrator('tasks_created', event.data);
    });

    this.automationEngine.on('automation_failed', (event) => {
      this.emit('automation_failed', event);
      // Notify orchestrator of failures
      this.notifyOrchestrator('automation_failed', event.data);
    });
  }

  async notifyOrchestrator(eventType, data) {
    try {
      const response = await fetch(`${this.orchestratorUrl}/api/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'task-automation-service',
          eventType,
          data,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        console.warn('Failed to notify orchestrator:', response.status);
      }
    } catch (error) {
      console.warn('Error notifying orchestrator:', error.message);
    }
  }

  async start() {
    try {
      // Initialize automation engine
      await this.automationEngine.initialize();

      // Start HTTP server
      this.server = this.app.listen(this.port, () => {
        console.log(`DevFlow Integration Service running on port ${this.port}`);
        this.emit('service_started', { port: this.port });
      });

      // Register with orchestrator
      await this.registerWithOrchestrator();

      return { port: this.port, status: 'started' };

    } catch (error) {
      console.error('Failed to start DevFlow Integration Service:', error);
      throw error;
    }
  }

  async registerWithOrchestrator() {
    try {
      const response = await fetch(`${this.orchestratorUrl}/api/services/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          serviceName: 'task-automation-service',
          serviceUrl: `http://localhost:${this.port}`,
          capabilities: [
            'automatic_task_creation',
            'project_analysis',
            'workflow_management',
            'approval_handling'
          ],
          healthEndpoint: '/health',
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        console.log('Successfully registered with orchestrator');
      } else {
        console.warn('Failed to register with orchestrator:', response.status);
      }
    } catch (error) {
      console.warn('Error registering with orchestrator:', error.message);
    }
  }

  async stop() {
    try {
      if (this.server) {
        this.server.close();
      }

      await this.automationEngine.shutdown();
      this.emit('service_stopped');

    } catch (error) {
      console.error('Error stopping service:', error);
    }
  }
}

module.exports = { DevFlowIntegrationService };