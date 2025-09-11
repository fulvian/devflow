import { ClaudeMessage, ClaudeResponse } from '@devflow/shared';
export declare class MCPService {
    private isRunning;
    start(): Promise<boolean>;
    stop(): Promise<boolean>;
    processMCPMessage(message: ClaudeMessage): Promise<ClaudeResponse>;
    getStatus(): {
        running: boolean;
    };
}
//# sourceMappingURL=mcp-server.d.ts.map