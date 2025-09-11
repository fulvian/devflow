export interface SyntheticCostRecord {
    readonly timestamp: number;
    readonly agent: string;
    readonly model: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly flatFeePortion: number;
}
export interface SyntheticUsageStats {
    readonly totalRequests: number;
    readonly totalTokens: number;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly monthlyCostUsd: number;
    readonly averageCostPerRequest: number;
    readonly averageCostPerToken: number;
}
export declare class SyntheticCostTracker {
    private readonly records;
    private readonly monthlyFeeUsd;
    constructor();
    /**
     * Add usage record for Synthetic.new request
     */
    add(params: {
        agent: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
    }): SyntheticCostRecord;
    /**
     * Get usage statistics for a given time range
     */
    getStats(rangeMs?: number): SyntheticUsageStats;
    /**
     * Get cost breakdown by agent type
     */
    getAgentBreakdown(rangeMs?: number): Record<string, SyntheticUsageStats>;
    /**
     * Get cost comparison with pay-per-use model
     * Useful for ROI analysis
     */
    getPayPerUseSavings(payPerTokenRate?: number): {
        savedUsd: number;
        flatFeeUsd: number;
        payPerUseUsd: number;
        savingsPercent: number;
    };
    /**
     * Check if we're getting good value from the flat fee
     */
    isGoodValue(minTokensForValue?: number): {
        isGoodValue: boolean;
        currentTokens: number;
        requiredTokens: number;
    };
    private calculateFlatFeePortion;
}
//# sourceMappingURL=cost-tracker.d.ts.map