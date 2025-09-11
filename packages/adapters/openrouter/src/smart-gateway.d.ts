/**
 * Smart OpenRouter Gateway with Cost Monitoring and DeepSeek Fallback
 * Integrates cost tracking, budget enforcement, and intelligent model selection
 */
import { type OpenRouterGatewayConfig, type GenerateInput, type GenerateResult } from './gateway.js';
import { type CostBudget, type CostAlert } from './cost-monitor.js';
export interface SmartGatewayConfig extends OpenRouterGatewayConfig {
    budget: CostBudget;
    enableCostMonitoring: boolean;
    preferFreeModels: boolean;
    alertCallback?: (alerts: CostAlert[]) => void;
}
export interface SmartGenerateResult extends GenerateResult {
    actualCost: number;
    budgetRemaining: number;
    modelSelected: string;
    fallbackUsed: boolean;
}
export declare class SmartOpenRouterGateway {
    private client;
    private costMonitor;
    private config;
    constructor(config: SmartGatewayConfig);
    /**
     * Generate with smart model selection and cost control
     */
    smartGenerate(input: GenerateInput & {
        taskComplexity?: 'simple' | 'medium' | 'complex';
        maxCost?: number;
    }): Promise<SmartGenerateResult>;
    /**
     * DeepSeek fallback strategy: free -> paid
     */
    private tryDeepSeekFallback;
    /**
     * Execute request with specific model
     */
    private executeWithModel;
    /**
     * Classify task complexity for model selection
     */
    private classifyTaskComplexity;
    /**
     * Get optimal model based on task complexity and budget
     */
    private getOptimalModel;
    /**
     * Estimate tokens for a text input
     */
    private estimateTokens;
    /**
     * Calculate actual cost based on model and tokens
     */
    private calculateActualCost;
    /**
     * Get remaining budget
     */
    private getBudgetRemaining;
    /**
     * Generate cost report
     */
    generateCostReport(): string;
    /**
     * Update budget limits
     */
    updateBudget(newBudget: Partial<CostBudget>): void;
    /**
     * Get current usage statistics
     */
    getUsageStats(): {
        daily: import("./cost-monitor.js").UsageStats;
        weekly: import("./cost-monitor.js").UsageStats;
        monthly: import("./cost-monitor.js").UsageStats;
        budget: CostBudget;
    } | null;
    /**
     * Test model connectivity
     */
    testModels(): Promise<Record<string, {
        success: boolean;
        responseTime: number;
        error?: string;
    }>>;
}
//# sourceMappingURL=smart-gateway.d.ts.map