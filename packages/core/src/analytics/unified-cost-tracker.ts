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
    readonly warning: number; // 0.0-1.0 (50% = 0.5)
    readonly critical: number; // 0.0-1.0 (80% = 0.8)
  };
}

export class UnifiedCostTracker {
  private readonly events: CostEvent[] = [];
  private readonly budgetLimits: BudgetLimits;
  private readonly alerts: BudgetAlert[] = [];
  private readonly maxEvents = 10000; // Keep last 10k events

  constructor(budgetLimits: BudgetLimits = {}) {
    this.budgetLimits = {
      alertThresholds: {
        warning: 0.5,
        critical: 0.8,
      },
      ...budgetLimits,
    };
  }

  /**
   * Record a cost event from any platform
   */
  recordEvent(event: Omit<CostEvent, 'timestamp'>): CostEvent {
    const fullEvent: CostEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Check budget alerts
    this.checkBudgetAlerts(fullEvent);

    return fullEvent;
  }

  /**
   * Get cost summary for all platforms or specific platform
   */
  getSummary(
    platform?: string,
    rangeMs: number = 30 * 24 * 60 * 60 * 1000 // Default: 30 days
  ): CostSummary | Record<string, CostSummary> {
    const now = Date.now();
    const relevantEvents = this.events.filter(e => 
      now - e.timestamp <= rangeMs &&
      (!platform || e.platform === platform)
    );

    if (platform) {
      return this.calculateSummaryForEvents(relevantEvents, platform);
    }

    // Return summary for all platforms
    const platforms = [...new Set(relevantEvents.map(e => e.platform))];
    const summaries: Record<string, CostSummary> = {};

    for (const plt of platforms) {
      const platformEvents = relevantEvents.filter(e => e.platform === plt);
      summaries[plt] = this.calculateSummaryForEvents(platformEvents, plt);
    }

    return summaries;
  }

  /**
   * Get cost breakdown by time period
   */
  getCostBreakdown(
    period: 'hour' | 'day' | 'week' | 'month',
    count: number = 7
  ): Array<{
    period: string;
    platforms: Record<string, number>;
    total: number;
  }> {
    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    }[period];

    const breakdown: Array<any> = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const endTime = now - (i * periodMs);
      const startTime = endTime - periodMs;
      
      const periodEvents = this.events.filter(e => 
        e.timestamp >= startTime && e.timestamp < endTime
      );

      const platforms: Record<string, number> = {};
      let total = 0;

      for (const event of periodEvents) {
        platforms[event.platform] = (platforms[event.platform] || 0) + event.costUsd;
        total += event.costUsd;
      }

