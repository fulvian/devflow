export interface PlatformGateway {
    generate(input: GenerateInput): Promise<GenerateResult>;
    getCostStats?(): any;
    getAvailableAgents?(): any;
}
export interface GenerateInput {
    readonly title?: string;
    readonly description: string;
    readonly messages: ReadonlyArray<ChatMessage>;
    readonly maxTokens?: number;
    readonly temperature?: number;
    readonly context?: {
        injected?: string;
    };
}
export interface GenerateResult {
    readonly model: string;
    readonly text: string;
    readonly raw: any;
}
export interface ChatMessage {
    readonly role: 'system' | 'user' | 'assistant';
    readonly content: string;
}
export interface TaskRequest {
    readonly id: string;
    readonly title?: string;
    readonly description: string;
    readonly context?: string;
    readonly priority: 'low' | 'medium' | 'high' | 'critical';
    readonly complexity: 'simple' | 'medium' | 'complex';
    readonly domain: 'code' | 'reasoning' | 'analysis' | 'documentation';
}
export interface TaskResult {
    readonly taskId: string;
    readonly platform: 'openai-codex' | 'synthetic' | 'openrouter';
    readonly agent?: string;
    readonly model: string;
    readonly content: string;
    readonly tokensUsed: number;
    readonly costUsd: number;
    readonly executionTime: number;
    readonly confidence: number;
}
export interface PlatformStatus {
    readonly available: boolean;
    readonly lastError?: string;
    readonly usageLimit?: {
        readonly current: number;
        readonly limit: number;
        readonly resetTime?: number;
    };
}
export interface MultiPlatformConfig {
    readonly synthetic?: {
        enabled: boolean;
        apiKey?: string;
        preferredAgents?: any;
    };
    readonly openRouter?: {
        enabled: boolean;
        apiKey?: string;
        budgetUsd?: number;
        preferredModels?: string[];
    };
    readonly fallbackChain?: ('synthetic' | 'openrouter')[];
    readonly costThresholds?: {
        maxCostPerTask?: number;
        dailyBudget?: number;
    };
}
//# sourceMappingURL=platform.d.ts.map