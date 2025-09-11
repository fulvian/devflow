/**
 * DevFlow Advanced Multi-Agent Orchestration System
 * Intelligent Batching Orchestrator - Phase 1.5 Implementation
 * 
 * API optimization through intelligent batching and resource management
 */

export interface BatchingStrategy {
  fileBatching: {
    maxFilesPerBatch: number;
    maxTokensPerBatch: number;
    contextSharing: boolean;
  };
  apiTiming: {
    dailyAllocation: number;
    priorityQueuing: PriorityQueue<Task>;
    emergencyReserve: number;
  };
  coordination: {
    sharedContext: boolean;
    sequentialDependencies: TaskGraph;
    parallelizableOperations: Task[];
  };
}

export interface Task {
  id: string;
  type: string;
  agentType: 'code' | 'reasoning' | 'context' | 'auto';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'emergency';
  estimatedTokens: number;
  dependencies: string[];
  context: any;
  requirements: string[];
  deadline?: Date;
  createdAt: Date;
}

export interface PriorityQueue<T> {
  items: Array<{ item: T; priority: number; timestamp: Date }>;
  enqueue: (item: T, priority: number) => void;
  dequeue: () => T | undefined;
  peek: () => T | undefined;
  size: () => number;
  clear: () => void;
}

export interface TaskGraph {
  nodes: Map<string, Task>;
  edges: Map<string, Set<string>>; // taskId -> dependent task IDs
  
  addTask: (task: Task) => void;
  addDependency: (fromTask: string, toTask: string) => void;
  getExecutionOrder: () => string[][];
  canExecuteInParallel: (taskIds: string[]) => boolean;
}

export interface BatchExecutionPlan {
  id: string;
  batches: TaskBatch[];
  estimatedDuration: number;
  estimatedTokens: number;
  parallelizable: boolean;
  contextSharing: ContextSharingPlan;
  apiUsageProjection: {
    totalCalls: number;
    peakUsage: number;
    timeDistribution: { hour: number; calls: number }[];
  };
}

export interface TaskBatch {
  id: string;
  tasks: Task[];
  agentType: string;
  estimatedTokens: number;
  sharedContext?: any;
  executionStrategy: 'sequential' | 'parallel' | 'hybrid';
  priority: number;
  scheduledTime?: Date;
}

export interface ContextSharingPlan {
  sharedContexts: Map<string, any>;
  contextReuse: Map<string, string[]>; // context ID -> task IDs
  compressionStrategy: 'none' | 'light' | 'aggressive';
  estimatedSavings: {
    tokenReduction: number;
    callReduction: number;
  };
}

export interface APIUsageMetrics {
  currentUsage: {
    calls: number;
    tokens: number;
    resetTime: Date;
  };
  limits: {
    callsPerHour: number;
    callsPerDay: number;
    tokensPerCall: number;
  };
  projections: {
    nextHourUsage: number;
    dailyProjection: number;
    availableCapacity: number;
  };
}

export interface OptimizationResult {
  originalPlan: {
    totalCalls: number;
    totalTokens: number;
    estimatedDuration: number;
  };
  optimizedPlan: {
    totalCalls: number;
    totalTokens: number;
    estimatedDuration: number;
  };
  improvements: {
    callReduction: number;
    tokenReduction: number;
    timeReduction: number;
    costReduction: number;
  };
  strategies: string[];
}

export interface ThrottlingStrategy {
  mode: 'disabled' | 'gentle' | 'aggressive' | 'emergency';
  parameters: {
    maxConcurrentCalls: number;
    delayBetweenCalls: number;
    backoffMultiplier: number;
    priorityThreshold: number;
  };
  triggers: {
    apiUsageThreshold: number;
    errorRateThreshold: number;
    responseTimeThreshold: number;
  };
}

/**
 * Intelligent Batching Orchestrator for API optimization
 */
export class BatchingOrchestrator {
  private taskQueue: PriorityQueue<Task>;
  private taskGraph: TaskGraph;
  private apiMetrics: APIUsageMetrics;
  private throttlingStrategy: ThrottlingStrategy;
  private executionHistory: Map<string, BatchExecutionPlan> = new Map();
  
