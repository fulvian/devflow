import { CognitiveSession, SessionPersistenceAdapter } from './interfaces';

export class SessionManager {
  private sessions: Map<string, CognitiveSession> = new Map();
  private persistenceAdapter: SessionPersistenceAdapter;
  private cacheExpiry: number; // in milliseconds

  constructor(persistenceAdapter: SessionPersistenceAdapter, cacheExpiry: number = 5 * 60 * 1000) { // 5 minutes default
    this.persistenceAdapter = persistenceAdapter;
    this.cacheExpiry = cacheExpiry;
  }

  async createSession(userId: string, explorationStrategyId: string): Promise<CognitiveSession> {
    const sessionId = this.generateSessionId();
    
    const newSession: CognitiveSession = {
      id: sessionId,
      userId,
      createdAt: new Date(),
      lastActive: new Date(),
      isActive: true,
      context: {
        currentFocus: [],
        explorationPath: [],
        workingMemory: [],
        goals: []
      },
      memoryGraph: {
        nodes: new Map(),
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          version: '1.0.0',
          nodeCount: 0,
          connectionCount: 0
        }
      },
      explorationStrategy: this.getDefaultExplorationStrategy(explorationStrategyId)
    };

    this.sessions.set(sessionId, newSession);
    await this.persistenceAdapter.saveSession(newSession);
    
    return newSession;
  }

  async getSession(sessionId: string): Promise<CognitiveSession | null> {
    // Check in-memory cache first
    const cachedSession = this.sessions.get(sessionId);
    if (cachedSession) {
      // Check if cache is expired
      if (Date.now() - cachedSession.lastActive.getTime() < this.cacheExpiry) {
        return cachedSession;
      } else {
        // Remove expired cache
        this.sessions.delete(sessionId);
      }
    }

    // Load from persistence if not in cache or expired
    const persistedSession = await this.persistenceAdapter.loadSession(sessionId);
    if (persistedSession) {
      this.sessions.set(sessionId, persistedSession);
      return persistedSession;
    }

    return null;
  }

  async updateSession(session: CognitiveSession): Promise<void> {
    session.lastActive = new Date();
    session.memoryGraph.metadata.lastModified = new Date();
    
    this.sessions.set(session.id, session);
    await this.persistenceAdapter.saveSession(session);
  }

  async endSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.isActive = false;
      session.lastActive = new Date();
      this.sessions.delete(sessionId);
      await this.persistenceAdapter.saveSession(session);
    }
  }

  async listUserSessions(userId: string): Promise<CognitiveSession[]> {
    return await this.persistenceAdapter.listSessions(userId);
  }

  async transferKnowledge(sourceSessionId: string, targetSessionId: string): Promise<void> {
    const sourceSession = await this.getSession(sourceSessionId);
    const targetSession = await this.getSession(targetSessionId);

    if (!sourceSession || !targetSession) {
      throw new Error('One or both sessions not found');
    }

    // Transfer key nodes from source to target session
    const importantNodes = this.getImportantNodes(sourceSession);
    
    for (const node of importantNodes) {
      if (!targetSession.memoryGraph.nodes.has(node.id)) {
        targetSession.memoryGraph.nodes.set(node.id, { ...node });
        targetSession.memoryGraph.metadata.nodeCount++;
        
        // Add connections for the transferred node
        targetSession.memoryGraph.metadata.connectionCount += Object.keys(node.connections).length;
      }
    }

    targetSession.memoryGraph.metadata.lastModified = new Date();
    await this.updateSession(targetSession);
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private getDefaultExplorationStrategy(strategyId: string): any {
    // This would typically load from a strategy registry
    return {
      id: strategyId,
      name: 'Default Strategy',
      description: 'Default exploration strategy',
      parameters: {}
    };
  }

  private getImportantNodes(session: CognitiveSession): any[] {
    // Return nodes with high strength or recent access
    return Array.from(session.memoryGraph.nodes.values())
      .filter(node => node.metadata.strength > 0.7 || 
             (Date.now() - node.metadata.lastAccessed.getTime()) < 24 * 60 * 60 * 1000) // Accessed within 24 hours
      .sort((a, b) => b.metadata.strength - a.metadata.strength);
  }
}
