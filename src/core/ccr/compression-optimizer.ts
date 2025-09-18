import { ContextEntry } from './types';

export class CompressionOptimizer {
  private compressionRatios = {
    low: 0.9,
    medium: 0.7,
    high: 0.5
  };

  async compressContext(context: ContextEntry[], targetRatio: keyof typeof this.compressionRatios = 'medium'): Promise<ContextEntry[]> {
    const ratio = this.compressionRatios[targetRatio];
    
    // First pass: semantic-aware chunking
    const chunkedContext = this.semanticChunking(context);
    
    // Second pass: token-aware compression
    const compressedContext = await this.tokenEfficientCompression(chunkedContext, ratio);
    
    // Third pass: preserve semantic integrity
    return this.preserveSemanticContent(compressedContext);
  }

  private semanticChunking(context: ContextEntry[]): ContextEntry[] {
    // Group related context entries
    const chunks: ContextEntry[][] = [];
    let currentChunk: ContextEntry[] = [];
    
    for (const entry of context) {
      if (entry.type === 'system' || currentChunk.length === 0) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }
        currentChunk = [entry];
      } else {
        currentChunk.push(entry);
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    // Compress each chunk while preserving relationships
    return chunks.flatMap(chunk => this.compressChunk(chunk));
  }

  private compressChunk(chunk: ContextEntry[]): ContextEntry[] {
    if (chunk.length <= 1) return chunk;
    
    // Preserve first and last entries, compress middle
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    
    if (chunk.length <= 2) return [first, last];
    
    // Create summary entry for middle content
    const middleContent = chunk
      .slice(1, -1)
      .map(e => e.content)
      .join(' ');
      
    const summaryEntry: ContextEntry = {
      id: `summary-${Date.now()}`,
      type: 'summary',
      content: this.createSummary(middleContent),
      timestamp: chunk[Math.floor(chunk.length/2)].timestamp,
      tokenCount: Math.floor(middleContent.length / 4) // Approximation
    };
    
    return [first, summaryEntry, last];
  }

  private async tokenEfficientCompression(context: ContextEntry[], ratio: number): Promise<ContextEntry[]> {
    return context.map(entry => {
      if (entry.type === 'system') return entry; // Never compress system entries
      
      const targetLength = Math.floor(entry.content.length * ratio);
      if (targetLength >= entry.content.length) return entry;
      
      return {
        ...entry,
        content: this.compressContent(entry.content, targetLength),
        tokenCount: Math.floor(entry.tokenCount! * ratio)
      };
    });
  }

  private preserveSemanticContent(context: ContextEntry[]): ContextEntry[] {
    // Ensure key semantic elements are preserved
    return context.map(entry => {
      if (entry.type === 'summary' || entry.type === 'system') {
        // Preserve key entities and actions in summaries
        const preservedContent = this.extractKeyEntities(entry.content);
        return {
          ...entry,
          content: preservedContent
        };
      }
      return entry;
    });
  }

  private createSummary(content: string): string {
    // In a real implementation, this would use an LLM for summarization
    // For now, we'll extract key sentences
    const sentences = content.split('. ').filter(s => s.length > 10);
    if (sentences.length <= 2) return content;
    
    // Return first and last sentences as summary
    return `${sentences[0]} ... ${sentences[sentences.length - 1]}.`;
  }

  private compressContent(content: string, targetLength: number): string {
    if (content.length <= targetLength) return content;
    
    // Remove redundant whitespace and condense phrasing
    let compressed = content.replace(/\s+/g, ' ');
    
    // If still too long, truncate with continuation marker
    if (compressed.length > targetLength) {
      compressed = compressed.substring(0, targetLength - 3) + '...';
    }
    
    return compressed;
  }

  private extractKeyEntities(content: string): string {
    // Simple entity extraction (in practice, would use NLP)
    const entities = content.match(/\b[A-Z][a-z]+\b/g) || [];
    const actions = content.match(/\b(need|want|require|should|must)\b/gi) || [];
    
    if (entities.length > 0 || actions.length > 0) {
      return `Key elements: ${[...new Set([...entities, ...actions])].join(', ')}`;
    }
    
    return content.substring(0, Math.min(100, content.length)) + (content.length > 100 ? '...' : '');
  }
}
