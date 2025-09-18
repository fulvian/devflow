// src/core/orchestration/intelligent-synthetic-batching.ts
// Intelligent Synthetic Batching System for Dream Team Orchestrator

import { v4 as uuidv4 } from 'uuid';

// Interfaces
export interface Task {
  id: string;
  context: string;
  priority: number;
  agentId?: string;
  createdAt: Date;
  deadline?: Date;
}

export interface Batch {
  id: string;
  tasks: Task[];
  size: number;
  contextEmbedding: number[];
  createdAt: Date;
  scheduledAt?: Date;
}

export interface Agent {
  id: string;
  capabilities: string[];
  performanceScore: number;
  costPerCall: number;
  availability: number;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  nextAttempt: Date | null;
  isOpen: boolean;
}

export interface Metrics {
  totalTasks: number;
  totalBatches: number;
  avgBatchSize: number;
  avgProcessingTime: number;
  failureRate: number;
  rateLimitUtilization: number;
}

export interface BatchingConfig {
  maxBatchSize: number;
  minBatchSize: number;
  maxWaitTime: number; // in milliseconds
  rateLimit: {
    calls: number;
    period: number; // in milliseconds
  };
  circuitBreaker: {
    failureThreshold: number;
    timeout: number; // in milliseconds
  };
  similarityThreshold: number;
}

// Circuit Breaker
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private failureThreshold: number;
  private timeout: number;

  constructor(config: { failureThreshold: number; timeout: number }) {
    this.failureThreshold = config.failureThreshold;
    this.timeout = config.timeout;
    this.state = {
      failures: 0,
      lastFailure: null,
      nextAttempt: null,
      isOpen: false
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state.isOpen) {
      if (this.state.nextAttempt && new Date() < this.state.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      // Half-open state - try once
      try {
        const result = await operation();
        this.reset();
        return result;
      } catch (error) {
        this.trip();
        throw error;
      }
    }

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.state.failures++;
    this.state.lastFailure = new Date();

    if (this.state.failures >= this.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.state.isOpen = true;
    this.state.nextAttempt = new Date(Date.now() + this.timeout);
  }

  private reset(): void {
    this.state = {
      failures: 0,
      lastFailure: null,
      nextAttempt: null,
      isOpen: false
    };
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}

// Rate Limiter
export class RateLimiter {
  private calls: number[];
  private maxCalls: number;
  private period: number;

  constructor(config: { calls: number; period: number }) {
    this.calls = [];
    this.maxCalls = config.calls;
    this.period = config.period;
  }

  canMakeCall(): boolean {
    const now = Date.now();
    // Remove calls outside the time window
    this.calls = this.calls.filter(callTime => now - callTime < this.period);
    return this.calls.length < this.maxCalls;
  }

  recordCall(): void {
    this.calls.push(Date.now());
  }

  getUtilization(): number {
    const now = Date.now();
    const recentCalls = this.calls.filter(callTime => now - callTime < this.period);
    return recentCalls.length / this.maxCalls;
  }
}

// Embedding Service
export class EmbeddingService {
  async generateEmbedding(text: string): Promise<number[]> {
    // Simulated embedding generation - in production use real embedding API
    const hash = this.simpleHash(text);
    return Array(128).fill(0).map((_, i) => {
      const val = Math.sin(hash * (i + 1));
      return val > 0 ? val : -val;
    });
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }
}

// Agent Selector
export class AgentSelector {
  private agents: Map<string, Agent>;

  constructor(agents: Agent[]) {
    this.agents = new Map(agents.map(agent => [agent.id, agent]));
  }

  selectAgentForTask(task: Task): Agent | null {
    // Find agents that can handle this task based on capabilities
    const capableAgents = Array.from(this.agents.values()).filter(agent =>
      agent.capabilities.some(cap => task.context.includes(cap)) &&
      agent.availability > 0.5
    );

    if (capableAgents.length === 0) {
      return null;
    }

    // Select agent with best cost-performance ratio
    return capableAgents.reduce((best, current) =>
      (current.performanceScore / current.costPerCall) >
      (best.performanceScore / best.costPerCall) ? current : best
    );
  }

  updateAgentMetrics(agentId: string, metrics: Partial<Agent>): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      Object.assign(agent, metrics);
      this.agents.set(agentId, agent);
    }
  }
}

