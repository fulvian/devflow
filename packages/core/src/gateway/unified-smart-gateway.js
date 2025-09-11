import { MultiPlatformCoordinator } from '../coordinator/multi-platform-coordinator.js';
import { EnhancedTaskRouter } from '../routing/enhanced-task-router.js';
export class UnifiedSmartGateway {
    coordinator;
    router;
    config;
    executionCount = 0;
    constructor(config = {}) {
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
            synthetic: config.synthetic ? { apiKey: config.synthetic.apiKey || '', enabled: config.synthetic.enabled || true } : undefined,
            openRouter: config.openRouter ? { apiKey: config.openRouter.apiKey || '', enabled: config.openRouter.enabled || true } : undefined,
        });
        this.router = new EnhancedTaskRouter();
    }
    /**
     * Main execution method with intelligent routing and fallback handling
     */
    async execute(request, options = {}) {
        const taskId = `task-${Date.now()}-${++this.executionCount}`;
        const fullRequest = { ...request, id: taskId };
        const _startTime = Date.now();
        const fallbacksUsed = [];
        let lastError = null;
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
                    const result = await this.executeWithTimeout({ ...fullRequest, id: `${taskId}-${platform}-${attempt}` }, platform, options.timeout ?? 30000);
                    // Validate quality if threshold specified
                    if (options.requireHighQuality && (result.confidence || 0.5) < (this.config.routing?.qualityThreshold ?? 0.7)) {
                        fallbacksUsed.push(`${platform}:quality_too_low`);
                        continue;
                    }
                    // Success! Update router learning and return result
                    if (this.config.routing?.enableLearning) {
                        this.router.updateFromResult(fullRequest, result);
                    }
                    const executionResult = {
                        ...result,
                        routingDecision,
                        fallbacksUsed,
                        totalCost: result.costUsd || 0,
                        qualityScore: result.confidence || 0.5,
                    };
                    return executionResult;
                }
                catch (error) {
                    lastError = error;
                    fallbacksUsed.push(`${platform}:${error instanceof Error ? error.message : 'unknown_error'}`);
                    // If this was the primary platform, try fallbacks
                    if (platform === routingDecision.platform) {
                        continue;
                    }
                }
            }
        }
        // All platforms failed
        throw new Error(`Task execution failed on all platforms. Last error: ${lastError?.message || 'Unknown'}. ` +
            `Fallbacks attempted: ${fallbacksUsed.join(', ')}`);
    }
    /**
     * Execute a simple text completion (simplified interface)
     */
    async complete(prompt, options = {}) {
        const result = await this.execute({
            description: prompt,
            domain: 'code', // Default domain
            priority: 'medium',
            complexity: 'medium',
        }, options);
        return result.content || '';
    }
    /**
     * Get cost analysis and recommendations
     */
    async analyzeCosts() {
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
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
    /**
     * Get usage statistics and insights
     */
    getInsights() {
        const platformStatus = this.coordinator.getPlatformStatus();
        const routerMetrics = this.router.getPlatformMetrics();
        const costStats = this.coordinator.getCostStatistics();
        const recommendations = [];
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
                platformAvailability: Object.fromEntries(Object.entries(platformStatus).map(([k, v]) => [k, v.available])),
                fallbackCoverage: this.config.fallbackChain?.length || 0,
            },
            recommendations,
        };
    }
    // Private helper methods
    async executeWithTimeout(request, _platform, timeoutMs) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Execution timeout after ${timeoutMs}ms`)), timeoutMs);
        });
        const executionPromise = this.coordinator.executeTask(request);
        return Promise.race([executionPromise, timeoutPromise]);
    }
    isPlatformSupported(platform) {
        const status = this.coordinator.getPlatformStatus();
        return status[platform]?.available ?? false;
    }
    createDirectRoutingDecision(platform, request) {
        const otherPlatforms = ['synthetic', 'openrouter'].filter(p => p !== platform);
        return {
            platform: platform,
            reason: `Direct platform selection: ${platform}`,
            confidence: 0.8,
            estimatedCost: this.estimateDirectCost(platform, request),
            fallbacks: otherPlatforms,
        };
    }
    estimateDirectCost(platform, request) {
        const tokens = Math.ceil((request.description.length + (request.title?.length || 0)) / 4);
        if (platform === 'synthetic')
            return 20 / 30 / 1000; // Daily allocation per 1000 tokens
        if (platform === 'openrouter')
            return tokens * 0.002; // Rough estimate
        return 0;
    }
    calculatePlatformRankings(metrics) {
        const rankings = Object.entries(metrics)
            .map(([platform, data]) => ({
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
    calculateCostProjections(stats) {
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
//# sourceMappingURL=unified-smart-gateway.js.map