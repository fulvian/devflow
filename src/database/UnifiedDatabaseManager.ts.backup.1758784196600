/**
 * DevFlow Unified Database Manager v1.0
 * Post-schema unification implementation
 * Addresses divergences between DatabaseManager and orchestrator services
 */

import Database = require('better-sqlite3');
import { randomUUID } from 'crypto';

export interface UnifiedMemoryBlockEmbedding {
  block_id: string;
  embedding: Buffer;
  model: string;
  dimensions: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryBlock {
  id: string;
  content: string;
  type: string;
  created_at: string;
  updated_at: string;
  project_id?: number;
  task_context_id?: string;
}

export class UnifiedDatabaseManager {
  private db: Database.Database;

  constructor(dbPath: string = './data/devflow_unified.sqlite') {
    this.db = new Database(dbPath);

    // Enable optimizations and safety features
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');

    this.initializeSchema();
  }

  /**
   * Initialize unified schema (idempotent) - works with existing DevFlow schema
   */
  private initializeSchema(): void {
    // Verify existing tables exist (they should from DevFlow unified database)
    const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map((t: any) => t.name);

    if (!tableNames.includes('memory_blocks')) {
      throw new Error('memory_blocks table not found in unified database');
    }

    if (!tableNames.includes('memory_block_embeddings')) {
      throw new Error('memory_block_embeddings table not found in unified database');
    }

    // Ensure additional indexes exist for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_embeddings_model_enhanced ON memory_block_embeddings(model);
      CREATE INDEX IF NOT EXISTS idx_memory_blocks_type ON memory_blocks(type);
      CREATE INDEX IF NOT EXISTS idx_memory_blocks_created_at ON memory_blocks(created_at);
    `);

    console.log('✅ UnifiedDatabaseManager initialized with existing DevFlow schema');
  }

  /**
   * Store embedding with existing DevFlow schema
   */
  storeEmbedding(blockId: string, model: string, embedding: Buffer, dimensions: number): string {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory_block_embeddings (
        block_id, model, embedding, dimensions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    stmt.run(blockId, model, embedding, dimensions);
    return blockId; // Return blockId as primary key
  }

  /**
   * Retrieve embedding by block and model
   */
  getEmbedding(blockId: string, model: string): UnifiedMemoryBlockEmbedding | null {
    const stmt = this.db.prepare(`
      SELECT block_id, embedding, model, dimensions, created_at, updated_at
      FROM memory_block_embeddings
      WHERE block_id = ? AND model = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = stmt.get(blockId, model) as any;
    if (!row) return null;

    return {
      block_id: row.block_id,
      embedding: row.embedding,
      model: row.model,
      dimensions: row.dimensions,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  /**
   * Get all embeddings for a memory block
   */
  getEmbeddingsForBlock(blockId: string): UnifiedMemoryBlockEmbedding[] {
    const stmt = this.db.prepare(`
      SELECT block_id, embedding, model, dimensions, created_at, updated_at
      FROM memory_block_embeddings
      WHERE block_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(blockId) as any[];
    return rows.map(row => ({
      block_id: row.block_id,
      embedding: row.embedding,
      model: row.model,
      dimensions: row.dimensions,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  /**
   * Store memory block
   */
  storeMemoryBlock(id: string, content: string, type: string, projectId?: number, taskContextId?: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory_blocks (id, content, type, created_at, updated_at, project_id, task_context_id)
      VALUES (?, ?, ?, datetime('now'), datetime('now'), ?, ?)
    `);

    stmt.run(id, content, type, projectId || null, taskContextId || null);
  }

  /**
   * Query memory blocks with embeddings
   */
  queryMemoryBlocks(options: {
    type?: string;
    limit?: number;
    orderBy?: 'created_at' | 'updated_at';
  } = {}): Array<MemoryBlock & { embeddings: UnifiedMemoryBlockEmbedding[] }> {
    const { type, limit = 50, orderBy = 'created_at' } = options;

    let query = `
      SELECT mb.id, mb.content, mb.type, mb.created_at, mb.updated_at, mb.project_id, mb.task_context_id
      FROM memory_blocks mb
      WHERE 1=1
    `;

    const params: any[] = [];
    if (type) {
      query += ` AND mb.type = ?`;
      params.push(type);
    }

    query += ` ORDER BY mb.${orderBy} DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    const blocks = stmt.all(...params) as any[];

    // Fetch embeddings for each block
    return blocks.map(block => ({
      id: block.id,
      content: block.content,
      type: block.type,
      created_at: block.created_at,
      updated_at: block.updated_at,
      project_id: block.project_id,
      task_context_id: block.task_context_id,
      embeddings: this.getEmbeddingsForBlock(block.id)
    }));
  }

  /**
   * Batch operations for performance
   */
  batchStoreEmbeddings(embeddings: Array<{
    blockId: string;
    model: string;
    embedding: Buffer;
    dimensions: number;
  }>): string[] {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memory_block_embeddings (
        block_id, model, embedding, dimensions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const transaction = this.db.transaction(() => {
      const ids: string[] = [];
      for (const embedding of embeddings) {
        stmt.run(embedding.blockId, embedding.model, embedding.embedding, embedding.dimensions);
        ids.push(embedding.blockId);
      }
      return ids;
    });

    return transaction();
  }

  /**
   * Search embeddings by similarity (requires cosine similarity implementation)
   */
  findSimilarEmbeddings(
    queryVector: Buffer,
    model: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Array<UnifiedMemoryBlockEmbedding & { similarity: number }> {
    // Note: This is a simplified version. For production, implement proper vector similarity
    const stmt = this.db.prepare(`
      SELECT block_id, embedding, model, dimensions, created_at, updated_at
      FROM memory_block_embeddings
      WHERE model = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(model, limit * 2) as any[]; // Get more to filter by similarity

    // Simplified similarity calculation (replace with proper cosine similarity)
    const results = rows.map(row => ({
      block_id: row.block_id,
      embedding: row.embedding,
      model: row.model,
      dimensions: row.dimensions,
      created_at: row.created_at,
      updated_at: row.updated_at,
      similarity: 0.8 // Placeholder - implement actual similarity calculation
    })).filter(result => result.similarity >= threshold).slice(0, limit);

    return results;
  }

  /**
   * Get database statistics
   */
  getStats(): {
    memoryBlocks: number;
    embeddings: number;
    models: number;
    averageEmbeddingsPerBlock: number;
  } {
    const memoryBlocks = this.db.prepare('SELECT COUNT(*) as count FROM memory_blocks').get() as any;
    const embeddings = this.db.prepare('SELECT COUNT(*) as count FROM memory_block_embeddings').get() as any;
    const models = this.db.prepare('SELECT COUNT(DISTINCT model_id) as count FROM memory_block_embeddings').get() as any;

    const avgEmbeddings = memoryBlocks.count > 0 ? embeddings.count / memoryBlocks.count : 0;

    return {
      memoryBlocks: memoryBlocks.count,
      embeddings: embeddings.count,
      models: models.count,
      averageEmbeddingsPerBlock: Math.round(avgEmbeddings * 100) / 100
    };
  }

  /**
   * Cleanup and close database connection
   */
  close(): void {
    this.db.close();
  }
}

export default UnifiedDatabaseManager;