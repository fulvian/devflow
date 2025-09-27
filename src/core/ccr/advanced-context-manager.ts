import { ContextEntry, ConversationState } from './types';
import { CompressionOptimizer } from './compression-optimizer';
import { CrossSessionMemory } from './cross-session-memory';

export class AdvancedContextManager {
  private contextWindow: ContextEntry[] = [];
  private maxContextLength: number;
  private compressionOptimizer: CompressionOptimizer;
  private crossSessionMemory: CrossSessionMemory;
  private relevanceThreshold: number = 0.3;
  
  constructor(
    maxContextLength: number = 8192,
    compressionOptimizer: CompressionOptimizer,
    crossSessionMemory: CrossSessionMemory
  ) {
    this.maxContextLength = maxContextLength;
    this.compressionOptimizer = compressionOptimizer;
    this.crossSessionMemory = crossSessionMemory;
  }

  async addContext(entry: ContextEntry): Promise<void> {
    this.contextWindow.push(entry);
    await this.optimizeContextFlow();
    await this.persistState();
  }

  getContextWindow(): ContextEntry[] {
    return [...this.contextWindow];
  }

  async optimizeContextFlow(): Promise<void> {
    // Apply sliding window approach
    if (this.getContextTokenCount() > this.maxContextLength) {
      await this.applyContextPruning();
    }
    
    // Optimize flow based on relevance scoring
    this.contextWindow = this.contextWindow
      .map(entry => ({
        ...entry,
        relevanceScore: this.calculateRelevance(entry)
      }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  private async applyContextPruning(): Promise<void> {
    // Compress least relevant entries first
    const compressed = await this.compressionOptimizer.compressContext(this.contextWindow);
    this.contextWindow = compressed;
    
    // If still over limit, remove lowest relevance entries
    while (this.getContextTokenCount() > this.maxContextLength && this.contextWindow.length > 1) {
      const lowestRelevanceIndex = this.contextWindow
        .map((entry, index) => ({ index, score: entry.relevanceScore || 0 }))
        .reduce((min, curr) => curr.score < min.score ? curr : min, { index: 0, score: Infinity });
      
      this.contextWindow.splice(lowestRelevanceIndex.index, 1);
    }
  }

  private calculateRelevance(entry: ContextEntry): number {
    // Simple relevance scoring based on recency and content type
    const recencyFactor = 1 - (this.contextWindow.indexOf(entry) / this.contextWindow.length);
    const typeFactor = entry.type === 'user' ? 1 : 0.7; // User entries more relevant
    return recencyFactor * typeFactor;
  }

  private getContextTokenCount(): number {
    return this.contextWindow.reduce((total, entry) => total + (entry.tokenCount || 0), 0);
  }

  async persistState(): Promise<void> {
    const state: ConversationState = {
      contextWindow: this.contextWindow,
      timestamp: Date.now()
    };
    await this.crossSessionMemory.storeSessionState(state);
  }

  async restoreState(): Promise<void> {
    const state = await this.crossSessionMemory.retrieveSessionState();
    if (state) {
      this.contextWindow = state.contextWindow;
    }
  }
}
