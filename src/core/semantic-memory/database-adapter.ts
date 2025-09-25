/**
 * Database Adapter for Phase 1 Semantic Memory
 * Bridges enhanced memory system with existing UnifiedDatabaseManager
 * Provides simple query interface for Phase 1 implementation
 */

import Database = require('better-sqlite3');

export interface DatabaseResult {
  lastID?: number;
  changes?: number;
}

export class DatabaseAdapter {
  private db: Database.Database;

  constructor(dbPath: string = './data/devflow_unified.sqlite') {
    this.db = new Database(dbPath);

    // Enable optimizations
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
  }

  /**
   * Execute a query that returns a single row
   */
  get(sql: string, params: any[] = []): any {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    } catch (error) {
      console.error('Database GET error:', error);
      throw error;
    }
  }

  /**
   * Execute a query that returns multiple rows
   */
  all(sql: string, params: any[] = []): any[] {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('Database ALL error:', error);
      throw error;
    }
  }

  /**
   * Execute a query that modifies data (INSERT, UPDATE, DELETE)
   */
  run(sql: string, params: any[] = []): DatabaseResult {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        lastID: result.lastInsertRowid as number,
        changes: result.changes
      };
    } catch (error) {
      console.error('Database RUN error:', error);
      throw error;
    }
  }

  /**
   * Execute multiple statements in a transaction
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  /**
   * Check if a table exists
   */
  tableExists(tableName: string): boolean {
    const result = this.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return !!result;
  }

  /**
   * Get database file size in bytes
   */
  getDatabaseSize(): number {
    try {
      const fs = require('fs');
      const stats = fs.statSync(this.db.name);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Optimize database (VACUUM and ANALYZE)
   */
  optimize(): void {
    this.db.pragma('optimize');
  }
}