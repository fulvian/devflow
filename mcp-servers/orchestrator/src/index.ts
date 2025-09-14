/**
 * MCP Orchestrator Server Implementation
 * Centralized orchestrator with WebSocket-based MCP tunneling, Redis state sync,
 * and model-agnostic routing for Claude Code session monitoring and delegation
 */

import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

// Types and interfaces
interface SessionState {
  id: string;
  userId: string;
  currentModel: 'sonnet' | 'codex' | 'gemini';
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  usage: {
    tokens: number;
    requests: number;
    startTime: number;
  };
  active: boolean;
  lastActivity: number;
}

interface ModelConfig {
  name: 'sonnet' | 'codex' | 'gemini';
  maxTokens: number;
  maxRequests: number;
  timeout: number;
}

interface MCPMessage {
  type: 'init' | 'message' | 'handoff' | 'status' | 'error';
  sessionId?: string;
  payload?: any;
  timestamp: number;
}

// Configuration
const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  MODELS: {
    sonnet: { name: 'sonnet', maxTokens: 100000, maxRequests: 1000, timeout: 30000 } as ModelConfig,
    codex: { name: 'codex', maxTokens: 200000, maxRequests: 500, timeout: 45000 } as ModelConfig,
    gemini: { name: 'gemini', maxTokens: 300000, maxRequests: 300, timeout: 60000 } as ModelConfig
  } as Record<string, ModelConfig>
};

class MCPOrchestrator {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocket.Server;
  private redis: Redis.Redis;
  private sessions: Map<string, SessionState>;
  private modelConnections: Map<string, WebSocket[]>;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.redis = new Redis(CONFIG.REDIS_URL);
    this.sessions = new Map();
    this.modelConnections = new Map();

    this.setupMiddleware();
    this.setupWebSocketHandling();
    this.setupRedisSubscriptions();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // Health check endpoint
    this.app.get('/health', (_, res) => {
      res.status(200).json({ status: 'ok', timestamp: Date.now() });
    });

    // Session status endpoint
    this.app.get('/sessions/:id', (req, res) => {
      const session = this.sessions.get(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    });
  }

