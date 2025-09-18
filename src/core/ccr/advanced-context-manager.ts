import { ContextEntry, ConversationState, TurnEntry, SessionMetadata } from './types';
import { calculateTokenCount, generateSemanticHash } from '../utils/token-utils';

export class AdvancedContextManager {
  private conversationState: ConversationState;
  private sessionMetadata: SessionMetadata;

  constructor(sessionId: string) {
    this.conversationState = {
      sessionId,
      contextWindow: [],
      turnHistory: [],
      currentTurnId: this.generateTurnId(),
      tokenUsage: { total: 0, perRole: { user: 0, assistant: 0, system: 0 } },
      compressionStats: { originalTokens: 0, compressedTokens: 0, compressionRatio: 0 }
    };

    this.sessionMetadata = {
      sessionId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      turnCount: 0,
      totalTokens: 0,
      compressionHistory: [],
      topics: []
    };
  }

  addContextEntry(entry: Omit<ContextEntry, 'id' | 'timestamp' | 'tokenCount' | 'semanticHash'>): ContextEntry {
    const contextEntry: ContextEntry = {
      id: this.generateEntryId(),
      timestamp: Date.now(),
      tokenCount: calculateTokenCount(entry.content),
      semanticHash: generateSemanticHash(entry.content),
      ...entry
    };

    this.conversationState.contextWindow.push(contextEntry);
    this.updateTokenUsage(contextEntry);
    
    // Associate with current turn
    const currentTurn = this.getCurrentTurn();
    if (currentTurn) {
      currentTurn.contextEntries.push(contextEntry.id);
    }
    
    return contextEntry;
  }

  startNewTurn(): string {
    // End current turn
    const currentTurn = this.getCurrentTurn();
    if (currentTurn) {
      currentTurn.endTime = Date.now();
    }

    // Start new turn
    this.conversationState.currentTurnId = this.generateTurnId();
    const newTurn: TurnEntry = {
      turnId: this.conversationState.currentTurnId,
      startTime: Date.now(),
      contextEntries: [],
      topics: []
    };
    
    this.conversationState.turnHistory.push(newTurn);
    this.sessionMetadata.turnCount++;
    
    return this.conversationState.currentTurnId;
  }

  calculateRelevanceScores(): void {
    const entries = this.conversationState.contextWindow;
    
    // Simple relevance scoring based on recency and turn proximity
    entries.forEach((entry, index) => {
      const recencyScore = 1 - (entries.length - index - 1) / entries.length;
      const turnProximityScore = this.calculateTurnProximityScore(entry.turnId || this.conversationState.currentTurnId);
      entry.relevanceScore = (recencyScore + turnProximityScore) / 2;
    });
  }

  pruneContext(maxTokens: number): ContextEntry[] {
    this.calculateRelevanceScores();
    
    // Sort by relevance score (descending)
    const sortedEntries = [...this.conversationState.contextWindow]
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    let tokenCount = 0;
    const prunedEntries: ContextEntry[] = [];
    
    for (const entry of sortedEntries) {
      if (tokenCount + entry.tokenCount <= maxTokens) {
        prunedEntries.push(entry);
        tokenCount += entry.tokenCount;
      } else {
        // For semantic pruning, we might want to summarize instead of discard
        // This is a simplified implementation
        break;
      }
    }
    
    // Update context window with pruned entries
    this.conversationState.contextWindow = prunedEntries
      .sort((a, b) => a.timestamp - b.timestamp); // Maintain chronological order
    
    return this.conversationState.contextWindow;
  }

  getContextWindow(): ContextEntry[] {
    return [...this.conversationState.contextWindow];
  }

  getConversationState(): ConversationState {
    return { ...this.conversationState };
  }

  getSessionMetadata(): SessionMetadata {
    return { ...this.sessionMetadata };
  }

  private generateEntryId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTurnId(): string {
    return `turn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  private getCurrentTurn(): TurnEntry | undefined {
    return this.conversationState.turnHistory.find(
      turn => turn.turnId === this.conversationState.currentTurnId
    );
  }

  private calculateTurnProximityScore(entryTurnId: string): number {
    const currentTurnIndex = this.conversationState.turnHistory.findIndex(
      turn => turn.turnId === this.conversationState.currentTurnId
    );
    
    const entryTurnIndex = this.conversationState.turnHistory.findIndex(
      turn => turn.turnId === entryTurnId
    );
    
    if (currentTurnIndex === -1 || entryTurnIndex === -1) return 0.5;
    
    // Higher score for more recent turns
    const proximity = Math.abs(currentTurnIndex - entryTurnIndex);
    return Math.max(0, 1 - (proximity / 5)); // Decay after 5 turns
  }

  private updateTokenUsage(entry: ContextEntry): void {
    this.conversationState.tokenUsage.total += entry.tokenCount;
    this.conversationState.tokenUsage.perRole[entry.role] += entry.tokenCount;
    this.sessionMetadata.totalTokens = this.conversationState.tokenUsage.total;
    this.sessionMetadata.lastAccessed = Date.now();
  }
}