      breakdown.unshift({
        period: this.formatPeriod(startTime, period),
        platforms,
        total: Number(total.toFixed(4)),
      });
    }

    return breakdown;
  }

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
  } {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;

    const dailyCost = this.getCostForPeriod(now - dayMs, now);
    const weeklyCost = this.getCostForPeriod(now - weekMs, now);
    const monthlyCost = this.getCostForPeriod(now - monthMs, now);

    // Calculate daily burn rate from last 7 days
    const dailyBurn = weeklyCost / 7;
    const monthlyProjection = dailyBurn * 30;

    return {
      limits: this.budgetLimits,
      current: {
        daily: Number(dailyCost.toFixed(4)),
        weekly: Number(weeklyCost.toFixed(4)),
        monthly: Number(monthlyCost.toFixed(4)),
      },
      alerts: this.alerts.slice(-10), // Last 10 alerts
      projections: {
        dailyBurn: Number(dailyBurn.toFixed(4)),
        monthlyProjection: Number(monthlyProjection.toFixed(2)),
      },
    };
  }

  /**
   * Get cost optimization recommendations
   */
  getOptimizationRecommendations(): CostOptimizationRecommendation[] {
    const recommendations: CostOptimizationRecommendation[] = [];
    const summaries = this.getSummary() as Record<string, CostSummary>;

    // Recommendation 1: Platform efficiency analysis
    const platformEfficiency = Object.entries(summaries)
      .map(([platform, summary]) => ({
        platform,
        costPerQualityPoint: summary.avgCostPerRequest / Math.max(0.1, summary.avgQuality),
        avgCost: summary.avgCostPerRequest,
        quality: summary.avgQuality,
      }))
      .sort((a, b) => a.costPerQualityPoint - b.costPerQualityPoint);

    if (platformEfficiency.length > 1) {
      const best = platformEfficiency[0];
      const worst = platformEfficiency[platformEfficiency.length - 1];
      
      if (best && worst && worst.costPerQualityPoint > best.costPerQualityPoint * 2) {
        recommendations.push({
          type: 'platform_switch',
          description: `Consider using ${best.platform} more often instead of ${worst.platform}`,
          estimatedSavings: summaries[worst.platform]?.totalCostUsd ? summaries[worst.platform]!.totalCostUsd * 0.3 : 0,
          confidence: 0.8,
          actionRequired: `Route similar tasks to ${best.platform} first`,
        });
      }
    }

    // Recommendation 2: High-cost request analysis
    const recentHighCostEvents = this.events
      .filter(e => Date.now() - e.timestamp < 7 * 24 * 60 * 60 * 1000) // Last 7 days
      .filter(e => e.costUsd > 0.1) // High cost threshold
      .sort((a, b) => b.costUsd - a.costUsd)
      .slice(0, 5);

    if (recentHighCostEvents.length > 0) {
      const avgHighCost = recentHighCostEvents.reduce((sum, e) => sum + e.costUsd, 0) / recentHighCostEvents.length;
      
      recommendations.push({
        type: 'model_downgrade',
        description: `${recentHighCostEvents.length} high-cost requests detected (avg: $${avgHighCost.toFixed(4)})`,
        estimatedSavings: avgHighCost * recentHighCostEvents.length * 0.4,
        confidence: 0.6,
        actionRequired: 'Review high-cost requests and consider using cheaper models for simpler tasks',
      });
    }

    // Recommendation 3: Synthetic.new flat fee optimization
    const syntheticSummary = summaries['synthetic'];
    if (syntheticSummary && syntheticSummary.totalRequests > 10) {
      const estimatedPayPerUse = syntheticSummary.totalTokens * 0.002;
      const flatFeeCost = 20; // Monthly flat fee
      
      if (estimatedPayPerUse > flatFeeCost * 1.5) {
        recommendations.push({
          type: 'usage_pattern',
          description: 'Synthetic.new flat fee is providing excellent value',
          estimatedSavings: estimatedPayPerUse - flatFeeCost,
          confidence: 0.9,
          actionRequired: 'Continue current usage pattern - great ROI on flat fee',
        });
      } else if (estimatedPayPerUse < flatFeeCost * 0.3) {
        recommendations.push({
          type: 'usage_pattern',
          description: 'Synthetic.new usage is low - consider increasing to maximize flat fee value',
          estimatedSavings: 0,
          confidence: 0.7,
          actionRequired: 'Route more suitable tasks to Synthetic.new to maximize flat fee ROI',
        });
      }
    }

    return recommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  /**
   * Export cost data for analysis
   */
  exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const header = 'timestamp,platform,taskId,model,agent,inputTokens,outputTokens,totalTokens,costUsd,executionTime,quality,success';
      const rows = this.events.map(e => [
        new Date(e.timestamp).toISOString(),
        e.platform,
        e.taskId,
        e.model || '',
        e.agent || '',
        e.inputTokens,
        e.outputTokens,
        e.totalTokens,
        e.costUsd,
        e.executionTime,
        e.quality,
        e.success,
      ].join(','));
      
      return [header, ...rows].join('\n');
    }

    return JSON.stringify({
      exportTime: new Date().toISOString(),
      totalEvents: this.events.length,
      budgetLimits: this.budgetLimits,
      events: this.events,
    }, null, 2);
  }

  // Private helper methods
  private calculateSummaryForEvents(events: CostEvent[], platform: string): CostSummary {
    if (events.length === 0) {
      return {
        platform,
        totalRequests: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        avgCostPerRequest: 0,
        avgCostPerToken: 0,
        avgQuality: 0,
        successRate: 0,
        avgExecutionTime: 0,
      };
    }

    const totalRequests = events.length;
    const totalTokens = events.reduce((sum, e) => sum + e.totalTokens, 0);
    const totalCostUsd = events.reduce((sum, e) => sum + e.costUsd, 0);
    const avgQuality = events.reduce((sum, e) => sum + e.quality, 0) / totalRequests;
    const successCount = events.filter(e => e.success).length;
    const avgExecutionTime = events.reduce((sum, e) => sum + e.executionTime, 0) / totalRequests;

    return {
      platform,
      totalRequests,
      totalTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      avgCostPerRequest: Number((totalCostUsd / totalRequests).toFixed(6)),
      avgCostPerToken: totalTokens > 0 ? Number((totalCostUsd / totalTokens).toFixed(8)) : 0,
      avgQuality: Number(avgQuality.toFixed(3)),
      successRate: Number((successCount / totalRequests).toFixed(3)),
      avgExecutionTime: Number(avgExecutionTime.toFixed(0)),
    };
  }

  private getCostForPeriod(startTime: number, endTime: number): number {
    return this.events
      .filter(e => e.timestamp >= startTime && e.timestamp <= endTime)
      .reduce((sum, e) => sum + e.costUsd, 0);
  }

  private checkBudgetAlerts(event: CostEvent): void {
    const now = Date.now();
    const { alertThresholds } = this.budgetLimits;
    
    if (!alertThresholds) return;

    // Check daily limit
    if (this.budgetLimits.daily) {
      const dailyCost = this.getCostForPeriod(now - 24 * 60 * 60 * 1000, now);
      const percentage = dailyCost / this.budgetLimits.daily;
      
      if (percentage >= alertThresholds.critical && !this.hasRecentAlert('daily', 'critical')) {
        this.addAlert({
          type: 'daily',
          threshold: this.budgetLimits.daily,
          current: dailyCost,
          percentage,
          severity: 'critical',
          message: `Daily budget 80% exceeded: $${dailyCost.toFixed(2)} of $${this.budgetLimits.daily}`,
        });
      } else if (percentage >= alertThresholds.warning && !this.hasRecentAlert('daily', 'warning')) {
        this.addAlert({
          type: 'daily',
          threshold: this.budgetLimits.daily,
          current: dailyCost,
          percentage,
          severity: 'warning',
          message: `Daily budget 50% reached: $${dailyCost.toFixed(2)} of $${this.budgetLimits.daily}`,
        });
      }
    }

    // Check per-request limit
    if (this.budgetLimits.perRequest && event.costUsd > this.budgetLimits.perRequest) {
      this.addAlert({
        type: 'per_request',
        threshold: this.budgetLimits.perRequest,
        current: event.costUsd,
        percentage: event.costUsd / this.budgetLimits.perRequest,
        severity: 'warning',
        message: `High-cost request: $${event.costUsd.toFixed(4)} on ${event.platform}`,
      });
    }
  }

  private hasRecentAlert(type: string, severity: string): boolean {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return this.alerts.some(alert => 
      alert.type === type && 
      alert.severity === severity && 
      alert.timestamp > oneHourAgo
    );
  }

  private addAlert(alertData: Omit<BudgetAlert, 'timestamp'>): void {
    this.alerts.push({
      ...alertData,
      timestamp: Date.now(),
    });

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }
  }

  private formatPeriod(timestamp: number, period: string): string {
    const date = new Date(timestamp);
    
    switch (period) {
      case 'hour':
        return date.toISOString().substring(0, 13) + ':00';
      case 'day':
        return date.toISOString().substring(0, 10);
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `Week of ${weekStart.toISOString().substring(0, 10)}`;
      case 'month':
        return date.toISOString().substring(0, 7);
      default:
        return date.toISOString();
    }
  }
}