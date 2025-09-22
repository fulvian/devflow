/**
 * Codex Orchestrator - Advanced function calling orchestration system
 * Manages task routing, Claude-Codex handoff, and conversation context
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Types and interfaces
export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

export interface Task {
  id: string;
  priority: number;
  functionCall: FunctionCall;
  context: ConversationContext;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  assignedTo?: 'claude' | 'codex';
}

export interface ConversationContext {
  conversationId: string;
  history: Array<{
    role: 'user' | 'assistant' | 'system' | 'function';
    content: string;
    name?: string;
  }>;
  metadata: Record<string, any>;
}

export interface PerformanceMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageResponseTime: number;
  activeTasks: number;
}

export interface OrchestratorConfig {
  maxRetries?: number;
  defaultPriority?: number;
  codexHandoffThreshold?: number;
  maxConcurrentTasks?: number;
}

export interface FunctionRegistry {
  [key: string]: (args: Record<string, any>) => Promise<any>;
}

// Events
export type OrchestratorEvents = {
  'task-created': (task: Task) => void;
  'task-assigned': (task: Task, agent: 'claude' | 'codex') => void;
  'task-completed': (task: Task, result: any) => void;
  'task-failed': (task: Task, error: Error) => void;
  'handoff-initiated': (task: Task) => void;
  'metrics-updated': (metrics: PerformanceMetrics) => void;
};

// Main orchestrator class
export class CodexOrchestrator extends EventEmitter {
  private taskQueue: Task[] = [];
  private activeTasks: Map<string, Task> = new Map();
  private functionRegistry: FunctionRegistry = {};
  private metrics: PerformanceMetrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageResponseTime: 0,
    activeTasks: 0
  };
  private config: Required<OrchestratorConfig>;
  private responseTimes: number[] = [];

  constructor(config: OrchestratorConfig = {}) {
    super();

    this.config = {
      maxRetries: config.maxRetries ?? 3,
      defaultPriority: config.defaultPriority ?? 5,
      codexHandoffThreshold: config.codexHandoffThreshold ?? 2,
      maxConcurrentTasks: config.maxConcurrentTasks ?? 10
    };
  }

  /**
   * Register a function that can be called by the orchestrator
   */
  public registerFunction(name: string, implementation: (args: Record<string, any>) => Promise<any>): void {
    this.functionRegistry[name] = implementation;
  }

  /**
   * Submit a new task for orchestration
   */
  public async submitTask(
    functionCall: FunctionCall,
    context: ConversationContext,
    priority?: number
  ): Promise<string> {
    const task: Task = {
      id: uuidv4(),
      priority: priority ?? this.config.defaultPriority,
      functionCall,
      context,
      retries: 0,
      maxRetries: this.config.maxRetries,
      createdAt: new Date()
    };

    this.taskQueue.push(task);
    this.sortTaskQueue();
    this.metrics.totalTasks++;
    this.emit('task-created', task);

    // Process the task queue
    setImmediate(() => this.processQueue());

    return task.id;
  }

  /**
   * Process the task queue based on priority and concurrency limits
   */
  private async processQueue(): Promise<void> {
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    if (this.taskQueue.length === 0) {
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    this.activeTasks.set(task.id, task);
    this.metrics.activeTasks = this.activeTasks.size;
    this.emit('metrics-updated', this.metrics);

    // Determine which agent should handle the task
    const agent = this.determineAgent(task);
    task.assignedTo = agent;
    this.emit('task-assigned', task, agent);

    try {
      let result: any;
      const startTime = Date.now();

      if (agent === 'codex') {
        result = await this.executeWithCodex(task);
      } else {
        result = await this.executeWithClaude(task);
      }

      const responseTime = Date.now() - startTime;
      this.responseTimes.push(responseTime);
      this.updateAverageResponseTime();

      this.completeTask(task, result);
    } catch (error) {
      this.handleTaskError(task, error as Error);
    }
  }

  /**
   * Determine which agent (Claude or Codex) should handle the task
   */
  private determineAgent(task: Task): 'claude' | 'codex' {
    // Simple heuristic: if task has been retried beyond threshold, handoff to Codex
    if (task.retries >= this.config.codexHandoffThreshold) {
      this.emit('handoff-initiated', task);
      return 'codex';
    }

    // Check if function is registered locally (Codex can handle it)
    if (this.functionRegistry[task.functionCall.name]) {
      return 'codex';
    }

    // Default to Claude for unregistered functions
    return 'claude';
  }

  /**
   * Execute task with Codex (local function execution)
   */
  private async executeWithCodex(task: Task): Promise<any> {
    const func = this.functionRegistry[task.functionCall.name];
    if (!func) {
      throw new Error(`Function ${task.functionCall.name} not registered with Codex`);
    }

    return await func(task.functionCall.arguments);
  }

  /**
   * Execute task with Claude (external processing)
   */
  private async executeWithClaude(task: Task): Promise<any> {
    // In a real implementation, this would call Claude's API
    // For this example, we simulate external processing
    return new Promise((resolve, reject) => {
      // Simulate network delay
      setTimeout(() => {
        // Simulate potential failure
        if (Math.random() < 0.1) { // 10% failure rate
          reject(new Error('Claude processing failed'));
        } else {
          resolve({
            result: `Claude processed ${task.functionCall.name}`,
            taskId: task.id
          });
        }
      }, 100 + Math.random() * 400);
    });
  }

  /**
   * Complete a task successfully
   */
  private completeTask(task: Task, result: any): void {
    this.activeTasks.delete(task.id);
    this.metrics.completedTasks++;
    this.metrics.activeTasks = this.activeTasks.size;
    this.emit('task-completed', task, result);
    this.emit('metrics-updated', this.metrics);

    // Process next task
    setImmediate(() => this.processQueue());
  }

  /**
   * Handle task execution error
   */
  private handleTaskError(task: Task, error: Error): void {
    this.activeTasks.delete(task.id);

    if (task.retries < task.maxRetries) {
      // Retry the task
      task.retries++;
      this.taskQueue.push(task);
      this.sortTaskQueue();
      this.emit('task-failed', task, error);
      setImmediate(() => this.processQueue());
    } else {
      // Task failed permanently
      this.metrics.failedTasks++;
      this.metrics.activeTasks = this.activeTasks.size;
      this.emit('task-failed', task, error);
      this.emit('metrics-updated', this.metrics);
      setImmediate(() => this.processQueue());
    }
  }

  /**
   * Sort task queue by priority (higher priority first)
   */
  private sortTaskQueue(): void {
    this.taskQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Update average response time metric
   */
  private updateAverageResponseTime(): void {
    if (this.responseTimes.length === 0) return;

    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    this.metrics.averageResponseTime = sum / this.responseTimes.length;
    this.emit('metrics-updated', this.metrics);
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current queue status
   */
  public getQueueStatus(): {
    pendingTasks: number;
    activeTasks: number;
    taskQueue: Task[];
  } {
    return {
      pendingTasks: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      taskQueue: [...this.taskQueue]
    };
  }

  /**
   * Cancel a task by ID
   */
  public cancelTask(taskId: string): boolean {
    // Check active tasks
    if (this.activeTasks.has(taskId)) {
      this.activeTasks.delete(taskId);
      this.metrics.activeTasks = this.activeTasks.size;
      this.emit('metrics-updated', this.metrics);
      return true;
    }

    // Check pending tasks
    const index = this.taskQueue.findIndex(task => task.id === taskId);
    if (index !== -1) {
      this.taskQueue.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Update conversation context for a task
   */
  public updateContext(taskId: string, context: ConversationContext): boolean {
    const task = this.activeTasks.get(taskId) ||
                 this.taskQueue.find(t => t.id === taskId);

    if (task) {
      task.context = context;
      return true;
    }

    return false;
  }
}

export default CodexOrchestrator;