/**
 * Memory Bridge Integration Module
 * Connects Codex MCP Server with DevFlow memory system for context persistence and retrieval
 * 
 * @module memory-bridge
 */

import { EventEmitter } from 'events';

// Types and interfaces
interface MemoryBlock {
  id: string;
  data: Record<string, any>;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

interface SessionState {
  sessionId: string;
  context: Record<string, any>;
  lastAccessed: number;
  metadata: Record<string, any>;
}

interface CompressionOptions {
  maxTokens: number;
  strategy: 'fifo' | 'lru' | 'priority';
  priorityField?: string;
}

interface MemoryConfig {
  defaultTTL?: number;
  maxMemoryBlocks?: number;
  compressionEnabled?: boolean;
  compressionOptions?: CompressionOptions;
}

// Custom error classes
class MemoryError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'MemoryError';
  }
}

class ContextCompressionError extends MemoryError {
  constructor(message: string) {
    super(message, 'CONTEXT_COMPRESSION_ERROR');
    this.name = 'ContextCompressionError';
  }
}

/**
 * Memory Bridge Integration Class
 * Handles all memory operations between Codex MCP Server and DevFlow memory system
 */
export class MemoryBridge extends EventEmitter {
  private memoryBlocks: Map<string, MemoryBlock>;
  private sessionStates: Map<string, SessionState>;
  private config: MemoryConfig;
  private cleanupInterval: NodeJS.Timeout | null;

  /**
   * Creates a new MemoryBridge instance
   * @param config Configuration options for the memory bridge
   */
  constructor(config: MemoryConfig = {}) {
    super();
    this.memoryBlocks = new Map();
    this.sessionStates = new Map();
    this.config = {
      defaultTTL: config.defaultTTL || 3600000, // 1 hour default
      maxMemoryBlocks: config.maxMemoryBlocks || 1000,
      compressionEnabled: config.compressionEnabled ?? true,
      compressionOptions: config.compressionOptions || {
        maxTokens: 4096,
        strategy: 'lru'
      }
    };
    this.cleanupInterval = null;
    
    // Start cleanup process
    this.startCleanupProcess();
  }

