// src/core/task-hierarchy/database.ts

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class TaskHierarchyDatabase {
  private db: Database.Database;
  private readonly dbPath: string;
  private readonly schemaPath: string;

  constructor(dbPath: string = './task-hierarchy.db') {
    this.dbPath = dbPath;
    this.schemaPath = path.join(__dirname, '../../../docs/schemas/task_hierarchy.sql');
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    try {
      // Enable foreign key constraints
      this.db.exec('PRAGMA foreign_keys = ON;');
      
      // Enable WAL mode for better concurrency
      this.db.exec('PRAGMA journal_mode = WAL;');
      
      // Create tables if they don't exist
      const schema = fs.readFileSync(this.schemaPath, 'utf8');
      this.db.exec(schema);
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  public getDatabase(): Database.Database {
    return this.db;
  }

  public beginTransaction(): Database.Transaction {
    return this.db.transaction(() => {});
  }

  public healthCheck(): boolean {
    try {
      const result = this.db.prepare('SELECT 1').get();
      return result !== undefined;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  public backup(backupPath: string): void {
    try {
      const backupDb = new Database(backupPath);
      this.db.backup(backupDb);
      backupDb.close();
      console.log(`Database backed up to ${backupPath}`);
    } catch (error) {
      console.error('Database backup failed:', error);
      throw error;
    }
  }

  public close(): void {
    this.db.close();
  }

  public executeMigration(migrationSql: string): void {
    try {
      this.db.exec(migrationSql);
      console.log('Migration executed successfully');
    } catch (error) {
      console.error('Migration execution failed:', error);
      throw error;
    }
  }
}

// Singleton instance for application use
export const taskHierarchyDb = new TaskHierarchyDatabase();
