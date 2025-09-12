import { MemoryBlock, MemoryType } from './memory-cache';

export interface CompressionConfig {
  tokenBudget: number;
  recentWeight: number;
  workingWeight: number;
  semanticWeight: number;
  episodicWeight: number;
}

export class ContextCompressor {
  private config: CompressionConfig;
  
  constructor(config?: Partial<CompressionConfig>) {
    this.config = {
      tokenBudget: 2000,
      recentWeight: 0.8,
      workingWeight: 0.6,
      semanticWeight: 0.4,
      episodicWeight: 0.2,
      ...config
    };
  }

  compressContext(memoryBlocks: MemoryBlock[]): MemoryBlock[] {
    // Weight memories by type
    const weightedBlocks = memoryBlocks.map(block => {
      const weight = this.getMemoryWeight(block.type);
      return {
        ...block,
        priority: block.importance * weight
      };
    });

    // Sort by priority (highest first)
    weightedBlocks.sort((a, b) => b.priority - a.priority);

    // Select blocks within token budget
    let tokenCount = 0;
    const selectedBlocks: MemoryBlock[] = [];
    
    for (const block of weightedBlocks) {
      if (tokenCount + block.tokens <= this.config.tokenBudget) {
        selectedBlocks.push(block);
        tokenCount += block.tokens;
      } else {
        // Try to fit a smaller block if current one exceeds budget
        continue;
      }
    }

    return selectedBlocks;
  }

  private getMemoryWeight(type: MemoryType): number {
    switch (type) {
      case 'recent': return this.config.recentWeight;
      case 'working': return this.config.workingWeight;
      case 'semantic': return this.config.semanticWeight;
      case 'episodic': return this.config.episodicWeight;
      default: return 0.1; // Default low weight
    }
  }

  updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