  /**
   * Initializes the memory bridge
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize connection to DevFlow memory system
      // This would typically involve setting up connections, authentication, etc.
      this.emit('initialized');
    } catch (error) {
      throw new MemoryError(`Failed to initialize memory bridge: ${error.message}`, 'INITIALIZATION_ERROR');
    }
  }

  /**
   * Persists context data to memory
   * @param sessionId Session identifier
   * @param context Context data to persist
   * @param metadata Additional metadata
   * @returns Promise that resolves when context is persisted
   */
  public async persistContext(
    sessionId: string,
    context: Record<string, any>,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const sessionState: SessionState = {
        sessionId,
        context,
        lastAccessed: Date.now(),
        metadata
      };

      this.sessionStates.set(sessionId, sessionState);
      this.emit('contextPersisted', { sessionId, context });
    } catch (error) {
      throw new MemoryError(`Failed to persist context: ${error.message}`, 'PERSISTENCE_ERROR');
    }
  }

  /**
   * Retrieves context data from memory
   * @param sessionId Session identifier
   * @returns Promise that resolves with the context data
   */
  public async retrieveContext(sessionId: string): Promise<Record<string, any> | null> {
    try {
      const sessionState = this.sessionStates.get(sessionId);
      
      if (!sessionState) {
        return null;
      }

      // Update last accessed time
      sessionState.lastAccessed = Date.now();
      this.sessionStates.set(sessionId, sessionState);
      
      this.emit('contextRetrieved', { sessionId, context: sessionState.context });
      return sessionState.context;
    } catch (error) {
      throw new MemoryError(`Failed to retrieve context: ${error.message}`, 'RETRIEVAL_ERROR');
    }
  }

  /**
   * Creates a new memory block
   * @param id Unique identifier for the memory block
   * @param data Data to store in the memory block
   * @param ttl Time to live in milliseconds (optional)
   * @returns Promise that resolves when memory block is created
   */
  public async createMemoryBlock(
    id: string,
    data: Record<string, any>,
    ttl?: number
  ): Promise<void> {
    try {
      // Check memory limits
      if (this.memoryBlocks.size >= (this.config.maxMemoryBlocks || 1000)) {
        await this.performMemoryCleanup();
      }

      const memoryBlock: MemoryBlock = {
        id,
        data,
        timestamp: Date.now(),
        ttl: ttl || this.config.defaultTTL
      };

      this.memoryBlocks.set(id, memoryBlock);
      this.emit('memoryBlockCreated', { id, data });
    } catch (error) {
      throw new MemoryError(`Failed to create memory block: ${error.message}`, 'MEMORY_BLOCK_ERROR');
    }
  }

  /**
   * Retrieves a memory block by ID
   * @param id Memory block identifier
   * @returns Promise that resolves with the memory block data
   */
  public async getMemoryBlock(id: string): Promise<Record<string, any> | null> {
    try {
      const memoryBlock = this.memoryBlocks.get(id);
      
      if (!memoryBlock) {
        return null;
      }

      // Check if block has expired
      if (memoryBlock.ttl && (Date.now() - memoryBlock.timestamp) > memoryBlock.ttl) {
        this.memoryBlocks.delete(id);
        this.emit('memoryBlockExpired', { id });
        return null;
      }

      this.emit('memoryBlockRetrieved', { id, data: memoryBlock.data });
      return memoryBlock.data;
    } catch (error) {
      throw new MemoryError(`Failed to retrieve memory block: ${error.message}`, 'MEMORY_BLOCK_ERROR');
    }
  }

  /**
   * Updates an existing memory block
   * @param id Memory block identifier
   * @param data Data to update in the memory block
   * @returns Promise that resolves when memory block is updated
   */
  public async updateMemoryBlock(
    id: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const memoryBlock = this.memoryBlocks.get(id);
      
      if (!memoryBlock) {
        throw new MemoryError(`Memory block with id ${id} not found`, 'MEMORY_BLOCK_NOT_FOUND');
      }

      // Merge existing data with new data
      memoryBlock.data = { ...memoryBlock.data, ...data };
      memoryBlock.timestamp = Date.now();
      
      this.memoryBlocks.set(id, memoryBlock);
      this.emit('memoryBlockUpdated', { id, data });
    } catch (error) {
      if (error instanceof MemoryError) {
        throw error;
      }
      throw new MemoryError(`Failed to update memory block: ${error.message}`, 'MEMORY_BLOCK_ERROR');
    }
  }

  /**
   * Deletes a memory block
   * @param id Memory block identifier
   * @returns Promise that resolves when memory block is deleted
   */
  public async deleteMemoryBlock(id: string): Promise<void> {
    try {
      const deleted = this.memoryBlocks.delete(id);
      
      if (deleted) {
        this.emit('memoryBlockDeleted', { id });
      }
    } catch (error) {
      throw new MemoryError(`Failed to delete memory block: ${error.message}`, 'MEMORY_BLOCK_ERROR');
    }
  }

  /**
   * Compresses context to fit within token limits
   * @param context Context to compress
   * @param options Compression options
   * @returns Compressed context
   */
  public async compressContext(
    context: Record<string, any>,
    options: CompressionOptions = this.config.compressionOptions || { maxTokens: 4096, strategy: 'lru' }
  ): Promise<Record<string, any>> {
    try {
      if (!this.config.compressionEnabled) {
        return context;
      }

      // Calculate current token count (simplified estimation)
      const currentTokens = JSON.stringify(context).length / 4;
      
      if (currentTokens <= options.maxTokens) {
        return context;
      }

      // Apply compression strategy
      let compressedContext: Record<string, any> = {};
      
      switch (options.strategy) {
        case 'fifo':
          compressedContext = this.applyFIFOCompression(context, options);
          break;
        case 'lru':
          compressedContext = this.applyLRUCompression(context, options);
          break;
        case 'priority':
          compressedContext = this.applyPriorityCompression(context, options);
          break;
        default:
          throw new ContextCompressionError(`Unknown compression strategy: ${options.strategy}`);
      }

      this.emit('contextCompressed', { 
        originalTokens: currentTokens, 
        compressedTokens: JSON.stringify(compressedContext).length / 4,
        strategy: options.strategy
      });

      return compressedContext;
    } catch (error) {
      if (error instanceof ContextCompressionError) {
        throw error;
      }
      throw new ContextCompressionError(`Failed to compress context: ${error.message}`);
    }
  }

  /**
   * Cleans up expired memory blocks and session states
   */
  public async performMemoryCleanup(): Promise<void> {
    try {
      const now = Date.now();
      let expiredBlocks = 0;
      let expiredSessions = 0;

      // Clean up expired memory blocks
      for (const [id, block] of this.memoryBlocks.entries()) {
        if (block.ttl && (now - block.timestamp) > block.ttl) {
          this.memoryBlocks.delete(id);
          expiredBlocks++;
        }
      }

      // Clean up old session states (older than 24 hours with no access)
      for (const [sessionId, session] of this.sessionStates.entries()) {
        if ((now - session.lastAccessed) > 86400000) { // 24 hours
          this.sessionStates.delete(sessionId);
          expiredSessions++;
        }
      }

      this.emit('memoryCleaned', { expiredBlocks, expiredSessions });
    } catch (error) {
      throw new MemoryError(`Failed to perform memory cleanup: ${error.message}`, 'CLEANUP_ERROR');
    }
  }

  /**
   * Gets memory usage statistics
   * @returns Memory usage statistics
   */
  public getMemoryStats(): {
    memoryBlocksCount: number;
    sessionStatesCount: number;
    totalMemorySize: number;
  } {
    let totalMemorySize = 0;
    
    // Calculate approximate memory size
    for (const block of this.memoryBlocks.values()) {
      totalMemorySize += JSON.stringify(block).length;
    }
    
    for (const session of this.sessionStates.values()) {
      totalMemorySize += JSON.stringify(session).length;
    }

    return {
      memoryBlocksCount: this.memoryBlocks.size,
      sessionStatesCount: this.sessionStates.size,
      totalMemorySize
    };
  }

  /**
   * Shuts down the memory bridge
   */
  public async shutdown(): Promise<void> {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      // Perform final cleanup
      await this.performMemoryCleanup();
      
      this.emit('shutdown');
    } catch (error) {
      throw new MemoryError(`Failed to shutdown memory bridge: ${error.message}`, 'SHUTDOWN_ERROR');
    }
  }

  // Private helper methods
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup().catch(error => {
        console.error('Memory cleanup error:', error);
      });
    }, 300000); // Run cleanup every 5 minutes
  }

  private applyFIFOCompression(
    context: Record<string, any>,
    options: CompressionOptions
  ): Record<string, any> {
    // First In, First Out compression - remove oldest entries
    const keys = Object.keys(context);
    const compressed: Record<string, any> = {};
    
    // Keep only the most recent entries that fit within token limit
    let tokenCount = 0;
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];
      const value = context[key];
      const entryTokens = JSON.stringify(value).length / 4;
      
      if (tokenCount + entryTokens <= options.maxTokens) {
        compressed[key] = value;
        tokenCount += entryTokens;
      } else {
        break;
      }
    }
    
    return compressed;
  }

  private applyLRUCompression(
    context: Record<string, any>,
    options: CompressionOptions
  ): Record<string, any> {
    // Least Recently Used compression
    // This is a simplified version - in a real implementation,
    // you would track access times for each context entry
    const keys = Object.keys(context);
    const compressed: Record<string, any> = {};
    
    // For simplicity, we'll just take the most recent entries
    let tokenCount = 0;
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];
      const value = context[key];
      const entryTokens = JSON.stringify(value).length / 4;
      
      if (tokenCount + entryTokens <= options.maxTokens) {
        compressed[key] = value;
        tokenCount += entryTokens;
      } else {
        break;
      }
    }
    
    return compressed;
  }

  private applyPriorityCompression(
    context: Record<string, any>,
    options: CompressionOptions
  ): Record<string, any> {
    // Priority-based compression
    if (!options.priorityField) {
      throw new ContextCompressionError('Priority field must be specified for priority compression');
    }

    const priorityField = options.priorityField;
    const entries = Object.entries(context);
    
    // Sort by priority field (assuming higher values = higher priority)
    entries.sort((a, b) => {
      const priorityA = a[1][priorityField] || 0;
      const priorityB = b[1][priorityField] || 0;
      return priorityB - priorityA;
    });

    const compressed: Record<string, any> = {};
    let tokenCount = 0;
    
    for (const [key, value] of entries) {
      const entryTokens = JSON.stringify(value).length / 4;
      
      if (tokenCount + entryTokens <= options.maxTokens) {
        compressed[key] = value;
        tokenCount += entryTokens;
      } else {
        break;
      }
    }
    
    return compressed;
  }
}

// Export types for external use
export type {
  MemoryBlock,
  SessionState,
  CompressionOptions,
  MemoryConfig
};

// Export error classes
export {
  MemoryError,
  ContextCompressionError
};

/**
 * Factory function to create a MemoryBridge instance
 * @param config Configuration options
 * @returns MemoryBridge instance
 */
export function createMemoryBridge(config?: MemoryConfig): MemoryBridge {
  return new MemoryBridge(config);
}

export default MemoryBridge;