import { MultiPlatformCoordinator, type TaskRequest, type TaskResult } from '../coordinator/multi-platform-coordinator.js';
import { EnhancedTaskRouter, type RoutingDecision } from '../routing/enhanced-task-router.js';

export interface UnifiedGatewayConfig {
  readonly synthetic?: {
    apiKey?: string;
    enabled?: boolean;
  };
  readonly openRouter?: {
    apiKey?: string;
    enabled?: boolean;
    budgetUsd?: number;
    preferredModels?: string[];
  };
  readonly routing?: {
    enableLearning?: boolean;
    costOptimization?: boolean;
    qualityThreshold?: number;
  };
  readonly fallbackChain?: ('synthetic' | 'openrouter')[];
}

export interface ExecutionOptions {
  readonly preferredPlatform?: 'synthetic' | 'openrouter' | 'auto';
  readonly maxCost?: number;
  readonly requireHighQuality?: boolean;
  readonly timeout?: number;
  readonly retries?: number;
}

export interface ExecutionResult extends TaskResult {
  readonly routingDecision: RoutingDecision;
  readonly fallbacksUsed: string[];
  readonly totalCost: number;
  readonly qualityScore: number;
}

export class UnifiedSmartGateway {
  private readonly coordinator: MultiPlatformCoordinator;
  private readonly router: EnhancedTaskRouter;
  private readonly config: UnifiedGatewayConfig;
  private executionCount = 0;

  constructor(config: UnifiedGatewayConfig = {}) {
    this.config = {
      routing: {
        enableLearning: true,
        costOptimization: true,
        qualityThreshold: 0.7,
        ...config.routing,
      },
      fallbackChain: ['synthetic', 'openrouter'],
      ...config,
    };

    this.coordinator = new MultiPlatformCoordinator({
      synthetic: config.synthetic ? { apiKey: config.synthetic.apiKey || '', enabled: config.synthetic.enabled || true } as any : undefined,
      openRouter: config.openRouter ? { apiKey: config.openRouter.apiKey || '', enabled: config.openRouter.enabled || true } as any : undefined,
    });

    this.router = new EnhancedTaskRouter();
  }

  /**
   * Main execution method with intelligent routing and fallback handling
   */
  async execute(
    request: Omit<TaskRequest, 'id'>,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const taskId = `task-${Date.now()}-${++this.executionCount}`;
    const fullRequest: TaskRequest = { ...request, id: taskId };
    
    const _startTime = Date.now();
    const fallbacksUsed: string[] = [];
    let lastError: Error | null = null;

    // Step 1: Get routing decision
    const routingDecision = options.preferredPlatform === 'auto' || !options.preferredPlatform
      ? this.router.route(fullRequest)
      : this.createDirectRoutingDecision(options.preferredPlatform, fullRequest);

    // Step 2: Validate routing decision against options
    if (options.maxCost && routingDecision.estimatedCost > options.maxCost) {
      throw new Error(`Estimated cost ($${routingDecision.estimatedCost.toFixed(4)}) exceeds maximum ($${options.maxCost})`);
    }

    // Step 3: Execute with fallback handling
    const platformsToTry = [routingDecision.platform, ...routingDecision.fallbacks];
    const maxRetries = options.retries ?? 2;
    
    for (let attempt = 0; attempt < maxRetries + 1; attempt++) {
      for (const platform of platformsToTry) {
        try {
          // Skip platforms not supported by coordinator
          if (!this.isPlatformSupported(platform)) {
            fallbacksUsed.push(`${platform}:not_supported`);
            continue;
          }

          const result = await this.executeWithTimeout(
            { ...fullRequest, id: `${taskId}-${platform}-${attempt}` },
            platform as any,
            options.timeout ?? 30000
          );

          // Validate quality if threshold specified
          if (options.requireHighQuality && ((result as any).confidence || 0.5) < (this.config.routing?.qualityThreshold ?? 0.7)) {
            fallbacksUsed.push(`${platform}:quality_too_low`);
            continue;
          }

          // Success! Update router learning and return result
          if (this.config.routing?.enableLearning) {
            this.router.updateFromResult(fullRequest, result);
          }

          const executionResult: ExecutionResult = {
            ...result,
            routingDecision,
            fallbacksUsed,
            totalCost: (result as any).costUsd || 0,
            qualityScore: (result as any).confidence || 0.5,
          };

          return executionResult;

        } catch (error) {
          lastError = error as Error;
          fallbacksUsed.push(`${platform}:${error instanceof Error ? error.message : 'unknown_error'}`);
          
          // If this was the primary platform, try fallbacks
          if (platform === routingDecision.platform) {
            continue;
          }
        }
      }
    }

    // All platforms failed
    throw new Error(
      `Task execution failed on all platforms. Last error: ${lastError?.message || 'Unknown'}. ` +
      `Fallbacks attempted: ${fallbacksUsed.join(', ')}`
    );
  }

  /**
   * Execute a simple text completion (simplified interface)
   */
  async complete(
    prompt: string,
    options: ExecutionOptions & { maxTokens?: number; temperature?: number } = {}
  ): Promise<string> {
    const result = await this.execute({
      description: prompt,
      domain: 'code', // Default domain
      priority: 'medium',
      complexity: 'medium',
    }, options);

    return (result as any).content || '';
  }