  // Configuration
  private config = {
    maxBatchSize: 5,
    maxTokensPerBatch: 8000,
    emergencyReservePercent: 0.1,
    contextReuseThreshold: 0.7,
    optimizationInterval: 60000, // 1 minute
    dailyApiLimit: 135, // Synthetic.new limit
  };
  
  // Statistics
  private stats = {
    totalBatches: 0,
    optimizedBatches: 0,
    tokensSaved: 0,
    callsSaved: 0,
    averageBatchSize: 0,
    contextReuseRate: 0,
  };

  constructor() {
    this.initializePriorityQueue();
    this.initializeTaskGraph();
    this.initializeAPIMetrics();
    this.initializeThrottlingStrategy();
    this.startOptimizationLoop();
  }

  /**
   * Add task to the orchestration queue
   */
  public async addTask(task: Task): Promise<void> {
    // Add to graph
    this.taskGraph.addTask(task);
    
    // Add dependencies if specified
    for (const depId of task.dependencies) {
      this.taskGraph.addDependency(depId, task.id);
    }
    
    // Calculate priority score
    const priorityScore = this.calculatePriorityScore(task);
    
    // Add to queue
    this.taskQueue.enqueue(task, priorityScore);
  }

  /**
   * Create optimal execution plan with batching
   */
  public async createExecutionPlan(tasks?: Task[]): Promise<BatchExecutionPlan> {
    const targetTasks = tasks || this.getAllQueuedTasks();
    
    if (targetTasks.length === 0) {
      return this.createEmptyPlan();
    }

    // Analyze task relationships and dependencies
    const executionOrder = this.taskGraph.getExecutionOrder();
    
    // Create batches based on optimization strategies
    const batches = await this.optimizeBatching(targetTasks, executionOrder);
    
    // Plan context sharing
    const contextSharing = await this.planContextSharing(batches);
    
    // Calculate API usage projection
    const apiUsageProjection = this.calculateAPIUsageProjection(batches);
    
    // Create execution plan
    const plan: BatchExecutionPlan = {
      id: this.generatePlanId(),
      batches,
      estimatedDuration: this.calculateEstimatedDuration(batches),
      estimatedTokens: batches.reduce((sum, b) => sum + b.estimatedTokens, 0),
      parallelizable: this.checkParallelizability(batches),
      contextSharing,
      apiUsageProjection
    };

    return plan;
  }

  /**
   * Execute batched tasks with optimization
   */
  public async executePlan(plan: BatchExecutionPlan): Promise<{
    results: Map<string, any>;
    actualMetrics: {
      duration: number;
      tokensUsed: number;
      callsMade: number;
    };
    optimizationEffectiveness: OptimizationResult;
  }> {
    const startTime = Date.now();
    const results = new Map<string, any>();
    let totalTokensUsed = 0;
    let totalCallsMade = 0;

    // Execute batches according to plan
    for (const batch of plan.batches) {
      const batchResult = await this.executeBatch(batch, plan.contextSharing);
      
      // Collect results
      for (const [taskId, result] of batchResult.results) {
        results.set(taskId, result);
      }
      
      totalTokensUsed += batchResult.tokensUsed;
      totalCallsMade += batchResult.callsMade;
      
      // Apply throttling if needed
      await this.applyThrottling();
    }

    const actualDuration = Date.now() - startTime;
    
    // Calculate optimization effectiveness
    const optimizationEffectiveness = this.calculateOptimizationEffectiveness(
      plan, 
      { duration: actualDuration, tokensUsed: totalTokensUsed, callsMade: totalCallsMade }
    );

    // Update statistics
    this.updateStatistics(plan, optimizationEffectiveness);
    
    // Store execution history
    this.executionHistory.set(plan.id, plan);

    return {
      results,
      actualMetrics: {
        duration: actualDuration,
        tokensUsed: totalTokensUsed,
        callsMade: totalCallsMade
      },
      optimizationEffectiveness
    };
  }

