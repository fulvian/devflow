export interface HttpClientConfig {
    readonly baseUrl?: string;
    readonly apiKey?: string;
    readonly timeoutMs?: number;
    readonly retries?: number;
}
export interface ChatMessage {
    readonly role: 'system' | 'user' | 'assistant' | 'tool';
    readonly content: string;
}
export interface ChatRequest {
    readonly model: string;
    readonly messages: ReadonlyArray<ChatMessage>;
    readonly max_tokens?: number;
    readonly temperature?: number;
    readonly top_p?: number;
    readonly response_format?: {
        type: 'text' | 'json_object';
    };
}
export interface Usage {
    readonly total_tokens: number;
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
}
export interface ChatResponseChoice {
    readonly index: number;
    readonly message: ChatMessage;
    readonly finish_reason?: string;
}
export interface ChatResponse {
    readonly id: string;
    readonly model: string;
    readonly created: number;
    readonly choices: ChatResponseChoice[];
    readonly usage?: Usage;
}
export declare class HttpError extends Error {
    readonly status: number;
    readonly body?: unknown | undefined;
    constructor(message: string, status: number, body?: unknown | undefined);
}
export declare class OpenRouterClient {
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly retryOpts;
    private readonly apiKey;
    constructor(cfg?: HttpClientConfig);
    chat(req: ChatRequest): Promise<ChatResponse>;
}
//# sourceMappingURL=api-client.d.ts.map