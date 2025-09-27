/**
 * CCR-008-MEMORY-INTEGRATION
 * Context Manager for handling memory operations within CCR fallback chain
 * 
 * This module provides comprehensive memory management capabilities including:
 * - Context compression and decompression
 * - Retrieval optimization strategies
 * - Session state management
 * - Memory block operations
 * - Context serialization/deserialization
 * - Cache management with eviction policies
 * - Performance monitoring
 * - Memory leak prevention mechanisms
 */

// Core interfaces and types
interface ContextData {
  id: string;
  data: Record<string, any>;
  metadata: {
    createdAt: number;
    lastAccessed: number;
    accessCount: number;
    size: number;
  };
}

interface CompressionOptions {
  algorithm: 'lz-string' | 'gzip' | 'deflate' | 'none';
  level?: number;
  threshold?: number;
}

interface CacheConfig {
  maxSize: number;
  ttl: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

interface PerformanceMetrics {
  compressionTime: number;
  decompressionTime: number;
  retrievalTime: number;
  cacheHitRate: number;
  memoryUsage: number;
}

interface SessionState {
  sessionId: string;
  contextStack: string[];
  variables: Record<string, any>;
  createdAt: number;
  lastActive: number;
}

// Error types
class ContextManagerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ContextManagerError';
  }
}

class MemoryLeakError extends ContextManagerError {
  constructor(message: string) {
    super(message, 'MEMORY_LEAK');
  }
}

/**
 * Context Manager for handling memory operations in CCR fallback chain
 */