  /**
   * Smart queuing with priority-based scheduling
   */
  public async scheduleTask(task: Task): Promise<{
    position: number;
    estimatedWaitTime: number;
    canExecuteImmediately: boolean;
  }> {
    const priorityScore = this.calculatePriorityScore(task);
    
    // Check if can execute immediately
    const canExecuteImmediately = await this.checkImmediateExecution(task);
    
    if (canExecuteImmediately) {
      return {
        position: 0,
        estimatedWaitTime: 0,
        canExecuteImmediately: true
      };
    }

    // Add to queue and calculate position
    await this.addTask(task);
    const position = this.calculateQueuePosition(task);
    const estimatedWaitTime = this.estimateWaitTime(position);

    return {
      position,
      estimatedWaitTime,
      canExecuteImmediately: false
    };
  }

  /**
   * Context-aware batching for related operations
   */
  public async contextAwareBatching(tasks: Task[]): Promise<TaskBatch[]> {
    // Group tasks by context similarity
    const contextGroups = this.groupByContextSimilarity(tasks);
    
    const batches: TaskBatch[] = [];
    
    for (const [contextKey, groupedTasks] of contextGroups) {
      // Create batches within context groups
      const contextBatches = await this.createContextBatches(groupedTasks, contextKey);
      batches.push(...contextBatches);
    }
    
    return this.optimizeBatchOrder(batches);
  }

  /**
   * Predictive throttling based on usage patterns
   */
  public async adjustThrottling(): Promise<ThrottlingStrategy> {
    const currentUsage = this.apiMetrics.currentUsage;
    const projections = this.apiMetrics.projections;
    
    let mode: ThrottlingStrategy['mode'] = 'disabled';
    
    // Determine throttling mode based on usage
    if (projections.dailyProjection > this.config.dailyApiLimit * 0.9) {
      mode = 'aggressive';
    } else if (projections.nextHourUsage > this.apiMetrics.limits.callsPerHour * 0.8) {
      mode = 'gentle';
    } else if (currentUsage.calls > this.config.dailyApiLimit * (1 - this.config.emergencyReservePercent)) {
      mode = 'emergency';
    }
    
    // Update throttling strategy
    this.throttlingStrategy.mode = mode;
    
    // Adjust parameters based on mode
    this.updateThrottlingParameters(mode);
    
    return { ...this.throttlingStrategy };
  }

  /**
   * Emergency escalation for critical tasks
   */
  public async emergencyEscalation(task: Task): Promise<{
    escalated: boolean;
    bypassedQueue: boolean;
    estimatedDelay: number;
    alternativeOptions: string[];
  }> {
    const isEmergency = task.priority === 'emergency' || task.priority === 'critical';
    
    if (!isEmergency) {
      return {
        escalated: false,
        bypassedQueue: false,
        estimatedDelay: 0,
        alternativeOptions: ['Increase task priority', 'Wait for normal processing']
      };
    }

    // Check emergency reserve capacity
    const reserveCapacity = this.calculateEmergencyReserve();
    
    if (reserveCapacity.available > task.estimatedTokens) {
      // Execute immediately using emergency reserve
      await this.executeEmergencyTask(task);
      
      return {
        escalated: true,
        bypassedQueue: true,
        estimatedDelay: 0,
        alternativeOptions: []
      };
    } else {
      // Find alternative execution strategies
      const alternatives = await this.findAlternativeStrategies(task);
      
      return {
        escalated: true,
        bypassedQueue: false,
        estimatedDelay: this.estimateEmergencyDelay(task),
        alternativeOptions: alternatives
      };
    }
  }

  /**
   * Get real-time orchestration statistics
   */
  public getStatistics(): typeof this.stats & {
    queueSize: number;
    apiUsage: APIUsageMetrics;
    throttlingStatus: ThrottlingStrategy;
    recentOptimizations: OptimizationResult[];
  } {
    const recentOptimizations = Array.from(this.executionHistory.values())
      .slice(-10)
      .map(plan => this.calculateOptimizationEffectiveness(plan, plan as any));

    return {
      ...this.stats,
      queueSize: this.taskQueue.size(),
      apiUsage: { ...this.apiMetrics },
      throttlingStatus: { ...this.throttlingStrategy },
      recentOptimizations
    };
  }

