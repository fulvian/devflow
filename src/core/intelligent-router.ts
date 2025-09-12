/**
 * DevFlow Phase 2 Intelligent Routing System
 * Cost-optimized platform selection for AI tasks
 */

// Types and Interfaces
export interface TaskComplexity {
  cognitiveLoad: number; // 1-10 scale
  dataVolume: number;    // 1-10 scale
  processingTime: number; // estimated seconds
  modelRequirements: string[]; // required model capabilities
}

export interface PlatformSpecs {
  id: string;
  name: string;
  costPerToken: number;
  maxTokens: number;
  capabilities: string[];
  performance: number; // 1-10 scale
}

export interface CostConstraint {
  maxCostPerTask: number;
  dailyBudget: number;
  currentSpent: number;
}

export interface RoutingDecision {
  selectedPlatform: string;
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  fallbackOptions: string[];
}

export interface BudgetTracker {
  totalSpent: number;
  dailyLimit: number;
  remainingBudget: number;
  costBreakdown: Record<string, number>;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  costEfficiency: number;
  userSatisfaction: number;
}

/**
 * Intelligent Router for cost-optimized platform selection
 */
export class IntelligentRouter {
  private platforms: Map<string, PlatformSpecs> = new Map();
  private budgetTracker: BudgetTracker;
  private performanceHistory: Map<string, PerformanceMetrics> = new Map();

  constructor() {
    this.budgetTracker = {
      totalSpent: 0,
      dailyLimit: 100,
      remainingBudget: 100,
      costBreakdown: {}
    };
    this.initializePlatforms();
  }

  private initializePlatforms(): void {
    // Initialize default platforms
    this.platforms.set('openai', {
      id: 'openai',
      name: 'OpenAI GPT-4',
      costPerToken: 0.00003,
      maxTokens: 8192,
      capabilities: ['coding', 'analysis', 'reasoning'],
      performance: 9
    });

    this.platforms.set('gemini', {
      id: 'gemini',
      name: 'Google Gemini',
      costPerToken: 0.000015,
      maxTokens: 32768,
      capabilities: ['coding', 'analysis', 'multimodal'],
      performance: 8
    });

    this.platforms.set('ccr', {
      id: 'ccr',
      name: 'Claude Code Router',
      costPerToken: 0,
      maxTokens: 100000,
      capabilities: ['coding', 'analysis', 'reasoning'],
      performance: 7
    });
  }

  /**
   * Route task to optimal platform
   */
  async routeTask(task: {
    query: string;
    context?: any;
    complexity: 'low' | 'medium' | 'high';
    priority: 'normal' | 'urgent';
  }): Promise<RoutingDecision> {
    // Analyze task complexity
    const taskComplexity = this.analyzeComplexity(task);
    
    // Get cost constraints
    const costConstraint: CostConstraint = {
      maxCostPerTask: task.priority === 'urgent' ? 1.0 : 0.5,
      dailyBudget: this.budgetTracker.dailyLimit,
      currentSpent: this.budgetTracker.totalSpent
    };

    // Find best platform
    const decision = this.selectOptimalPlatform(taskComplexity, costConstraint);
    
    // Update budget tracking
    this.updateBudgetTracking(decision.selectedPlatform, decision.estimatedCost);
    
    return decision;
  }

  private analyzeComplexity(task: any): TaskComplexity {
    const queryLength = task.query.length;
    const hasContext = task.context !== undefined;
    
    let cognitiveLoad: number;
    switch (task.complexity) {
      case 'low': cognitiveLoad = 3; break;
      case 'medium': cognitiveLoad = 6; break;
      case 'high': cognitiveLoad = 9; break;
      default: cognitiveLoad = 6;
    }

    return {
      cognitiveLoad,
      dataVolume: Math.min(10, Math.ceil(queryLength / 100)),
      processingTime: cognitiveLoad * 10,
      modelRequirements: hasContext ? ['reasoning', 'context'] : ['basic']
    };
  }

  private selectOptimalPlatform(
    complexity: TaskComplexity,
    constraint: CostConstraint
  ): RoutingDecision {
    const candidates: Array<{platform: PlatformSpecs; score: number; cost: number}> = [];
    
    for (const platform of this.platforms.values()) {
      const estimatedTokens = complexity.cognitiveLoad * 200;
      const estimatedCost = estimatedTokens * platform.costPerToken;
      
      // Skip if over budget
      if (estimatedCost > constraint.maxCostPerTask) {
        continue;
      }
      
      // Calculate selection score
      const performanceScore = platform.performance / 10;
      const costScore = constraint.maxCostPerTask > 0 ? 
        (constraint.maxCostPerTask - estimatedCost) / constraint.maxCostPerTask : 1;
      const capabilityScore = this.calculateCapabilityMatch(platform, complexity);
      
      const totalScore = (performanceScore * 0.4) + (costScore * 0.4) + (capabilityScore * 0.2);
      
      candidates.push({
        platform,
        score: totalScore,
        cost: estimatedCost
      });
    }
    
    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    
    if (candidates.length === 0) {
      // Fallback to CCR (free)
      return {
        selectedPlatform: 'ccr',
        confidence: 0.5,
        reasoning: 'Fallback to CCR due to budget constraints',
        estimatedCost: 0,
        fallbackOptions: []
      };
    }
    
    const selected = candidates[0];
    return {
      selectedPlatform: selected.platform.id,
      confidence: selected.score,
      reasoning: `Selected ${selected.platform.name} based on performance and cost optimization`,
      estimatedCost: selected.cost,
      fallbackOptions: candidates.slice(1, 3).map(c => c.platform.id)
    };
  }

  private calculateCapabilityMatch(platform: PlatformSpecs, complexity: TaskComplexity): number {
    const requiredCapabilities = complexity.modelRequirements;
    const availableCapabilities = platform.capabilities;
    
    const matches = requiredCapabilities.filter(req => 
      availableCapabilities.some(cap => cap.includes(req))
    ).length;
    
    return requiredCapabilities.length > 0 ? matches / requiredCapabilities.length : 1;
  }

  private updateBudgetTracking(platformId: string, cost: number): void {
    this.budgetTracker.totalSpent += cost;
    this.budgetTracker.remainingBudget = this.budgetTracker.dailyLimit - this.budgetTracker.totalSpent;
    
    if (!this.budgetTracker.costBreakdown[platformId]) {
      this.budgetTracker.costBreakdown[platformId] = 0;
    }
    this.budgetTracker.costBreakdown[platformId] += cost;
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(): BudgetTracker {
    return { ...this.budgetTracker };
  }

  /**
   * Reset daily budget
   */
  resetDailyBudget(): void {
    this.budgetTracker.totalSpent = 0;
    this.budgetTracker.remainingBudget = this.budgetTracker.dailyLimit;
    this.budgetTracker.costBreakdown = {};
  }

  /**
   * Add or update platform
   */
  registerPlatform(specs: PlatformSpecs): void {
    this.platforms.set(specs.id, specs);
  }

  /**
   * Get available platforms
   */
  getAvailablePlatforms(): PlatformSpecs[] {
    return Array.from(this.platforms.values());
  }
}