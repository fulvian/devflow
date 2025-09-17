/**
 * WebSocket Server for Real-time CCR Monitoring and Alerting
 *
 * This module implements a WebSocket server for broadcasting CCR events,
 * metrics, alerts, and circuit breaker states to connected clients.
 */

import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { createServer, Server as HttpServer } from 'http';
import { CircuitBreakerState, CCREvent, MetricsData, Alert } from './types/ccr-types';
import { EnhancedAutoCCRRunner } from '../orchestration/enhanced-auto-ccr-runner';
import { MetricsCollector } from '../tracking/metrics-collector';

// Interfaces for WebSocket message protocol
interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

interface AuthMessage extends WebSocketMessage {
  type: 'auth';
  payload: {
    token: string;
  };
}

interface SubscribeMessage extends WebSocketMessage {
  type: 'subscribe';
  payload: {
    events: string[];
  };
}

interface UnsubscribeMessage extends WebSocketMessage {
  type: 'unsubscribe';
  payload: {
    events: string[];
  };
}

// Client connection management
interface ClientConnection {
  id: string;
  socket: WebSocket;
  authenticated: boolean;
  subscriptions: Set<string>;
  lastPing: number;
}

/**
 * CCR WebSocket Server
 * Handles real-time broadcasting of CCR events, metrics, and alerts
 */