  /**
   * Get cost analysis and recommendations
   */
  async analyzeCosts(): Promise<{
    current: any;
    recommendations: any;
    projections: any;
  }> {
    const stats = this.coordinator.getCostStatistics();
    const platformMetrics = this.router.getPlatformMetrics();
    const recommendations = this.router.getRecommendations();

    return {
      current: {
        platforms: stats,
        total: stats.total,
      },
      recommendations: {
        byTaskType: recommendations,
        platformRankings: this.calculatePlatformRankings(platformMetrics),
      },
      projections: this.calculateCostProjections(stats),
    };
  }

  /**
   * Get real-time platform status
   */
  getPlatformStatus() {
    return {
      coordinator: this.coordinator.getPlatformStatus(),
      router: this.router.getPlatformMetrics(),
      gateway: {
        executionCount: this.executionCount,
        config: this.config,
      },
    };
  }

  /**
   * Update gateway configuration
   */
  updateConfig(newConfig: Partial<UnifiedGatewayConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Get usage statistics and insights
   */
  getInsights(): {
    performance: any;
    costs: any;
    reliability: any;
    recommendations: string[];
  } {
    const platformStatus = this.coordinator.getPlatformStatus();
    const routerMetrics = this.router.getPlatformMetrics();
    const costStats = this.coordinator.getCostStatistics();

    const recommendations: string[] = [];

    // Analyze and generate recommendations
    if (costStats.synthetic?.totalRequests > 50 && costStats.synthetic.monthlyCostUsd > 15) {
      recommendations.push('Consider upgrading Synthetic.new usage - you\'re getting good value from the flat fee');
    }

    if (platformStatus['synthetic']?.available && platformStatus['openrouter']?.available) {
      recommendations.push('Multi-platform setup optimal - good fallback coverage');
    }

    Object.entries(routerMetrics).forEach(([platform, metrics]) => {
      if (metrics.recentPerformance?.avgQuality < 0.6) {
        recommendations.push(`Consider reducing ${platform} usage - quality below threshold`);
      }
    });

    return {
      performance: routerMetrics,
      costs: costStats,
      reliability: {
        platformAvailability: Object.fromEntries(
          Object.entries(platformStatus).map(([k, v]) => [k, v.available])
        ),
        fallbackCoverage: this.config.fallbackChain?.length || 0,
      },
      recommendations,
    };
  }

  // Private helper methods
  private async executeWithTimeout(
    request: TaskRequest,
    _platform: 'synthetic' | 'openrouter',
    timeoutMs: number
  ): Promise<TaskResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Execution timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    const executionPromise = this.coordinator.executeTask(request);

    return Promise.race([executionPromise, timeoutPromise]);
  }

  private isPlatformSupported(platform: string): boolean {
    const status = this.coordinator.getPlatformStatus();
    return status[platform]?.available ?? false;
  }

  private createDirectRoutingDecision(
    platform: 'synthetic' | 'openrouter',
    request: TaskRequest
  ): RoutingDecision {
    const otherPlatforms = ['synthetic', 'openrouter'].filter(p => p !== platform);
    
    return {
      platform: platform as any,
      reason: `Direct platform selection: ${platform}`,
      confidence: 0.8,
      estimatedCost: this.estimateDirectCost(platform, request),
      fallbacks: otherPlatforms,
    };
  }

  private estimateDirectCost(platform: string, request: TaskRequest): number {
    const tokens = Math.ceil((request.description.length + (request.title?.length || 0)) / 4);
    
    if (platform === 'synthetic') return 20 / 30 / 1000; // Daily allocation per 1000 tokens
    if (platform === 'openrouter') return tokens * 0.002; // Rough estimate
    return 0;
  }

  private calculatePlatformRankings(metrics: any): Array<{
    platform: string;
    score: number;
    strengths: string[];
    ranking: number;
  }> {
    const rankings = Object.entries(metrics)
      .map(([platform, data]: [string, any]) => ({
        platform,
        score: (data.capabilities?.quality || 0) * 0.4 + 
               (data.capabilities?.availability || 0) * 0.3 +
               (data.capabilities?.speed || 0) * 0.2 +
               (1 / Math.max(0.001, data.capabilities?.costPerToken || 0.001)) * 0.1,
        strengths: data.strengths || [],
      }))
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, ranking: index + 1 }));

    return rankings;
  }

  private calculateCostProjections(stats: any): any {
    const currentMonthly = stats.total?.monthly || 0;
    
    return {
      monthly: {
        current: currentMonthly,
        projected: currentMonthly * 1.2, // 20% growth assumption
        savings: currentMonthly > 50 ? currentMonthly * 0.3 : 0, // Potential 30% savings
      },
      breakdown: {
        synthetic: stats.synthetic?.monthlyCostUsd || 0,
        openrouter: 0, // TODO: Get actual OpenRouter costs
      },
      recommendations: currentMonthly > 100 ? 
        ['Consider enterprise plans for better rates'] :
        ['Current usage is cost-efficient'],
    };
  }
}