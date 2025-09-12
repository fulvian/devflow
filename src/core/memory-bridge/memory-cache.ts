export type MemoryType = 'recent' | 'working' | 'semantic' | 'episodic';

export interface MemoryBlock {
  id: string;
  content: string;
  type: MemoryType;
  importance: number; // 0-1 scale
  tokens: number;
  timestamp: number;
  priority?: number; // Used during compression
}

export interface CacheStats {
  totalBlocks: number;
  totalSize: number;
  hitRate: number;
  evictions: number;
}

export interface PersistenceConfig {
  enabled: boolean;
  storageKey: string;
  syncInterval: number;
}

export class MemoryCache {
  private cache: Map<string, MemoryBlock> = new Map();
  private lruOrder: string[] = [];
  private maxSize: number;
  private stats: CacheStats = { totalBlocks: 0, totalSize: 0, hitRate: 0, evictions: 0 };
  private hits = 0;
  private misses = 0;

  constructor(
    maxSize: number = 1000,
    private persistenceConfig: PersistenceConfig = { enabled: false, storageKey: 'devflow_memory', syncInterval: 30000 }
  ) {
    this.maxSize = maxSize;
    this.loadFromPersistence();
  }

  set(block: MemoryBlock): void {
    // Remove if exists to update LRU order
    if (this.cache.has(block.id)) {
      this.lruOrder = this.lruOrder.filter(id => id !== block.id);
    } else {
      this.stats.totalBlocks++;
    }

    this.cache.set(block.id, block);
    this.lruOrder.push(block.id);
    this.stats.totalSize += block.tokens;

    // Evict if necessary
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }

    this.syncToPersistence();
  }

  get(id: string): MemoryBlock | undefined {
    const block = this.cache.get(id);
    if (block) {
      // Update LRU order
      this.lruOrder = this.lruOrder.filter(blockId => blockId !== id);
      this.lruOrder.push(id);
      this.hits++;
      return block;
    }
    this.misses++;
    return undefined;
  }

  getByType(type: MemoryType, limit?: number): MemoryBlock[] {
    const blocks = Array.from(this.cache.values())
      .filter(block => block.type === type)
      .sort((a, b) => b.importance - a.importance);
    
    return limit ? blocks.slice(0, limit) : blocks;
  }

  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    this.stats.hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    return { ...this.stats };
  }

  private evictLRU(): void {
    if (this.lruOrder.length === 0) return;
    
    const lruId = this.lruOrder.shift()!;
    const block = this.cache.get(lruId);
    if (block) {
      this.cache.delete(lruId);
      this.stats.totalSize -= block.tokens;
      this.stats.evictions++;
      this.stats.totalBlocks--;
    }
  }

  private loadFromPersistence(): void {
    if (!this.persistenceConfig.enabled) return;
    
    try {
      // In Node.js environment, use fs instead of localStorage
      const fs = require('fs');
      const path = require('path');
      const cacheFile = path.join(process.cwd(), '.devflow', 'memory-cache.json');
      
      if (fs.existsSync(cacheFile)) {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        data.forEach((block: MemoryBlock) => {
          this.cache.set(block.id, block);
          this.lruOrder.push(block.id);
        });
      }
    } catch (error) {
      console.warn('Failed to load memory cache from persistence:', error);
    }
  }

  private syncToPersistence(): void {
    if (!this.persistenceConfig.enabled) return;
    
    try {
      const fs = require('fs');
      const path = require('path');
      const cacheDir = path.join(process.cwd(), '.devflow');
      const cacheFile = path.join(cacheDir, 'memory-cache.json');
      
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      const data = Array.from(this.cache.values());
      fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to sync memory cache to persistence:', error);
    }
  }

  clear(): void {
    this.cache.clear();
    this.lruOrder = [];
    this.stats = { totalBlocks: 0, totalSize: 0, hitRate: 0, evictions: 0 };
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.cache.size;
  }
}