  // Private implementation methods

  private initializePriorityQueue(): void {
    this.taskQueue = {
      items: [],
      enqueue: (item: Task, priority: number) => {
        this.taskQueue.items.push({ item, priority, timestamp: new Date() });
        this.taskQueue.items.sort((a, b) => b.priority - a.priority);
      },
      dequeue: () => {
        const item = this.taskQueue.items.shift();
        return item?.item;
      },
      peek: () => {
        return this.taskQueue.items[0]?.item;
      },
      size: () => {
        return this.taskQueue.items.length;
      },
      clear: () => {
        this.taskQueue.items = [];
      }
    };
  }

  private initializeTaskGraph(): void {
    this.taskGraph = {
      nodes: new Map(),
      edges: new Map(),
      
      addTask: (task: Task) => {
        this.taskGraph.nodes.set(task.id, task);
        if (!this.taskGraph.edges.has(task.id)) {
          this.taskGraph.edges.set(task.id, new Set());
        }
      },
      
      addDependency: (fromTask: string, toTask: string) => {
        if (!this.taskGraph.edges.has(fromTask)) {
          this.taskGraph.edges.set(fromTask, new Set());
        }
        this.taskGraph.edges.get(fromTask)!.add(toTask);
      },
      
      getExecutionOrder: () => {
        return this.topologicalSort();
      },
      
      canExecuteInParallel: (taskIds: string[]) => {
        return this.checkParallelExecutability(taskIds);
      }
    };
  }

  private initializeAPIMetrics(): void {
    this.apiMetrics = {
      currentUsage: {
        calls: 0,
        tokens: 0,
        resetTime: new Date()
      },
      limits: {
        callsPerHour: 27, // 135/5 = 27 calls per hour average
        callsPerDay: 135,
        tokensPerCall: 8000
      },
      projections: {
        nextHourUsage: 0,
        dailyProjection: 0,
        availableCapacity: 135
      }
    };
  }

  private initializeThrottlingStrategy(): void {
    this.throttlingStrategy = {
      mode: 'disabled',
      parameters: {
        maxConcurrentCalls: 3,
        delayBetweenCalls: 1000,
        backoffMultiplier: 1.5,
        priorityThreshold: 0.8
      },
      triggers: {
        apiUsageThreshold: 0.8,
        errorRateThreshold: 0.1,
        responseTimeThreshold: 30000
      }
    };
  }

  private startOptimizationLoop(): void {
    setInterval(async () => {
      try {
        await this.runOptimizationCycle();
      } catch (error) {
        console.error('Optimization cycle failed:', error);
      }
    }, this.config.optimizationInterval);
  }

  private async runOptimizationCycle(): Promise<void> {
    // Update API usage metrics
    await this.updateAPIMetrics();
    
    // Adjust throttling strategy
    await this.adjustThrottling();
    
    // Optimize pending batches
    await this.optimizePendingBatches();
    
    // Clean up old execution history
    this.cleanupExecutionHistory();
  }

  private calculatePriorityScore(task: Task): number {
    const priorityScores = {
      emergency: 1000,
      critical: 800,
      high: 600,
      medium: 400,
      low: 200
    };
    
    let score = priorityScores[task.priority];
    
    // Adjust for deadline urgency
    if (task.deadline) {
      const timeToDeadline = task.deadline.getTime() - Date.now();
      const urgencyMultiplier = Math.max(0.5, Math.min(2.0, 86400000 / timeToDeadline)); // 24 hours baseline
      score *= urgencyMultiplier;
    }
    
    // Adjust for task age (prevent starvation)
    const age = Date.now() - task.createdAt.getTime();
    const agingBonus = Math.min(200, age / 3600000); // Max 200 points after 1 hour
    score += agingBonus;
    
    return score;
  }

