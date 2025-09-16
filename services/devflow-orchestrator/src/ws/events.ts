/**
 * WebSocket Events Module for DevFlow Orchestrator
 * 
 * This module provides WebSocket event handling capabilities including:
 * - Event emitter patterns for real-time communication
 * - Memory-related events monitoring
 * - Session lifecycle events
 * - Task execution events
 * - Event broadcasting across connected clients
 */

// Interfaces for event payloads
export interface WebSocketEvent<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  source?: string;
}

export interface MemoryEventPayload {
  used: number;
  total: number;
  percentage: number;
  threshold?: number;
}

export interface SessionEventPayload {
  sessionId: string;
  userId?: string;
  action: 'created' | 'updated' | 'destroyed' | 'expired';
  metadata?: Record<string, any>;
}

export interface TaskEventPayload {
  taskId: string;
  workflowId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  result?: any;
  error?: string;
}

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  userId?: string;
  connectedAt: number;
}

// Event types enumeration
export enum EventType {
  MEMORY_USAGE = 'memory:usage',
  MEMORY_WARNING = 'memory:warning',
  MEMORY_CRITICAL = 'memory:critical',
  
  SESSION_CREATED = 'session:created',
  SESSION_UPDATED = 'session:updated',
  SESSION_DESTROYED = 'session:destroyed',
  SESSION_EXPIRED = 'session:expired',
  
  TASK_QUEUED = 'task:queued',
  TASK_STARTED = 'task:started',
  TASK_PROGRESS = 'task:progress',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',
  TASK_CANCELLED = 'task:cancelled',
  
  CLIENT_CONNECTED = 'client:connected',
  CLIENT_DISCONNECTED = 'client:disconnected',
}

// Event emitter interface
export interface EventEmitter {
  on(event: string, listener: (data: WebSocketEvent) => void): void;
  off(event: string, listener: (data: WebSocketEvent) => void): void;
  emit(event: string, data: WebSocketEvent): void;
}

// Main WebSocket events manager
export class WebSocketEventManager implements EventEmitter {
  private clients: Map<string, ClientConnection> = new Map();
  private listeners: Map<string, Array<(data: WebSocketEvent) => void>> = new Map();
  private eventQueue: WebSocketEvent[] = [];
  private isProcessingQueue = false;

