/**
 * Claude-Codex Handoff System
 *
 * This system intelligently delegates tasks between Claude and Codex based on:
 * - Task complexity analysis
 * - Model capability matching
 * - Performance metrics
 * - Load balancing
 */

import { CodexAuthManager } from '../auth/codex-auth-manager.js';
import { CodexOrchestrator } from '../orchestration/codex-orchestrator.js';

// Types and interfaces
export enum TaskComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum ModelType {
  CLAUDE = 'claude',
  CODEX = 'codex'
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  successRate: number;
  errorRate: number;
  throughput: number;
}

export interface HandoffContext {
  taskId: string;
  originalModel: ModelType;
  complexity: TaskComplexity;
  timestamp: number;
  context?: any;
  handoffCount?: number;
  handoffReason?: string;
  previousModel?: ModelType;
}

export interface HandoffTask {
  id: string;
  content: string;
  userId: string;
  context?: {
    history?: Array<{
      role: string;
      content: string;
    }>;
    metadata?: Record<string, any>;
  };
}

export class ClaudeCodexHandoffSystem {
  private authManager: CodexAuthManager;
  private orchestrator: CodexOrchestrator;
  private performanceMetrics: Map<ModelType, PerformanceMetrics>;
  private taskHistory: Map<string, HandoffContext>;

  constructor(authManager: CodexAuthManager, orchestrator: CodexOrchestrator) {
    this.authManager = authManager;
    this.orchestrator = orchestrator;
    this.performanceMetrics = new Map([
      [ModelType.CLAUDE, {
        avgResponseTime: 0,
        successRate: 1.0,
        errorRate: 0,
        throughput: 0
      }],
      [ModelType.CODEX, {
        avgResponseTime: 0,
        successRate: 1.0,
        errorRate: 0,
        throughput: 0
      }]
    ]);
    this.taskHistory = new Map();
  }

  /**
   * Analyzes task complexity to determine optimal model assignment
   */
  private analyzeTaskComplexity(task: HandoffTask): TaskComplexity {
    const contentLength = task.content?.length || 0;
    const hasCode = /(?:function|class|const|let|var|import|export)/.test(task.content || '');
    const hasData = /(?:data|json|api|database)/.test(task.content || '');
    const requiresReasoning = /(?:analyze|compare|evaluate|reason|explain)/.test(task.content || '');

    // Simple heuristic-based complexity scoring
    let score = 0;
    if (contentLength > 1000) score += 2;
    if (hasCode) score += 3;
    if (hasData) score += 2;
    if (requiresReasoning) score += 3;
    if (task.context?.history?.length && task.context.history.length > 5) score += 1;

    if (score <= 3) return TaskComplexity.LOW;
    if (score <= 6) return TaskComplexity.MEDIUM;
    return TaskComplexity.HIGH;
  }

  /**
   * Matches task requirements with model capabilities
   */
  private matchModelCapabilities(task: HandoffTask, complexity: TaskComplexity): ModelType {
    // Codex excels at code-related tasks
    const isCodeTask = /(?:code|program|function|debug|refactor)/.test(task.content || '');

    // Claude excels at reasoning and complex tasks
    const isReasoningTask = /(?:analyze|compare|evaluate|reason|explain|summarize)/.test(task.content || '');

    // Load balancing consideration
    const claudeLoad = this.performanceMetrics.get(ModelType.CLAUDE)?.throughput || 0;
    const codexLoad = this.performanceMetrics.get(ModelType.CODEX)?.throughput || 0;

    // Decision logic based on capabilities and load
    if (isCodeTask && complexity !== TaskComplexity.HIGH) {
      return ModelType.CODEX;
    }

    if (isReasoningTask || complexity === TaskComplexity.HIGH) {
      return ModelType.CLAUDE;
    }

    // For medium complexity, choose based on load
    if (complexity === TaskComplexity.MEDIUM) {
      return claudeLoad > codexLoad ? ModelType.CODEX : ModelType.CLAUDE;
    }

    // For low complexity, prefer the less loaded model
    return claudeLoad > codexLoad ? ModelType.CODEX : ModelType.CLAUDE;
  }

  /**
   * Updates performance metrics based on task execution results
   */
  private updatePerformanceMetrics(
    model: ModelType,
    executionTime: number,
    success: boolean
  ): void {
    const metrics = this.performanceMetrics.get(model);
    if (!metrics) return;

    // Update average response time (exponential moving average)
    metrics.avgResponseTime = metrics.avgResponseTime
      ? (metrics.avgResponseTime * 0.9 + executionTime * 0.1)
      : executionTime;

    // Update success/error rates
    if (success) {
      metrics.successRate = (metrics.successRate * 0.95) + (1 * 0.05);
      metrics.errorRate = Math.max(0, metrics.errorRate - 0.05);
    } else {
      metrics.successRate = Math.max(0, metrics.successRate - 0.05);
      metrics.errorRate = (metrics.errorRate * 0.95) + (1 * 0.05);
    }

    // Update throughput (tasks per minute)
    metrics.throughput = metrics.throughput
      ? metrics.throughput * 0.9 + 0.1
      : 0.1;

    this.performanceMetrics.set(model, metrics);
  }

  /**
   * Preserves context for seamless handoff between models
   */
  private preserveContext(taskId: string, context: HandoffContext): void {
    this.taskHistory.set(taskId, context);
  }

  /**
   * Recovers context for task continuation
   */
  private recoverContext(taskId: string): HandoffContext | undefined {
    return this.taskHistory.get(taskId);
  }