  private getAllQueuedTasks(): Task[] {
    return this.taskQueue.items.map(item => item.item);
  }

  private createEmptyPlan(): BatchExecutionPlan {
    return {
      id: this.generatePlanId(),
      batches: [],
      estimatedDuration: 0,
      estimatedTokens: 0,
      parallelizable: true,
      contextSharing: {
        sharedContexts: new Map(),
        contextReuse: new Map(),
        compressionStrategy: 'none',
        estimatedSavings: { tokenReduction: 0, callReduction: 0 }
      },
      apiUsageProjection: {
        totalCalls: 0,
        peakUsage: 0,
        timeDistribution: []
      }
    };
  }

  private async optimizeBatching(tasks: Task[], executionOrder: string[][]): Promise<TaskBatch[]> {
    const batches: TaskBatch[] = [];
    
    for (const parallelGroup of executionOrder) {
      const groupTasks = parallelGroup.map(id => 
        tasks.find(t => t.id === id)
      ).filter(Boolean) as Task[];
      
      // Group by agent type for batching
      const agentGroups = this.groupByAgentType(groupTasks);
      
      for (const [agentType, agentTasks] of agentGroups) {
        const agentBatches = await this.createAgentBatches(agentTasks, agentType);
        batches.push(...agentBatches);
      }
    }
    
    return batches;
  }

  private async planContextSharing(batches: TaskBatch[]): Promise<ContextSharingPlan> {
    const sharedContexts = new Map<string, any>();
    const contextReuse = new Map<string, string[]>();
    
    // Analyze context similarity across batches
    for (let i = 0; i < batches.length; i++) {
      const batch1 = batches[i];
      
      for (let j = i + 1; j < batches.length; j++) {
        const batch2 = batches[j];
        
        const similarity = this.calculateContextSimilarity(
          batch1.tasks[0]?.context,
          batch2.tasks[0]?.context
        );
        
        if (similarity > this.config.contextReuseThreshold) {
          const sharedContextId = `shared-${i}-${j}`;
          const mergedContext = this.mergeContexts(
            batch1.tasks[0]?.context,
            batch2.tasks[0]?.context
          );
          
          sharedContexts.set(sharedContextId, mergedContext);
          contextReuse.set(sharedContextId, [
            ...batch1.tasks.map(t => t.id),
            ...batch2.tasks.map(t => t.id)
          ]);
        }
      }
    }
    
    // Calculate estimated savings
    const estimatedSavings = this.calculateContextSavings(sharedContexts, contextReuse);
    
    return {
      sharedContexts,
      contextReuse,
      compressionStrategy: 'light',
      estimatedSavings
    };
  }

  private calculateAPIUsageProjection(batches: TaskBatch[]): {
    totalCalls: number;
    peakUsage: number;
    timeDistribution: { hour: number; calls: number }[];
  } {
    const totalCalls = batches.length;
    const peakUsage = Math.max(...batches.map(b => b.tasks.length));
    
    // Distribute calls across time
    const timeDistribution = [];
    const hoursInDay = 24;
    const callsPerHour = Math.ceil(totalCalls / hoursInDay);
    
    for (let hour = 0; hour < hoursInDay; hour++) {
      timeDistribution.push({
        hour,
        calls: Math.min(callsPerHour, totalCalls - (hour * callsPerHour))
      });
    }
    
    return { totalCalls, peakUsage, timeDistribution };
  }

  private calculateEstimatedDuration(batches: TaskBatch[]): number {
    // Estimate based on batch sizes and processing times
    let totalDuration = 0;
    
    for (const batch of batches) {
      const baseDuration = batch.tasks.length * 15000; // 15s per task baseline
      const tokenAdjustment = (batch.estimatedTokens / 1000) * 1000; // 1s per 1000 tokens
      
      totalDuration += baseDuration + tokenAdjustment;
    }
    
    return totalDuration;
  }

