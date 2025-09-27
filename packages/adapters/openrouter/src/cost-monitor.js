/**
 * Cost Monitoring System for OpenRouter API
 * Tracks usage, enforces budget limits, and provides cost optimization
 */
export class CostMonitor {
    dailyUsage;
    weeklyUsage;
    monthlyUsage;
    budget;
    alertThresholds = [0.5, 0.8, 0.9, 1.0]; // 50%, 80%, 90%, 100%
    constructor(budget) {
        this.budget = budget;
        this.dailyUsage = this.initUsageStats();
        this.weeklyUsage = this.initUsageStats();
        this.monthlyUsage = this.initUsageStats();
        this.loadPersistedUsage();
        this.startPeriodicReset();
    }
    initUsageStats() {
        return {
            totalCost: 0,
            totalTokens: 0,
            requestCount: 0,
            lastReset: new Date(),
            costByModel: new Map()
        };
    }
    /**
     * Record API usage and cost
     */
    async recordUsage(model, tokens, cost) {
        const alerts = [];
        // Update all timeframe stats
        this.updateUsageStats(this.dailyUsage, model, tokens, cost);
        this.updateUsageStats(this.weeklyUsage, model, tokens, cost);
        this.updateUsageStats(this.monthlyUsage, model, tokens, cost);
        // Check for budget alerts
        alerts.push(...this.checkBudgetAlerts());
        // Persist usage data
        await this.persistUsage();
        return alerts;
    }
    updateUsageStats(stats, model, tokens, cost) {
        stats.totalCost += cost;
        stats.totalTokens += tokens;
        stats.requestCount++;
        const modelCost = stats.costByModel.get(model) || 0;
        stats.costByModel.set(model, modelCost + cost);
    }
    /**
     * Check if we can make a request within budget
     */
    canMakeRequest(estimatedCost) {
        // Check daily budget
        if (this.dailyUsage.totalCost + estimatedCost > this.budget.daily) {
            return {
                allowed: false,
                reason: `Daily budget exceeded. Used: $${this.dailyUsage.totalCost.toFixed(4)}, Limit: $${this.budget.daily}`
            };
        }
        // Check weekly budget
        if (this.weeklyUsage.totalCost + estimatedCost > this.budget.weekly) {
            return {
                allowed: false,
                reason: `Weekly budget exceeded. Used: $${this.weeklyUsage.totalCost.toFixed(4)}, Limit: $${this.budget.weekly}`
            };
        }
        // Check monthly budget
        if (this.monthlyUsage.totalCost + estimatedCost > this.budget.monthly) {
            return {
                allowed: false,
                reason: `Monthly budget exceeded. Used: $${this.monthlyUsage.totalCost.toFixed(4)}, Limit: $${this.budget.monthly}`
            };
        }
        return { allowed: true };
    }
    /**
     * Get current usage statistics
     */
    getCurrentUsage() {
        return {
            daily: { ...this.dailyUsage },
            weekly: { ...this.weeklyUsage },
            monthly: { ...this.monthlyUsage },
            budget: { ...this.budget }
        };
    }
    /**
     * Estimate cost for a request
     */
    estimateRequestCost(model, estimatedTokens) {
        // Model pricing (approximate costs per 1K tokens)
        const modelPricing = {
            'deepseek/deepseek-chat-v3.1:free': { input: 0, output: 0 },
            'deepseek/deepseek-chat-v3.1': { input: 0.00027, output: 0.0011 },
            'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
            'claude-3-sonnet': { input: 0.003, output: 0.015 },
            'claude-3-haiku': { input: 0.00025, output: 0.00125 }
        };
        const pricing = modelPricing[model] || { input: 0.001, output: 0.002 }; // Default pricing
        // Assume roughly equal input/output tokens for estimation
        const inputTokens = estimatedTokens * 0.7;
        const outputTokens = estimatedTokens * 0.3;
        const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000;
        return Math.max(cost, 0.0001); // Minimum cost for tracking
    }
    /**
     * Get recommended model based on budget
     */
    getRecommendedModel(taskComplexity) {
        const remainingDaily = this.budget.daily - this.dailyUsage.totalCost;
        // If budget is very low, prefer free models
        if (remainingDaily < 0.01) {
            return 'deepseek/deepseek-chat-v3.1:free';
        }
        // Model recommendations based on task and budget
        const recommendations = {
            simple: [
                'deepseek/deepseek-chat-v3.1:free',
                'deepseek/deepseek-chat-v3.1',
                'gpt-4o-mini'
            ],
            medium: [
                'deepseek/deepseek-chat-v3.1',
                'gpt-4o-mini',
                'claude-3-haiku'
            ],
            complex: [
                'claude-3-sonnet',
                'gpt-4o-mini',
                'deepseek/deepseek-chat-v3.1'
            ]
        };
        return recommendations[taskComplexity]?.[0] || 'gpt-4o-mini';
    }
    checkBudgetAlerts() {
        const alerts = [];
        // Check daily budget
        for (const threshold of this.alertThresholds) {
            const usage = this.dailyUsage.totalCost / this.budget.daily;
            if (usage >= threshold && usage < (threshold + 0.05)) { // Small buffer to avoid duplicate alerts
                alerts.push({
                    type: threshold >= 1.0 ? 'budget_exceeded' : threshold >= 0.9 ? 'critical' : 'warning',
                    threshold,
                    currentCost: this.dailyUsage.totalCost,
                    budgetLimit: this.budget.daily,
                    timeframe: 'daily'
                });
            }
        }
        return alerts;
    }
    async persistUsage() {
        // In a real implementation, this would save to database or file
        try {
            // Data structure for future database storage
            // const _data = {
            //   daily: this.dailyUsage,
            //   weekly: this.weeklyUsage,
            //   monthly: this.monthlyUsage,
            //   lastUpdate: new Date().toISOString()
            // };
            // For now, just log to console in debug mode
            if (process.env['DEBUG_COSTS'] === 'true') {
                console.log('Cost usage updated:', {
                    dailyCost: this.dailyUsage.totalCost.toFixed(4),
                    weeklyTokens: this.weeklyUsage.totalTokens,
                    monthlyRequests: this.monthlyUsage.requestCount
                });
            }
        }
        catch (error) {
            console.warn('Failed to persist cost usage:', error);
        }
    }
    loadPersistedUsage() {
        // In a real implementation, this would load from database or file
        // For now, start fresh each session
    }
    startPeriodicReset() {
        // Reset daily stats at midnight
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        setTimeout(() => {
            this.resetDailyUsage();
            // Set up daily reset interval
            setInterval(() => {
                this.resetDailyUsage();
            }, 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
    }
    resetDailyUsage() {
        this.dailyUsage = this.initUsageStats();
        console.log('Daily usage stats reset');
    }
    /**
     * Update budget limits
     */
    updateBudget(newBudget) {
        this.budget = { ...this.budget, ...newBudget };
    }
    /**
     * Generate cost report
     */
    generateReport() {
        const daily = this.dailyUsage;
        const budget = this.budget;
        return `
=== DevFlow Cost Report ===
Daily Usage: $${daily.totalCost.toFixed(4)} / $${budget.daily} (${(daily.totalCost / budget.daily * 100).toFixed(1)}%)
Weekly Usage: $${this.weeklyUsage.totalCost.toFixed(4)} / $${budget.weekly} (${(this.weeklyUsage.totalCost / budget.weekly * 100).toFixed(1)}%)
Monthly Usage: $${this.monthlyUsage.totalCost.toFixed(4)} / $${budget.monthly} (${(this.monthlyUsage.totalCost / budget.monthly * 100).toFixed(1)}%)

Today: ${daily.requestCount} requests, ${daily.totalTokens} tokens
Most expensive model: ${this.getMostExpensiveModel(daily.costByModel)}

Remaining daily budget: $${Math.max(0, budget.daily - daily.totalCost).toFixed(4)}
===========================
    `.trim();
    }
    getMostExpensiveModel(costByModel) {
        let maxCost = 0;
        let expensiveModel = 'none';
        for (const [model, cost] of costByModel) {
            if (cost > maxCost) {
                maxCost = cost;
                expensiveModel = model;
            }
        }
        return `${expensiveModel} ($${maxCost.toFixed(4)})`;
    }
}
//# sourceMappingURL=cost-monitor.js.map