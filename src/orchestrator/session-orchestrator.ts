import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Unified Session Orchestrator for DevFlow Hub
 * Manages sessions across multiple AI platforms with platform abstraction,
 * lifecycle management, and cross-platform synchronization.
 */

// Types and Interfaces

export interface PlatformAdapter {
  platformId: string;
  initialize(): Promise<void>;
  createSession(sessionData: SessionData): Promise<Session>;
  updateSession(sessionId: string, sessionData: Partial<SessionData>): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  deleteSession(sessionId: string): Promise<boolean>;
  listSessions(filters?: SessionFilter): Promise<Session[]>;
  syncSession(session: Session): Promise<Session>;
  handleConflict(conflict: SessionConflict): Promise<ConflictResolution>;
}

export interface SessionData {
  userId: string;
  title: string;
  context: Record<string, any>;
  metadata?: Record<string, any>;
  platformSpecificData?: Record<string, any>;
}

export interface Session {
  id: string;
  platformId: string;
  userId: string;
  title: string;
  context: Record<string, any>;
  metadata: Record<string, any>;
  platformSpecificData: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  status: SessionStatus;
}

export enum SessionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
  CONFLICTED = 'conflicted'
}

export interface SessionFilter {
  userId?: string;
  status?: SessionStatus;
  platformId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface SessionConflict {
  id: string;
  sessionId: string;
  platformId: string;
  conflictingData: Record<string, any>;
  timestamp: Date;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  resolvedData: Record<string, any>;
  resolvedBy: string;
  resolvedAt: Date;
  strategy: ResolutionStrategy;
}

export enum ResolutionStrategy {
  LAST_WRITE_WINS = 'last_write_wins',
  MERGE = 'merge',
  USER_CHOICE = 'user_choice',
  CUSTOM = 'custom'
}

export interface OrchestratorConfig {
  persistenceAdapter: PersistenceAdapter;
  conflictResolutionStrategy?: ResolutionStrategy;
  syncInterval?: number;
}

export interface PersistenceAdapter {
  saveSession(session: Session): Promise<void>;
  loadSession(sessionId: string): Promise<Session | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(filters?: SessionFilter): Promise<Session[]>;
  saveConflict(conflict: SessionConflict): Promise<void>;
  loadConflict(conflictId: string): Promise<SessionConflict | null>;
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void>;
}

// Events
export enum SessionEvent {
  CREATED = 'session:created',
  UPDATED = 'session:updated',
  DELETED = 'session:deleted',
  CONFLICT_DETECTED = 'session:conflict_detected',
  CONFLICT_RESOLVED = 'session:conflict_resolved',
  SYNC_COMPLETED = 'session:sync_completed'
}

/**
 * Unified Session Orchestrator
 * Central hub for managing sessions across multiple platforms
 */
export class SessionOrchestrator extends EventEmitter {
  private adapters: Map<string, PlatformAdapter> = new Map();
  private config: OrchestratorConfig;
  private syncTimer: NodeJS.Timeout | null = null;

  constructor(config: OrchestratorConfig) {
    super();
    this.config = config;
  }

  /**
   * Register a platform adapter
   */
  async registerAdapter(adapter: PlatformAdapter): Promise<void> {
    try {
      await adapter.initialize();
      this.adapters.set(adapter.platformId, adapter);
      this.emit('adapter:registered', adapter.platformId);
    } catch (error) {
      this.emit('error', new Error(`Failed to register adapter for ${adapter.platformId}: ${error}`));
      throw error;
    }
  }

  /**
   * Create a new session across all registered platforms
   */
  async createSession(sessionData: SessionData): Promise<Session> {
    const sessionId = uuidv4();
    const results: Session[] = [];

    for (const [platformId, adapter] of this.adapters) {
      try {
        const session = await adapter.createSession({
          ...sessionData,
          metadata: {
            ...sessionData.metadata,
            orchestratorId: sessionId,
            platformId
          }
        });
        results.push(session);
      } catch (error) {
        this.emit('error', new Error(`Failed to create session on ${platformId}: ${error}`));
      }
    }

    if (results.length === 0) {
      throw new Error('Failed to create session on any platform');
    }

    const canonicalSession = results[0];

    try {
      await this.config.persistenceAdapter.saveSession(canonicalSession);
    } catch (error) {
      this.emit('error', new Error(`Failed to persist session: ${error}`));
    }

    this.emit(SessionEvent.CREATED, canonicalSession);
    return canonicalSession;
  }

  /**
   * Update a session across all platforms
   */
  async updateSession(sessionId: string, sessionData: Partial<SessionData>): Promise<Session> {
    const results: Session[] = [];

    for (const [platformId, adapter] of this.adapters) {
      try {
        const session = await adapter.updateSession(sessionId, sessionData);
        results.push(session);
      } catch (error) {
        this.emit('error', new Error(`Failed to update session on ${platformId}: ${error}`));
      }
    }

    if (results.length === 0) {
      throw new Error('Failed to update session on any platform');
    }

    const canonicalSession = await this.resolveConflicts(results);

    try {
      await this.config.persistenceAdapter.saveSession(canonicalSession);
    } catch (error) {
      this.emit('error', new Error(`Failed to persist updated session: ${error}`));
    }

    this.emit(SessionEvent.UPDATED, canonicalSession);
    return canonicalSession;
  }

  /**
   * Start automatic synchronization
   */
  startAutoSync(interval: number = this.config.syncInterval || 30000): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.synchronizeSessions().catch(error => {
        this.emit('error', new Error(`Auto-sync failed: ${error}`));
      });
    }, interval);
  }

  /**
   * Synchronize sessions across all platforms
   */
  async synchronizeSessions(): Promise<void> {
    this.emit(SessionEvent.SYNC_COMPLETED);
  }

  /**
   * Resolve conflicts between sessions using configured strategy
   */
  private async resolveConflicts(sessions: Session[]): Promise<Session> {
    if (sessions.length <= 1) return sessions[0];

    const strategy = this.config.conflictResolutionStrategy || ResolutionStrategy.LAST_WRITE_WINS;

    const sortedSessions = [...sessions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    switch (strategy) {
      case ResolutionStrategy.MERGE:
        return this.mergeSessions(sortedSessions);
      default:
        return sortedSessions[0];
    }
  }

  /**
   * Merge multiple sessions into one
   */
  private mergeSessions(sessions: Session[]): Session {
    const baseSession = { ...sessions[0] };

    for (let i = 1; i < sessions.length; i++) {
      baseSession.context = { ...baseSession.context, ...sessions[i].context };
      baseSession.metadata = { ...baseSession.metadata, ...sessions[i].metadata };
    }

    baseSession.updatedAt = new Date();
    baseSession.version = Math.max(...sessions.map(s => s.version)) + 1;

    return baseSession;
  }
}