  private checkParallelizability(batches: TaskBatch[]): boolean {
    // Check if batches can be executed in parallel
    for (const batch of batches) {
      for (const task of batch.tasks) {
        if (task.dependencies.length > 0) {
          return false;
        }
      }
    }
    
    return true;
  }

  private async executeBatch(
    batch: TaskBatch,
    contextSharing: ContextSharingPlan
  ): Promise<{
    results: Map<string, any>;
    tokensUsed: number;
    callsMade: number;
  }> {
    const results = new Map<string, any>();
    let tokensUsed = 0;
    let callsMade = 0;
    
    // Simulate batch execution
    for (const task of batch.tasks) {
      // Simulate API call
      const result = await this.simulateAgentCall(task, batch.sharedContext);
      results.set(task.id, result);
      
      tokensUsed += task.estimatedTokens;
      callsMade++;
      
      // Update API metrics
      this.apiMetrics.currentUsage.calls++;
      this.apiMetrics.currentUsage.tokens += task.estimatedTokens;
    }
    
    return { results, tokensUsed, callsMade };
  }

  private async simulateAgentCall(task: Task, sharedContext?: any): Promise<any> {
    // Simulate processing delay
    const processingTime = Math.random() * 5000 + 2000; // 2-7 seconds
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    return {
      taskId: task.id,
      result: `Processed ${task.type} task`,
      tokensUsed: task.estimatedTokens,
      processingTime,
      success: Math.random() > 0.05 // 95% success rate
    };
  }

  private async applyThrottling(): Promise<void> {
    if (this.throttlingStrategy.mode === 'disabled') return;
    
    const delay = this.throttlingStrategy.parameters.delayBetweenCalls;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private calculateOptimizationEffectiveness(
    plan: BatchExecutionPlan,
    actualMetrics: { duration: number; tokensUsed: number; callsMade: number }
  ): OptimizationResult {
    // Calculate what would have happened without optimization
    const originalCalls = plan.batches.reduce((sum, b) => sum + b.tasks.length, 0);
    const originalTokens = plan.estimatedTokens;
    const originalDuration = originalCalls * 15000; // 15s per individual call
    
    return {
      originalPlan: {
        totalCalls: originalCalls,
        totalTokens: originalTokens,
        estimatedDuration: originalDuration
      },
      optimizedPlan: {
        totalCalls: actualMetrics.callsMade,
        totalTokens: actualMetrics.tokensUsed,
        estimatedDuration: actualMetrics.duration
      },
      improvements: {
        callReduction: originalCalls - actualMetrics.callsMade,
        tokenReduction: originalTokens - actualMetrics.tokensUsed,
        timeReduction: originalDuration - actualMetrics.duration,
        costReduction: (originalCalls - actualMetrics.callsMade) * 0.1 // Estimated cost per call
      },
      strategies: ['batching', 'context-sharing', 'priority-optimization']
    };
  }

  private updateStatistics(plan: BatchExecutionPlan, optimization: OptimizationResult): void {
    this.stats.totalBatches++;
    this.stats.optimizedBatches++;
    this.stats.tokensSaved += optimization.improvements.tokenReduction;
    this.stats.callsSaved += optimization.improvements.callReduction;
    
    // Update average batch size
    const totalTasks = plan.batches.reduce((sum, b) => sum + b.tasks.length, 0);
    this.stats.averageBatchSize = 
      (this.stats.averageBatchSize * (this.stats.totalBatches - 1) + totalTasks) / this.stats.totalBatches;
    
    // Update context reuse rate
    const contextReuseCount = plan.contextSharing.contextReuse.size;
    const totalContexts = plan.batches.length;
    if (totalContexts > 0) {
      this.stats.contextReuseRate = contextReuseCount / totalContexts;
    }
  }

  // Additional helper methods (simplified implementations)

  private topologicalSort(): string[][] {
    // Simplified topological sort returning parallel groups
    const result: string[][] = [];
    const visited = new Set<string>();
    
    // For now, return all tasks as parallelizable
    const allTasks = Array.from(this.taskGraph.nodes.keys());
    if (allTasks.length > 0) {
      result.push(allTasks);
    }
    
    return result;
  }

  private checkParallelExecutability(taskIds: string[]): boolean {
    // Check if tasks can be executed in parallel
    for (const taskId of taskIds) {
      const dependencies = this.taskGraph.edges.get(taskId);
      if (dependencies && dependencies.size > 0) {
        return false;
      }
    }
    return true;
  }

  private groupByAgentType(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    
    for (const task of tasks) {
      if (!groups.has(task.agentType)) {
        groups.set(task.agentType, []);
      }
      groups.get(task.agentType)!.push(task);
    }
    
    return groups;
  }

  private async createAgentBatches(tasks: Task[], agentType: string): Promise<TaskBatch[]> {
    const batches: TaskBatch[] = [];
    
    // Create batches respecting size limits
    for (let i = 0; i < tasks.length; i += this.config.maxBatchSize) {
      const batchTasks = tasks.slice(i, i + this.config.maxBatchSize);
      const estimatedTokens = batchTasks.reduce((sum, t) => sum + t.estimatedTokens, 0);
      
      batches.push({
        id: `batch-${agentType}-${Date.now()}-${i}`,
        tasks: batchTasks,
        agentType,
        estimatedTokens,
        executionStrategy: 'parallel',
        priority: Math.max(...batchTasks.map(t => this.calculatePriorityScore(t)))
      });
    }
    
    return batches;
  }

  private groupByContextSimilarity(tasks: Task[]): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();
    
    for (const task of tasks) {
      // Simple context grouping based on task type
      const contextKey = `${task.type}-${task.agentType}`;
      
      if (!groups.has(contextKey)) {
        groups.set(contextKey, []);
      }
      groups.get(contextKey)!.push(task);
    }
    
    return groups;
  }

