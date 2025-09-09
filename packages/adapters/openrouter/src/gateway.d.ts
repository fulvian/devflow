import { type ChatMessage, type ChatResponse } from './client/api-client.js';
export interface OpenRouterGatewayConfig {
    readonly apiKey?: string;
    readonly baseUrl?: string;
    readonly timeoutMs?: number;
    readonly maxRetries?: number;
    readonly requestsPerMinute?: number;
    readonly budgetUsd?: number;
    readonly preferredModels?: ReadonlyArray<string>;
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
    readonly raw: ChatResponse;
}
export declare class OpenRouterGateway {
    private readonly client;
    private readonly limiter;
    private readonly models;
    private readonly cost;
    private readonly usage;
    private readonly perf;
    constructor(cfg?: OpenRouterGatewayConfig);
    private mergeContext;
    generate(input: GenerateInput): Promise<GenerateResult>;
}
//# sourceMappingURL=gateway.d.ts.map