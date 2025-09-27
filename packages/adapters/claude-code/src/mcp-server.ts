type ClaudeMessage = { content: string; role: 'user' | 'assistant' };
type ClaudeResponse = { content: string; role: 'assistant' };

export class MCPService {
  private isRunning: boolean = false;

  async start(): Promise<boolean> {
    this.isRunning = true;
    return true;
  }

  async stop(): Promise<boolean> {
    this.isRunning = false;
    return true;
  }

  async processMCPMessage(message: ClaudeMessage): Promise<ClaudeResponse> {
    return { content: 'MCP processed response', role: 'assistant' };
  }

  getStatus(): { running: boolean } {
    return { running: this.isRunning };
  }
}