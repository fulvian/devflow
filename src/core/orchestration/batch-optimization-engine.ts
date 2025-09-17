import { AgentHealthMonitor } from './fallback/agent-health-monitor';

interface BatchTask {
  id: string;
  prompt: string;
  agent: string;
  priority: number;
  context?: any;
}

interface BatchResult {
  taskId: string;
  result: any;
  executionTime: number;
  cost: number;
  success: boolean;
  error?: string;
}

interface AgentLoad {
  agentName: string;
  currentLoad: number; // 0-100
  maxCapacity: number;
  avgResponseTime: number;
}

interface CostCalculation {
  baseCost: number;
  agentCost: number;
  processingCost: number;
  total: number;
}

class BatchOptimizationEngine {
  private healthMonitor: AgentHealthMonitor;
  private agentLoadMap: Map<string, AgentLoad> = new Map();
  private rateLimiters: Map<string, { tokens: number; lastRefill: number }> = new Map();

  constructor() {
    this.healthMonitor = new AgentHealthMonitor();
  }

  calculateBatchCost(tasks: BatchTask[]): CostCalculation {
    const baseCost = tasks.length * 0.01; // Base cost per task
    let agentCost = 0;
    let processingCost = 0;
    
    // Calculate agent-specific costs
    for (const task of tasks) {
      const agentLoad = this.agentLoadMap.get(task.agent);
      
      // Agent cost based on load
      const loadFactor = agentLoad ? agentLoad.currentLoad / 100 : 0.5;
      agentCost += 0.02 * (1 + loadFactor);
      
      // Processing cost based on prompt length
      processingCost += task.prompt.length * 0.0001;
    }
    
    const total = baseCost + agentCost + processingCost;
    
    return {
      baseCost,
      agentCost,
      processingCost,
      total
    };
  }

  async executeBatch(tasks: BatchTask[]): Promise<BatchResult[]> {
    // Check agent health before batch execution
    const healthStatus = await this.healthMonitor.checkAllAgents();
    if (!healthStatus.allHealthy) {
      throw new Error('One or more agents are not healthy for batch execution');
    }
    
    // Update agent load information
    await this.updateAgentLoad();
    
    // Apply rate limiting
    this.enforceRateLimits(tasks);
    
    // Execute tasks with optimized batching
    const results: BatchResult[] = [];
    const optimizedTasks = this.optimizeBatchOrder(tasks);
    
    // Process tasks in parallel with concurrency control
    const concurrencyLimit = this.determineOptimalConcurrency();
    for (let i = 0; i < optimizedTasks.length; i += concurrencyLimit) {
      const batch = optimizedTasks.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(task => this.executeTask(task));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  private async executeTask(task: BatchTask): Promise<BatchResult> {
    const startTime = Date.now();
    
    try {
      // Real MCP tool execution based on agent type
      let endpoint = '';
      switch (task.agent) {
        case 'claude-tech-lead':
          endpoint = 'mcp://claude-tech-lead/analyze';
          break;
        case 'codex-senior-dev':
          endpoint = 'mcp://codex-senior-dev/implement';
          break;
        case 'gemini-doc-manager':
          endpoint = 'mcp://gemini-doc-manager/generate';
          break;
        case 'qwen-qa-specialist':
          endpoint = 'mcp://qwen-qa-specialist/validate';
          break;
        default:
          throw new Error(`Unknown agent: ${task.agent}`);
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: task.prompt,
          context: task.context,
          timeout: 30000
        }),
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`Agent ${task.agent} returned error: ${response.status}`);
      }
      
      const data = await response.json();
      const executionTime = Date.now() - startTime;
      
      // Update agent load
      this.updateAgentMetrics(task.agent, executionTime);
      
      return {
        taskId: task.id,
        result: data,
        executionTime,
        cost: this.calculateTaskCost(task, executionTime),
        success: true
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        taskId: task.id,
        result: null,
        executionTime,
        cost: this.calculateTaskCost(task, executionTime),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async updateAgentLoad(): Promise<void> {
    const healthStatus = await this.healthMonitor.checkAllAgents();
    
    for (const agent of healthStatus.agents) {
      const currentLoad = this.agentLoadMap.get(agent.name);
      
      // Estimate load based on response time
      const loadEstimate = Math.min(100, (agent.responseTime / 1000) * 20);
      
      this.agentLoadMap.set(agent.name, {
        agentName: agent.name,
        currentLoad: loadEstimate,
        maxCapacity: 100,
        avgResponseTime: agent.responseTime
      });
      
      // Initialize rate limiter if not exists
      if (!this.rateLimiters.has(agent.name)) {
        this.rateLimiters.set(agent.name, { tokens: 10, lastRefill: Date.now() });
      }
    }
  }

  private enforceRateLimits(tasks: BatchTask[]): void {
    const now = Date.now();
    
    for (const task of tasks) {
      const limiter = this.rateLimiters.get(task.agent);
      if (!limiter) continue;
      
      // Refill tokens (10 tokens per minute)
      const timePassed = now - limiter.lastRefill;
      const tokensToAdd = Math.floor(timePassed / 6000);
      limiter.tokens = Math.min(10, limiter.tokens + tokensToAdd);
      limiter.lastRefill = now;
      
      // Consume token
      if (limiter.tokens > 0) {
        limiter.tokens -= 1;
      } else {
        throw new Error(`Rate limit exceeded for agent: ${task.agent}`);
      }
    }
  }

  private optimizeBatchOrder(tasks: BatchTask[]): BatchTask[] {
    // Sort tasks by priority and agent load
    return [...tasks].sort((a, b) => {
      // Higher priority first
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      
      // Lower load agents first
      const aLoad = this.agentLoadMap.get(a.agent)?.currentLoad || 50;
      const bLoad = this.agentLoadMap.get(b.agent)?.currentLoad || 50;
      
      return aLoad - bLoad;
    });
  }

  private determineOptimalConcurrency(): number {
    // Determine concurrency based on agent health and load
    let totalCapacity = 0;
    let healthyAgents = 0;
    
    for (const [_, load] of this.agentLoadMap) {
      if (load.currentLoad < 80) { // Only use agents with <80% load
        totalCapacity += Math.max(1, Math.floor((100 - load.currentLoad) / 20));
        healthyAgents++;
      }
    }
    
    // Return between 1 and 10 concurrent tasks
    return Math.max(1, Math.min(10, Math.floor(totalCapacity / Math.max(1, healthyAgents))));
  }

  private updateAgentMetrics(agentName: string, executionTime: number): void {
    const load = this.agentLoadMap.get(agentName);
    if (load) {
      // Update average response time
      load.avgResponseTime = (load.avgResponseTime + executionTime) / 2;
      // Update load estimate
      load.currentLoad = Math.min(100, (load.avgResponseTime / 1000) * 20);
    }
  }

  private calculateTaskCost(task: BatchTask, executionTime: number): number {
    const baseCost = 0.01;
    const agentLoad = this.agentLoadMap.get(task.agent);
    const loadFactor = agentLoad ? agentLoad.currentLoad / 100 : 0.5;
    const timeCost = executionTime * 0.00001;
    
    return baseCost + (0.02 * loadFactor) + timeCost;
  }

  async processBatchResults(results: BatchResult[]): Promise<{ successful: number; failed: number; totalCost: number }> {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    
    return {
      successful,
      failed,
      totalCost
    };
  }
}

export default BatchOptimizationEngine;
export { type BatchTask, type BatchResult, type AgentLoad, type CostCalculation };
