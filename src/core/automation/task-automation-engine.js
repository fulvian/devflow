/**
 * DevFlow Task Automation Engine
 * Based on Context7 patterns for intelligent task creation and workflow management
 *
 * Implements structured workflow with approval steps and event-driven processing
 */

const EventEmitter = require('events');
const { WorkflowState, WorkflowStateManager } = require('./workflow-state-manager');
const {
  ProjectAnalysisEvent,
  TaskGenerationRequiredEvent,
  TasksProposedEvent,
  ApprovalRequiredEvent,
  UserApprovalEvent,
  TasksCreatedEvent,
  AutomationFailedEvent,
  ProgressEvent
} = require('./task-creation-events');

class TaskAutomationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.stateManager = new WorkflowStateManager(options.dbPath);
    this.activeWorkflows = new Map();
    this.approvalTimeout = options.approvalTimeout || 300000; // 5 minutes
    this.context7QualityThreshold = options.context7QualityThreshold || 0.75;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      await this.stateManager.initialize();

      // Restore active workflows from database
      const activeWorkflows = await this.stateManager.getActiveWorkflows();
      for (const workflow of activeWorkflows) {
        this.activeWorkflows.set(workflow.workflowId, workflow);
        this.emit('workflow_restored', workflow);
      }

      this.initialized = true;
      this.emit('engine_initialized', {
        restoredWorkflows: activeWorkflows.length
      });

    } catch (error) {
      this.emit('engine_error', { error, stage: 'initialization' });
      throw error;
    }
  }

  /**
   * Start automatic task creation workflow for a project
   */
  async analyzeProjectAndCreateTasks(projectId, userIntent = null, options = {}) {
    const workflowId = `taskgen_${projectId}_${Date.now()}`;

    try {
      // Create initial workflow state
      const workflowState = new WorkflowState({
        workflowId,
        projectId,
        currentStage: 'project_analysis',
        projectContext: { userIntent, options },
        status: 'active'
      });

      await this.stateManager.saveWorkflowState(workflowState);
      this.activeWorkflows.set(workflowId, workflowState);

      // Emit progress event
      this.emit('progress', new ProgressEvent('project_analysis', 0, 'Starting project analysis'));

      // Start the workflow
      await this.processProjectAnalysis(workflowId);

      return workflowId;

    } catch (error) {
      this.emit('automation_failed', new AutomationFailedEvent(error, { projectId, userIntent }, {}));
      throw error;
    }
  }

  /**
   * Process project analysis stage
   */
  async processProjectAnalysis(workflowId) {
    const workflowState = await this.stateManager.loadWorkflowState(workflowId);
    if (!workflowState) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    try {
      this.emit('progress', new ProgressEvent('project_analysis', 25, 'Analyzing project structure'));

      // Fetch project data from database
      const projectData = await this.fetchProjectData(workflowState.projectId);
      const existingTasks = await this.fetchProjectTasks(workflowState.projectId);
      const projectPlans = await this.fetchProjectPlans(workflowState.projectId);

      // Analyze project context
      const analysisResults = await this.analyzeProjectContext({
        projectData,
        existingTasks,
        projectPlans,
        userIntent: workflowState.projectContext.userIntent
      });

      // Update workflow state
      workflowState.updateStage('analysis_complete', {
        analysisResults,
        projectData: {
          id: projectData.id,
          name: projectData.name,
          description: projectData.description,
          status: projectData.status
        }
      });

      await this.stateManager.saveWorkflowState(workflowState);

      this.emit('progress', new ProgressEvent('project_analysis', 50, 'Project analysis complete'));

      // Move to task generation
      await this.processTaskGeneration(workflowId);

    } catch (error) {
      await this.handleWorkflowError(workflowId, error, 'project_analysis');
    }
  }

  /**
   * Process task generation stage
   */
  async processTaskGeneration(workflowId) {
    const workflowState = await this.stateManager.loadWorkflowState(workflowId);

    try {
      this.emit('progress', new ProgressEvent('task_generation', 60, 'Generating task proposals'));

      const analysisResults = workflowState.metadata.analysisResults;

      // Generate task proposals using Context7-informed logic
      const taskProposals = await this.generateTaskProposals(analysisResults);

      // Calculate confidence score
      const confidence = this.calculateProposalConfidence(taskProposals, analysisResults);

      // Update workflow state
      workflowState.proposedTasks = taskProposals;
      workflowState.updateStage('tasks_proposed', { confidence });

      await this.stateManager.saveWorkflowState(workflowState);

      this.emit('tasks_proposed', new TasksProposedEvent(taskProposals, confidence, analysisResults.reasoningChain));

      // Check if approval is required
      if (confidence < this.context7QualityThreshold) {
        await this.requestUserApproval(workflowId);
      } else {
        // Auto-approve high confidence proposals
        await this.processApproval(workflowId, { approved: true, autoApproved: true });
      }

    } catch (error) {
      await this.handleWorkflowError(workflowId, error, 'task_generation');
    }
  }

  /**
   * Request user approval for task proposals
   */
  async requestUserApproval(workflowId) {
    const workflowState = await this.stateManager.loadWorkflowState(workflowId);

    const approvalRequest = {
      workflowId,
      proposedTasks: workflowState.proposedTasks,
      reason: 'Confidence below threshold - human review required',
      timeout: this.approvalTimeout
    };

    workflowState.pendingApprovals.push(approvalRequest);
    workflowState.updateStage('awaiting_approval');

    await this.stateManager.saveWorkflowState(workflowState);

    this.emit('approval_required', new ApprovalRequiredEvent(
      workflowState.proposedTasks,
      'Confidence below threshold - human review required',
      this.approvalTimeout
    ));

    // Set timeout for approval
    setTimeout(async () => {
      const currentState = await this.stateManager.loadWorkflowState(workflowId);
      if (currentState && currentState.currentStage === 'awaiting_approval') {
        await this.handleApprovalTimeout(workflowId);
      }
    }, this.approvalTimeout);
  }

  /**
   * Process user approval response
   */
  async processApproval(workflowId, approvalData) {
    const workflowState = await this.stateManager.loadWorkflowState(workflowId);

    try {
      if (approvalData.approved) {
        // Apply any modifications
        let finalTasks = workflowState.proposedTasks;
        if (approvalData.modifications) {
          finalTasks = this.applyTaskModifications(finalTasks, approvalData.modifications);
        }

        workflowState.approvedTasks = finalTasks;
        workflowState.pendingApprovals = [];
        workflowState.updateStage('approved', {
          feedback: approvalData.feedback,
          autoApproved: approvalData.autoApproved
        });

        await this.stateManager.saveWorkflowState(workflowState);

        this.emit('progress', new ProgressEvent('task_creation', 80, 'Creating approved tasks'));

        // Proceed to task creation
        await this.createApprovedTasks(workflowId);

      } else {
        // Handle rejection
        workflowState.updateStage('rejected', {
          feedback: approvalData.feedback
        });

        await this.stateManager.saveWorkflowState(workflowState);

        this.emit('approval_rejected', { workflowId, feedback: approvalData.feedback });

        // Could implement re-generation logic here based on feedback
      }

    } catch (error) {
      await this.handleWorkflowError(workflowId, error, 'approval_processing');
    }
  }

  /**
   * Create approved tasks in the database
   */
  async createApprovedTasks(workflowId) {
    const workflowState = await this.stateManager.loadWorkflowState(workflowId);

    try {
      const createdTasks = [];

      for (const taskProposal of workflowState.approvedTasks) {
        const createdTask = await this.createTaskInDatabase({
          projectId: workflowState.projectId,
          name: taskProposal.title,
          description: taskProposal.description,
          priority: taskProposal.priority || 'medium',
          dependencies: taskProposal.dependencies || [],
          estimatedHours: taskProposal.estimatedHours,
          tags: taskProposal.tags || []
        });

        createdTasks.push(createdTask);
      }

      // Create execution plan
      const executionPlan = this.generateExecutionPlan(createdTasks);

      workflowState.updateStage('completed', {
        createdTaskIds: createdTasks.map(t => t.id),
        executionPlan
      });

      await this.stateManager.markWorkflowCompleted(workflowId, {
        createdTasks: createdTasks.length,
        executionPlan
      });

      this.activeWorkflows.delete(workflowId);

      this.emit('tasks_created', new TasksCreatedEvent(createdTasks, executionPlan, []));
      this.emit('progress', new ProgressEvent('completed', 100, `Successfully created ${createdTasks.length} tasks`));

    } catch (error) {
      await this.handleWorkflowError(workflowId, error, 'task_creation');
    }
  }

  /**
   * Handle workflow errors
   */
  async handleWorkflowError(workflowId, error, stage) {
    try {
      await this.stateManager.markWorkflowFailed(workflowId, error.message, {
        stage,
        canRetry: true,
        timestamp: new Date().toISOString()
      });

      this.activeWorkflows.delete(workflowId);

      this.emit('automation_failed', new AutomationFailedEvent(error, { workflowId, stage }, { canRetry: true }));

    } catch (stateError) {
      console.error('Failed to update workflow state:', stateError);
    }
  }

  /**
   * Handle approval timeout
   */
  async handleApprovalTimeout(workflowId) {
    const error = new Error('Approval timeout exceeded');
    await this.handleWorkflowError(workflowId, error, 'approval_timeout');
  }

  // Helper methods for database operations
  async fetchProjectData(projectId) {
    return new Promise((resolve, reject) => {
      const db = this.stateManager.db;
      db.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async fetchProjectTasks(projectId) {
    return new Promise((resolve, reject) => {
      const db = this.stateManager.db;
      db.all('SELECT * FROM tasks WHERE project_id = ?', [projectId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async fetchProjectPlans(projectId) {
    return new Promise((resolve, reject) => {
      const db = this.stateManager.db;
      db.all('SELECT * FROM plans WHERE project_id = ?', [projectId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async createTaskInDatabase(taskData) {
    return new Promise((resolve, reject) => {
      const db = this.stateManager.db;
      const sql = `
        INSERT INTO tasks (project_id, name, description, status, created_at, updated_at)
        VALUES (?, ?, ?, 'pending', datetime('now'), datetime('now'))
      `;

      db.run(sql, [taskData.projectId, taskData.name, taskData.description], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            ...taskData,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
        }
      });
    });
  }

  // Intelligent analysis methods (placeholder implementations)
  async analyzeProjectContext(context) {
    // This would integrate with Context7 for intelligent analysis
    return {
      gaps: [],
      recommendations: [],
      priorityAreas: [],
      reasoningChain: ['analyzed_existing_tasks', 'identified_gaps', 'generated_recommendations']
    };
  }

  async generateTaskProposals(analysisResults) {
    // This would use Context7 patterns for intelligent task generation
    return [
      {
        title: 'Example Generated Task',
        description: 'Automatically generated based on project analysis',
        priority: 'medium',
        estimatedHours: 4,
        dependencies: [],
        tags: ['auto-generated']
      }
    ];
  }

  calculateProposalConfidence(proposals, analysisResults) {
    // Implement confidence calculation logic
    // Factors: context quality, existing patterns, user intent clarity
    return 0.8; // Placeholder
  }

  applyTaskModifications(tasks, modifications) {
    // Apply user modifications to task proposals
    return tasks.map(task => ({ ...task, ...modifications[task.id] || {} }));
  }

  generateExecutionPlan(tasks) {
    // Generate optimized execution plan based on dependencies and priorities
    return {
      phases: [
        {
          name: 'Foundation',
          tasks: tasks.filter(t => !t.dependencies || t.dependencies.length === 0)
        }
      ],
      estimatedDuration: tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
    };
  }

  async shutdown() {
    // Save all active workflows
    for (const [workflowId, workflow] of this.activeWorkflows) {
      await this.stateManager.saveWorkflowState(workflow);
    }

    await this.stateManager.close();
    this.removeAllListeners();
  }
}

module.exports = { TaskAutomationEngine };