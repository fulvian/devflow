import { SyntheticClient, type ChatMessage, type ChatResponse } from '../client/api-client.js';
export interface AgentRequest {
    readonly title?: string;
    readonly description: string;
    readonly messages: ReadonlyArray<ChatMessage>;
    readonly maxTokens?: number;
    readonly temperature?: number;
    readonly context?: {
        injected?: string;
    };
}
export interface AgentResponse {
    readonly agent: string;
    readonly model: string;
    readonly text: string;
    readonly raw: ChatResponse;
    readonly tokensUsed?: number;
}
export declare abstract class BaseSyntheticAgent {
    protected readonly client: SyntheticClient;
    protected readonly agentName: string;
    constructor(client: SyntheticClient, agentName: string);
    abstract getPreferredModel(): string;
    abstract getSystemPrompt(): string;
    process(request: AgentRequest): Promise<AgentResponse>;
}
export declare class SyntheticCodeAgent extends BaseSyntheticAgent {
    constructor(client: SyntheticClient);
    getPreferredModel(): string;
    getSystemPrompt(): string;
}
export declare class SyntheticReasoningAgent extends BaseSyntheticAgent {
    constructor(client: SyntheticClient);
    getPreferredModel(): string;
    getSystemPrompt(): string;
}
export declare class SyntheticContextAgent extends BaseSyntheticAgent {
    constructor(client: SyntheticClient);
    getPreferredModel(): string;
    getSystemPrompt(): string;
}
//# sourceMappingURL=specialized-agents.d.ts.map