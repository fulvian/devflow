import { type AgentRequest, type AgentResponse } from './agents/specialized-agents.js';
export interface SyntheticGatewayConfig {
    readonly apiKey?: string;
    readonly baseUrl?: string;
    readonly timeoutMs?: number;
}
export type AgentType = 'code' | 'reasoning' | 'context';
export interface TaskClassification {
    readonly type: AgentType;
    readonly confidence: number;
    readonly reasoning?: string;
}
export declare class SyntheticGateway {
    private readonly client;
    private readonly codeAgent;
    private readonly reasoningAgent;
    private readonly contextAgent;
    private readonly costTracker;
    constructor(config?: SyntheticGatewayConfig);
    /**
     * Classify task to determine which specialized agent should handle it
     */
    classifyTask(request: AgentRequest): TaskClassification;
    /**
     * Process request with automatically selected agent
     */
    process(request: AgentRequest): Promise<AgentResponse & {
        classification: TaskClassification;
    }>;
    /**
     * Process request with specific agent
     */
    processWithAgent(agentType: AgentType, request: AgentRequest): Promise<AgentResponse>;
    /**
     * Get available agents info
     */
    getAvailableAgents(): {
        code: {
            name: string;
            model: string;
            specialties: string[];
        };
        reasoning: {
            name: string;
            model: string;
            specialties: string[];
        };
        context: {
            name: string;
            model: string;
            specialties: string[];
        };
    };
    /**
     * Get cost and usage statistics
     */
    getCostStats(rangeMs?: number): import("./analytics/cost-tracker.js").SyntheticUsageStats;
    /**
     * Get agent breakdown
     */
    getAgentBreakdown(rangeMs?: number): Record<string, import("./analytics/cost-tracker.js").SyntheticUsageStats>;
    /**
     * Get cost comparison with pay-per-use models
     */
    getPayPerUseSavings(payPerTokenRate?: number): {
        savedUsd: number;
        flatFeeUsd: number;
        payPerUseUsd: number;
        savingsPercent: number;
    };
    /**
     * Check if we're getting good value from flat fee
     */
    isGoodValue(minTokensForValue?: number): {
        isGoodValue: boolean;
        currentTokens: number;
        requiredTokens: number;
    };
}
//# sourceMappingURL=gateway.d.ts.map