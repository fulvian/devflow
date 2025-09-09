import type { TaskRequest, TaskResult } from '../coordinator/multi-platform-coordinator.js';

export interface RoutingDecision {
  readonly platform: 'openai-codex' | 'synthetic' | 'openrouter';
  readonly reason: string;
  readonly confidence: number;
  readonly estimatedCost: number;
  readonly fallbacks: ReadonlyArray<string>;
}

export interface RoutingRule {
  readonly name: string;
  readonly condition: (task: TaskRequest) => boolean;
  readonly priority: number;
  readonly platformPreferences: ReadonlyArray<{
    platform: string;
    score: number;
    conditions?: ReadonlyArray<string>;
  }>;
}

export interface PlatformCapabilities {
  readonly platform: string;
  readonly strengths: ReadonlyArray<string>;
  readonly costPerToken: number;
  readonly contextLimit: number;
  readonly availabilityScore: number; // 0.0-1.0
  readonly qualityScore: number;      // 0.0-1.0
  readonly speedScore: number;        // 0.0-1.0
}

export class EnhancedTaskRouter {
  private readonly capabilities: Map<string, PlatformCapabilities> = new Map();
  private readonly routingRules: RoutingRule[] = [];
  private readonly usageHistory: Map<string, Array<{ cost: number; quality: number; speed: number }>> = new Map();

  constructor() {
    this.initializePlatformCapabilities();
    this.initializeRoutingRules();
  }

  /**
   * Determine the best platform for a given task
   */
  route(task: TaskRequest): RoutingDecision {
    // Step 1: Apply routing rules to get initial preferences
    const ruleBasedScores = this.applyRoutingRules(task);
    
    // Step 2: Factor in current platform availability and performance
    const availabilityScores = this.calculateAvailabilityScores();
    
    // Step 3: Calculate cost-benefit scores
    const costBenefitScores = this.calculateCostBenefitScores(task);
    
    // Step 4: Combine all factors to get final scores
    const finalScores = this.combineScoringFactors({
      ruleBased: ruleBasedScores,
      availability: availabilityScores,
      costBenefit: costBenefitScores,
    });
    
    // Step 5: Select platform and generate decision
    return this.selectPlatform(task, finalScores);
  }

  /**
   * Learn from execution results to improve future routing
   */
  updateFromResult(task: TaskRequest, result: TaskResult): void {
    const platform = result.platform;
    
    // Calculate quality score (0.0-1.0) based on multiple factors
    const qualityScore = Math.min(1.0, 
      result.confidence * 0.6 + 
      (result.tokensUsed > 50 ? 0.3 : 0.1) + // Substantial response
      (result.executionTime < 10000 ? 0.1 : 0.0) // Fast execution
    );
    
    // Calculate speed score (inverse of execution time, normalized)
    const speedScore = Math.max(0.1, Math.min(1.0, 10000 / result.executionTime));
    
    // Store in history
    if (!this.usageHistory.has(platform)) {
      this.usageHistory.set(platform, []);
    }
    
    const history = this.usageHistory.get(platform)!;
    history.push({
      cost: result.costUsd,
      quality: qualityScore,
      speed: speedScore,
    });
    
    // Keep only recent history (last 100 entries)
    if (history.length > 100) {
      history.shift();
    }
    
    // Update platform capabilities based on recent performance
    this.updatePlatformCapabilities(platform);
  }

  /**
   * Get routing recommendations for different task types
   */
  getRecommendations(): Record<string, { platform: string; confidence: number; reasoning: string }> {
    const taskTypes = [
      { domain: 'code', complexity: 'simple', priority: 'medium' },
      { domain: 'code', complexity: 'complex', priority: 'high' },
      { domain: 'reasoning', complexity: 'medium', priority: 'medium' },
      { domain: 'analysis', complexity: 'complex', priority: 'low' },
      { domain: 'documentation', complexity: 'simple', priority: 'low' },
    ] as const;

    const recommendations: Record<string, any> = {};
    
    taskTypes.forEach((taskType, index) => {
      const mockTask: TaskRequest = {
        id: `test-${index}`,
        description: `Sample ${taskType.domain} task`,
        domain: taskType.domain,
        complexity: taskType.complexity,
        priority: taskType.priority,
      };
      
      const decision = this.route(mockTask);
      const key = `${taskType.domain}_${taskType.complexity}_${taskType.priority}`;
      
      recommendations[key] = {
        platform: decision.platform,
        confidence: decision.confidence,
        reasoning: decision.reason,
      };
    });
    
    return recommendations;
  }

