export interface SyntheticCostRecord {
  readonly timestamp: number;
  readonly agent: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly flatFeePortion: number; // Portion of $20/month fee allocated
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

export class SyntheticCostTracker {
  private readonly records: SyntheticCostRecord[] = [];
  private readonly monthlyFeeUsd = 20; // $20/month flat fee

  constructor() {
    // Initialization complete
  }

  /**
   * Add usage record for Synthetic.new request
   */
  add(params: {
    agent: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): SyntheticCostRecord {
    // For flat fee model, we allocate cost based on usage within the month
    // This gives us cost awareness even with flat pricing
    const record: SyntheticCostRecord = {
      timestamp: Date.now(),
      agent: params.agent,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      flatFeePortion: this.calculateFlatFeePortion(params.inputTokens + params.outputTokens),
    };

    this.records.push(record);
    return record;
  }

  /**
   * Get usage statistics for a given time range
   */
  getStats(rangeMs = 30 * 24 * 60 * 60 * 1000): SyntheticUsageStats { // Default 30 days
    const now = Date.now();
    const recent = this.records.filter(r => now - r.timestamp <= rangeMs);

    if (recent.length === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        monthlyCostUsd: 0,
        averageCostPerRequest: 0,
        averageCostPerToken: 0,
      };
    }

    const totalRequests = recent.length;
    const inputTokens = recent.reduce((sum, r) => sum + r.inputTokens, 0);
    const outputTokens = recent.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalTokens = inputTokens + outputTokens;

    // For monthly cost calculation
    const daysInRange = rangeMs / (24 * 60 * 60 * 1000);
    const monthlyCostUsd = daysInRange >= 30 ? this.monthlyFeeUsd : (this.monthlyFeeUsd * daysInRange / 30);

    return {
      totalRequests,
      totalTokens,
      inputTokens,
      outputTokens,
      monthlyCostUsd: Number(monthlyCostUsd.toFixed(2)),
      averageCostPerRequest: totalRequests > 0 ? Number((monthlyCostUsd / totalRequests).toFixed(6)) : 0,
      averageCostPerToken: totalTokens > 0 ? Number((monthlyCostUsd / totalTokens).toFixed(8)) : 0,
    };
  }

  /**
   * Get cost breakdown by agent type
   */
  getAgentBreakdown(rangeMs = 30 * 24 * 60 * 60 * 1000): Record<string, SyntheticUsageStats> {
    const now = Date.now();
    const recent = this.records.filter(r => now - r.timestamp <= rangeMs);
    const agentGroups = new Map<string, SyntheticCostRecord[]>();

    // Group by agent
    for (const record of recent) {
      if (!agentGroups.has(record.agent)) {
        agentGroups.set(record.agent, []);
      }
      agentGroups.get(record.agent)!.push(record);
    }

    const breakdown: Record<string, SyntheticUsageStats> = {};
    const totalRequests = recent.length;

    for (const [agent, records] of agentGroups) {
      const agentRequests = records.length;
      const inputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
      const outputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
      const totalTokens = inputTokens + outputTokens;

      // Proportional cost allocation based on requests
      const daysInRange = rangeMs / (24 * 60 * 60 * 1000);
      const baseCost = daysInRange >= 30 ? this.monthlyFeeUsd : (this.monthlyFeeUsd * daysInRange / 30);
      const agentCost = totalRequests > 0 ? baseCost * (agentRequests / totalRequests) : 0;

      breakdown[agent] = {
        totalRequests: agentRequests,
        totalTokens,
        inputTokens,
        outputTokens,
        monthlyCostUsd: Number(agentCost.toFixed(2)),
        averageCostPerRequest: agentRequests > 0 ? Number((agentCost / agentRequests).toFixed(6)) : 0,
        averageCostPerToken: totalTokens > 0 ? Number((agentCost / totalTokens).toFixed(8)) : 0,
      };
    }

    return breakdown;
  }

  /**
   * Get cost comparison with pay-per-use model
   * Useful for ROI analysis
   */
  getPayPerUseSavings(payPerTokenRate = 0.002): { savedUsd: number; flatFeeUsd: number; payPerUseUsd: number; savingsPercent: number } {
    const stats = this.getStats();
    const payPerUseUsd = stats.totalTokens * payPerTokenRate;
    const flatFeeUsd = stats.monthlyCostUsd;
    const savedUsd = payPerUseUsd - flatFeeUsd;
    const savingsPercent = payPerUseUsd > 0 ? (savedUsd / payPerUseUsd) * 100 : 0;

    return {
      savedUsd: Number(savedUsd.toFixed(2)),
      flatFeeUsd,
      payPerUseUsd: Number(payPerUseUsd.toFixed(2)),
      savingsPercent: Number(savingsPercent.toFixed(1)),
    };
  }

  /**
   * Check if we're getting good value from the flat fee
   */
  isGoodValue(minTokensForValue = 50000): { isGoodValue: boolean; currentTokens: number; requiredTokens: number } {
    const stats = this.getStats();
    return {
      isGoodValue: stats.totalTokens >= minTokensForValue,
      currentTokens: stats.totalTokens,
      requiredTokens: minTokensForValue,
    };
  }

  private calculateFlatFeePortion(tokens: number): number {
    // Simple allocation: divide monthly fee by estimated monthly token usage
    // This is just for cost awareness, not actual billing
    const estimatedMonthlyTokens = 1000000; // 1M tokens/month assumption
    return (this.monthlyFeeUsd / estimatedMonthlyTokens) * tokens;
  }
}