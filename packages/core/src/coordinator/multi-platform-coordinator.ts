import type { 
  PlatformStatus, 
  MultiPlatformConfig,
  PlatformGateway 
} from '@devflow/shared';

// Import TaskRequest and TaskResult from interfaces to avoid conflicts
import type { TaskRequest, TaskResult } from '@devflow/shared';

// Re-export for other modules
export type { TaskRequest, TaskResult };

// Import platform implementations dynamically to avoid circular dependencies
export interface PlatformImplementations {
  synthetic?: PlatformGateway;
  openRouter?: PlatformGateway;
}

export class MultiPlatformCoordinator {
  private readonly platforms: PlatformImplementations;
  private readonly config: MultiPlatformConfig;
  private readonly platformStatus: Map<string, PlatformStatus> = new Map();

  constructor(
    platforms: PlatformImplementations,
    config: MultiPlatformConfig = {}
  ) {
    this.platforms = platforms;
    this.config = {
      fallbackChain: ['synthetic', 'openrouter'],
      ...config
    };

    this.initializePlatformStatus();
  }

  /**
   * Main entry point for task execution with intelligent platform selection
   */
  async executeTask(request: TaskRequest): Promise<TaskResult> {
    const startTime = Date.now();
    
    // Step 1: Analyze task requirements
    const analysis = this.analyzeTask(request);
    
    // Step 2: Select optimal platform based on analysis and availability
    const selectedPlatform = await this.selectPlatform(analysis);
    
    // Step 3: Execute task on selected platform
    const result = await this.executeOnPlatform(request, selectedPlatform, analysis);
    
    // Step 4: Update platform status and metrics
    await this.updatePlatformMetrics(selectedPlatform, result);
    
    return {
      ...result,
      taskId: request.id,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Analyze task to determine optimal platform and requirements
   */
  private analyzeTask(request: TaskRequest) {
    const { domain, complexity, priority, description, title } = request;
    
    // Calculate complexity score
    const complexityScore = {
      simple: 0.3,
      medium: 0.6,
      complex: 0.9
    }[complexity];

    // Calculate priority urgency
    const urgencyScore = {
      low: 0.25,
      medium: 0.5,
      high: 0.75,
      critical: 1.0
    }[priority];

    // Domain-specific analysis
    const domainPreferences = {
      code: {
        synthetic: 0.9,        // Excellent for code generation
        openrouter: 0.7        // Good but more expensive
      },
      reasoning: {
        synthetic: 0.8,        // Very good with DeepSeek models
        openrouter: 0.9        // Premium models excel here
      },
      analysis: {
        synthetic: 0.7,        // Good for large context analysis
        openrouter: 0.8        // Better reasoning models
      },
      documentation: {
        synthetic: 0.8,        // Cost-effective for docs
        openrouter: 0.6        // Overkill for most docs
      }
    };

    return {
      domain,
      complexity: complexityScore,
      urgency: urgencyScore,
      preferences: domainPreferences[domain],
      estimatedTokens: this.estimateTokens(description, title),
      requiresHighQuality: priority === 'critical' || complexity === 'complex'
    };
  }

  /**
   * Select the best available platform based on task analysis
   */
  private async selectPlatform(analysis: any): Promise<'synthetic' | 'openrouter'> {
    const fallbackChain = this.config.fallbackChain || ['synthetic', 'openrouter'];
    
    for (const platform of fallbackChain) {
      const status = this.platformStatus.get(platform);
      
      // Check platform availability
      if (!status?.available) {
        continue;
      }
      
      // Check usage limits
      if (status.usageLimit && status.usageLimit.current >= status.usageLimit.limit) {
        continue;
      }
      
      // Check cost thresholds
      const estimatedCost = this.estimateCost(platform, analysis.estimatedTokens);
      if (this.config.costThresholds?.maxCostPerTask && 
          estimatedCost > this.config.costThresholds.maxCostPerTask) {
        continue;
      }
      
      // Platform is available and within limits
      return platform as 'synthetic' | 'openrouter';
    }
    
    throw new Error('No available platforms within cost/usage limits');
  }

  /**
   * Execute task on selected platform
   */
  private async executeOnPlatform(
    request: TaskRequest, 
    platform: 'synthetic' | 'openrouter',
    analysis: any
  ): Promise<Omit<TaskResult, 'taskId' | 'executionTime'>> {
    
    if (platform === 'synthetic' && this.synthetic) {
      return this.executeOnSynthetic(request, analysis);
    }
    
    if (platform === 'openrouter' && this.openRouter) {
      return this.executeOnOpenRouter(request, analysis);
    }
    
    throw new Error(`Platform ${platform} not available or not configured`);
  }

  /**
   * Execute task using Synthetic.new
   */
  private async executeOnSynthetic(
    request: TaskRequest,
    analysis: any
  ): Promise<Omit<TaskResult, 'taskId' | 'executionTime'>> {
    if (!this.synthetic) {
      throw new Error('Synthetic gateway not available');
    }

    const agentRequest = {
      title: request.title,
      description: request.description,
      messages: [{
        role: 'user' as const,
        content: request.description
      }],
      context: request.context ? { injected: request.context } : undefined,
      maxTokens: this.calculateMaxTokens(analysis.estimatedTokens),
    };

    const response = await this.synthetic.process(agentRequest);
    
    return {
      platform: 'synthetic',
      agent: response.agent,
      model: response.model,
      content: response.text,
      tokensUsed: response.tokensUsed || 0,
      costUsd: 20 / 30, // $20/month flat fee allocated daily
      confidence: response.classification.confidence,
    };
  }

  /**
   * Execute task using OpenRouter
   */
  private async executeOnOpenRouter(
    request: TaskRequest,
    analysis: any
  ): Promise<Omit<TaskResult, 'taskId' | 'executionTime'>> {
    if (!this.openRouter) {
      throw new Error('OpenRouter gateway not available');
    }

    const generateInput = {
      title: request.title,
      description: request.description,
      messages: [{
        role: 'user' as const,
        content: request.description
      }],
      context: request.context ? { injected: request.context } : undefined,
      maxTokens: this.calculateMaxTokens(analysis.estimatedTokens),
    };

    const response = await this.openRouter.generate(generateInput);
    
    return {
      platform: 'openrouter',
      model: response.model,
      content: response.text,
      tokensUsed: response.raw.usage?.total_tokens || 0,
      costUsd: this.estimateOpenRouterCost(response.raw.usage?.total_tokens || 0),
      confidence: 0.8, // Default confidence for OpenRouter
    };
  }

  /**
   * Get platform status and availability
   */
  getPlatformStatus(): Record<string, PlatformStatus> {
    return Object.fromEntries(this.platformStatus.entries());
  }

  /**
   * Get cost statistics across all platforms
   */
  getCostStatistics() {
    return {
      synthetic: this.synthetic?.getCostStats(),
      openrouter: null, // TODO: Implement OpenRouter cost stats
      total: this.calculateTotalCosts(),
    };
  }

  /**
   * Get platform preferences for a given task type
   */
  getRecommendations(domain: TaskRequest['domain']) {
    const analysis = this.analyzeTask({
      id: 'temp',
      description: 'Sample task',
      domain,
      priority: 'medium',
      complexity: 'medium'
    });
    
    return {
      recommended: analysis.preferences,
      available: Array.from(this.platformStatus.entries())
        .filter(([, status]) => status.available)
        .map(([platform]) => platform),
    };
  }

  // Private helper methods
  private initializePlatformStatus() {
    this.platformStatus.set('synthetic', {
      available: this.platforms.synthetic !== undefined,
      usageLimit: {
        current: 0,
        limit: 1000000, // High limit for flat fee model
      }
    });
    
    this.platformStatus.set('openrouter', {
      available: this.platforms.openRouter !== undefined,
      usageLimit: this.config.openRouter?.budgetUsd ? {
        current: 0,
        limit: this.config.openRouter.budgetUsd,
      } : undefined
    });
  }

  private estimateTokens(description: string, title?: string): number {
    const text = `${title || ''} ${description}`;
    return Math.ceil(text.length / 4); // Rough estimate: 4 chars per token
  }

  private estimateCost(platform: string, tokens: number): number {
    if (platform === 'synthetic') {
      return 20 / 30 / 1000; // Daily allocation per 1000 tokens
    }
    if (platform === 'openrouter') {
      return tokens * 0.002; // Rough estimate
    }
    return 0;
  }

  private calculateMaxTokens(estimatedTokens: number): number {
    return Math.min(Math.max(estimatedTokens * 2, 150), 2000);
  }

  private estimateOpenRouterCost(tokens: number): number {
    return tokens * 0.002; // Rough estimate, should use actual model pricing
  }

  private async updatePlatformMetrics(platform: string, result: any) {
    // Update usage statistics
    const status = this.platformStatus.get(platform);
    if (status?.usageLimit) {
      status.usageLimit.current += result.costUsd || 0;
    }
  }

  private calculateTotalCosts() {
    const synthetic = this.synthetic?.getCostStats();
    return {
      daily: (synthetic?.monthlyCostUsd || 0) / 30,
      monthly: synthetic?.monthlyCostUsd || 0,
      requests: synthetic?.totalRequests || 0,
    };
  }
}