  /**
   * Get current platform performance metrics
   */
  getPlatformMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [platform, capabilities] of this.capabilities.entries()) {
      const history = this.usageHistory.get(platform) || [];
      const recent = history.slice(-10); // Last 10 requests
      
      metrics[platform] = {
        capabilities: {
          availability: capabilities.availabilityScore,
          quality: capabilities.qualityScore,
          speed: capabilities.speedScore,
          costPerToken: capabilities.costPerToken,
        },
        recentPerformance: recent.length > 0 ? {
          avgQuality: recent.reduce((sum, h) => sum + h.quality, 0) / recent.length,
          avgSpeed: recent.reduce((sum, h) => sum + h.speed, 0) / recent.length,
          avgCost: recent.reduce((sum, h) => sum + h.cost, 0) / recent.length,
          requestCount: recent.length,
        } : null,
        strengths: capabilities.strengths,
      };
    }
    
    return metrics;
  }

  // Private implementation methods
  private initializePlatformCapabilities(): void {
    // OpenAI Codex (Primary implementation engine)
    this.capabilities.set('openai-codex', {
      platform: 'openai-codex',
      strengths: ['code_generation', 'api_integration', 'pattern_following', 'rapid_implementation'],
      costPerToken: 0.002, // Estimated
      contextLimit: 8192,
      availabilityScore: 0.8, // Usage limits
      qualityScore: 0.9,      // High quality
      speedScore: 0.9,        // Fast
    });

    // Synthetic.new (Cost-effective secondary)
    this.capabilities.set('synthetic', {
      platform: 'synthetic',
      strengths: ['code_generation', 'reasoning', 'cost_effective', 'large_context'],
      costPerToken: 0.0, // Flat fee model
      contextLimit: 131072, // Varies by model
      availabilityScore: 0.95, // High availability
      qualityScore: 0.8,       // Good quality
      speedScore: 0.7,         // Moderate speed
    });

    // OpenRouter (Premium fallback)
    this.capabilities.set('openrouter', {
      platform: 'openrouter',
      strengths: ['reasoning', 'complex_analysis', 'high_quality', 'premium_models'],
      costPerToken: 0.015, // Higher cost
      contextLimit: 32768,
      availabilityScore: 0.99, // Very high availability
      qualityScore: 0.95,      // Premium quality
      speedScore: 0.6,         // Slower but thorough
    });
  }

  private initializeRoutingRules(): void {
    this.routingRules.push(
      // Rule 1: Simple code tasks → Synthetic first, then Codex
      {
        name: 'simple_code_tasks',
        condition: (task) => task.domain === 'code' && task.complexity === 'simple',
        priority: 10,
        platformPreferences: [
          { platform: 'synthetic', score: 0.9, conditions: ['available', 'under_budget'] },
          { platform: 'openai-codex', score: 0.8, conditions: ['available'] },
          { platform: 'openrouter', score: 0.3 },
        ],
      },
      
      // Rule 2: Complex code tasks → Codex first, then Synthetic
      {
        name: 'complex_code_tasks',
        condition: (task) => task.domain === 'code' && task.complexity === 'complex',
        priority: 15,
        platformPreferences: [
          { platform: 'openai-codex', score: 0.9, conditions: ['available'] },
          { platform: 'synthetic', score: 0.7, conditions: ['available'] },
          { platform: 'openrouter', score: 0.8 },
        ],
      },

      // Rule 3: Reasoning tasks → Synthetic then OpenRouter
      {
        name: 'reasoning_tasks',
        condition: (task) => task.domain === 'reasoning',
        priority: 12,
        platformPreferences: [
          { platform: 'synthetic', score: 0.85, conditions: ['available'] },
          { platform: 'openrouter', score: 0.9 },
          { platform: 'openai-codex', score: 0.4 },
        ],
      },

      // Rule 4: Critical priority → Best available regardless of cost
      {
        name: 'critical_priority',
        condition: (task) => task.priority === 'critical',
        priority: 20,
        platformPreferences: [
          { platform: 'openrouter', score: 0.95 },
          { platform: 'openai-codex', score: 0.9, conditions: ['available'] },
          { platform: 'synthetic', score: 0.8, conditions: ['available'] },
        ],
      },

      // Rule 5: Documentation tasks → Synthetic (cost-effective)
      {
        name: 'documentation_tasks',
        condition: (task) => task.domain === 'documentation',
        priority: 8,
        platformPreferences: [
          { platform: 'synthetic', score: 0.9, conditions: ['available'] },
          { platform: 'openai-codex', score: 0.6, conditions: ['available'] },
          { platform: 'openrouter', score: 0.4 },
        ],
      }
    );
  }

  private applyRoutingRules(task: TaskRequest): Map<string, number> {
    const scores = new Map<string, number>();
    
    // Initialize all platforms with base score
    for (const platform of this.capabilities.keys()) {
      scores.set(platform, 0.1);
    }
    
    // Apply matching rules
    const applicableRules = this.routingRules
      .filter(rule => rule.condition(task))
      .sort((a, b) => b.priority - a.priority);
    
    for (const rule of applicableRules) {
      for (const preference of rule.platformPreferences) {
        const currentScore = scores.get(preference.platform) || 0;
        const ruleScore = preference.score * (rule.priority / 20); // Normalize by max priority
        scores.set(preference.platform, Math.max(currentScore, ruleScore));
      }
    }
    
    return scores;
  }

  private calculateAvailabilityScores(): Map<string, number> {
    const scores = new Map<string, number>();
    
    for (const [platform, capabilities] of this.capabilities.entries()) {
      scores.set(platform, capabilities.availabilityScore);
    }
    
    return scores;
  }

  private calculateCostBenefitScores(task: TaskRequest): Map<string, number> {
    const scores = new Map<string, number>();
    const estimatedTokens = this.estimateTokens(task);
    
    for (const [platform, capabilities] of this.capabilities.entries()) {
      const estimatedCost = estimatedTokens * capabilities.costPerToken;
      const qualityPerDollar = capabilities.qualityScore / Math.max(0.001, estimatedCost);
      
      // Normalize score (higher is better)
      scores.set(platform, Math.min(1.0, qualityPerDollar / 100));
    }
    
    return scores;
  }

  private combineScoringFactors(factors: {
    ruleBased: Map<string, number>;
    availability: Map<string, number>;
    costBenefit: Map<string, number>;
  }): Map<string, number> {
    const finalScores = new Map<string, number>();
    
    for (const platform of this.capabilities.keys()) {
      const ruleScore = factors.ruleBased.get(platform) || 0;
      const availScore = factors.availability.get(platform) || 0;
      const costScore = factors.costBenefit.get(platform) || 0;
      
      // Weighted combination
      const finalScore = 
        ruleScore * 0.5 +      // 50% rule-based preference
        availScore * 0.3 +     // 30% availability
        costScore * 0.2;       // 20% cost-benefit
      
      finalScores.set(platform, finalScore);
    }
    
    return finalScores;
  }

  private selectPlatform(task: TaskRequest, scores: Map<string, number>): RoutingDecision {
    // Sort platforms by score
    const sortedPlatforms = Array.from(scores.entries())
      .sort(([,a], [,b]) => b - a);
    
    const [selectedPlatform, score] = sortedPlatforms[0];
    const fallbacks = sortedPlatforms.slice(1).map(([platform]) => platform);
    
    const estimatedCost = this.estimateTaskCost(task, selectedPlatform);
    
    return {
      platform: selectedPlatform as any,
      confidence: score,
      reason: this.generateRoutingReason(task, selectedPlatform, score),
      estimatedCost,
      fallbacks,
    };
  }

  private estimateTokens(task: TaskRequest): number {
    const text = `${task.title || ''} ${task.description}`;
    return Math.ceil(text.length / 4); // Rough estimate
  }

  private estimateTaskCost(task: TaskRequest, platform: string): number {
    const capabilities = this.capabilities.get(platform);
    if (!capabilities) return 0;
    
    const estimatedTokens = this.estimateTokens(task);
    return estimatedTokens * capabilities.costPerToken;
  }

  private generateRoutingReason(task: TaskRequest, platform: string, score: number): string {
    const capabilities = this.capabilities.get(platform);
    if (!capabilities) return 'Unknown platform';
    
    const reasons = [
      `Best match for ${task.domain} tasks`,
      `${task.complexity} complexity well-suited for ${platform}`,
      `${task.priority} priority optimization`,
      `Strong in: ${capabilities.strengths.join(', ')}`,
    ];
    
    return `${reasons.join('. ')}. Confidence: ${(score * 100).toFixed(0)}%`;
  }

  private updatePlatformCapabilities(platform: string): void {
    const capabilities = this.capabilities.get(platform);
    const history = this.usageHistory.get(platform);
    
    if (!capabilities || !history || history.length === 0) return;
    
    const recent = history.slice(-20); // Last 20 requests
    const avgQuality = recent.reduce((sum, h) => sum + h.quality, 0) / recent.length;
    const avgSpeed = recent.reduce((sum, h) => sum + h.speed, 0) / recent.length;
    
    // Update capabilities based on recent performance
    capabilities.qualityScore = avgQuality * 0.3 + capabilities.qualityScore * 0.7;
    capabilities.speedScore = avgSpeed * 0.3 + capabilities.speedScore * 0.7;
  }
}