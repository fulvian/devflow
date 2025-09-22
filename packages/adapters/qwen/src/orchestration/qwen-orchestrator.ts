import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import pRetry from 'p-retry';
import { QwenAuthManager } from '../auth/qwen-auth-manager.js';
import { QwenWorker } from './qwen-worker.js';
import { QwenLoadBalancer } from './qwen-load-balancer.js';
import { QwenHealthMonitor } from './qwen-health-monitor.js';

export interface QwenTask {
  id?: string;
  type: string;
  prompt: string;
  provider?: string;
  model?: string;
  language?: string;
  framework?: string;
  complexity?: string;
  code?: string;
  analysisType?: string;
  priority: 'low' | 'normal' | 'high';
  sandbox?: boolean;
  timeout?: number;
}

export interface QwenTaskResult {
  id: string;
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  provider: string;
  model: string;
}

/**
 * Qwen Orchestrator
 * Manages worker pool, load balancing, and task execution for Qwen Code CLI
 */
export class QwenOrchestrator extends EventEmitter {
  private workers: Map<string, QwenWorker> = new Map();
  private queues: Map<string, PQueue> = new Map();
  private loadBalancer: QwenLoadBalancer;
  private healthMonitor: QwenHealthMonitor;
  private authManager: QwenAuthManager;
  private isInitialized = false;

  constructor(authManager: QwenAuthManager) {
    super();
    this.authManager = authManager;
    this.loadBalancer = new QwenLoadBalancer();
    this.healthMonitor = new QwenHealthMonitor();
    
    // Setup priority queues
    this.queues.set('high', new PQueue({ concurrency: 3, interval: 1000, intervalCap: 10 }));
    this.queues.set('normal', new PQueue({ concurrency: 2, interval: 1000, intervalCap: 5 }));
    this.queues.set('low', new PQueue({ concurrency: 1, interval: 2000, intervalCap: 3 }));
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[Qwen Orchestrator] Initializing...');

    // Initialize workers for each provider
    const providers = ['dashscope', 'modelscope', 'openrouter'];
    
    for (const provider of providers) {
      try {
        const worker = new QwenWorker(provider, this.authManager);
        await worker.initialize();
        this.workers.set(provider, worker);
        console.log(`[Qwen Orchestrator] Worker initialized for provider: ${provider}`);
      } catch (error) {
        console.warn(`[Qwen Orchestrator] Failed to initialize worker for ${provider}:`, error);
      }
    }

    // Start health monitoring
    this.healthMonitor.on('worker-unhealthy', (provider: string) => {
      console.warn(`[Qwen Orchestrator] Worker ${provider} marked as unhealthy`);
      this.loadBalancer.markProviderUnhealthy(provider);
    });

    this.healthMonitor.on('worker-healthy', (provider: string) => {
      console.log(`[Qwen Orchestrator] Worker ${provider} restored to healthy`);
      this.loadBalancer.markProviderHealthy(provider);
    });

    await this.healthMonitor.start([...this.workers.keys()]);
    this.isInitialized = true;
    
    console.log('[Qwen Orchestrator] Initialized successfully');
  }

  /**
   * Execute a single task
   */
  async executeTask(task: QwenTask): Promise<QwenTaskResult> {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized');
    }

    const taskId = task.id || this.generateTaskId();
    const priority = task.priority || 'normal';
    
    // Get the appropriate queue
    const queue = this.queues.get(priority);
    if (!queue) {
      throw new Error(`Invalid priority: ${priority}`);
    }

    console.log(`[Qwen Orchestrator] Queuing task ${taskId} with priority ${priority}`);

    return queue.add(() => this.executeTaskInternal({
      ...task,
      id: taskId,
    }), {
      priority: this.getPriorityWeight(priority),
    });
  }

  /**
   * Execute multiple tasks in batch
   */
  async executeBatch(tasks: QwenTask[], maxConcurrent: number = 3): Promise<QwenTaskResult[]> {
    console.log(`[Qwen Orchestrator] Executing batch of ${tasks.length} tasks`);

    const batchQueue = new PQueue({ concurrency: maxConcurrent });
    
    const promises = tasks.map(task => 
      batchQueue.add(() => this.executeTask(task))
    );

    return Promise.all(promises);
  }

  /**
   * Internal task execution with load balancing and retry logic
   */
  private async executeTaskInternal(task: QwenTask): Promise<QwenTaskResult> {
    const startTime = Date.now();
    
    return pRetry(async () => {
      // Select best provider
      let provider = task.provider;
      if (!provider || provider === 'auto') {
        provider = await this.loadBalancer.selectProvider(task, [...this.workers.keys()]);
      }

      const worker = this.workers.get(provider);
      if (!worker) {
        throw new Error(`No worker available for provider: ${provider}`);
      }

      console.log(`[Qwen Orchestrator] Executing task ${task.id} on provider ${provider}`);

      try {
        const result = await worker.executeTask(task);
        
        // Report success to load balancer
        this.loadBalancer.reportSuccess(provider, Date.now() - startTime);
        
        return {
          id: task.id!,
          success: true,
          output: result.output,
          executionTime: Date.now() - startTime,
          provider: result.provider,
          model: result.model,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Report failure to load balancer
        this.loadBalancer.reportFailure(provider, errorMessage);
        
        throw new Error(`Task execution failed on ${provider}: ${errorMessage}`);
      }
    }, {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 5000,
      onFailedAttempt: (error) => {
        console.warn(`[Qwen Orchestrator] Task ${task.id} attempt failed:`, error.message);
      },
    });
  }

  /**
   * Get worker status
   */
  getWorkerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [provider, worker] of this.workers) {
      status[provider] = {
        healthy: this.healthMonitor.isProviderHealthy(provider),
        lastUsed: this.loadBalancer.getProviderStats(provider).lastUsed,
        successRate: this.loadBalancer.getProviderStats(provider).successRate,
        avgResponseTime: this.loadBalancer.getProviderStats(provider).avgResponseTime,
      };
    }
    
    return status;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [priority, queue] of this.queues) {
      status[priority] = {
        size: queue.size,
        pending: queue.pending,
        isPaused: queue.isPaused,
      };
    }
    
    return status;
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    console.log('[Qwen Orchestrator] Shutting down...');
    
    // Stop health monitoring
    await this.healthMonitor.stop();
    
    // Clear all queues
    for (const queue of this.queues.values()) {
      queue.clear();
    }
    
    // Shutdown all workers
    for (const worker of this.workers.values()) {
      await worker.shutdown();
    }
    
    this.workers.clear();
    this.isInitialized = false;
    
    console.log('[Qwen Orchestrator] Shutdown complete');
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `qwen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get priority weight for queue ordering
   */
  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'high': return 10;
      case 'normal': return 5;
      case 'low': return 1;
      default: return 5;
    }
  }
}