  /**
   * Add a client connection
   */
  addClient(client: ClientConnection): void {
    this.clients.set(client.id, client);
    this.emitSystemEvent(EventType.CLIENT_CONNECTED, {
      clientId: client.id,
      connectedAt: client.connectedAt,
    });
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      this.emitSystemEvent(EventType.CLIENT_DISCONNECTED, { clientId });
    }
  }

  /**
   * Get all connected clients
   */
  getClients(): ClientConnection[] {
    return Array.from(this.clients.values());
  }

  /**
   * Register an event listener
   */
  on(event: string, listener: (data: WebSocketEvent) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  /**
   * Remove an event listener
   */
  off(event: string, listener: (data: WebSocketEvent) => void): void {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event)!;
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  emit(event: string, data: WebSocketEvent): void {
    // Add to queue for processing
    this.eventQueue.push(data);
    this.processEventQueue();
  }

  /**
   * Process the event queue
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift()!;
        await this.broadcastEvent(event);
        await this.notifyListeners(event);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  private async broadcastEvent(event: WebSocketEvent): Promise<void> {
    const disconnectedClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      try {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.send(JSON.stringify(event));
        } else {
          disconnectedClients.push(clientId);
        }
      } catch (error) {
        console.error(`Failed to send event to client ${clientId}:`, error);
        disconnectedClients.push(clientId);
      }
    }

    // Clean up disconnected clients
    for (const clientId of disconnectedClients) {
      this.removeClient(clientId);
    }
  }

  /**
   * Notify local listeners
   */
  private async notifyListeners(event: WebSocketEvent): Promise<void> {
    const listeners = this.listeners.get(event.type) || [];
    for (const listener of listeners) {
      try {
        await listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    }
  }

  /**
   * Emit a system event with standardized structure
   */
  private emitSystemEvent(type: EventType, payload: Record<string, any>): void {
    const event: WebSocketEvent = {
      id: this.generateEventId(),
      type,
      payload,
      timestamp: Date.now(),
      source: 'system',
    };

    this.emit(type, event);
  }

  /**
   * Emit a memory-related event
   */
  emitMemoryEvent(type: EventType.MEMORY_USAGE | EventType.MEMORY_WARNING | EventType.MEMORY_CRITICAL, 
                  payload: MemoryEventPayload): void {
    const event: WebSocketEvent<MemoryEventPayload> = {
      id: this.generateEventId(),
      type,
      payload,
      timestamp: Date.now(),
      source: 'memory-monitor',
    };

    this.emit(type, event);
  }

  /**
   * Emit a session-related event
   */
  emitSessionEvent(type: EventType, payload: SessionEventPayload): void {
    const event: WebSocketEvent<SessionEventPayload> = {
      id: this.generateEventId(),
      type,
      payload,
      timestamp: Date.now(),
      source: 'session-manager',
    };

    this.emit(type, event);
  }

  /**
   * Emit a task-related event
   */
  emitTaskEvent(type: EventType, payload: TaskEventPayload): void {
    const event: WebSocketEvent<TaskEventPayload> = {
      id: this.generateEventId(),
      type,
      payload,
      timestamp: Date.now(),
      source: 'task-orchestrator',
    };

    this.emit(type, event);
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close all connections and clean up
   */
  destroy(): void {
    for (const client of this.clients.values()) {
      try {
        client.socket.close();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    this.clients.clear();
    this.listeners.clear();
    this.eventQueue = [];
  }
}

// Singleton instance for global event management
export const globalEventManager = new WebSocketEventManager();

// Helper functions for common event emissions
export const emitMemoryUsage = (payload: MemoryEventPayload): void => {
  globalEventManager.emitMemoryEvent(EventType.MEMORY_USAGE, payload);
};

export const emitMemoryWarning = (payload: MemoryEventPayload): void => {
  globalEventManager.emitMemoryEvent(EventType.MEMORY_WARNING, payload);
};

export const emitMemoryCritical = (payload: MemoryEventPayload): void => {
  globalEventManager.emitMemoryEvent(EventType.MEMORY_CRITICAL, payload);
};

export const emitSessionCreated = (payload: SessionEventPayload): void => {
  globalEventManager.emitSessionEvent(EventType.SESSION_CREATED, payload);
};

export const emitSessionUpdated = (payload: SessionEventPayload): void => {
  globalEventManager.emitSessionEvent(EventType.SESSION_UPDATED, payload);
};

export const emitSessionDestroyed = (payload: SessionEventPayload): void => {
  globalEventManager.emitSessionEvent(EventType.SESSION_DESTROYED, payload);
};

export const emitSessionExpired = (payload: SessionEventPayload): void => {
  globalEventManager.emitSessionEvent(EventType.SESSION_EXPIRED, payload);
};

export const emitTaskQueued = (payload: TaskEventPayload): void => {
  globalEventManager.emitTaskEvent(EventType.TASK_QUEUED, payload);
};

export const emitTaskStarted = (payload: TaskEventPayload): void => {
  globalEventManager.emitTaskEvent(EventType.TASK_STARTED, payload);
};

export const emitTaskProgress = (payload: TaskEventPayload): void => {
  globalEventManager.emitTaskEvent(EventType.TASK_PROGRESS, payload);
};

export const emitTaskCompleted = (payload: TaskEventPayload): void => {
  globalEventManager.emitTaskEvent(EventType.TASK_COMPLETED, payload);
};

export const emitTaskFailed = (payload: TaskEventPayload): void => {
  globalEventManager.emitTaskEvent(EventType.TASK_FAILED, payload);
};

export const emitTaskCancelled = (payload: TaskEventPayload): void => {
  globalEventManager.emitTaskEvent(EventType.TASK_CANCELLED, payload);
};

// Re-export types for convenience
export { WebSocket } from 'ws';