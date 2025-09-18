import { ConversationState, SessionMetadata } from './types';

export class CrossSessionMemory {
  private memoryStore: Map<string, ConversationState> = new Map();
  private sessionMetadata: Map<string, SessionMetadata> = new Map();
  private maxMemorySessions: number = 100;
  
  async storeSessionState(state: ConversationState): Promise<void> {
    const sessionId = this.generateSessionId(state);
    
    // Store the session state
    this.memoryStore.set(sessionId, state);
    
    // Store metadata for retrieval optimization
    const metadata: SessionMetadata = {
      sessionId,
      timestamp: state.timestamp,
      contextSize: state.contextWindow.length,
      topics: this.extractTopics(state.contextWindow)
    };
    
    this.sessionMetadata.set(sessionId, metadata);
    
    // Run garbage collection if needed
    await this.garbageCollect();
  }

  async retrieveSessionState(sessionId?: string): Promise<ConversationState | null> {
    if (sessionId) {
      return this.memoryStore.get(sessionId) || null;
    }
    
    // If no specific session, retrieve most recent
    const recentSession = this.getMostRecentSession();
    return recentSession ? this.memoryStore.get(recentSession) || null : null;
  }

  async retrieveSimilarSession(context: string): Promise<ConversationState | null> {
    const topics = this.extractTopicsFromText(context);
    const similarSessionId = this.findSimilarSession(topics);
    
    if (similarSessionId) {
      return this.memoryStore.get(similarSessionId) || null;
    }
    
    return null;
  }

  async consolidateMemories(): Promise<void> {
    // Group sessions by topic similarity
    const topicGroups = this.groupSessionsByTopics();
    
    // For each group, create consolidated knowledge
    for (const [topic, sessionIds] of Object.entries(topicGroups)) {
      const consolidated = this.consolidateSessions(sessionIds);
      const consolidatedId = `consolidated-${topic}-${Date.now()}`;
      
      this.memoryStore.set(consolidatedId, consolidated);
      
      // Update metadata
      const metadata: SessionMetadata = {
        sessionId: consolidatedId,
        timestamp: Date.now()
      };
      
      this.sessionMetadata.set(consolidatedId, metadata);
    }
  }

  private async garbageCollect(): Promise<void> {
    if (this.memoryStore.size <= this.maxMemorySessions) return;
    
    // Remove oldest sessions
    const sortedSessions = Array.from(this.sessionMetadata.entries())
      .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
      
    const sessionsToRemove = sortedSessions
      .slice(0, this.memoryStore.size - this.maxMemorySessions)
      .map(([id]) => id);
      
    for (const sessionId of sessionsToRemove) {
      this.memoryStore.delete(sessionId);
      this.sessionMetadata.delete(sessionId);
    }
  }

  private generateSessionId(state: ConversationState): string {
    // Create a deterministic session ID based on context content
    const contentHash = this.hashContent(
      state.contextWindow
        .map(entry => entry.content)
        .join('|')
    );
    
    return `session-${contentHash}-${state.timestamp}`;
  }

  private extractTopics(contextWindow: any[]): string[] {
    // Extract key topics from context (simplified implementation)
    const allContent = contextWindow.map(e => e.content).join(' ');
    return this.extractTopicsFromText(allContent);
  }

  private extractTopicsFromText(text: string): string[] {
    // Simple topic extraction (in practice, would use NLP)
    const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    
    return Array.from(
      words
        .filter(word => word.length > 3 && !commonWords.has(word))
        .reduce((acc, word) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
    )
    .filter(([word, count]) => count > 1)
    .map(([word]) => word)
    .slice(0, 5); // Top 5 topics
  }

  private findSimilarSession(topics: string[]): string | null {
    let bestMatch: { id: string; score: number } | null = null;
    
    for (const [sessionId, metadata] of this.sessionMetadata.entries()) {
      const similarity = this.calculateTopicSimilarity(topics, metadata.topics || []);
      
      if (similarity > 0.5 && (!bestMatch || similarity > bestMatch.score)) {
        bestMatch = { id: sessionId, score: similarity };
      }
    }
    
    return bestMatch ? bestMatch.id : null;
  }

  private calculateTopicSimilarity(topics1: string[], topics2: string[]): number {
    if (topics1.length === 0 || topics2.length === 0) return 0;
    
    const intersection = topics1.filter(t => topics2.includes(t)).length;
    const union = new Set([...topics1, ...topics2]).size;
    
    return union > 0 ? intersection / union : 0;
  }

  private groupSessionsByTopics(): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    
    for (const [sessionId, metadata] of this.sessionMetadata.entries()) {
      const primaryTopic = (metadata.topics || [])[0] || 'general';
      
      if (!groups[primaryTopic]) {
        groups[primaryTopic] = [];
      }
      
      groups[primaryTopic].push(sessionId);
    }
    
    return groups;
  }

  private consolidateSessions(sessionIds: string[]): ConversationState {
    // Combine context from multiple sessions
    const allContextEntries = sessionIds
      .map(id => this.memoryStore.get(id))
      .filter(Boolean)
      .flatMap(state => state!.contextWindow)
      .sort((a, b) => a.timestamp - b.timestamp);
      
    return {
      contextWindow: allContextEntries,
      timestamp: Date.now()
    };
  }

  private getMostRecentSession(): string | null {
    let mostRecent: { id: string; timestamp: number } | null = null;
    
    for (const [id, metadata] of this.sessionMetadata.entries()) {
      if (!mostRecent || (metadata.timestamp || 0) > mostRecent.timestamp) {
        mostRecent = { id, timestamp: metadata.timestamp || 0 };
      }
    }
    
    return mostRecent ? mostRecent.id : null;
  }

  private hashContent(content: string): string {
    // Simple hash function (in practice, use a proper hashing algorithm)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}
