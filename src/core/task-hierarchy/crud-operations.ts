/**
 * In-memory database implementation to replace better-sqlite3
 * This provides a mock implementation for development and testing
 */

// Mock database class to replace better-sqlite3
class InMemoryDatabase {
  private data: Map<string, any[]> = new Map();
  private tables: Set<string> = new Set();

  constructor() {
    // Initialize with empty state
  }

  /**
   * Execute a SQL statement
   */
  exec(sql: string): void {
    // Parse SQL to determine action
    const normalizedSql = sql.trim().toUpperCase();
    
    if (normalizedSql.startsWith('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE\s+(\w+)/i);
      if (match) {
        this.tables.add(match[1]);
        this.data.set(match[1], []);
      }
    }
  }

  /**
   * Prepare a statement for execution
   */
  prepare(sql: string): InMemoryStatement {
    return new InMemoryStatement(sql, this);
  }

  /**
   * Get all rows from a table
   */
  getAll(table: string): any[] {
    return this.data.get(table) || [];
  }

  /**
   * Insert a row into a table
   */
  insert(table: string, row: any): void {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    this.data.get(table)?.push(row);
  }

  /**
   * Update rows in a table
   */
  update(table: string, updates: any, where: (row: any) => boolean): number {
    const rows = this.data.get(table) || [];
    let count = 0;
    
    for (let i = 0; i < rows.length; i++) {
      if (where(rows[i])) {
        rows[i] = { ...rows[i], ...updates };
        count++;
      }
    }
    
    return count;
  }

  /**
   * Delete rows from a table
   */
  delete(table: string, where: (row: any) => boolean): number {
    const rows = this.data.get(table) || [];
    let count = 0;
    
    for (let i = rows.length - 1; i >= 0; i--) {
      if (where(rows[i])) {
        rows.splice(i, 1);
        count++;
      }
    }
    
    return count;
  }
}

/**
 * Mock statement class to replace better-sqlite3 Statement
 */
class InMemoryStatement {
  private sql: string;
  private db: InMemoryDatabase;

  constructor(sql: string, db: InMemoryDatabase) {
    this.sql = sql;
    this.db = db;
  }

  /**
   * Run the statement with parameters
   */
  run(...params: any[]): { changes: number; lastInsertRowid?: number } {
    // This is a simplified implementation
    // In a real scenario, you'd parse the SQL and execute accordingly
    return { changes: 0 };
  }

  /**
   * Get all results
   */
  all(...params: any[]): any[] {
    // Simplified implementation
    const match = this.sql.match(/FROM\s+(\w+)/i);
    if (match) {
      return this.db.getAll(match[1]);
    }
    return [];
  }

  /**
   * Get one result
   */
  get(...params: any[]): any | undefined {
    const results = this.all(...params);
    return results.length > 0 ? results[0] : undefined;
  }
}

/**
 * Database interface to maintain existing API
 */
interface Database {
  exec(sql: string): void;
  prepare(sql: string): InMemoryStatement;
}

/**
 * Temporal consistency validation function
 * @param data The data to validate
 * @returns Boolean indicating if temporal consistency is maintained
 */
function validateTemporalConsistency(data: any): boolean {
  // Mock implementation - in a real scenario, this would check:
  // 1. That timestamps are in chronological order
  // 2. That there are no temporal overlaps
  // 3. That all required temporal fields are present
  
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check if data has temporal fields
  const hasTimestamps = 'createdAt' in data || 'updatedAt' in data || 'timestamp' in data;
  
  // Basic validation - ensure temporal fields are valid dates if present
  if (data.createdAt && isNaN(Date.parse(data.createdAt))) {
    return false;
  }
  
  if (data.updatedAt && isNaN(Date.parse(data.updatedAt))) {
    return false;
  }
  
  if (data.timestamp && isNaN(Date.parse(data.timestamp))) {
    return false;
  }

  // If we have temporal data, check chronological order
  if (data.createdAt && data.updatedAt) {
    const created = new Date(data.createdAt);
    const updated = new Date(data.updatedAt);
    if (updated < created) {
      return false;
    }
  }

  return true;
}

// Export the mock implementations
export { InMemoryDatabase as Database, InMemoryStatement as Statement, validateTemporalConsistency };