  private async createContextBatches(tasks: Task[], contextKey: string): Promise<TaskBatch[]> {
    return this.createAgentBatches(tasks, tasks[0]?.agentType || 'auto');
  }

  private optimizeBatchOrder(batches: TaskBatch[]): TaskBatch[] {
    // Sort batches by priority
    return batches.sort((a, b) => b.priority - a.priority);
  }

  private calculateContextSimilarity(context1: any, context2: any): number {
    if (!context1 || !context2) return 0;
    
    // Simple similarity based on common keys
    const keys1 = Object.keys(context1);
    const keys2 = Object.keys(context2);
    const commonKeys = keys1.filter(key => keys2.includes(key));
    
    return commonKeys.length / Math.max(keys1.length, keys2.length);
  }

  private mergeContexts(context1: any, context2: any): any {
    return { ...context1, ...context2 };
  }

  private calculateContextSavings(
    sharedContexts: Map<string, any>,
    contextReuse: Map<string, string[]>
  ): { tokenReduction: number; callReduction: number } {
    let tokenReduction = 0;
    let callReduction = 0;
    
    for (const [contextId, taskIds] of contextReuse) {
      const sharedContext = sharedContexts.get(contextId);
      if (sharedContext && taskIds.length > 1) {
        const contextSize = JSON.stringify(sharedContext).length / 4; // Rough token estimate
        tokenReduction += contextSize * (taskIds.length - 1); // Save by reusing context
      }
    }
    
    return { tokenReduction, callReduction };
  }

  private async checkImmediateExecution(task: Task): Promise<boolean> {
    // Check API capacity
    const hasCapacity = this.apiMetrics.currentUsage.calls < this.apiMetrics.limits.callsPerHour;
    
    // Check if high priority
    const isHighPriority = task.priority === 'critical' || task.priority === 'emergency';
    
    // Check no dependencies
    const noDependencies = task.dependencies.length === 0;
    
    return hasCapacity && (isHighPriority || noDependencies);
  }

  private calculateQueuePosition(task: Task): number {
    const priorityScore = this.calculatePriorityScore(task);
    
    return this.taskQueue.items.filter(item => 
      item.priority > priorityScore
    ).length + 1;
  }

