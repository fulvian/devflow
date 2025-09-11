import { type TaskRequest, type TaskResult } from '../coordinator/multi-platform-coordinator.js';
import { type RoutingDecision } from '../routing/enhanced-task-router.js';
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
export declare class UnifiedSmartGateway {
    private readonly coordinator;
    private readonly router;
    private readonly config;
    private executionCount;
    constructor(config?: UnifiedGatewayConfig);
    /**
     * Main execution method with intelligent routing and fallback handling
     */
    execute(request: Omit<TaskRequest, 'id'>, options?: ExecutionOptions): Promise<ExecutionResult>;
    /**
     * Execute a simple text completion (simplified interface)
     */
    complete(prompt: string, options?: ExecutionOptions & {
        maxTokens?: number;
        temperature?: number;
    }): Promise<string>;
    /**
     * Get cost analysis and recommendations
     */
    analyzeCosts(): Promise<{
        current: any;
        recommendations: any;
        projections: any;
    }>;
    /**
     * Get real-time platform status
     */
    getPlatformStatus(): {
        coordinator: Record<string, import("@devflow/shared").PlatformStatus>;
        router: Record<string, any>;
        gateway: {
            executionCount: number;
            config: UnifiedGatewayConfig;
        };
    };
    /**
     * Update gateway configuration
     */
    updateConfig(newConfig: Partial<UnifiedGatewayConfig>): void;
    /**
     * Get usage statistics and insights
     */
    getInsights(): {
        performance: any;
        costs: any;
        reliability: any;
        recommendations: string[];
    };
    private executeWithTimeout;
    private isPlatformSupported;
    private createDirectRoutingDecision;
    private estimateDirectCost;
    private calculatePlatformRankings;
    private calculateCostProjections;
}
//# sourceMappingURL=unified-smart-gateway.d.ts.map