/**
 * Robust Token Cache System - Anti-crash LRU + TTL Implementation
 * Based on Context7 best practices for high-performance caching
 * Prevents system overload and ensures resilient token tracking
 */

interface CacheItem {
  value: any;
  timestamp: number;
  expireTime: number;
  accessCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  errors: number;
}

export class RobustTokenCache {
  private cache = new Map<string, CacheItem>();
  private timers = new Map<string, NodeJS.Timeout>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    errors: 0
  };

  private readonly maxSize: number;
  private readonly defaultTTL: number; // milliseconds
  private readonly maxMemoryMB: number;
  private readonly cleanupInterval: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: {
    maxSize?: number;
    defaultTTL?: number; // seconds
    maxMemoryMB?: number;
    cleanupInterval?: number; // seconds
  } = {}) {
    this.maxSize = options.maxSize || 50; // Limit cache size
    this.defaultTTL = (options.defaultTTL || 30) * 1000; // 30s default
    this.maxMemoryMB = options.maxMemoryMB || 10; // 10MB limit
    this.cleanupInterval = (options.cleanupInterval || 60) * 1000; // 60s cleanup

    // Start cleanup timer
    this.startCleanupTimer();

    // Graceful shutdown
    process.on('SIGINT', () => this.destroy());
    process.on('SIGTERM', () => this.destroy());
  }

  /**
   * Set cache item with TTL and size monitoring
   */
  set(key: string, value: any, ttlSeconds?: number): boolean {
    try {
      const now = Date.now();
      const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTTL;
      const expireTime = now + ttl;

      // Check memory pressure before adding
      if (!this.checkMemoryPressure()) {
        this.forceCleanup();
      }

      // LRU eviction if needed
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        this.evictLRU();
      }

      // Clear existing timer if updating
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key)!);
      }

      // Set new item
      const item: CacheItem = {
        value,
        timestamp: now,
        expireTime,
        accessCount: 0
      };

      this.cache.set(key, item);

      // Set expiration timer
      const timer = setTimeout(() => {
        this.delete(key);
      }, ttl);

      this.timers.set(key, timer);
      this.stats.sets++;

      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cache item with automatic cleanup
   */
  get(key: string): any {
    try {
      const item = this.cache.get(key);

      if (!item) {
        this.stats.misses++;
        return undefined;
      }

      const now = Date.now();

      // Check if expired
      if (now > item.expireTime) {
        this.delete(key);
        this.stats.misses++;
        return undefined;
      }

      // Update access tracking for LRU
      item.accessCount++;
      item.timestamp = now;

      this.stats.hits++;
      return item.value;
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.errors++;
      return undefined;
    }
  }

  /**
   * Check if key exists and not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expireTime) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete cache item safely
   */
  delete(key: string): boolean {
    try {
      const timer = this.timers.get(key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(key);
      }

      const deleted = this.cache.delete(key);
      if (deleted) {
        this.stats.evictions++;
      }

      return deleted;
    } catch (error) {
      console.error('Cache delete error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get or set pattern for lazy loading
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    ttlSeconds?: number
  ): Promise<T | undefined> {
    try {
      // Try cache first
      let value = this.get(key);
      if (value !== undefined) {
        return value;
      }

      // Factory function
      value = await factory();
      if (value !== undefined) {
        this.set(key, value, ttlSeconds);
      }

      return value;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      this.stats.errors++;
      return undefined;
    }
  }

  /**
   * LRU eviction - remove least recently used
   */
  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    let lowestAccess = Infinity;

    for (const [key, item] of this.cache) {
      // Prioritize by access count, then by timestamp
      if (item.accessCount < lowestAccess ||
          (item.accessCount === lowestAccess && item.timestamp < oldestTime)) {
        oldestKey = key;
        oldestTime = item.timestamp;
        lowestAccess = item.accessCount;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  /**
   * Check memory pressure heuristically
   */
  private checkMemoryPressure(): boolean {
    try {
      const memUsage = process.memoryUsage();
      const usedMB = memUsage.heapUsed / 1024 / 1024;

      return usedMB < this.maxMemoryMB;
    } catch {
      return true; // Assume OK if can't check
    }
  }

  /**
   * Force cleanup of expired items
   */
  private forceCleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, item] of this.cache) {
      if (now > item.expireTime) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    // If still over limit, evict LRU
    while (this.cache.size > this.maxSize * 0.8) {
      this.evictLRU();
    }
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.forceCleanup();
    }, this.cleanupInterval);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { size: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  /**
   * Clear all cache entries safely
   */
  clear(): void {
    try {
      // Clear all timers
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }

      this.timers.clear();
      this.cache.clear();

      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        evictions: 0,
        errors: 0
      };
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Graceful shutdown
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// Export singleton instance with optimized settings for token tracking
export const tokenCache = new RobustTokenCache({
  maxSize: 20,        // Small cache for token data
  defaultTTL: 2,      // 2 second default TTL for real-time feel
  maxMemoryMB: 5,     // 5MB memory limit
  cleanupInterval: 10 // 10 second cleanup for faster cache invalidation
});