export class CCRWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private httpServer: HttpServer;
  private clients: Map<string, ClientConnection>;
  private authToken: string;
  private pingInterval: NodeJS.Timeout | null = null;
  private ccrRunner?: EnhancedAutoCCRRunner;
  private metricsCollector?: MetricsCollector;

  constructor(
    port: number,
    authToken: string,
    ccrRunner?: EnhancedAutoCCRRunner,
    metricsCollector?: MetricsCollector
  ) {
    super();
    this.authToken = authToken;
    this.clients = new Map();
    this.ccrRunner = ccrRunner;
    this.metricsCollector = metricsCollector;

    // Create HTTP server and WebSocket server
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupWebSocketHandlers();

    if (this.ccrRunner) {
      this.setupCCRRunnerIntegration();
    }

    if (this.metricsCollector) {
      this.setupMetricsIntegration();
    }

    this.httpServer.listen(port, () => {
      console.log(`CCR WebSocket server listening on port ${port}`);
    });

    // Start ping/pong mechanism for connection health
    this.pingInterval = setInterval(() => this.checkClientHealth(), 30000);
  }

  /**
   * Set up WebSocket connection handlers
   */
  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (socket: WebSocket) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = {
        id: clientId,
        socket,
        authenticated: false,
        subscriptions: new Set(),
        lastPing: Date.now()
      };

      this.clients.set(clientId, client);
      console.log(`New client connected: ${clientId}`);

      // Set up message handler
      socket.on('message', (data: WebSocket.Data) => {
        try {
          this.handleMessage(client, data);
        } catch (error) {
          console.error(`Error handling message from client ${clientId}:`, error);
          this.sendError(client, 'Invalid message format');
        }
      });

      // Set up error handler
      socket.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.disconnectClient(clientId);
      });

      // Set up close handler
      socket.on('close', () => {
        console.log(`Client disconnected: ${clientId}`);
        this.disconnectClient(clientId);
      });

      // Send welcome message
      this.sendWelcome(client);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Set up integration with Enhanced Auto CCR Runner
   */
  private setupCCRRunnerIntegration(): void {
    if (!this.ccrRunner) return;

    this.ccrRunner.on('fallbackTriggered', (event: any) => {
      this.broadcastToSubscribers('fallback', {
        type: 'event',
        payload: event,
        timestamp: Date.now()
      });
    });

    this.ccrRunner.on('circuitBreakerStateChange', (data: any) => {
      this.broadcastToSubscribers('circuit_breaker', {
        type: 'circuit_breaker',
        payload: data,
        timestamp: Date.now()
      });
    });

    this.ccrRunner.on('metricsUpdated', (metrics: any) => {
      this.broadcastToSubscribers('metrics', {
        type: 'metrics',
        payload: metrics,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Set up integration with Metrics Collector
   */
  private setupMetricsIntegration(): void {
    if (!this.metricsCollector) return;

    // Listen for metrics updates from the collector
    setInterval(() => {
      const metrics = this.metricsCollector?.getMetricsData();
      if (metrics) {
        this.broadcastToSubscribers('metrics', {
          type: 'metrics',
          payload: metrics,
          timestamp: Date.now()
        });
      }
    }, 5000); // Broadcast metrics every 5 seconds
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(client: ClientConnection, data: WebSocket.Data): void {
    if (typeof data !== 'string') {
      throw new Error('Invalid message format');
    }

    const message: WebSocketMessage = JSON.parse(data);

    switch (message.type) {
      case 'auth':
        this.handleAuth(client, message as AuthMessage);
        break;
      case 'subscribe':
        this.handleSubscribe(client, message as SubscribeMessage);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(client, message as UnsubscribeMessage);
        break;
      case 'ping':
        this.handlePing(client);
        break;
      default:
        this.sendError(client, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle authentication requests
   */
  private handleAuth(client: ClientConnection, message: AuthMessage): void {
    if (message.payload.token === this.authToken) {
      client.authenticated = true;
      this.sendMessage(client, {
        type: 'auth_success',
        payload: { message: 'Authentication successful' },
        timestamp: Date.now()
      });
      console.log(`Client ${client.id} authenticated successfully`);
    } else {
      this.sendError(client, 'Authentication failed');
      setTimeout(() => {
        client.socket.close(4001, 'Authentication failed');
      }, 1000);
    }
  }

  /**
   * Handle subscription requests
   */
  private handleSubscribe(client: ClientConnection, message: SubscribeMessage): void {
    if (!client.authenticated) {
      this.sendError(client, 'Authentication required');
      return;
    }

    message.payload.events.forEach(event => {
      client.subscriptions.add(event);
    });

    this.sendMessage(client, {
      type: 'subscribe_success',
      payload: {
        message: 'Subscribed to events',
        subscriptions: Array.from(client.subscriptions)
      },
      timestamp: Date.now()
    });

    console.log(`Client ${client.id} subscribed to: ${Array.from(client.subscriptions).join(', ')}`);
  }

  /**
   * Handle unsubscription requests
   */
  private handleUnsubscribe(client: ClientConnection, message: UnsubscribeMessage): void {
    if (!client.authenticated) {
      this.sendError(client, 'Authentication required');
      return;
    }

    message.payload.events.forEach(event => {
      client.subscriptions.delete(event);
    });

    this.sendMessage(client, {
      type: 'unsubscribe_success',
      payload: {
        message: 'Unsubscribed from events',
        subscriptions: Array.from(client.subscriptions)
      },
      timestamp: Date.now()
    });

    console.log(`Client ${client.id} unsubscribed from: ${message.payload.events.join(', ')}`);
  }

  /**
   * Handle ping messages
   */
  private handlePing(client: ClientConnection): void {
    client.lastPing = Date.now();
    this.sendMessage(client, {
      type: 'pong',
      payload: {},
      timestamp: Date.now()
    });
  }

  /**
   * Send a message to a specific client
   */
  private sendMessage(client: ClientConnection, message: WebSocketMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Send an error message to a client
   */
  private sendError(client: ClientConnection, errorMessage: string): void {
    this.sendMessage(client, {
      type: 'error',
      payload: { message: errorMessage },
      timestamp: Date.now()
    });
  }

  /**
   * Send welcome message to new client
   */
  private sendWelcome(client: ClientConnection): void {
    this.sendMessage(client, {
      type: 'welcome',
      payload: {
        message: 'Connected to CCR WebSocket server',
        serverVersion: '1.0.0',
        supportedEvents: ['fallback', 'metrics', 'alert', 'circuit_breaker']
      },
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast message to all subscribers of a specific event type
   */
  private broadcastToSubscribers(eventType: string, message: WebSocketMessage): void {
    this.clients.forEach(client => {
      if (client.authenticated && client.subscriptions.has(eventType)) {
        this.sendMessage(client, message);
      }
    });
  }

  /**
   * Check client connection health and disconnect stale connections
   */
  private checkClientHealth(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds

    this.clients.forEach((client, clientId) => {
      if (now - client.lastPing > timeout) {
        console.log(`Disconnecting stale client: ${clientId}`);
        this.disconnectClient(clientId);
      } else {
        // Send ping to check connection
        this.sendMessage(client, {
          type: 'ping',
          payload: {},
          timestamp: now
        });
      }
    });
  }

  /**
   * Disconnect a client
   */
  private disconnectClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.close();
      }
      this.clients.delete(clientId);
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Broadcast a fallback event to all subscribers
   */
  public broadcastFallbackEvent(event: CCREvent): void {
    this.broadcastToSubscribers('fallback', {
      type: 'event',
      payload: event,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast metrics update to all subscribers
   */
  public broadcastMetrics(metrics: MetricsData): void {
    this.broadcastToSubscribers('metrics', {
      type: 'metrics',
      payload: metrics,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast alert to all subscribers
   */
  public broadcastAlert(alert: Alert): void {
    this.broadcastToSubscribers('alert', {
      type: 'alert',
      payload: alert,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast circuit breaker state change
   */
  public broadcastCircuitBreakerState(serviceId: string, state: CircuitBreakerState): void {
    this.broadcastToSubscribers('circuit_breaker', {
      type: 'circuit_breaker',
      payload: { serviceId, state },
      timestamp: Date.now()
    });
  }

  /**
   * Get server statistics
   */
  public getStats() {
    return {
      connectedClients: this.clients.size,
      authenticatedClients: Array.from(this.clients.values()).filter(c => c.authenticated).length,
      totalSubscriptions: Array.from(this.clients.values()).reduce((acc, c) => acc + c.subscriptions.size, 0)
    };
  }

  /**
   * Close the WebSocket server
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }

      this.clients.forEach(client => {
        client.socket.close();
      });

      this.wss.close(() => {
        this.httpServer.close(() => {
          console.log('CCR WebSocket server closed');
          resolve();
        });
      });
    });
  }
}

export default CCRWebSocketServer;