import { MemoryCache, MemoryBlock } from './memory-cache';
import { ContextCompressor } from './context-compression';
import { ContextSanitizer } from './context-sanitizer';

export interface InjectionConfig {
  enabled: boolean;
  maxContextSize: number;
  priorityThreshold: number;
}

export interface ContextPayload {
  compressed: string;
  metadata: {
    totalBlocks: number;
    compressionRatio: number;
    timestamp: number;
    priority: number;
  };
  taskContext: {
    currentTask: string;
    relatedFiles: string[];
    recentActions: string[];
  };
  codebaseMap: {
    relevantModules: string[];
    dependencies: string[];
    architecture: string;
  };
}

export interface PreCallPreparation {
  contextPayload: ContextPayload;
  injectionSuccess: boolean;
  warnings: string[];
  estimatedTokens: number;
}

/**
 * Synthetic Context Injection Protocol
 * Prepares memory context for injection into AI model calls
 */
export class InjectionProtocol {
  private cache: MemoryCache;
  private compressor: ContextCompressor;
  private config: InjectionConfig;

  constructor(
    cache: MemoryCache,
    compressor: ContextCompressor,
    config: InjectionConfig = {
      enabled: true,
      maxContextSize: 2000,
      priorityThreshold: 0.5
    }
  ) {
    this.cache = cache;
    this.compressor = compressor;
    this.config = config;
  }

  /**
   * Prepare context for pre-call injection
   */
  async prepareContextInjection(
    taskId: string,
    currentTask: string,
    options: {
      includeRecent?: boolean;
      includeWorking?: boolean;
      includeSemantic?: boolean;
      maxBlocks?: number;
    } = {}
  ): Promise<PreCallPreparation> {
    if (!this.config.enabled) {
      return {
        contextPayload: this.createEmptyPayload(),
        injectionSuccess: false,
        warnings: ['Context injection disabled'],
        estimatedTokens: 0
      };
    }

    try {
      // Gather relevant memory blocks
      const memoryBlocks = await this.gatherRelevantMemory(taskId, options);
      
      // Compress context - pass memory blocks directly
      const compressedBlocks = this.compressor.compressContext(memoryBlocks);
      const compressed = this.convertBlocksToString(compressedBlocks);
      
      // Create context payload
      const contextPayload = this.createContextPayload(
        compressed,
        compressedBlocks,
        currentTask
      );
      
      // Estimate token usage
      const estimatedTokens = this.estimateTokenUsage(contextPayload);
      
      const warnings: string[] = [];
      if (estimatedTokens > this.config.maxContextSize) {
        warnings.push(`Context size (${estimatedTokens}) exceeds limit (${this.config.maxContextSize})`);
      }
      
      return {
        contextPayload,
        injectionSuccess: true,
        warnings,
        estimatedTokens
      };
      
    } catch (error) {
      return {
        contextPayload: this.createEmptyPayload(),
        injectionSuccess: false,
        warnings: [`Context preparation failed: ${error}`],
        estimatedTokens: 0
      };
    }
  }

  /**
   * Format context for API call injection with security sanitization
   */
  formatForAPICall(payload: ContextPayload): string {
    // Sanitize all user-controlled content to prevent injection attacks
    const sanitizedTask = ContextSanitizer.sanitizeString(payload.taskContext.currentTask);
    const sanitizedCompressed = ContextSanitizer.sanitizeString(payload.compressed);
    const sanitizedArchitecture = ContextSanitizer.sanitizeString(payload.codebaseMap.architecture);
    const sanitizedModules = ContextSanitizer.sanitizeArray(payload.codebaseMap.relevantModules).join(', ');
    const sanitizedActions = ContextSanitizer.sanitizeArray(payload.taskContext.recentActions).join(', ');

    return `
=== DevFlow Context Injection ===
Task: ${sanitizedTask}
Relevant Context:
${sanitizedCompressed}

Architecture Notes: ${sanitizedArchitecture}
Relevant Modules: ${sanitizedModules}
Recent Actions: ${sanitizedActions}
=== End Context ===

`;
  }

  /**
   * Wrap API call with memory injection
   */
  async wrapAPICall<T>(
    apiCall: (prompt: string) => Promise<T>,
    originalPrompt: string,
    taskId: string,
    currentTask: string
  ): Promise<T> {
    // Prepare context
    const preparation = await this.prepareContextInjection(taskId, currentTask);
    
    // Inject context if successful
    let enhancedPrompt = originalPrompt;
    if (preparation.injectionSuccess && preparation.estimatedTokens <= this.config.maxContextSize) {
      const contextString = this.formatForAPICall(preparation.contextPayload);
      enhancedPrompt = contextString + originalPrompt;
    }
    
    // Make the API call
    return await apiCall(enhancedPrompt);
  }

