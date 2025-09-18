import { SessionMetadata, ContextEntry, CrossSessionBridge, MemoryPersistenceConfig } from './types';
import { generateSemanticHash } from '../utils/token-utils';

export class CrossSessionMemory {
  private sessions: Map<string, SessionMetadata>;
  private contextStore: Map<string, ContextEntry[]>;
  private bridges: CrossSessionBridge[];
  private config: MemoryPersistenceConfig;
  
  constructor(config: MemoryPersistenceConfig) {
    this.sessions = new Map();
    this.contextStore = new Map();
    this.bridges = [];
    this.config = config;
  }

  createSession(sessionId: string): SessionMetadata {
    const metadata: SessionMetadata = {
      sessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      turnCount: 0,
      totalTokens: 0,
      compressionHistory: [],
      topics: []
    };
    
    this.sessions.set(sessionId, metadata);
    this.contextStore.set(sessionId, []);
    
    // Run garbage collection if needed
    this.garbageCollect();
    
    return metadata;
  }

  storeContext(sessionId: string, entries: ContextEntry[]): void {
    if (!this.contextStore.has(sessionId)) {
      this.createSession(sessionId);
    }
    
    const sessionContext = this.contextStore.get(sessionId) || [];
    this.contextStore.set(sessionId, [...sessionContext, ...entries]);
    
    // Update session metadata
    const metadata = this.sessions.get(sessionId);
    if (metadata) {
      metadata.lastAccessed = Date.now();
      metadata.totalTokens += entries.reduce((sum, entry) => sum + entry.tokenCount, 0);
      metadata.topics = this.extractTopics(entries);
    }
  }

  retrieveContext(sessionId: string): ContextEntry[] {
    const metadata = this.sessions.get(sessionId);
    if (metadata) {
      metadata.lastAccessed = Date.now();
    }
    
    return this.contextStore.get(sessionId) || [];
  }

  findSimilarSessions(sessionId: string, threshold: number = 0.7): SessionMetadata[] {
    const targetSession = this.sessions.get(sessionId);
    if (!targetSession || !targetSession.embedding) return [];
    
    const similarSessions: SessionMetadata[] = [];
    
    for (const [id, session] of this.sessions) {
      if (id === sessionId || !session.embedding) continue;
      
      const similarity = this.calculateEmbeddingSimilarity(
        targetSession.embedding, 
        session.embedding
      );
      
      if (similarity >= threshold) {
        similarSessions.push({ ...session, similarityScore: similarity });
      }
    }
    
    return similarSessions.sort((a, b) => (b as any).similarityScore - (a as any).similarityScore);
  }

  bridgeSessions(sourceSessionId: string, targetSessionId: string): CrossSessionBridge | null {
    const sourceSession = this.sessions.get(sourceSessionId);
    const targetSession = this.sessions.get(targetSessionId);
    
    if (!sourceSession || !targetSession) return null;
    
    // Find shared context based on topics
    const sharedTopics = sourceSession.topics.filter(topic => 
      targetSession.topics.includes(topic)
    );
    
    if (sharedTopics.length === 0) return null;
    
    // Get relevant context entries from source session
    const sourceContext = this.contextStore.get(sourceSessionId) || [];
    const sharedContext = sourceContext.filter(entry => 
      sharedTopics.some(topic => entry.content.includes(topic))
    );
    
    if (sharedContext.length === 0) return null;
    
    const bridge: CrossSessionBridge = {
      sourceSessionId,
      targetSessionId,
      sharedContext,
      similarityScore: sharedTopics.length / Math.max(sourceSession.topics.length, targetSession.topics.length),
      bridgedAt: Date.now(),
      topics: sharedTopics
    };
    
    this.bridges.push(bridge);
    
    // Add bridged context to target session
    this.storeContext(targetSessionId, sharedContext);
    
    return bridge;
  }

  getSessionMetadata(sessionId: string): SessionMetadata | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): SessionMetadata[] {
    return Array.from(this.sessions.values());
  }

  private garbageCollect(): void {
    if (!this.config.garbageCollection.enabled) return;
    
    const now = Date.now();
    const sessions = Array.from(this.sessions.entries());
    
    // Remove expired sessions
    for (const [id, metadata] of sessions) {
      if (now - metadata.lastAccessed > this.config.ttl) {
        this.sessions.delete(id);
        this.contextStore.delete(id);
      }
    }
    
    // Apply retention policy if we exceed max sessions
    if (this.sessions.size > this.config.maxSessions) {
      const sortedSessions = Array.from(this.sessions.entries())
        .sort((a, b) => {
          const metadataA = a[1];
          const metadataB = b[1];
          
          switch (this.config.garbageCollection.retentionPolicy) {
            case 'lru':
              return metadataA.lastAccessed - metadataB.lastAccessed;
            case 'topic-based':
              return metadataB.topics.length - metadataA.topics.length;
            case 'relevance-based':
              return metadataB.totalTokens - metadataA.totalTokens;
            default:
              return metadataA.lastAccessed - metadataB.lastAccessed;
          }
        });
      
      // Remove oldest sessions
      const excess = this.sessions.size - this.config.maxSessions;
      for (let i = 0; i < excess; i++) {
        const [id] = sortedSessions[i];
        this.sessions.delete(id);
        this.contextStore.delete(id);
      }
    }
  }

  private extractTopics(entries: ContextEntry[]): string[] {
    // Simple topic extraction (in a real implementation, this would use NLP)
    const content = entries.map(e => e.content).join(' ');
    const words = content.toLowerCase().match(/\b(\w{5,})\b/g) || [];
    
    // Count word frequency
    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    // Return top 5 most frequent words as topics
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private calculateEmbeddingSimilarity(embedding1: number[], embedding2: number[]): number {
    // Cosine similarity calculation
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < Math.min(embedding1.length, embedding2.length); i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }
}
