/**
 * DevFlow Phase 1 Database Schema Implementation
 * 
 * This module provides a complete SQLite database implementation for DevFlow Phase 1,
 * using sqlite3 instead of better-sqlite3 for compatibility.
 */

import * as sqlite3 from 'sqlite3';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { dirname } from 'path';

interface TableInfo {
  name: string;
}

/**
 * DevFlow Database Schema Manager
 */
export class DevFlowDatabase {
  private db: sqlite3.Database;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = this.initializeDatabase();
  }

  /**
   * Initialize the SQLite database connection
   */
  private initializeDatabase(): sqlite3.Database {
    // Ensure directory exists
    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const db = new sqlite3.Database(this.dbPath);
    
    // Configure database settings
    db.serialize(() => {
      db.run("PRAGMA foreign_keys = ON");
      db.run("PRAGMA journal_mode = WAL");
      db.run("PRAGMA synchronous = NORMAL");
      db.run("PRAGMA cache_size = 65536");
      
      this.createSchema(db);
      this.createIndexes(db);
      this.createTriggers(db);
    });

    return db;
  }

  /**
   * Create the complete database schema
   */
  private createSchema(db: sqlite3.Database): void {
    // Create coordination sessions first (referenced by task_contexts)
    db.run(`
      CREATE TABLE IF NOT EXISTS coordination_sessions (
        id TEXT PRIMARY KEY,
        session_name TEXT NOT NULL,
        session_description TEXT,
        session_status TEXT NOT NULL DEFAULT 'active',
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        session_metadata TEXT
      )
    `);

    // Task contexts table for hierarchical task management
    db.run(`
      CREATE TABLE IF NOT EXISTS task_contexts (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        session_id TEXT NOT NULL,
        task_name TEXT NOT NULL,
        task_description TEXT,
        task_status TEXT NOT NULL DEFAULT 'pending',
        task_priority INTEGER DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        metadata TEXT,
        FOREIGN KEY (parent_id) REFERENCES task_contexts(id) ON DELETE CASCADE,
        FOREIGN KEY (session_id) REFERENCES coordination_sessions(id) ON DELETE CASCADE
      )
    `);

    // Memory block embeddings for vector storage
    db.run(`
      CREATE TABLE IF NOT EXISTS memory_block_embeddings (
        id TEXT PRIMARY KEY,
        task_context_id TEXT NOT NULL,
        embedding_vector BLOB NOT NULL,
        embedding_metadata TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_context_id) REFERENCES task_contexts(id) ON DELETE CASCADE
      )
    `);

    // Platform performance metrics
    db.run(`
      CREATE TABLE IF NOT EXISTS platform_performance (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metric_unit TEXT,
        recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES coordination_sessions(id) ON DELETE CASCADE
      )
    `);

    // Cost analytics for resource tracking
    db.run(`
      CREATE TABLE IF NOT EXISTS cost_analytics (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        cost_amount REAL NOT NULL,
        cost_currency TEXT NOT NULL DEFAULT 'USD',
        usage_amount REAL,
        usage_unit TEXT,
        recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES coordination_sessions(id) ON DELETE CASCADE
      )
    `);

    // Knowledge entities for semantic understanding
    db.run(`
      CREATE TABLE IF NOT EXISTS knowledge_entities (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_name TEXT NOT NULL,
        entity_description TEXT,
        entity_data TEXT,
        confidence_score REAL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT
      )
    `);

    // Entity relationships for knowledge graph
    db.run(`
      CREATE TABLE IF NOT EXISTS entity_relationships (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        relationship_strength REAL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (source_entity_id) REFERENCES knowledge_entities(id) ON DELETE CASCADE,
        FOREIGN KEY (target_entity_id) REFERENCES knowledge_entities(id) ON DELETE CASCADE
      )
    `);
  }

  /**
   * Create indexes for query optimization
   */
  private createIndexes(db: sqlite3.Database): void {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_task_contexts_session ON task_contexts(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_contexts_parent ON task_contexts(parent_id)',
      'CREATE INDEX IF NOT EXISTS idx_task_contexts_status ON task_contexts(task_status)',
      'CREATE INDEX IF NOT EXISTS idx_memory_blocks_task ON memory_block_embeddings(task_context_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_status ON coordination_sessions(session_status)',
      'CREATE INDEX IF NOT EXISTS idx_performance_session ON platform_performance(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_cost_session ON cost_analytics(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_entities_type ON knowledge_entities(entity_type)',
      'CREATE INDEX IF NOT EXISTS idx_relationships_source ON entity_relationships(source_entity_id)'
    ];

    indexes.forEach(sql => db.run(sql));
  }

  /**
   * Create triggers for automatic timestamp maintenance
   */
  private createTriggers(db: sqlite3.Database): void {
    const triggers = [
      `CREATE TRIGGER IF NOT EXISTS task_contexts_updated_trigger
       AFTER UPDATE ON task_contexts
       BEGIN
         UPDATE task_contexts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
      `CREATE TRIGGER IF NOT EXISTS memory_blocks_updated_trigger
       AFTER UPDATE ON memory_block_embeddings
       BEGIN
         UPDATE memory_block_embeddings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`
    ];

    triggers.forEach(sql => db.run(sql));
  }

  /**
   * Perform database health check and validation
   */
  public healthCheck(): Promise<{ status: string; details: any }> {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN (
          'task_contexts', 'memory_block_embeddings', 'coordination_sessions',
          'platform_performance', 'cost_analytics', 'knowledge_entities',
          'entity_relationships'
        )
      `, (err, tables: TableInfo[]) => {
        if (err) {
          reject(err);
          return;
        }

        const expectedTables = 7;
        const foundTables = tables.length;

        resolve({
          status: foundTables === expectedTables ? 'healthy' : 'degraded',
          details: {
            tables: { expected: expectedTables, found: foundTables },
            tableList: tables.map(t => t.name)
          }
        });
      });
    });
  }

  /**
   * Get database connection for direct queries
   */
  public getConnection(): sqlite3.Database {
    return this.db;
  }

  /**
   * Close database connection
   */
  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Run a query with promise interface
   */
  public run(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Get a single row with promise interface
   */
  public get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all rows with promise interface
   */
  public all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
}

/**
 * Database utility functions
 */
export class DatabaseUtils {
  /**
   * Generate a unique ID for database records
   */
  public static generateId(prefix: string = 'df'): string {
    return `${prefix}_${createHash('sha256')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 16)}`;
  }

  /**
   * Convert vector to BLOB for storage
   */
  public static vectorToBlob(vector: number[]): Buffer {
    const buffer = Buffer.alloc(vector.length * 4);
    for (let i = 0; i < vector.length; i++) {
      buffer.writeFloatLE(vector[i], i * 4);
    }
    return buffer;
  }

  /**
   * Convert BLOB back to vector
   */
  public static blobToVector(blob: Buffer): number[] {
    const vector: number[] = [];
    for (let i = 0; i < blob.length; i += 4) {
      vector.push(blob.readFloatLE(i));
    }
    return vector;
  }
}