import { ContextEntry, CompressionStrategy, TurnEntry } from './types';
import { generateSemanticHash } from '../utils/token-utils';

export class CompressionOptimizer {
  private strategies: Record<CompressionStrategy, (entries: ContextEntry[]) => ContextEntry[]>;
  
  constructor() {
    this.strategies = {
      'semantic-chunking': this.semanticChunking.bind(this),
      'turn-boundary': this.turnBoundaryCompression.bind(this),
      'relevance-ranking': this.relevanceRankingCompression.bind(this),
      'adaptive-ratio': this.adaptiveRatioCompression.bind(this),
      'multi-strategy': this.multiStrategyCompression.bind(this)
    };
  }

  compressContext(
    entries: ContextEntry[], 
    strategy: CompressionStrategy, 
    turnHistory: TurnEntry[]
  ): ContextEntry[] {
    const compressor = this.strategies[strategy];
    if (!compressor) {
      throw new Error(`Unknown compression strategy: ${strategy}`);
    }
    
    return compressor(entries);
  }

  private semanticChunking(entries: ContextEntry[]): ContextEntry[] {
    // Group entries by semantic similarity (simplified implementation)
    const chunks: ContextEntry[][] = [];
    let currentChunk: ContextEntry[] = [];
    
    for (const entry of entries) {
      if (currentChunk.length === 0) {
        currentChunk.push(entry);
      } else {
        // Check semantic similarity (simplified)
        const lastEntry = currentChunk[currentChunk.length - 1];
        if (this.semanticSimilarity(lastEntry, entry) > 0.7) {
          currentChunk.push(entry);
        } else {
          chunks.push(currentChunk);
          currentChunk = [entry];
        }
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    // Compress each chunk into a summary
    return chunks.map(chunk => this.createSummaryEntry(chunk));
  }

  private turnBoundaryCompression(entries: ContextEntry[]): ContextEntry[] {
    // Preserve turn boundaries while compressing within turns
    const turnGroups = new Map<string, ContextEntry[]>();
    
    // Group entries by turnId
    for (const entry of entries) {
      const turnId = entry.turnId || 'unknown';
      if (!turnGroups.has(turnId)) {
        turnGroups.set(turnId, []);
      }
      turnGroups.get(turnId)!.push(entry);
    }
    
    // Compress each turn group
    const compressedEntries: ContextEntry[] = [];
    for (const [turnId, group] of turnGroups) {
      if (group.length > 3) { // Only compress if more than 3 entries
        const summary = this.createSummaryEntry(group);
        summary.turnId = turnId;
        compressedEntries.push(summary);
      } else {
        compressedEntries.push(...group);
      }
    }
    
    return compressedEntries;
  }

  private relevanceRankingCompression(entries: ContextEntry[]): ContextEntry[] {
    // Sort by relevance and keep top percentage
    const sorted = [...entries].sort((a, b) => b.relevanceScore - a.relevanceScore);
    const keepCount = Math.max(Math.floor(sorted.length * 0.7), 5); // Keep 70% or at least 5
    return sorted.slice(0, keepCount);
  }

  private adaptiveRatioCompression(entries: ContextEntry[]): ContextEntry[] {
    // Adjust compression based on importance scores
    const totalTokens = entries.reduce((sum, entry) => sum + entry.tokenCount, 0);
    const targetTokens = Math.floor(totalTokens * 0.6); // Target 60% compression
    
    // Sort by importance (relevance * recency)
    const sorted = [...entries].sort((a, b) => {
      const importanceA = a.relevanceScore * (1 - (Date.now() - a.timestamp) / (24 * 60 * 60 * 1000));
      const importanceB = b.relevanceScore * (1 - (Date.now() - b.timestamp) / (24 * 60 * 60 * 1000));
      return importanceB - importanceA;
    });
    
    let tokenCount = 0;
    const result: ContextEntry[] = [];
    
    for (const entry of sorted) {
      if (tokenCount < targetTokens) {
        result.push(entry);
        tokenCount += entry.tokenCount;
      } else {
        // Compress remaining entries into a summary
        const remaining = sorted.slice(sorted.indexOf(entry));
        if (remaining.length > 0) {
          result.push(this.createSummaryEntry(remaining));
        }
        break;
      }
    }
    
    return result;
  }

  private multiStrategyCompression(entries: ContextEntry[]): ContextEntry[] {
    // Apply multiple strategies in sequence
    let result = [...entries];
    
    // First apply turn boundary preservation
    result = this.turnBoundaryCompression(result);
    
    // Then apply relevance ranking
    result = this.relevanceRankingCompression(result);
    
    // Finally apply semantic chunking if still too large
    const totalTokens = result.reduce((sum, entry) => sum + entry.tokenCount, 0);
    if (totalTokens > 2000) { // Threshold for additional compression
      result = this.semanticChunking(result);
    }
    
    return result;
  }

  private semanticSimilarity(entry1: ContextEntry, entry2: ContextEntry): number {
    // Simplified semantic similarity check
    // In a real implementation, this would use embeddings
    const hash1 = entry1.semanticHash;
    const hash2 = entry2.semanticHash;
    
    // Simple hash comparison (just for demonstration)
    let matches = 0;
    for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    
    return matches / Math.max(hash1.length, hash2.length);
  }

  private createSummaryEntry(entries: ContextEntry[]): ContextEntry {
    // Create a summary entry from multiple entries
    const combinedContent = entries.map(e => e.content).join(' ');
    const summary = combinedContent.length > 200 
      ? combinedContent.substring(0, 197) + '...'
      : combinedContent;
      
    return {
      id: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      content: summary,
      role: 'system',
      timestamp: Date.now(),
      relevanceScore: Math.max(...entries.map(e => e.relevanceScore)),
      tokenCount: Math.floor(combinedContent.length / 4), // Rough estimate
      semanticHash: generateSemanticHash(summary)
    };
  }
}