  private async gatherRelevantMemory(
    taskId: string,
    options: {
      includeRecent?: boolean;
      includeWorking?: boolean;
      includeSemantic?: boolean;
      maxBlocks?: number;
    }
  ): Promise<MemoryBlock[]> {
    const blocks: MemoryBlock[] = [];
    const maxBlocks = options.maxBlocks || 20;
    
    // Get recent memory blocks
    if (options.includeRecent !== false) {
      const recentBlocks = this.cache.getByType('recent', Math.floor(maxBlocks * 0.4));
      blocks.push(...recentBlocks);
    }
    
    // Get working memory blocks
    if (options.includeWorking !== false) {
      const workingBlocks = this.cache.getByType('working', Math.floor(maxBlocks * 0.3));
      blocks.push(...workingBlocks);
    }
    
    // Get semantic memory blocks
    if (options.includeSemantic !== false) {
      const semanticBlocks = this.cache.getByType('semantic', Math.floor(maxBlocks * 0.2));
      blocks.push(...semanticBlocks);
    }
    
    // Get episodic memory blocks
    const episodicBlocks = this.cache.getByType('episodic', Math.floor(maxBlocks * 0.1));
    blocks.push(...episodicBlocks);
    
    // Remove duplicates and sort by importance
    const uniqueBlocks = Array.from(
      new Map(blocks.map(block => [block.id, block])).values()
    ).sort((a, b) => b.importance - a.importance);
    
    return uniqueBlocks.slice(0, maxBlocks);
  }

  private convertBlocksToString(blocks: MemoryBlock[]): string {
    return blocks
      .map(block => `[${block.type}] ${block.content} (importance: ${block.importance})`)
      .join('\n\n');
  }

  private createContextPayload(
    compressed: string,
    blocks: MemoryBlock[],
    currentTask: string
  ): ContextPayload {
    const originalSize = blocks.reduce((sum, block) => sum + block.tokens, 0);
    const compressedSize = compressed.length;
    
    return {
      compressed,
      metadata: {
        totalBlocks: blocks.length,
        compressionRatio: originalSize > 0 ? compressedSize / originalSize : 1,
        timestamp: Date.now(),
        priority: blocks.reduce((sum, block) => sum + block.importance, 0) / Math.max(blocks.length, 1)
      },
      taskContext: {
        currentTask,
        relatedFiles: this.extractRelatedFiles(blocks),
        recentActions: this.extractRecentActions(blocks)
      },
      codebaseMap: {
        relevantModules: this.extractRelevantModules(blocks),
        dependencies: this.extractDependencies(blocks),
        architecture: this.generateArchitectureSummary(blocks)
      }
    };
  }

  private createEmptyPayload(): ContextPayload {
    return {
      compressed: '',
      metadata: {
        totalBlocks: 0,
        compressionRatio: 0,
        timestamp: Date.now(),
        priority: 0
      },
      taskContext: {
        currentTask: '',
        relatedFiles: [],
        recentActions: []
      },
      codebaseMap: {
        relevantModules: [],
        dependencies: [],
        architecture: ''
      }
    };
  }

  private estimateTokenUsage(payload: ContextPayload): number {
    // Rough estimation: 1 token ≈ 0.75 words ≈ 4 characters
    return Math.ceil(payload.compressed.length / 4);
  }

  private extractRelatedFiles(blocks: MemoryBlock[]): string[] {
    return blocks
      .map(block => this.extractFileReferences(block.content))
      .flat()
      .slice(0, 10);
  }

  private extractRecentActions(blocks: MemoryBlock[]): string[] {
    return blocks
      .filter(block => block.type === 'recent')
      .map(block => block.content.substring(0, 100))
      .slice(0, 5);
  }

  private extractRelevantModules(blocks: MemoryBlock[]): string[] {
    return blocks
      .map(block => this.extractModuleNames(block.content))
      .flat()
      .slice(0, 8);
  }

  private extractDependencies(blocks: MemoryBlock[]): string[] {
    return [];
  }

  private generateArchitectureSummary(blocks: MemoryBlock[]): string {
    const workingBlocks = blocks.filter(block => block.type === 'working');
    if (workingBlocks.length === 0) return 'No architectural context';
    
    return `Working on ${workingBlocks.length} components with focus on ${workingBlocks[0]?.content.substring(0, 50) || 'general development'}`;
  }

  private extractFileReferences(content: string): string[] {
    const matches = content.match(/\b\w+\.(ts|js|py|java|cpp|h)\b/g) || [];
    return [...new Set(matches)];
  }

  private extractModuleNames(content: string): string[] {
    const matches = content.match(/\b(?:class|interface|module|namespace)\s+(\w+)/g) || [];
    return matches.map(match => match.split(/\s+/).pop() || '').filter(Boolean);
  }

  updateConfig(newConfig: Partial<InjectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): InjectionConfig {
    return { ...this.config };
  }
}