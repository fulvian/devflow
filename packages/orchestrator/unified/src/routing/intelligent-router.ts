/**
 * Intelligent Routing System for Multi-Platform Task Distribution
 */

/**
 * Enum representing supported AI platforms
 */
export enum Platform {
  GEMINI = 'gemini',
  CODEX = 'codex',
  QWEN = 'qwen'
}

/**
 * Enum representing task complexity levels
 */
export enum TaskComplexity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Enum representing task types
 */
export enum TaskType {
  ANALYSIS = 'analysis',
  GENERATION = 'generation',
  CODE = 'code',
  REASONING = 'reasoning',
  CREATIVE = 'creative'
}

/**
 * Interface for task characteristics
 */
export interface TaskCharacteristics {
  id: string;
  type: TaskType;
  complexity: TaskComplexity;
  contentLength: number;
  requiresContext: boolean;
  domainSpecificity: number; // 0-1 scale
  timeSensitivity: number; // 0-1 scale
  contextHistory?: string[];
}

/**
 * Interface for platform capabilities
 */
export interface PlatformCapabilities {
  name: Platform;
  strengths: TaskType[];
  maxComplexity: TaskComplexity;
  processingSpeed: number; // Tasks per second
  accuracyScore: number; // 0-1 scale
  costEfficiency: number; // 0-1 scale
  contextWindow: number; // tokens
  currentLoad: number; // 0-1 scale
  reliability: number; // 0-1 scale
  lastUpdated: Date;
}

/**
 * Interface for routing decision
 */
export interface RoutingDecision {
  platform: Platform;
  confidence: number; // 0-1 scale
  estimatedCompletionTime: number; // milliseconds
  costEstimate: number;
  reasoning: string[];
}

/**
 * Interface for performance metrics
 */
export interface PerformanceMetrics {
  platform: Platform;
  successRate: number;
  avgResponseTime: number;
  accuracy: number;
  costPerTask: number;
  lastUpdated: Date;
}

/**
 * Interface for machine learning insights
 */
export interface MLInsights {
  patternRecognition: Map<string, number>; // patternId -> confidence
  optimizationSuggestions: string[];
  predictedPerformance: Map<Platform, number>; // platform -> predicted score
}

/**
 * Configuration for the routing system
 */
export interface RoutingConfig {
  enableMLInsights: boolean;
  enableLoadBalancing: boolean;
  enableFallback: boolean;
  fallbackThreshold: number; // 0-1 scale
  performanceWeight: number; // 0-1 scale
  costWeight: number; // 0-1 scale
  accuracyWeight: number; // 0-1 scale
}

/**
 * Main Intelligent Routing System
 */
export class IntelligentRoutingSystem {
  private platforms: Map<Platform, PlatformCapabilities>;
  private performanceHistory: Map<Platform, PerformanceMetrics[]>;
  private mlInsights: MLInsights;
  private config: RoutingConfig;

  constructor(config: Partial<RoutingConfig> = {}) {
    this.platforms = new Map();
    this.performanceHistory = new Map();
    this.mlInsights = {
      patternRecognition: new Map(),
      optimizationSuggestions: [],
      predictedPerformance: new Map()
    };

    this.config = {
      enableMLInsights: true,
      enableLoadBalancing: true,
      enableFallback: true,
      fallbackThreshold: 0.7,
      performanceWeight: 0.4,
      costWeight: 0.3,
      accuracyWeight: 0.3,
      ...config
    };

    this.initializePlatforms();
  }