  /**
   * Routes task to the appropriate model
   */
  async routeTask(task: HandoffTask): Promise<any> {
    try {
      // Analyze task complexity
      const complexity = this.analyzeTaskComplexity(task);

      // Match with appropriate model
      const recommendedModel = this.matchModelCapabilities(task, complexity);

      // Preserve context for potential handoff
      const context: HandoffContext = {
        taskId: task.id,
        originalModel: recommendedModel,
        complexity,
        timestamp: Date.now(),
        context: task.context
      };

      this.preserveContext(task.id, context);

      // Execute task with the recommended model
      const startTime = Date.now();
      const result = await this.executeWithModel(task, recommendedModel);
      const executionTime = Date.now() - startTime;

      // Update performance metrics
      this.updatePerformanceMetrics(recommendedModel, executionTime, true);

      return result;
    } catch (error) {
      // Handle errors and attempt recovery
      return this.handleTaskError(task, error);
    }
  }

  /**
   * Execute task with specified model
   */
  private async executeWithModel(task: HandoffTask, model: ModelType): Promise<any> {
    if (model === ModelType.CODEX) {
      // Use Codex orchestrator for local execution
      const functionCall = {
        name: 'process_task',
        arguments: { content: task.content, context: task.context }
      };

      const conversationContext = {
        conversationId: task.id,
        history: task.context?.history || [],
        metadata: task.context?.metadata || {}
      };

      const taskId = await this.orchestrator.submitTask(functionCall, conversationContext);

      // Wait for task completion (simplified - in real implementation, would use event listeners)
      return new Promise((resolve, reject) => {
        this.orchestrator.on('task-completed', (completedTask, result) => {
          if (completedTask.id === taskId) {
            resolve(result);
          }
        });

        this.orchestrator.on('task-failed', (failedTask, error) => {
          if (failedTask.id === taskId) {
            reject(error);
          }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          reject(new Error('Task execution timeout'));
        }, 30000);
      });
    } else {
      // Use Claude for external processing (placeholder)
      return {
        result: `Claude processed: ${task.content.substring(0, 100)}...`,
        model: ModelType.CLAUDE,
        taskId: task.id
      };
    }
  }

  /**
   * Handles task errors and attempts recovery through model handoff
   */
  private async handleTaskError(task: HandoffTask, error: any): Promise<any> {
    console.warn(`Task ${task.id} failed with error:`, error);

    // Retrieve preserved context
    const context = this.recoverContext(task.id);
    if (!context) {
      throw new Error('No context available for error recovery');
    }

    // Prevent infinite handoff loops
    if ((context.handoffCount || 0) >= 2) {
      throw new Error('Maximum handoff attempts exceeded');
    }

    // Determine alternative model for handoff
    const alternativeModel = context.originalModel === ModelType.CLAUDE
      ? ModelType.CODEX
      : ModelType.CLAUDE;

    // Check if alternative model has better performance metrics
    const originalMetrics = this.performanceMetrics.get(context.originalModel);
    const alternativeMetrics = this.performanceMetrics.get(alternativeModel);

    // Only attempt handoff if alternative model is likely to succeed
    if (alternativeMetrics &&
        alternativeMetrics.errorRate < (originalMetrics?.errorRate || 1)) {

      try {
        console.log(`Attempting handoff to ${alternativeModel} for task ${task.id}`);

        // Update context for handoff
        const handoffContext: HandoffContext = {
          ...context,
          handoffCount: (context.handoffCount || 0) + 1,
          handoffReason: 'error_recovery',
          previousModel: context.originalModel
        };

        this.preserveContext(task.id, handoffContext);

        // Execute with alternative model
        const startTime = Date.now();
        const result = await this.executeWithModel(task, alternativeModel);
        const executionTime = Date.now() - startTime;

        // Update performance metrics
        this.updatePerformanceMetrics(alternativeModel, executionTime, true);

        return result;
      } catch (handoffError) {
        console.error(`Handoff also failed for task ${task.id}:`, handoffError);
        this.updatePerformanceMetrics(alternativeModel, 0, false);
      }
    }

    // Update performance metrics for original model
    this.updatePerformanceMetrics(context.originalModel, 0, false);

    // If we can't recover, throw the original error
    throw error;
  }

  /**
   * Gets current performance metrics for both models
   */
  getPerformanceMetrics(): Map<ModelType, PerformanceMetrics> {
    return new Map(this.performanceMetrics);
  }

  /**
   * Gets task history for debugging and analysis
   */
  getTaskHistory(): Map<string, HandoffContext> {
    return new Map(this.taskHistory);
  }

  /**
   * Manual handoff trigger for testing or admin purposes
   */
  async forceHandoff(taskId: string, targetModel: ModelType): Promise<any> {
    const context = this.recoverContext(taskId);
    if (!context) {
      throw new Error(`No context found for task ${taskId}`);
    }

    // Create a simplified task from context
    const task: HandoffTask = {
      id: taskId,
      content: 'Forced handoff task',
      userId: 'system',
      context: context.context
    };

    return this.executeWithModel(task, targetModel);
  }

  /**
   * Clean up old task history
   */
  cleanupHistory(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    for (const [taskId, context] of this.taskHistory.entries()) {
      if (context.timestamp < cutoff) {
        this.taskHistory.delete(taskId);
      }
    }
  }
}

export default ClaudeCodexHandoffSystem;