import type Database from 'better-sqlite3';
import type { MemoryBlock, MemoryQuery } from '@devflow/shared';
import { Queries } from '../database/queries.js';

export class BlockService {
  private q: Queries;
  constructor(db: Database.Database) {
    this.q = new Queries(db);
  }

  create(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): string {
    return this.q.storeMemoryBlock(block);
  }

  find(query: MemoryQuery): MemoryBlock[] {
    return this.q.retrieveMemoryBlocks(query);
  }

  update(id: string, updates: Partial<MemoryBlock>): void {
    this.q.updateMemoryBlock(id, updates);
  }

  remove(id: string): void {
    this.q.deleteMemoryBlock(id);
  }
}