export class ContextManager {
  private contextCache: Map<string, ContextData>;
  private sessionStates: Map<string, SessionState>;
  private compressionCache: Map<string, string>;
  private performanceMetrics: PerformanceMetrics;
  private cacheConfig: CacheConfig;
  private compressionOptions: CompressionOptions;
  private readonly MAX_CONTEXT_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly CLEANUP_INTERVAL = 30000; // 30 seconds
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    cacheConfig: Partial<CacheConfig> = {},
    compressionOptions: Partial<CompressionOptions> = {}
  ) {
    this.contextCache = new Map();
    this.sessionStates = new Map();
    this.compressionCache = new Map();
    this.performanceMetrics = {
      compressionTime: 0,
      decompressionTime: 0,
      retrievalTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0
    };

    this.cacheConfig = {
      maxSize: cacheConfig.maxSize || 1000,
      ttl: cacheConfig.ttl || 300000, // 5 minutes
      evictionPolicy: cacheConfig.evictionPolicy || 'lru'
    };

    this.compressionOptions = {
      algorithm: compressionOptions.algorithm || 'lz-string',
      level: compressionOptions.level || 6,
      threshold: compressionOptions.threshold || 1024 // 1KB
    };

    this.startCleanupProcess();
  }

  /**
   * Compresses context data using specified algorithm
   */
  private async compressContext(data: Record<string, any>): Promise<string> {
    const startTime = Date.now();
    const serialized = JSON.stringify(data);
    
    if (serialized.length < (this.compressionOptions.threshold || 1024)) {
      return serialized;
    }

    let compressed: string;
    switch (this.compressionOptions.algorithm) {
      case 'lz-string':
        // Using LZ-String compression (would require lz-string package)
        compressed = this.lzStringCompress(serialized);
        break;
      case 'gzip':
        compressed = await this.gzipCompress(serialized);
        break;
      case 'deflate':
        compressed = await this.deflateCompress(serialized);
        break;
      default:
        compressed = serialized;
    }

    this.performanceMetrics.compressionTime = Date.now() - startTime;
    return compressed;
  }

  /**
   * Decompresses context data
   */
  private async decompressContext(compressedData: string): Promise<Record<string, any>> {
    const startTime = Date.now();
    let decompressed: string;

    // Check if data was actually compressed
    try {
      const parsed = JSON.parse(compressedData);
      if (typeof parsed === 'object' && parsed !== null) {
        this.performanceMetrics.decompressionTime = Date.now() - startTime;
        return parsed;
      }
    } catch (e) {
      // Data is compressed, continue with decompression
    }

    switch (this.compressionOptions.algorithm) {
      case 'lz-string':
        decompressed = this.lzStringDecompress(compressedData);
        break;
      case 'gzip':
        decompressed = await this.gzipDecompress(compressedData);
        break;
      case 'deflate':
        decompressed = await this.deflateDecompress(compressedData);
        break;
      default:
        decompressed = compressedData;
    }

    this.performanceMetrics.decompressionTime = Date.now() - startTime;
    return JSON.parse(decompressed);
  }

  // Compression algorithm implementations (simplified)
  private lzStringCompress(data: string): string {
    // In real implementation, would use lz-string library
    // return LZString.compressToUTF16(data);
    return data; // Placeholder
  }

  private lzStringDecompress(data: string): string {
    // In real implementation, would use lz-string library
    // return LZString.decompressFromUTF16(data);
    return data; // Placeholder
  }

  private async gzipCompress(data: string): Promise<string> {
    // In real implementation, would use zlib or pako library
    // return pako.gzip(data, { to: 'string' });
    return data; // Placeholder
  }

  private async gzipDecompress(data: string): Promise<string> {
    // In real implementation, would use zlib or pako library
    // return pako.ungzip(data, { to: 'string' });
    return data; // Placeholder
  }

  private async deflateCompress(data: string): Promise<string> {
    // In real implementation, would use zlib or pako library
    // return pako.deflate(data, { to: 'string' });
    return data; // Placeholder
  }

  private async deflateDecompress(data: string): Promise<string> {
    // In real implementation, would use zlib or pako library
    // return pako.inflate(data, { to: 'string' });
    return data; // Placeholder
  }

  /**
   * Stores context data with automatic compression
   */
  public async storeContext(id: string, data: Record<string, any>): Promise<void> {
    // Check for memory leak prevention
    if (this.contextCache.size >= this.cacheConfig.maxSize * 0.9) {
      this.evictEntries();
    }

    const size = new Blob([JSON.stringify(data)]).size;
    if (size > this.MAX_CONTEXT_SIZE) {
      throw new ContextManagerError(
        `Context size ${size} exceeds maximum allowed size ${this.MAX_CONTEXT_SIZE}`,
        'CONTEXT_TOO_LARGE'
      );
    }

    const compressedData = await this.compressContext(data);
    
    const contextData: ContextData = {
      id,
      data: compressedData as any, // Will be decompressed when retrieved
      metadata: {
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        size
      }
    };

    this.contextCache.set(id, contextData);
    this.updateMemoryUsage();
  }

  /**
   * Retrieves context data with decompression
   */
  public async retrieveContext(id: string): Promise<Record<string, any> | null> {
    const startTime = Date.now();
    const contextData = this.contextCache.get(id);

    if (!contextData) {
      this.performanceMetrics.retrievalTime = Date.now() - startTime;
      return null;
    }

    // Update metadata for cache algorithms
    contextData.metadata.lastAccessed = Date.now();
    contextData.metadata.accessCount++;

    const decompressedData = await this.decompressContext(contextData.data as any);
    this.performanceMetrics.retrievalTime = Date.now() - startTime;
    
    return decompressedData;
  }

  /**
   * Updates existing context data
   */
  public async updateContext(id: string, data: Record<string, any>): Promise<void> {
    const existingContext = this.contextCache.get(id);
    if (!existingContext) {
      throw new ContextManagerError(`Context with id ${id} not found`, 'CONTEXT_NOT_FOUND');
    }

    const size = new Blob([JSON.stringify(data)]).size;
    if (size > this.MAX_CONTEXT_SIZE) {
      throw new ContextManagerError(
        `Context size ${size} exceeds maximum allowed size ${this.MAX_CONTEXT_SIZE}`,
        'CONTEXT_TOO_LARGE'
      );
    }

    const compressedData = await this.compressContext(data);
    
    existingContext.data = compressedData as any;
    existingContext.metadata.size = size;
    existingContext.metadata.lastAccessed = Date.now();
    
    this.contextCache.set(id, existingContext);
    this.updateMemoryUsage();
  }

  /**
   * Deletes context data
   */
  public deleteContext(id: string): boolean {
    const result = this.contextCache.delete(id);
    this.compressionCache.delete(id);
    this.updateMemoryUsage();
    return result;
  }

  /**
   * Creates a new session state
   */
  public createSession(sessionId: string): SessionState {
    const session: SessionState = {
      sessionId,
      contextStack: [],
      variables: {},
      createdAt: Date.now(),
      lastActive: Date.now()
    };

    this.sessionStates.set(sessionId, session);
    return session;
  }

  /**
   * Gets session state
   */
  public getSession(sessionId: string): SessionState | null {
    const session = this.sessionStates.get(sessionId);
    if (session) {
      session.lastActive = Date.now();
    }
    return session || null;
  }

  /**
   * Updates session variables
   */
  public updateSessionVariables(sessionId: string, variables: Record<string, any>): void {
    const session = this.sessionStates.get(sessionId);
    if (!session) {
      throw new ContextManagerError(`Session ${sessionId} not found`, 'SESSION_NOT_FOUND');
    }

    session.variables = { ...session.variables, ...variables };
    session.lastActive = Date.now();
  }

  /**
   * Pushes context to session stack
   */
  public pushContextToSession(sessionId: string, contextId: string): void {
    const session = this.sessionStates.get(sessionId);
    if (!session) {
      throw new ContextManagerError(`Session ${sessionId} not found`, 'SESSION_NOT_FOUND');
    }

    session.contextStack.push(contextId);
    session.lastActive = Date.now();
  }

  /**
   * Pops context from session stack
   */
  public popContextFromSession(sessionId: string): string | null {
    const session = this.sessionStates.get(sessionId);
    if (!session) {
      throw new ContextManagerError(`Session ${sessionId} not found`, 'SESSION_NOT_FOUND');
    }

    const contextId = session.contextStack.pop() || null;
    session.lastActive = Date.now();
    return contextId;
  }

  /**
   * Serializes context to string
   */
  public async serializeContext(id: string): Promise<string> {
    const context = this.contextCache.get(id);
    if (!context) {
      throw new ContextManagerError(`Context ${id} not found`, 'CONTEXT_NOT_FOUND');
    }

    return JSON.stringify({
      id: context.id,
      data: context.data,
      metadata: context.metadata
    });
  }

  /**
   * Deserializes context from string
   */
  public async deserializeContext(serializedData: string): Promise<void> {
    try {
      const parsed = JSON.parse(serializedData);
      this.contextCache.set(parsed.id, parsed);
      this.updateMemoryUsage();
    } catch (error) {
      throw new ContextManagerError('Invalid serialized context data', 'INVALID_SERIALIZATION');
    }
  }

  /**
   * Gets performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    return {
      size: this.contextCache.size,
      maxSize: this.cacheConfig.maxSize,
      hitRate: this.performanceMetrics.cacheHitRate,
      memoryUsage: this.performanceMetrics.memoryUsage
    };
  }

  /**
   * Evicts entries based on configured policy
   */
  private evictEntries(): void {
    const entries = Array.from(this.contextCache.entries());
    
    switch (this.cacheConfig.evictionPolicy) {
      case 'lru': // Least Recently Used
        entries.sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed);
        break;
      case 'lfu': // Least Frequently Used
        entries.sort((a, b) => a[1].metadata.accessCount - b[1].metadata.accessCount);
        break;
      case 'fifo': // First In, First Out
        entries.sort((a, b) => a[1].metadata.createdAt - b[1].metadata.createdAt);
        break;
    }

    // Remove oldest 10% of entries
    const removeCount = Math.max(1, Math.floor(entries.length * 0.1));
    for (let i = 0; i < removeCount; i++) {
      const [id] = entries[i];
      this.contextCache.delete(id);
      this.compressionCache.delete(id);
    }

    this.updateMemoryUsage();
  }

  /**
   * Updates memory usage metrics
   */
  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const context of this.contextCache.values()) {
      totalSize += context.metadata.size;
    }
    this.performanceMetrics.memoryUsage = totalSize;
  }

  /**
   * Starts automatic cleanup process
   */
  private startCleanupProcess(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
      this.checkForMemoryLeaks();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Cleans up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, context] of this.contextCache.entries()) {
      if (now - context.metadata.lastAccessed > this.cacheConfig.ttl) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      this.contextCache.delete(id);
      this.compressionCache.delete(id);
    }

    if (expiredIds.length > 0) {
      this.updateMemoryUsage();
    }
  }

  /**
   * Checks for potential memory leaks
   */
  private checkForMemoryLeaks(): void {
    // Check for sessions that haven't been active for a long time
    const now = Date.now();
    const staleSessionThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sessionId, session] of this.sessionStates.entries()) {
      if (now - session.lastActive > staleSessionThreshold) {
        this.sessionStates.delete(sessionId);
      }
    }

    // Check for excessive memory usage
    if (this.performanceMetrics.memoryUsage > this.MAX_CONTEXT_SIZE * 10) {
      throw new MemoryLeakError(
        `Memory usage ${this.performanceMetrics.memoryUsage} exceeds safe threshold`
      );
    }
  }

  /**
   * Clears all data and stops cleanup process
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.contextCache.clear();
    this.sessionStates.clear();
    this.compressionCache.clear();
    this.performanceMetrics = {
      compressionTime: 0,
      decompressionTime: 0,
      retrievalTime: 0,
      cacheHitRate: 0,
      memoryUsage: 0
    };
  }

  /**
   * Clears expired entries manually
   */
  public async clearExpired(): Promise<number> {
    const beforeCount = this.contextCache.size;
    this.cleanupExpiredEntries();
    return beforeCount - this.contextCache.size;
  }
}

// Export types for external use
export type {
  ContextData,
  CompressionOptions,
  CacheConfig,
  PerformanceMetrics,
  SessionState
};

export { ContextManagerError, MemoryLeakError };