  /**
   * Initialize platform capabilities
   */
  private initializePlatforms(): void {
    // Gemini capabilities
    this.platforms.set(Platform.GEMINI, {
      name: Platform.GEMINI,
      strengths: [TaskType.ANALYSIS, TaskType.REASONING, TaskType.CREATIVE],
      maxComplexity: TaskComplexity.HIGH,
      processingSpeed: 15,
      accuracyScore: 0.92,
      costEfficiency: 0.85,
      contextWindow: 32768,
      currentLoad: 0.3,
      reliability: 0.95,
      lastUpdated: new Date()
    });

    // Codex capabilities
    this.platforms.set(Platform.CODEX, {
      name: Platform.CODEX,
      strengths: [TaskType.CODE, TaskType.GENERATION],
      maxComplexity: TaskComplexity.MEDIUM,
      processingSpeed: 20,
      accuracyScore: 0.88,
      costEfficiency: 0.90,
      contextWindow: 8192,
      currentLoad: 0.45,
      reliability: 0.90,
      lastUpdated: new Date()
    });

    // Qwen capabilities
    this.platforms.set(Platform.QWEN, {
      name: Platform.QWEN,
      strengths: [TaskType.GENERATION, TaskType.CREATIVE, TaskType.ANALYSIS],
      maxComplexity: TaskComplexity.HIGH,
      processingSpeed: 18,
      accuracyScore: 0.90,
      costEfficiency: 0.88,
      contextWindow: 32768,
      currentLoad: 0.25,
      reliability: 0.92,
      lastUpdated: new Date()
    });

    // Initialize performance history
    for (const platform of Object.values(Platform)) {
      this.performanceHistory.set(platform, []);
    }
  }

  /**
   * Update platform capabilities
   */
  public updatePlatformCapabilities(platform: Platform, capabilities: Partial<PlatformCapabilities>): void {
    const existing = this.platforms.get(platform);
    if (existing) {
      this.platforms.set(platform, {
        ...existing,
        ...capabilities,
        lastUpdated: new Date()
      });
    }
  }

  /**
   * Update platform load
   */
  public updatePlatformLoad(platform: Platform, load: number): void {
    const capabilities = this.platforms.get(platform);
    if (capabilities) {
      this.platforms.set(platform, {
        ...capabilities,
        currentLoad: Math.max(0, Math.min(1, load)),
        lastUpdated: new Date()
      });
    }
  }

  /**
   * Add performance metrics
   */
  public addPerformanceMetrics(platform: Platform, metrics: PerformanceMetrics): void {
    const history = this.performanceHistory.get(platform) || [];
    history.push(metrics);

    // Keep only last 100 metrics
    if (history.length > 100) {
      history.shift();
    }

    this.performanceHistory.set(platform, history);
  }

  /**
   * Analyze task complexity
   */
  public analyzeTaskComplexity(task: TaskCharacteristics): TaskComplexity {
    let score = 0;

    // Content length factor (0-0.3)
    score += Math.min(0.3, task.contentLength / 10000 * 0.3);

    // Context requirement factor (0-0.2)
    score += task.requiresContext ? 0.2 : 0;

    // Domain specificity factor (0-0.2)
    score += task.domainSpecificity * 0.2;

    // Time sensitivity factor (0-0.3)
    score += task.timeSensitivity * 0.3;

    if (score < 0.3) return TaskComplexity.LOW;
    if (score < 0.7) return TaskComplexity.MEDIUM;
    return TaskComplexity.HIGH;
  }

