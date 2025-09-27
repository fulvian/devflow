/**
 * Simple LRU Cache implementation for caching classification results
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private capacity: number;
  private hits: number = 0;
  private misses: number = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  /**
   * Get value from cache
   */
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      this.hits++;
      // Move to front (most recently used)
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    this.misses++;
    return undefined;
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V): void {
    // If key already exists, delete it to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used item (first item in map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // Add new item to end (most recently used)
    this.cache.set(key, value);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): { hits: number; misses: number } {
    return {
      hits: this.hits,
      misses: this.misses
    };
  }
}