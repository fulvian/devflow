import type { PlatformStatus, MultiPlatformConfig, PlatformGateway } from '@devflow/shared';
import type { TaskRequest, TaskResult } from '@devflow/shared';
export type { TaskRequest, TaskResult };
export interface PlatformImplementations {
    synthetic?: PlatformGateway;
    openRouter?: PlatformGateway;
}
export declare class MultiPlatformCoordinator {
    private readonly platforms;
    private readonly config;
    private readonly platformStatus;
    synthetic?: PlatformGateway;
    openRouter?: PlatformGateway;
    constructor(platforms: PlatformImplementations, config?: MultiPlatformConfig);
    /**
     * Main entry point for task execution with intelligent platform selection
     */
    executeTask(request: TaskRequest): Promise<TaskResult>;
    /**
     * Analyze task to determine optimal platform and requirements
     */
    private analyzeTask;
    /**
     * Select the best available platform based on task analysis
     */
    private selectPlatform;
    /**
     * Execute task on selected platform
     */
    private executeOnPlatform;
    /**
     * Execute task using Synthetic.new
     */
    private executeOnSynthetic;
    /**
     * Execute task using OpenRouter
     */
    private executeOnOpenRouter;
    /**
     * Get platform status and availability
     */
    getPlatformStatus(): Record<string, PlatformStatus>;
    /**
     * Get cost statistics across all platforms
     */
    getCostStatistics(): {
        synthetic: any;
        openrouter: null;
        total: {
            daily: number;
            monthly: any;
            requests: any;
        };
    };
    /**
     * Get platform preferences for a given task type
     */
    getRecommendations(domain: TaskRequest['domain']): {
        recommended: {
            synthetic: number;
            openrouter: number;
        } | {
            synthetic: number;
            openrouter: number;
        } | {
            synthetic: number;
            openrouter: number;
        } | {
            synthetic: number;
            openrouter: number;
        };
        available: string[];
    };
    private initializePlatformStatus;
    private estimateTokens;
    private estimateCost;
    private calculateMaxTokens;
    private estimateOpenRouterCost;
    private updatePlatformMetrics;
    private calculateTotalCosts;
}
//# sourceMappingURL=multi-platform-coordinator.d.ts.map