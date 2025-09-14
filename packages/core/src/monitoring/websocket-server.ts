/**
 * Real-time Monitoring WebSocket Server
 * 
 * This module implements a WebSocket server for streaming real-time monitoring data
 * to multiple clients with authentication, compression, and performance optimizations.
 * 
 * Features:
 * - Client connection management
 * - Authenticated connections
 * - Message compression
 * - Data broadcasting
 * - Performance optimizations
 * - Error handling
 */

import WebSocket, { WebSocketServer } from 'ws';
import { createHash } from 'crypto';
import { inflate, deflate } from 'zlib';
import { promisify } from 'util';

// Promisify compression functions for easier async usage
const inflateAsync = promisify(inflate);
const deflateAsync = promisify(deflate);

// Types
interface ClientMetadata {
  id: string;
  authenticated: boolean;
  connectedAt: Date;
  lastPing: Date;
  subscriptions: Set<string>;
}

interface MonitoringData {
  timestamp: number;
  metric: string;
  value: number | string | boolean;
  tags?: Record<string, string>;
}

interface AuthMessage {
  type: 'auth';
  token: string;
}

interface SubscribeMessage {
  type: 'subscribe';
  channels: string[];
}

interface UnsubscribeMessage {
  type: 'unsubscribe';
  channels: string[];
}

type ClientMessage = AuthMessage | SubscribeMessage | UnsubscribeMessage;

// Configuration
const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT || '8080', 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'default-secret-token';
const PING_INTERVAL = 30000; // 30 seconds
const CLIENT_TIMEOUT = 90000; // 90 seconds

/**
 * Monitoring WebSocket Server Class
 */
class MonitoringWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientMetadata> = new Map();
  private broadcastQueue: MonitoringData[] = [];
  private isBroadcasting = false;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(port: number) {
    this.wss = new WebSocketServer({ 
      port,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });

    this.setupServer();
    this.setupPingInterval();
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleNewConnection(ws, request);
    });

    this.wss.on('error', (error: Error) => {
      console.error('WebSocket server error:', error);
    });

    console.log(`Monitoring WebSocket server started on port ${WEBSOCKET_PORT}`);
  }

  /**
   * Handle new client connections
   */
  private handleNewConnection(ws: WebSocket, request: any): void {
    const clientId = this.generateClientId(request.socket.remoteAddress);
    
    // Initialize client metadata
    const clientMetadata: ClientMetadata = {
      id: clientId,
      authenticated: false,
      connectedAt: new Date(),
      lastPing: new Date(),
      subscriptions: new Set()
    };

    this.clients.set(ws, clientMetadata);

    console.log(`New client connected: ${clientId}`);

    // Setup message handler
    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(ws, data);
    });

    // Setup close handler
    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(ws, code, reason);
    });

    // Setup error handler
    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(ws, 1011, Buffer.from('Internal error'));
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'welcome',
      clientId,
      timestamp: Date.now(),
      message: 'Connected to monitoring server'
    });
  }

  /**
   * Handle incoming messages from clients
   */
  private async handleMessage(ws: WebSocket, data: WebSocket.Data): Promise<void> {
    const clientMetadata = this.clients.get(ws);
    if (!clientMetadata) return;

    try {
      let message: ClientMessage;
      
      // Handle compressed messages
      if (data instanceof Buffer) {
        const inflated = await inflateAsync(data);
        message = JSON.parse(inflated.toString());
      } else if (typeof data === 'string') {
        message = JSON.parse(data);
      } else {
        throw new Error('Unsupported message format');
      }

      switch (message.type) {
        case 'auth':
          this.handleAuthMessage(ws, message);
          break;
        case 'subscribe':
          if (clientMetadata.authenticated) {
            this.handleSubscribeMessage(ws, message);
          } else {
            this.sendErrorMessage(ws, 'Authentication required');
          }
          break;
        case 'unsubscribe':
          this.handleUnsubscribeMessage(ws, message);
          break;
        default:
          this.sendErrorMessage(ws, 'Unknown message type');
      }
    } catch (error) {
      console.error(`Error processing message from client ${clientMetadata.id}:`, error);
      this.sendErrorMessage(ws, 'Invalid message format');
    }
  }

  /**
   * Handle authentication messages
   */
  private handleAuthMessage(ws: WebSocket, message: AuthMessage): void {
    const clientMetadata = this.clients.get(ws);
    if (!clientMetadata) return;

    if (message.token === AUTH_TOKEN) {
      clientMetadata.authenticated = true;
      this.sendMessage(ws, {
        type: 'auth_success',
        message: 'Authentication successful'
      });
      console.log(`Client ${clientMetadata.id} authenticated`);
    } else {
      this.sendErrorMessage(ws, 'Authentication failed');
      setTimeout(() => {
        ws.close(1008, 'Authentication failed');
      }, 1000);
    }
  }

  /**
   * Handle subscription messages
   */
  private handleSubscribeMessage(ws: WebSocket, message: SubscribeMessage): void {
    const clientMetadata = this.clients.get(ws);
    if (!clientMetadata) return;

    message.channels.forEach(channel => {
      clientMetadata.subscriptions.add(channel);
    });

    this.sendMessage(ws, {
      type: 'subscribed',
      channels: Array.from(clientMetadata.subscriptions),
      message: `Subscribed to ${message.channels.length} channels`
    });

    console.log(`Client ${clientMetadata.id} subscribed to channels: ${message.channels.join(', ')}`);
  }

  /**
   * Handle unsubscription messages
   */
  private handleUnsubscribeMessage(ws: WebSocket, message: UnsubscribeMessage): void {
    const clientMetadata = this.clients.get(ws);
    if (!clientMetadata) return;

    message.channels.forEach(channel => {
      clientMetadata.subscriptions.delete(channel);
    });

    this.sendMessage(ws, {
      type: 'unsubscribed',
      channels: message.channels,
      message: `Unsubscribed from ${message.channels.length} channels`
    });

    console.log(`Client ${clientMetadata.id} unsubscribed from channels: ${message.channels.join(', ')}`);
  }

  /**
   * Handle client disconnections
   */
  private handleDisconnection(ws: WebSocket, code: number, reason: Buffer): void {
    const clientMetadata = this.clients.get(ws);
    if (clientMetadata) {
      console.log(`Client ${clientMetadata.id} disconnected. Code: ${code}, Reason: ${reason.toString()}`);
      this.clients.delete(ws);
    }

    // Clean up event listeners
    ws.removeAllListeners();
  }

  /**
   * Send a message to a specific client
   */
  private async sendMessage(ws: WebSocket, message: any): Promise<void> {
    if (ws.readyState !== WebSocket.OPEN) return;

    try {
      const messageString = JSON.stringify(message);
      
      // Compress large messages
      if (messageString.length > 1024) {
        const compressed = await deflateAsync(messageString);
        ws.send(compressed);
      } else {
        ws.send(messageString);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  /**
   * Send an error message to a client
   */
  private sendErrorMessage(ws: WebSocket, message: string): void {
    this.sendMessage(ws, {
      type: 'error',
      message,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast monitoring data to all subscribed clients
   */
  private async broadcastData(data: MonitoringData): Promise<void> {
    // Add to broadcast queue for batching
    this.broadcastQueue.push(data);
    
    // If already broadcasting, return early
    if (this.isBroadcasting) return;
    
    this.isBroadcasting = true;
    
    try {
      // Process queue in batches to prevent blocking
      while (this.broadcastQueue.length > 0) {
        const batch = this.broadcastQueue.splice(0, 50); // Process 50 items at a time
        const messageString = JSON.stringify({ type: 'data', data: batch });
        
        // Compress the batched message
        const compressedMessage = await deflateAsync(messageString);
        
        // Send to all authenticated clients with matching subscriptions
        for (const [ws, metadata] of this.clients.entries()) {
          if (ws.readyState === WebSocket.OPEN && metadata.authenticated) {
            // Check if client is subscribed to any of the metrics in this batch
            const shouldSend = batch.some(item => 
              metadata.subscriptions.has(item.metric) || 
              metadata.subscriptions.has('all')
            );
            
            if (shouldSend) {
              try {
                ws.send(compressedMessage);
              } catch (error) {
                console.error(`Error sending data to client ${metadata.id}:`, error);
              }
            }
          }
        }
        
        // Small delay to prevent blocking the event loop
        if (this.broadcastQueue.length > 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
    } finally {
      this.isBroadcasting = false;
    }
  }

  /**
   * Setup periodic ping to clients to detect stale connections
   */
  private setupPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      
      for (const [ws, metadata] of this.clients.entries()) {
        // Check if client is still connected
        if (ws.readyState !== WebSocket.OPEN) {
          this.handleDisconnection(ws, 1001, Buffer.from('Client disconnected'));
          continue;
        }
        
        // Check for timeout
        const timeSinceLastPing = now.getTime() - metadata.lastPing.getTime();
        if (timeSinceLastPing > CLIENT_TIMEOUT) {
          console.log(`Client ${metadata.id} timed out`);
          ws.close(1000, 'Connection timeout');
          continue;
        }
        
        // Send ping
        try {
          ws.ping();
          metadata.lastPing = now;
        } catch (error) {
          console.error(`Error pinging client ${metadata.id}:`, error);
        }
      }
    }, PING_INTERVAL);
  }

  /**
   * Generate a unique client ID based on IP and timestamp
   */
  private generateClientId(ip: string | undefined): string {
    const timestamp = Date.now().toString();
    const hash = createHash('sha256');
    hash.update(`${ip || 'unknown'}-${timestamp}`);
    return hash.digest('hex').substring(0, 16);
  }

  /**
   * Add monitoring data to be broadcasted
   */
  public addData(data: MonitoringData | MonitoringData[]): void {
    const dataArray = Array.isArray(data) ? data : [data];
    dataArray.forEach(item => this.broadcastData(item));
  }

  /**
   * Get server statistics
   */
  public getStats(): {
    connectedClients: number;
    authenticatedClients: number;
    totalConnections: number;
  } {
    let authenticatedClients = 0;
    
    for (const metadata of this.clients.values()) {
      if (metadata.authenticated) {
        authenticatedClients++;
      }
    }
    
    return {
      connectedClients: this.clients.size,
      authenticatedClients,
      totalConnections: this.clients.size
    };
  }

  /**
   * Gracefully shutdown the server
   */
  public async shutdown(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all client connections
    for (const ws of this.clients.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, 'Server shutting down');
      }
    }

    // Close server
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log('Monitoring WebSocket server closed');
        resolve();
      });
    });
  }
}

// Create and export server instance
const monitoringServer = new MonitoringWebSocketServer(WEBSOCKET_PORT);

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  await monitoringServer.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully');
  await monitoringServer.shutdown();
  process.exit(0);
});

// Export for use in other modules
export { MonitoringWebSocketServer, monitoringServer };
export type { MonitoringData, ClientMetadata };