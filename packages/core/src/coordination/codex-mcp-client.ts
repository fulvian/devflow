import { AgentContext, FallbackChain, FallbackStrategy } from './types';

export interface MCPMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  context?: AgentContext;
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface MCPClientConfig {
  serverUrl: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
}

export class CodexMCPClient {
  private readonly serverUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(config: MCPClientConfig) {
    this.serverUrl = config.serverUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 5000;
    this.maxRetries = config.maxRetries || 3;
  }

  async executeGeminiCommand(command: string, context: AgentContext): Promise<MCPResponse> {
    const message: MCPMessage = {
      id: this.generateId(),
      type: 'GEMINI_COMMAND',
      payload: { command },
      timestamp: Date.now(),
      context
    };

    return this.sendWithRetry(message);
  }

  async sendMetrics(metrics: any, context: AgentContext): Promise<MCPResponse> {
    const message: MCPMessage = {
      id: this.generateId(),
      type: 'METRICS',
      payload: metrics,
      timestamp: Date.now(),
      context
    };

    return this.sendWithRetry(message);
  }

  private async sendWithRetry(message: MCPMessage): Promise<MCPResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.sendRequest(message);
        return response;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: `Failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`
    };
  }

  private async sendRequest(message: MCPMessage): Promise<MCPResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(`${this.serverUrl}/mcp`, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
