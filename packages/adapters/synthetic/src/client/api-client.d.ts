export interface ChatMessage {
    readonly role: 'system' | 'user' | 'assistant';
    readonly content: string;
}
export interface ChatResponse {
    readonly id: string;
    readonly model: string;
    readonly choices: ReadonlyArray<{
        readonly message: {
            readonly role: string;
            readonly content: string;
        };
        readonly finish_reason: string;
    }>;
    readonly usage: {
        readonly prompt_tokens: number;
        readonly completion_tokens: number;
        readonly total_tokens: number;
    };
}
export interface SyntheticClientConfig {
    readonly apiKey: string;
    readonly baseUrl?: string;
    readonly timeoutMs?: number;
}
export declare class SyntheticClient {
    private readonly openai;
    private readonly timeoutMs;
    constructor(config: SyntheticClientConfig);
    chat(params: {
        readonly model: string;
        readonly messages: ReadonlyArray<ChatMessage>;
        readonly maxTokens?: number;
        readonly temperature?: number;
    }): Promise<ChatResponse>;
}
//# sourceMappingURL=api-client.d.ts.map