// Main Batching Orchestrator
export class IntelligentBatchingOrchestrator {
  private pendingTasks: Task[] = [];
  private batches: Batch[] = [];
  private config: BatchingConfig;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;
  private embeddingService: EmbeddingService;
  private agentSelector: AgentSelector;
  private metrics: Metrics;
  private processingTimer: NodeJS.Timeout | null = null;
  private onBatchReady: (batch: Batch) => Promise<void>;

  constructor(
    config: BatchingConfig,
    agents: Agent[],
    onBatchReady: (batch: Batch) => Promise<void>
  ) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.embeddingService = new EmbeddingService();
    this.agentSelector = new AgentSelector(agents);
    this.onBatchReady = onBatchReady;

    this.metrics = {
      totalTasks: 0,
      totalBatches: 0,
      avgBatchSize: 0,
      avgProcessingTime: 0,
      failureRate: 0,
      rateLimitUtilization: 0
    };

    this.startProcessingTimer();
  }

  async addTask(task: Task): Promise<void> {
    try {
      // Assign agent based on task context
      const agent = this.agentSelector.selectAgentForTask(task);
      if (agent) {
        task.agentId = agent.id;
      }

      this.pendingTasks.push(task);
      this.metrics.totalTasks++;

      // Trigger immediate processing if we've reached max batch size
      if (this.pendingTasks.length >= this.config.maxBatchSize) {
        await this.processBatches();
      }
    } catch (error) {
      console.error('Error adding task:', error);
      throw error;
    }
  }

  private async processBatches(): Promise<void> {
    if (this.pendingTasks.length === 0) return;

    try {
      // Group tasks by context similarity
      const groupedTasks = await this.groupTasksBySimilarity(this.pendingTasks);

      // Create batches from grouped tasks
      const newBatches: Batch[] = [];

      for (const group of groupedTasks) {
        // Determine optimal batch size based on rate limiting and agent capacity
        const batchSize = this.calculateOptimalBatchSize(group.length);

        // Split group into batches of optimal size
        for (let i = 0; i < group.length; i += batchSize) {
          const batchTasks = group.slice(i, i + batchSize);

          // Generate context embedding for the batch
          const contextEmbedding = await this.generateBatchEmbedding(batchTasks);

          const batch: Batch = {
            id: uuidv4(),
            tasks: batchTasks,
            size: batchTasks.length,
            contextEmbedding,
            createdAt: new Date()
          };

          newBatches.push(batch);
          this.metrics.totalBatches++;
        }
      }

      // Update metrics
      this.updateMetrics(newBatches);

      // Schedule batches respecting rate limits
      for (const batch of newBatches) {
        if (this.rateLimiter.canMakeCall()) {
          this.rateLimiter.recordCall();
          batch.scheduledAt = new Date();

          try {
            await this.circuitBreaker.execute(() => this.onBatchReady(batch));
          } catch (error) {
            console.error(`Failed to process batch ${batch.id}:`, error);
            this.metrics.failureRate = (this.metrics.failureRate * this.metrics.totalBatches + 1) /
                                     (this.metrics.totalBatches + 1);
          }
        } else {
          // Reschedule for later processing
          setTimeout(() => this.processBatches(), 1000);
          break;
        }
      }

      // Remove processed tasks
      const processedTaskIds = newBatches.flatMap(b => b.tasks.map(t => t.id));
      this.pendingTasks = this.pendingTasks.filter(
        task => !processedTaskIds.includes(task.id)
      );

    } catch (error) {
      console.error('Error processing batches:', error);
      throw error;
    }
  }

  private async groupTasksBySimilarity(tasks: Task[]): Promise<Task[][]> {
    if (tasks.length === 0) return [];

    // Generate embeddings for all tasks
    const embeddings = await Promise.all(
      tasks.map(task => this.embeddingService.generateEmbedding(task.context))
    );

    // Group tasks by similarity
    const groups: Task[][] = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < tasks.length; i++) {
      if (usedIndices.has(i)) continue;

      const group: Task[] = [tasks[i]];
      usedIndices.add(i);

      for (let j = i + 1; j < tasks.length; j++) {
        if (usedIndices.has(j)) continue;

        const similarity = this.embeddingService.calculateSimilarity(
          embeddings[i],
          embeddings[j]
        );

        if (similarity >= this.config.similarityThreshold) {
          group.push(tasks[j]);
          usedIndices.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private calculateOptimalBatchSize(taskCount: number): number {
    // Start with rate limit consideration
    const maxPossibleBatches = Math.floor(
      this.config.rateLimit.calls /
      (this.config.rateLimit.period / (this.config.maxWaitTime || 5000))
    );

    const batchSizeBasedOnRateLimit = Math.max(
      this.config.minBatchSize,
      Math.min(
        this.config.maxBatchSize,
        Math.ceil(taskCount / maxPossibleBatches)
      )
    );

    // Adjust based on current rate limit utilization
    const utilization = this.rateLimiter.getUtilization();
    if (utilization > 0.8) {
      return Math.max(this.config.minBatchSize, Math.floor(batchSizeBasedOnRateLimit * 0.7));
    } else if (utilization < 0.3) {
      return Math.min(this.config.maxBatchSize, Math.ceil(batchSizeBasedOnRateLimit * 1.3));
    }

    return batchSizeBasedOnRateLimit;
  }

  private async generateBatchEmbedding(tasks: Task[]): Promise<number[]> {
    // Combine task contexts for batch embedding
    const combinedContext = tasks.map(t => t.context).join(' ');
    return await this.embeddingService.generateEmbedding(combinedContext);
  }

  private updateMetrics(batches: Batch[]): void {
    const totalBatchSize = batches.reduce((sum, batch) => sum + batch.size, 0);
    const newAvgBatchSize = (this.metrics.avgBatchSize * this.metrics.totalBatches + totalBatchSize) /
                           (this.metrics.totalBatches + batches.length);

    this.metrics.avgBatchSize = newAvgBatchSize;
    this.metrics.rateLimitUtilization = this.rateLimiter.getUtilization();
  }

  private startProcessingTimer(): void {
    this.processingTimer = setInterval(() => {
      this.processBatches().catch(error => {
        console.error('Error in processing timer:', error);
      });
    }, this.config.maxWaitTime);
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  getPendingTaskCount(): number {
    return this.pendingTasks.length;
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  shutdown(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
  }
}

// Default configuration for Dream Team
export const DREAM_TEAM_AGENTS: Agent[] = [
  {
    id: 'claude-tech-lead',
    capabilities: ['architecture', 'planning', 'coordination'],
    performanceScore: 0.95,
    costPerCall: 0.015,
    availability: 1.0
  },
  {
    id: 'codex-senior-dev',
    capabilities: ['implementation', 'coding', 'refactoring'],
    performanceScore: 0.93,
    costPerCall: 0.02,
    availability: 0.8
  },
  {
    id: 'gemini-doc-manager',
    capabilities: ['documentation', 'analysis', 'integration'],
    performanceScore: 0.88,
    costPerCall: 0.005,
    availability: 1.0
  },
  {
    id: 'qwen-qa-specialist',
    capabilities: ['testing', 'qa', 'verification'],
    performanceScore: 0.90,
    costPerCall: 0.003,
    availability: 1.0
  }
];

export const DEFAULT_BATCHING_CONFIG: BatchingConfig = {
  maxBatchSize: 20,
  minBatchSize: 3,
  maxWaitTime: 5000, // 5 seconds
  rateLimit: {
    calls: 135,
    period: 5 * 60 * 60 * 1000 // 5 hours in milliseconds
  },
  circuitBreaker: {
    failureThreshold: 5,
    timeout: 60000 // 1 minute
  },
  similarityThreshold: 0.82
};