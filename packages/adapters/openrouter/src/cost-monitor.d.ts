/**
 * Cost Monitoring System for OpenRouter API
 * Tracks usage, enforces budget limits, and provides cost optimization
 */
export interface CostBudget {
    daily: number;
    weekly: number;
    monthly: number;
}
export interface UsageStats {
    totalCost: number;
    totalTokens: number;
    requestCount: number;
    lastReset: Date;
    costByModel: Map<string, number>;
}
export interface CostAlert {
    type: 'warning' | 'critical' | 'budget_exceeded';
    threshold: number;
    currentCost: number;
    budgetLimit: number;
    timeframe: 'daily' | 'weekly' | 'monthly';
}
export declare class CostMonitor {
    private dailyUsage;
    private weeklyUsage;
    private monthlyUsage;
    private budget;
    private alertThresholds;
    constructor(budget: CostBudget);
    private initUsageStats;
    /**
     * Record API usage and cost
     */
    recordUsage(model: string, tokens: number, cost: number): Promise<CostAlert[]>;
    private updateUsageStats;
    /**
     * Check if we can make a request within budget
     */
    canMakeRequest(estimatedCost: number): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Get current usage statistics
     */
    getCurrentUsage(): {
        daily: UsageStats;
        weekly: UsageStats;
        monthly: UsageStats;
        budget: CostBudget;
    };
    /**
     * Estimate cost for a request
     */
    estimateRequestCost(model: string, estimatedTokens: number): number;
    /**
     * Get recommended model based on budget
     */
    getRecommendedModel(taskComplexity: 'simple' | 'medium' | 'complex'): string;
    private checkBudgetAlerts;
    private persistUsage;
    private loadPersistedUsage;
    private startPeriodicReset;
    private resetDailyUsage;
    /**
     * Update budget limits
     */
    updateBudget(newBudget: Partial<CostBudget>): void;
    /**
     * Generate cost report
     */
    generateReport(): string;
    private getMostExpensiveModel;
}
//# sourceMappingURL=cost-monitor.d.ts.map