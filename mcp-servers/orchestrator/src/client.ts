// orchestrator-client.ts
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

/**
 * Model types supported by the orchestrator
 */
export type ModelType = 'sonnet' | 'codex' | 'gemini';

/**
 * Session state interface
 */
export interface SessionState {
  sessionId: string;
  currentModel: ModelType;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  metadata: Record<string, any>;
}

/**
 * MCP Message interface
 */
export interface MCPMessage {
  id: string;
  method: string;
  params?: Record<string, any>;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Role transfer request interface
 */
export interface RoleTransferRequest {
  sessionId: string;
  targetModel: ModelType;
  preserveState: boolean;
}

/**
 * Orchestrator client for managing Claude Code sessions and model switching
 */
export class OrchestratorClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private currentModel: ModelType | null = null;
  private isConnected = false;
  private messageQueue: MCPMessage[] = [];
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private orchestratorUrl: string,
    private apiKey: string
  ) {
    super();
  }

  /**
   * Connect to the orchestrator server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.orchestratorUrl, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        this.ws.on('open', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.processMessageQueue();
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message: MCPMessage = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            this.emit('error', new Error(`Failed to parse message: ${error}`));
          }
        });

        this.ws.on('error', (error) => {
          this.isConnected = false;
          this.emit('error', error);
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          } else {
            reject(error);
          }
        });

        this.ws.on('close', () => {
          this.isConnected = false;
          this.emit('disconnected');
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect to the orchestrator
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect().catch((error) => {
        this.emit('error', new Error(`Reconnection failed: ${error}`));
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  /**
   * Initialize a new Claude Code session
   */
  async initializeSession(metadata?: Record<string, any>): Promise<SessionState> {
    const message: MCPMessage = {
      id: this.generateMessageId(),
      method: 'session.initialize',
      params: {
        metadata
      }
    };

    return this.sendMessage(message);
  }

  /**
   * Transfer role to a different model while preserving session state
   */
  async transferRole(request: RoleTransferRequest): Promise<SessionState> {
    const message: MCPMessage = {
      id: this.generateMessageId(),
      method: 'session.transfer',
      params: request
    };

    return this.sendMessage(message);
  }

  /**
   * Send a message through the current model
   */
  async sendMessageToModel(content: string): Promise<string> {
    if (!this.sessionId) {
      throw new Error('No active session. Initialize session first.');
    }

    const message: MCPMessage = {
      id: this.generateMessageId(),
      method: 'model.message',
      params: {
        sessionId: this.sessionId,
        content,
        model: this.currentModel
      }
    };

    const response = await this.sendMessage(message);
    return response.content;
  }

  /**
   * Get current session state
   */
  async getSessionState(): Promise<SessionState> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    const message: MCPMessage = {
      id: this.generateMessageId(),
      method: 'session.state',
      params: {
        sessionId: this.sessionId
      }
    };

    return this.sendMessage(message);
  }

  /**
   * Close the current session
   */
  async closeSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    const message: MCPMessage = {
      id: this.generateMessageId(),
      method: 'session.close',
      params: {
        sessionId: this.sessionId
      }
    };

    await this.sendMessage(message);
    this.sessionId = null;
    this.currentModel = null;
  }

  /**
   * Send MCP message and wait for response
   */
  private sendMessage(message: MCPMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected && this.ws) {
        this.messageQueue.push(message);
        this.pendingRequests.set(message.id, { resolve, reject });
        return;
      }

      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      this.pendingRequests.set(message.id, { resolve, reject });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        this.pendingRequests.delete(message.id);
        reject(error);
      }
    });
  }

  /**
   * Process queued messages when connection is established
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Handle incoming MCP messages
   */
  private handleMessage(message: MCPMessage): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(`MCP Error: ${message.error.message} (code: ${message.error.code})`));
      } else {
        // Update session context if relevant
        if (message.result?.sessionId) {
          this.sessionId = message.result.sessionId;
        }
        if (message.result?.currentModel) {
          this.currentModel = message.result.currentModel;
        }
        resolve(message.result);
      }
    } else {
      // Handle unsolicited messages (notifications)
      this.handleNotification(message);
    }
  }

  /**
   * Handle notification messages from orchestrator
   */
  private handleNotification(message: MCPMessage): void {
    switch (message.method) {
      case 'session.updated':
        this.emit('sessionUpdated', message.result);
        break;
      case 'model.switched':
        this.currentModel = message.result.newModel;
        this.emit('modelSwitched', message.result);
        break;
      case 'session.timeout':
        this.sessionId = null;
        this.currentModel = null;
        this.emit('sessionTimeout');
        break;
      default:
        this.emit('notification', message);
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close WebSocket connection
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
    this.currentModel = null;
  }

  /**
   * Get current connection status
   */
  getStatus(): {
    connected: boolean;
    sessionId: string | null;
    currentModel: ModelType | null;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      sessionId: this.sessionId,
      currentModel: this.currentModel,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

/**
 * Claude Code session hook for integration with code editors
 */
export class ClaudeCodeSession {
  private client: OrchestratorClient;
  private sessionState: SessionState | null = null;

  constructor(orchestratorUrl: string, apiKey: string) {
    this.client = new OrchestratorClient(orchestratorUrl, apiKey);
  }

  /**
   * Initialize the Claude Code session
   */
  async initialize(metadata?: Record<string, any>): Promise<void> {
    await this.client.connect();
    this.sessionState = await this.client.initializeSession(metadata);

    // Set up event listeners
    this.client.on('modelSwitched', (data) => {
      console.log(`Model switched to: ${data.newModel}`);
      // Could trigger UI updates here
    });

    this.client.on('sessionUpdated', (state) => {
      this.sessionState = state;
    });
  }

  /**
   * Send code to be analyzed by the current model
   */
  async analyzeCode(code: string, language?: string): Promise<string> {
    if (!this.sessionState) {
      throw new Error('Session not initialized');
    }

    const prompt = language
      ? `Analyze this ${language} code:\n\n${code}`
      : `Analyze this code:\n\n${code}`;

    return this.client.sendMessageToModel(prompt);
  }

  /**
   * Transfer to a different model
   */
  async transferToModel(model: ModelType): Promise<void> {
    if (!this.sessionState) {
      throw new Error('Session not initialized');
    }

    const newState = await this.client.transferRole({
      sessionId: this.sessionState.sessionId,
      targetModel: model,
      preserveState: true
    });

    this.sessionState = newState;
  }

  /**
   * Get current session information
   */
  getSessionInfo(): SessionState | null {
    return this.sessionState;
  }

  /**
   * Close the session
   */
  async close(): Promise<void> {
    if (this.sessionState) {
      await this.client.closeSession();
    }
    await this.client.disconnect();
  }
}

// Export types and interfaces
export default {
  OrchestratorClient,
  ClaudeCodeSession,
  type ModelType,
  type SessionState,
  type RoleTransferRequest
};