  private estimateWaitTime(position: number): number {
    // Estimate based on average processing time
    const averageTaskTime = 15000; // 15 seconds
    const averageBatchSize = this.stats.averageBatchSize || 3;
    
    const batchesAhead = Math.ceil(position / averageBatchSize);
    return batchesAhead * averageTaskTime;
  }

  private updateThrottlingParameters(mode: ThrottlingStrategy['mode']): void {
    switch (mode) {
      case 'gentle':
        this.throttlingStrategy.parameters.maxConcurrentCalls = 2;
        this.throttlingStrategy.parameters.delayBetweenCalls = 2000;
        break;
      case 'aggressive':
        this.throttlingStrategy.parameters.maxConcurrentCalls = 1;
        this.throttlingStrategy.parameters.delayBetweenCalls = 5000;
        break;
      case 'emergency':
        this.throttlingStrategy.parameters.maxConcurrentCalls = 1;
        this.throttlingStrategy.parameters.delayBetweenCalls = 10000;
        break;
      default:
        this.throttlingStrategy.parameters.maxConcurrentCalls = 3;
        this.throttlingStrategy.parameters.delayBetweenCalls = 1000;
    }
  }

  private calculateEmergencyReserve(): { available: number; total: number } {
    const total = this.config.dailyApiLimit * this.config.emergencyReservePercent;
    const used = this.apiMetrics.currentUsage.calls;
    
    return {
      total,
      available: Math.max(0, total - used)
    };
  }

  private async executeEmergencyTask(task: Task): Promise<void> {
    // Execute task immediately bypassing normal queue
    const result = await this.simulateAgentCall(task);
    
    // Update metrics
    this.apiMetrics.currentUsage.calls++;
    this.apiMetrics.currentUsage.tokens += task.estimatedTokens;
  }

  private estimateEmergencyDelay(task: Task): number {
    // Estimate delay for emergency task execution
    return this.estimateWaitTime(1); // High priority position
  }

  private async findAlternativeStrategies(task: Task): Promise<string[]> {
    const alternatives: string[] = [];
    
    // Check if task can be split
    if (task.estimatedTokens > this.config.maxTokensPerBatch) {
      alternatives.push('Split task into smaller subtasks');
    }
    
    // Check if different agent type can handle it
    if (task.agentType !== 'auto') {
      alternatives.push('Use auto agent for flexible processing');
    }
    
    // Check if task can be deferred
    if (!task.deadline || task.deadline.getTime() > Date.now() + 3600000) {
      alternatives.push('Defer to off-peak hours');
    }
    
    return alternatives;
  }

  private async updateAPIMetrics(): Promise<void> {
    // Update projections based on current usage
    const hoursRemaining = 24 - new Date().getHours();
    this.apiMetrics.projections.dailyProjection = 
      this.apiMetrics.currentUsage.calls + (this.apiMetrics.currentUsage.calls / (24 - hoursRemaining)) * hoursRemaining;
    
    this.apiMetrics.projections.availableCapacity = 
      this.config.dailyApiLimit - this.apiMetrics.currentUsage.calls;
  }

  private async optimizePendingBatches(): Promise<void> {
    // Optimize any pending batches in the queue
    if (this.taskQueue.size() > 5) {
      const tasks = this.getAllQueuedTasks();
      const optimizedPlan = await this.createExecutionPlan(tasks);
      
      // Replace queue with optimized batches
      this.taskQueue.clear();
      
      for (const batch of optimizedPlan.batches) {
        for (const task of batch.tasks) {
          const priority = this.calculatePriorityScore(task);
          this.taskQueue.enqueue(task, priority);
        }
      }
    }
  }

  private cleanupExecutionHistory(): void {
    // Keep only recent execution history
    const maxHistoryAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoffTime = Date.now() - maxHistoryAge;
    
    for (const [planId, plan] of this.executionHistory) {
      const planTime = parseInt(planId.split('-')[1]) || 0;
      if (planTime < cutoffTime) {
        this.executionHistory.delete(planId);
      }
    }
  }

  private generatePlanId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default BatchingOrchestrator;