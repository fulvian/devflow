import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Mutex } from 'async-mutex';

// Session interface matching original structure
export interface Session {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_accessed_at: string;
  data: string;
}

// SessionBatch interface matching original structure
export interface SessionBatch {
  id: string;
  session_id: string;
  batch_data: string;
  created_at: string;
  processed_at: string | null;
}

/**
 * DatabaseManager class that provides database operations for the daemon
 */
export class DatabaseManager {
  private db: Database | null = null;
  private mutex = new Mutex();
  private initialized = false;

  /**
   * Constructor for DatabaseManager
   */
  constructor() {
    // Empty constructor as expected by daemon interface
  }

  /**
   * Initialize the database connection and tables
   * Uses DEVFLOW_DB_PATH environment variable for database location
   */
  async initialize(): Promise<void> {
    return this.mutex.runExclusive(async () => {
      if (this.initialized) {
        return;
      }

      const dbPath = process.env.DEVFLOW_DB_PATH || './devflow.db';
      
      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Create sessions table with renamed table name
      await this.db!.run(`
        CREATE TABLE IF NOT EXISTS manager_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          last_accessed_at TEXT NOT NULL,
          data TEXT NOT NULL
        )
      `);

      // Create session batches table with renamed table name
      await this.db!.run(`
        CREATE TABLE IF NOT EXISTS manager_session_batches (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          batch_data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          processed_at TEXT
        )
      `);

      this.initialized = true;
    });
  }

  /**
   * Check if the database is healthy
   * @returns boolean indicating health status
   */
  isHealthy(): boolean {
    return this.initialized && this.db !== null;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

// Backward compatibility function exports
export async function initialize(): Promise<DatabaseManager> {
  const manager = new DatabaseManager();
  await manager.initialize();
  return manager;
}

export function isHealthy(manager: DatabaseManager): boolean {
  return manager.isHealthy();
}

export async function close(manager: DatabaseManager): Promise<void> {
  await manager.close();
}