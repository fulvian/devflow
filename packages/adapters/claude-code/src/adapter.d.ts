import { ClaudeAdapterConfig, ClaudeMessage, ClaudeResponse } from '@devflow/shared';
export declare class ClaudeCodeAdapter {
    private config;
    private memoryManager;
    private embeddingService;
    private handoffEngine;
    private contextManager;
    private mcpService;
    private fileOps;
    constructor(config: ClaudeAdapterConfig);
    processMessage(message: ClaudeMessage): Promise<ClaudeResponse>;
    searchContext(query: string): Promise<any>;
    saveToMemory(key: string, data: any): Promise<any>;
    retrieveFromMemory(key: string): Promise<any>;
    generateEmbedding(text: string): Promise<any>;
    executeHandoff(task: any): Promise<any>;
    startMCP(): Promise<boolean | null>;
}
//# sourceMappingURL=adapter.d.ts.map