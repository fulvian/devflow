export interface CostEvent {
    readonly timestamp: number;
    readonly platform: 'claude-code' | 'openai-codex' | 'synthetic' | 'openrouter';
    readonly taskId: string;
    readonly model?: string;
    readonly agent?: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
    readonly costUsd: number;
    readonly executionTime: number;
    readonly quality: number;
    readonly success: boolean;
    readonly metadata?: Record<string, any>;
}
export interface CostSummary {
    readonly platform: string;
    readonly totalRequests: number;
    readonly totalTokens: number;
    readonly totalCostUsd: number;
    readonly avgCostPerRequest: number;
    readonly avgCostPerToken: number;
    readonly avgQuality: number;
    readonly successRate: number;
    readonly avgExecutionTime: number;
}
export interface BudgetAlert {
    readonly type: 'daily' | 'weekly' | 'monthly' | 'per_request';
    readonly threshold: number;
    readonly current: number;
    readonly percentage: number;
    readonly severity: 'info' | 'warning' | 'critical';
    readonly message: string;
    readonly timestamp: number;
}
export interface CostOptimizationRecommendation {
    readonly type: 'platform_switch' | 'model_downgrade' | 'batch_requests' | 'usage_pattern';
    readonly description: string;
    readonly estimatedSavings: number;
    readonly confidence: number;
    readonly actionRequired: string;
}
export interface BudgetLimits {
    readonly daily?: number;
    readonly weekly?: number;
    readonly monthly?: number;
    readonly perRequest?: number;
    readonly alertThresholds?: {
        readonly warning: number;
        readonly critical: number;
    };
}
export declare class UnifiedCostTracker {
    private readonly events;
    private readonly budgetLimits;
    private readonly alerts;
    private readonly maxEvents;
    constructor(budgetLimits?: BudgetLimits);
    /**
     * Record a cost event from any platform
     */
    recordEvent(event: Omit<CostEvent, 'timestamp'>): CostEvent;
    /**
     * Get cost summary for all platforms or specific platform
     */
    getSummary(platform?: string, rangeMs?: number): CostSummary | Record<string, CostSummary>;
    /**
     * Get cost breakdown by time period
     */
    getCostBreakdown(period: 'hour' | 'day' | 'week' | 'month', count?: number): Array<{
        period: string;
        platforms: Record<string, number>;
        total: number;
    }>;
    /**
     * Get current budget status
     */
    getBudgetStatus(): {
        limits: BudgetLimits;
        current: {
            daily: number;
            weekly: number;
            monthly: number;
        };
        alerts: BudgetAlert[];
        projections: {
            dailyBurn: number;
            monthlyProjection: number;
        };
    };
    /**
     * Get cost optimization recommendations
     */
    getOptimizationRecommendations(): CostOptimizationRecommendation[];
    /**
     * Export cost data for analysis
     */
    exportData(format?: 'json' | 'csv'): string;
    private calculateSummaryForEvents;
    private getCostForPeriod;
    private checkBudgetAlerts;
    private hasRecentAlert;
    private addAlert;
    private formatPeriod;
}
//# sourceMappingURL=unified-cost-tracker.d.ts.map