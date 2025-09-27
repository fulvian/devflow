/**
 * DevFlow Automatic Task Creation - Event Definitions
 * Based on Context7 patterns from TaskFlow MCP and Workflows Python
 *
 * Implements event-driven task automation with approval workflows
 */

class DevFlowEvent {
  constructor(data = {}) {
    this.id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date().toISOString();
    this.data = data;
  }
}

// Start Events - Trigger automation
class ProjectAnalysisEvent extends DevFlowEvent {
  constructor(projectId, analysisType = 'full') {
    super({ projectId, analysisType });
    this.type = 'project_analysis';
  }
}

class TaskGenerationRequiredEvent extends DevFlowEvent {
  constructor(projectContext, userIntent, priorityLevel = 'medium') {
    super({ projectContext, userIntent, priorityLevel });
    this.type = 'task_generation_required';
  }
}

// Processing Events - Internal workflow
class TasksProposedEvent extends DevFlowEvent {
  constructor(proposedTasks, confidence, reasoningChain) {
    super({ proposedTasks, confidence, reasoningChain });
    this.type = 'tasks_proposed';
    this.requiresApproval = confidence < 0.8;
  }
}

class DependencyAnalysisEvent extends DevFlowEvent {
  constructor(taskId, dependencies, conflicts) {
    super({ taskId, dependencies, conflicts });
    this.type = 'dependency_analysis';
  }
}

class PriorityCalculationEvent extends DevFlowEvent {
  constructor(taskId, factors, calculatedPriority) {
    super({ taskId, factors, calculatedPriority });
    this.type = 'priority_calculation';
  }
}

// Approval Events - Human interaction required
class ApprovalRequiredEvent extends DevFlowEvent {
  constructor(taskProposal, reasonForApproval, timeoutMs = 300000) { // 5 min default
    super({ taskProposal, reasonForApproval, timeoutMs });
    this.type = 'approval_required';
    this.awaitingResponse = true;
  }
}

class UserApprovalEvent extends DevFlowEvent {
  constructor(approved, modifications = null, feedback = null) {
    super({ approved, modifications, feedback });
    this.type = 'user_approval';
  }
}

// Completion Events - Final states
class TasksCreatedEvent extends DevFlowEvent {
  constructor(createdTasks, executionPlan, nextSteps) {
    super({ createdTasks, executionPlan, nextSteps });
    this.type = 'tasks_created';
  }
}

class AutomationFailedEvent extends DevFlowEvent {
  constructor(error, context, recoveryOptions) {
    super({ error, context, recoveryOptions });
    this.type = 'automation_failed';
  }
}

// Progress Events - Status updates
class ProgressEvent extends DevFlowEvent {
  constructor(stage, progress, message) {
    super({ stage, progress, message });
    this.type = 'progress';
  }
}

module.exports = {
  DevFlowEvent,
  ProjectAnalysisEvent,
  TaskGenerationRequiredEvent,
  TasksProposedEvent,
  DependencyAnalysisEvent,
  PriorityCalculationEvent,
  ApprovalRequiredEvent,
  UserApprovalEvent,
  TasksCreatedEvent,
  AutomationFailedEvent,
  ProgressEvent
};