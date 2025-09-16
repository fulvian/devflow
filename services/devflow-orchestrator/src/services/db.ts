/**
 * Database Service for DevFlow Orchestrator
 * Provides SQLite database connection and basic query functionality
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface DatabaseConfig {
  path?: string;
  readonly?: boolean;
  memory?: boolean;
}

class DatabaseService {
  public db: Database.Database;
  private dbPath: string;

  constructor(config: DatabaseConfig = {}) {
    if (config.memory) {
      this.dbPath = ':memory:';
    } else {
      this.dbPath = config.path || join(process.cwd(), 'data', 'devflow.sqlite');
    }

    // Ensure data directory exists
    if (!config.memory && this.dbPath !== ':memory:') {
      const dataDir = join(process.cwd(), 'data');
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }
    }

    // Initialize database connection
    this.db = new Database(this.dbPath, {
      readonly: config.readonly || false,
      fileMustExist: false
    });

    // Initialize tables if they don't exist
    this.initializeTables();
  }

  private initializeTables(): void {
    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Task contexts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_contexts (
        id TEXT PRIMARY KEY,
        task_name TEXT,
        context_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Memory blocks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_blocks (
        id TEXT PRIMARY KEY,
        content TEXT,
        embedding BLOB,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Synthetic usage tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS synthetic_usage (
        id TEXT PRIMARY KEY,
        provider TEXT,
        agent_type TEXT,
        model TEXT,
        duration_ms INTEGER,
        tokens_in INTEGER,
        tokens_out INTEGER,
        cost_usd REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables initialized');
  }

  /**
   * Execute a simple SELECT query and return count
   * Used by the metrics endpoint in app.ts
   */
  public getCount(tableName: string): number {
    try {
      const stmt = this.db.prepare(`SELECT COUNT(*) as cnt FROM ${tableName}`);
      const result = stmt.get() as { cnt: number };
      return result?.cnt || 0;
    } catch (error) {
      console.error(`Error counting records in ${tableName}:`, error);
      return 0;
    }
  }

  /**
   * Insert a record into synthetic_usage table
   */
  public recordSyntheticUsage(record: {
    id: string;
    provider: string;
    agentType: string;
    model?: string;
    durationMs?: number;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
  }): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO synthetic_usage 
        (id, provider, agent_type, model, duration_ms, tokens_in, tokens_out, cost_usd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        record.id,
        record.provider,
        record.agentType,
        record.model || null,
        record.durationMs || null,
        record.tokensIn || null,
        record.tokensOut || null,
        record.costUsd || null
      );
    } catch (error) {
      console.error('Error recording synthetic usage:', error);
    }
  }

  /**
   * Close database connection
   */
  public close(): void {
    this.db.close();
  }

  /**
   * Get database info
   */
  public getInfo(): { path: string; size?: number } {
    const info: { path: string; size?: number } = { path: this.dbPath };
    
    try {
      if (this.dbPath !== ':memory:') {
        const fs = require('fs');
        const stats = fs.statSync(this.dbPath);
        info.size = stats.size;
      }
    } catch (error) {
      // Ignore errors getting file size
    }
    
    return info;
  }
}

// Singleton instance
const dbService = new DatabaseService();

// Export the service instance and class
export { dbService as db, DatabaseService };
export default dbService;