  /**
   * Calculate platform score for a task
   */
  private calculatePlatformScore(
    platform: PlatformCapabilities,
    task: TaskCharacteristics,
    performanceMetrics?: PerformanceMetrics[]
  ): number {
    let score = 0;
    const reasoning: string[] = [];

    // Strength match factor (0-0.25)
    const strengthMatch = platform.strengths.includes(task.type) ? 0.25 : 0;
    score += strengthMatch;
    if (strengthMatch > 0) {
      reasoning.push(`Platform strength match for ${task.type}`);
    }

    // Complexity handling factor (0-0.2)
    const complexityMap = {
      [TaskComplexity.LOW]: 1,
      [TaskComplexity.MEDIUM]: platform.maxComplexity !== TaskComplexity.LOW ? 1 : 0,
      [TaskComplexity.HIGH]: platform.maxComplexity === TaskComplexity.HIGH ? 1 : 0
    };

    const complexityScore = complexityMap[task.complexity] * 0.2;
    score += complexityScore;
    if (complexityScore > 0) {
      reasoning.push(`Platform can handle ${task.complexity} complexity`);
    }

    // Context window factor (0-0.15)
    const contextScore = task.requiresContext && platform.contextWindow >= 8192 ? 0.15 : 0;
    score += contextScore;
    if (contextScore > 0) {
      reasoning.push(`Sufficient context window (${platform.contextWindow} tokens)`);
    }

    // Performance metrics factor (0-0.25)
    if (performanceMetrics && performanceMetrics.length > 0) {
      const recentMetrics = performanceMetrics.slice(-10); // Last 10 metrics
      const avgSuccessRate = recentMetrics.reduce((sum, m) => sum + m.successRate, 0) / recentMetrics.length;
      const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / recentMetrics.length;
      const avgAccuracy = recentMetrics.reduce((sum, m) => sum + m.accuracy, 0) / recentMetrics.length;

      // Normalize response time (faster is better)
      const normalizedResponseTime = Math.max(0, 1 - (avgResponseTime / 5000)); // Assuming 5s is slow

      const performanceScore = (
        avgSuccessRate * 0.1 +
        normalizedResponseTime * 0.08 +
        avgAccuracy * 0.07
      );

      score += performanceScore;
      if (performanceScore > 0) {
        reasoning.push(`Strong performance history (success: ${(avgSuccessRate * 100).toFixed(1)}%, accuracy: ${(avgAccuracy * 100).toFixed(1)}%)`);
      }
    } else {
      // Use platform capabilities if no performance history
      const capabilityScore = (
        platform.accuracyScore * 0.1 +
        platform.processingSpeed / 20 * 0.08 + // Normalize by max speed
        platform.reliability * 0.07
      );
      score += capabilityScore;
      if (capabilityScore > 0) {
        reasoning.push(`Strong platform capabilities (accuracy: ${(platform.accuracyScore * 100).toFixed(1)}%, reliability: ${(platform.reliability * 100).toFixed(1)}%)`);
      }
    }

    // Load factor (0-0.15)
    const loadFactor = (1 - platform.currentLoad) * 0.15;
    score += loadFactor;
    if (loadFactor > 0.1) {
      reasoning.push(`Low current load (${(platform.currentLoad * 100).toFixed(1)}%)`);
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Apply machine learning insights to platform scoring
   */
  private applyMLInsights(platform: Platform, baseScore: number): number {
    if (!this.config.enableMLInsights) return baseScore;

    // Apply predicted performance adjustment
    const predictedPerformance = this.mlInsights.predictedPerformance.get(platform) || 1;
    const adjustedScore = baseScore * predictedPerformance;

    // Apply pattern recognition insights
    // This would be more sophisticated in a real implementation
    return Math.min(1, adjustedScore);
  }

  /**
   * Get fallback platforms in order of preference
   */
  private getFallbackPlatforms(primary: Platform): Platform[] {
    const allPlatforms = Object.values(Platform).filter(p => p !== primary);

    return allPlatforms.sort((a, b) => {
      const aCaps = this.platforms.get(a);
      const bCaps = this.platforms.get(b);

      if (!aCaps || !bCaps) return 0;

      // Sort by reliability and current load
      const aScore = aCaps.reliability * (1 - aCaps.currentLoad);
      const bScore = bCaps.reliability * (1 - bCaps.currentLoad);

      return bScore - aScore;
    });
  }

  /**
   * Make routing decision for a task
   */
  public async routeTask(task: TaskCharacteristics): Promise<RoutingDecision> {
    const startTime = Date.now();

    // Ensure task complexity is set
    if (!task.complexity) {
      task.complexity = this.analyzeTaskComplexity(task);
    }

    // Calculate scores for all platforms
    const platformScores = new Map<Platform, { score: number; reasoning: string[] }>();

    for (const [platformName, capabilities] of this.platforms.entries()) {
      const performanceMetrics = this.performanceHistory.get(platformName);
      let score = this.calculatePlatformScore(capabilities, task, performanceMetrics);
      const reasoning: string[] = [];

      // Add reasoning from calculatePlatformScore
      // (In a real implementation, we'd capture this reasoning)
      reasoning.push(`Base score: ${score.toFixed(3)}`);

      // Apply ML insights
      const mlAdjustedScore = this.applyMLInsights(platformName, score);
      if (mlAdjustedScore !== score) {
        reasoning.push(`ML adjustment: ${(mlAdjustedScore - score).toFixed(3)}`);
        score = mlAdjustedScore;
      }

      platformScores.set(platformName, { score, reasoning });
    }

    // Select best platform
    let bestPlatform: Platform | null = null;
    let bestScore = -1;
    let bestReasoning: string[] = [];

    for (const [platform, { score, reasoning }] of platformScores.entries()) {
      if (score > bestScore) {
        bestScore = score;
        bestPlatform = platform;
        bestReasoning = reasoning;
      }
    }

    if (!bestPlatform) {
      throw new Error('No suitable platform found for task routing');
    }

    // Handle fallback if confidence is low
    let finalPlatform = bestPlatform;
    let finalReasoning = [...bestReasoning];

    if (this.config.enableFallback && bestScore < this.config.fallbackThreshold) {
      const fallbackPlatforms = this.getFallbackPlatforms(bestPlatform);
      if (fallbackPlatforms.length > 0) {
        finalPlatform = fallbackPlatforms[0];
        finalReasoning.push(`Fallback to ${finalPlatform} due to low confidence (${bestScore.toFixed(3)} < ${this.config.fallbackThreshold})`);
      }
    }

    // Get platform capabilities for estimation
    const platformCaps = this.platforms.get(finalPlatform);
    if (!platformCaps) {
      throw new Error(`Platform capabilities not found for ${finalPlatform}`);
    }

    // Estimate completion time (simplified)
    const estimatedCompletionTime = (task.contentLength / 1000) * (1 / platformCaps.processingSpeed) * 1000;

    // Estimate cost (simplified)
    const costEstimate = (task.contentLength / 1000) * (1 - platformCaps.costEfficiency) * 0.01;

    const decision: RoutingDecision = {
      platform: finalPlatform,
      confidence: bestScore,
      estimatedCompletionTime,
      costEstimate,
      reasoning: finalReasoning
    };

    // Update ML insights (simplified)
    if (this.config.enableMLInsights) {
      this.updateMLInsights(task, decision);
    }

    return decision;
  }

  /**
   * Update machine learning insights based on routing decisions
   */
  private updateMLInsights(task: TaskCharacteristics, decision: RoutingDecision): void {
    // In a real implementation, this would update ML models
    // For now, we'll just track patterns

    const patternKey = `${task.type}-${task.complexity}`;
    const currentConfidence = this.mlInsights.patternRecognition.get(patternKey) || 0;

    // Simple reinforcement learning - increase confidence for successful decisions
    const newConfidence = Math.min(1, currentConfidence + 0.01);
    this.mlInsights.patternRecognition.set(patternKey, newConfidence);
  }

  /**
   * Get platform recommendations for a task type
   */
  public getPlatformRecommendations(taskType: TaskType): Platform[] {
    const platforms = Array.from(this.platforms.values());

    return platforms
      .filter(platform => platform.strengths.includes(taskType))
      .sort((a, b) => {
        // Sort by strength match and overall capability
        const aScore = a.accuracyScore * 0.5 + a.reliability * 0.3 + (1 - a.currentLoad) * 0.2;
        const bScore = b.accuracyScore * 0.5 + b.reliability * 0.3 + (1 - b.currentLoad) * 0.2;
        return bScore - aScore;
      })
      .map(platform => platform.name);
  }

  /**
   * Get system health status
   */
  public getSystemHealth(): Record<Platform, { status: 'healthy' | 'degraded' | 'unhealthy'; load: number }> {
    const health: Record<Platform, { status: 'healthy' | 'degraded' | 'unhealthy'; load: number }> =
      {} as Record<Platform, { status: 'healthy' | 'degraded' | 'unhealthy'; load: number }>;

    for (const [platformName, capabilities] of this.platforms.entries()) {
      const load = capabilities.currentLoad;
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

      if (load > 0.8) {
        status = 'unhealthy';
      } else if (load > 0.6) {
        status = 'degraded';
      }

      health[platformName] = { status, load };
    }

    return health;
  }
}

export default IntelligentRoutingSystem;