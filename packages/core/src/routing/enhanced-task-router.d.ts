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
    readonly availabilityScore: number;
    readonly qualityScore: number;
    readonly speedScore: number;
}
export declare class EnhancedTaskRouter {
    private readonly capabilities;
    private readonly routingRules;
    private readonly usageHistory;
    constructor();
    /**
     * Determine the best platform for a given task
     */
    route(task: TaskRequest): RoutingDecision;
    /**
     * Learn from execution results to improve future routing
     */
    updateFromResult(_task: TaskRequest, result: TaskResult): void;
    /**
     * Get routing recommendations for different task types
     */
    getRecommendations(): Record<string, {
        platform: string;
        confidence: number;
        reasoning: string;
    }>;
    /**
     * Get current platform performance metrics
     */
    getPlatformMetrics(): Record<string, any>;
    private initializePlatformCapabilities;
    private initializeRoutingRules;
    private applyRoutingRules;
    private calculateAvailabilityScores;
    private calculateCostBenefitScores;
    private combineScoringFactors;
    private selectPlatform;
    private estimateTokens;
    private estimateTaskCost;
    private generateRoutingReason;
    private updatePlatformCapabilities;
}
//# sourceMappingURL=enhanced-task-router.d.ts.map