  private setupWebSocketHandling(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = uuidv4();
      console.log(`New WebSocket connection: ${clientId}`);

      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message: MCPMessage = JSON.parse(data.toString());
          await this.handleWebSocketMessage(ws, message, clientId);
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          this.sendErrorMessage(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log(`WebSocket connection closed: ${clientId}`);
        this.handleClientDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });
  }

  private setupRedisSubscriptions(): void {
    // Subscribe to model status updates
    this.redis.subscribe('model:status', (err, count) => {
      if (err) {
        console.error('Redis subscription error:', err);
      } else {
        console.log(`Subscribed to ${count} Redis channels`);
      }
    });

    this.redis.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message);
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, message: MCPMessage, clientId: string): Promise<void> {
    switch (message.type) {
      case 'init':
        await this.initializeSession(ws, message, clientId);
        break;
      case 'message':
        await this.processUserMessage(ws, message);
        break;
      case 'handoff':
        await this.initiateHandoff(ws, message);
        break;
      case 'status':
        this.sendSessionStatus(ws, message.sessionId || '');
        break;
      default:
        this.sendErrorMessage(ws, `Unknown message type: ${message.type}`);
    }
  }

  private async initializeSession(ws: WebSocket, message: MCPMessage, clientId: string): Promise<void> {
    try {
      const userId = message.payload?.userId;
      if (!userId) {
        return this.sendErrorMessage(ws, 'User ID is required for session initialization');
      }

      const sessionId = uuidv4();
      const session: SessionState = {
        id: sessionId,
        userId,
        currentModel: 'sonnet',
        conversationHistory: [],
        usage: {
          tokens: 0,
          requests: 0,
          startTime: Date.now()
        },
        active: true,
        lastActivity: Date.now()
      };

      this.sessions.set(sessionId, session);

      // Store in Redis for persistence
      await this.redis.setex(`session:${sessionId}`, 3600, JSON.stringify(session));

      // Associate WebSocket with session
      (ws as any).sessionId = sessionId;
      (ws as any).clientId = clientId;

      // Send initialization confirmation
      ws.send(JSON.stringify({
        type: 'init',
        sessionId,
        model: session.currentModel,
        timestamp: Date.now()
      } as MCPMessage));

      console.log(`Initialized session ${sessionId} for user ${userId} with model ${session.currentModel}`);
    } catch (error) {
      console.error('Session initialization error:', error);
      this.sendErrorMessage(ws, 'Failed to initialize session');
    }
  }

  private async processUserMessage(ws: WebSocket, message: MCPMessage): Promise<void> {
    const sessionId = (ws as any).sessionId;
    if (!sessionId) {
      return this.sendErrorMessage(ws, 'Session not initialized');
    }

    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      return this.sendErrorMessage(ws, 'Session is inactive');
    }

    try {
      // Update session activity
      session.lastActivity = Date.now();
      session.usage.requests += 1;

      // Add user message to history
      const userMessage = {
        role: 'user' as const,
        content: message.payload?.content || '',
        timestamp: Date.now()
      };
      session.conversationHistory.push(userMessage);

      // Check if handoff is needed
      const shouldHandoff = this.shouldInitiateHandoff(session);
      if (shouldHandoff) {
        await this.initiateModelHandoff(session);
        // Notify client of handoff
        ws.send(JSON.stringify({
          type: 'handoff',
          sessionId,
          payload: {
            fromModel: session.currentModel,
            toModel: this.getNextModel(session.currentModel)
          },
          timestamp: Date.now()
        } as MCPMessage));
      }

      // Process with current model
      const response = await this.processWithModel(session, userMessage.content);

      // Add assistant response to history
      const assistantMessage = {
        role: 'assistant' as const,
        content: response,
        timestamp: Date.now()
      };
      session.conversationHistory.push(assistantMessage);

      // Update usage
      session.usage.tokens += this.estimateTokenCount(userMessage.content + response);

      // Update session in Redis
      await this.redis.setex(`session:${sessionId}`, 3600, JSON.stringify(session));

      // Send response to client
      ws.send(JSON.stringify({
        type: 'message',
        sessionId,
        payload: {
          role: 'assistant',
          content: response,
          model: session.currentModel
        },
        timestamp: Date.now()
      } as MCPMessage));

    } catch (error) {
      console.error(`Error processing message for session ${sessionId}:`, error);
      this.sendErrorMessage(ws, 'Failed to process message');
    }
  }

  private shouldInitiateHandoff(session: SessionState): boolean {
    const modelConfig = CONFIG.MODELS[session.currentModel];

    // Check token limit
    if (session.usage.tokens >= modelConfig.maxTokens * 0.8) {
      return true;
    }

    // Check request limit
    if (session.usage.requests >= modelConfig.maxRequests * 0.8) {
      return true;
    }

    // Check session duration (30 minutes)
    if (Date.now() - session.usage.startTime >= 1800000) {
      return true;
    }

    return false;
  }

  private getNextModel(currentModel: string): 'sonnet' | 'codex' | 'gemini' {
    switch (currentModel) {
      case 'sonnet': return 'codex';
      case 'codex': return 'gemini';
      case 'gemini': return 'sonnet'; // Cycle back to sonnet
      default: return 'sonnet';
    }
  }

  private async initiateModelHandoff(session: SessionState): Promise<void> {
    const nextModel = this.getNextModel(session.currentModel);
    console.log(`Initiating handoff from ${session.currentModel} to ${nextModel} for session ${session.id}`);

    // Update session state
    session.currentModel = nextModel;
    session.usage.tokens = 0; // Reset token count for new model
    session.usage.requests = 0;
    session.usage.startTime = Date.now();

    // Preserve conversation history but potentially truncate for context window
    this.optimizeConversationHistory(session);

    // Update in Redis
    await this.redis.setex(`session:${session.id}`, 3600, JSON.stringify(session));
  }

  private optimizeConversationHistory(session: SessionState): void {
    // Keep last 20 messages to maintain context while managing token limits
    if (session.conversationHistory.length > 20) {
      session.conversationHistory = session.conversationHistory.slice(-20);
    }
  }

  private async processWithModel(session: SessionState, content: string): Promise<string> {
    // In a real implementation, this would call the actual model APIs
    // For demonstration, we'll simulate responses

    const model = session.currentModel;
    console.log(`Processing with ${model} for session ${session.id}`);

    // Simulate model processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulated responses based on model
    const responses: Record<string, string> = {
      sonnet: `Sonnet response to: ${content.substring(0, 50)}...`,
      codex: `Codex response to: ${content.substring(0, 50)}...`,
      gemini: `Gemini response to: ${content.substring(0, 50)}...`
    };

    return responses[model] || `Default response to: ${content.substring(0, 50)}...`;
  }

  private estimateTokenCount(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private async initiateHandoff(ws: WebSocket, message: MCPMessage): Promise<void> {
    const sessionId = (ws as any).sessionId;
    if (!sessionId) {
      return this.sendErrorMessage(ws, 'Session not initialized');
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return this.sendErrorMessage(ws, 'Session not found');
    }

    try {
      const targetModel = message.payload?.targetModel;
      if (!targetModel || !['sonnet', 'codex', 'gemini'].includes(targetModel)) {
        return this.sendErrorMessage(ws, 'Invalid target model specified');
      }

      const previousModel = session.currentModel;
      session.currentModel = targetModel;

      // Reset usage counters for new model
      session.usage.tokens = 0;
      session.usage.requests = 0;
      session.usage.startTime = Date.now();

      // Optimize conversation history
      this.optimizeConversationHistory(session);

      // Update in Redis
      await this.redis.setex(`session:${sessionId}`, 3600, JSON.stringify(session));

      // Notify client of successful handoff
      ws.send(JSON.stringify({
        type: 'handoff',
        sessionId,
        payload: {
          fromModel: previousModel,
          toModel: targetModel,
          status: 'completed'
        },
        timestamp: Date.now()
      } as MCPMessage));

      console.log(`Manual handoff completed for session ${sessionId}: ${previousModel} -> ${targetModel}`);
    } catch (error) {
      console.error(`Handoff error for session ${sessionId}:`, error);
      this.sendErrorMessage(ws, 'Failed to initiate handoff');
    }
  }

  private sendSessionStatus(ws: WebSocket, sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return this.sendErrorMessage(ws, 'Session not found');
    }

    ws.send(JSON.stringify({
      type: 'status',
      sessionId,
      payload: {
        ...session,
        uptime: Date.now() - session.usage.startTime
      },
      timestamp: Date.now()
    } as MCPMessage));
  }

  private sendErrorMessage(ws: WebSocket, message: string): void {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message },
      timestamp: Date.now()
    } as MCPMessage));
  }

  private handleClientDisconnect(clientId: string): void {
    // In a production system, you might want to implement more sophisticated cleanup
    console.log(`Client disconnected: ${clientId}`);
  }

  private async handleRedisMessage(channel: string, message: string): Promise<void> {
    try {
      switch (channel) {
        case 'model:status':
          // Handle model status updates
          console.log('Model status update:', message);
          break;
        default:
          console.log(`Unhandled Redis message on channel ${channel}:`, message);
      }
    } catch (error) {
      console.error('Error handling Redis message:', error);
    }
  }

  public async start(): Promise<void> {
    this.server.listen(CONFIG.PORT, () => {
      console.log(`MCP Orchestrator Server listening on port ${CONFIG.PORT}`);
    });

    // Periodic session cleanup
    setInterval(() => this.cleanupInactiveSessions(), 60000);
  }

  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > inactiveThreshold) {
        console.log(`Cleaning up inactive session: ${sessionId}`);
        this.sessions.delete(sessionId);
        await this.redis.del(`session:${sessionId}`);
      }
    }
  }

  public async stop(): Promise<void> {
    this.wss.close();
    this.server.close();
    await this.redis.quit();
  }
}

// Initialize and start the orchestrator
const orchestrator = new MCPOrchestrator();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down MCP Orchestrator...');
  await orchestrator.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down MCP Orchestrator...');
  await orchestrator.stop();
  process.exit(0);
});

// Start the server
orchestrator.start().catch(error => {
  console.error('Failed to start MCP Orchestrator:', error);
  process.exit(1);
});

export default MCPOrchestrator;