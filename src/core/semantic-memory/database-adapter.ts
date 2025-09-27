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
  private preparedStatements: Map<string, Database.Statement> = new Map();

  constructor(dbPath: string = './data/devflow_unified.sqlite') {
    this.db = new Database(dbPath);

    // Context7: Better SQLite3 performance optimizations
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000'); // Increase cache size
    this.db.pragma('temp_store = memory'); // Store temp files in memory
    this.db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

    // Context7: WAL checkpoint management to prevent starvation
    this.setupWALCheckpoints();
  }

  /**
   * Context7: Setup WAL checkpoint management to prevent checkpoint starvation
   */
  private setupWALCheckpoints(): void {
    const fs = require('fs');
    const walFile = this.db.name + '-wal';
    const maxWalSize = 10 * 1024 * 1024; // 10MB

    setInterval(() => {
      fs.stat(walFile, (err: any, stat: any) => {
        if (err) {
          if (err.code !== 'ENOENT') console.error('WAL stat error:', err);
        } else if (stat.size > maxWalSize) {
          this.db.pragma('wal_checkpoint(RESTART)');
        }
      });
    }, 30000).unref(); // Check every 30 seconds
  }

  /**
   * Context7: Get or create prepared statement with caching
   */
  private getPreparedStatement(sql: string): Database.Statement {
    if (!this.preparedStatements.has(sql)) {
      this.preparedStatements.set(sql, this.db.prepare(sql));
    }
    return this.preparedStatements.get(sql)!;
  }

  /**
   * Execute a query that returns a single row (Context7 optimized)
   */
  get(sql: string, params: any[] = []): any {
    try {
      const stmt = this.getPreparedStatement(sql);
      return stmt.get(...params);
    } catch (error) {
      console.error('Database GET error:', error);
      throw error;
    }
  }

  /**
   * Execute a query that returns multiple rows (Context7 optimized)
   */
  all(sql: string, params: any[] = []): any[] {
    try {
      const stmt = this.getPreparedStatement(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('Database ALL error:', error);
      throw error;
    }
  }

  /**
   * Execute a query that modifies data (Context7 optimized with prepared statements)
   */
  run(sql: string, params: any[] = []): DatabaseResult {
    try {
      const stmt = this.getPreparedStatement(sql);
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
   * Close database connection (Context7: cleanup prepared statements)
   */
  close(): void {
    // Cleanup prepared statements
    this.preparedStatements.clear();
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