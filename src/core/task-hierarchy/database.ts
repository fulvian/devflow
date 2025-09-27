/**
 * In-memory database implementation to replace better-sqlite3
 * Provides compatible API interface for basic database operations
 */

interface Row {
  [key: string]: any;
}

interface Statement {
  run(...params: any[]): RunResult;
  get(...params: any[]): Row | undefined;
  all(...params: any[]): Row[];
}

interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

interface DatabaseOptions {
  memory?: boolean;
}

class InMemoryDatabase {
  private tables: Map<string, Map<number, Row>> = new Map();
  private autoIncrementCounters: Map<string, number> = new Map();
  private tableName: string | null = null;

  constructor(filename?: string, options?: DatabaseOptions) {
    // For compatibility, we accept filename and options but ignore them
    // since we're implementing in-memory storage
  }

  /**
   * Prepare a statement for execution
   * @param sql SQL statement to prepare
   * @returns Statement object with run, get, and all methods
   */
  prepare(sql: string): Statement {
    // Extract table name from SQL for internal tracking
    const tableMatch = sql.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i);
    if (tableMatch) {
      this.tableName = tableMatch[1];
      if (!this.tables.has(this.tableName)) {
        this.tables.set(this.tableName, new Map<number, Row>());
        this.autoIncrementCounters.set(this.tableName, 0);
      }
    }

    return new InMemoryStatement(sql, this.tables, this.autoIncrementCounters, this.tableName);
  }

  /**
   * Execute a statement immediately
   * @param sql SQL statement to execute
   * @param params Parameters for the statement
   * @returns Result of the execution
   */
  exec(sql: string, ...params: any[]): RunResult {
    const statement = this.prepare(sql);
    return statement.run(...params);
  }

  /**
   * Close the database connection
   */
  close(): void {
    // No resources to clean up in this in-memory implementation
  }

  /**
   * Begin a transaction
   */
  transaction(): void {
    // Transactions not implemented in this simple version
  }
}

class InMemoryStatement implements Statement {
  private sql: string;
  private tables: Map<string, Map<number, Row>>;
  private autoIncrementCounters: Map<string, number>;
  private tableName: string | null;

  constructor(
    sql: string,
    tables: Map<string, Map<number, Row>>,
    autoIncrementCounters: Map<string, number>,
    tableName: string | null
  ) {
    this.sql = sql;
    this.tables = tables;
    this.autoIncrementCounters = autoIncrementCounters;
    this.tableName = tableName;
  }

  /**
   * Execute the statement and return result information
   * @param params Parameters for the statement
   * @returns RunResult with changes and lastInsertRowid
   */
  run(...params: any[]): RunResult {
    const changes = this.executeStatement(params);
    const lastInsertRowid = this.tableName 
      ? this.autoIncrementCounters.get(this.tableName) || 0 
      : 0;
    
    return { changes, lastInsertRowid };
  }

  /**
   * Execute the statement and return the first result
   * @param params Parameters for the statement
   * @returns First matching row or undefined
   */
  get(...params: any[]): Row | undefined {
    const results = this.executeSelect(params, true);
    return results.length > 0 ? results[0] : undefined;
  }

  /**
   * Execute the statement and return all results
   * @param params Parameters for the statement
   * @returns Array of matching rows
   */
  all(...params: any[]): Row[] {
    return this.executeSelect(params, false);
  }

  private executeStatement(params: any[]): number {
    let changes = 0;

    if (!this.tableName) {
      throw new Error('Could not determine table name from SQL statement');
    }

    const table = this.tables.get(this.tableName);
    if (!table) {
      throw new Error(`Table ${this.tableName} does not exist`);
    }

    if (this.sql.toUpperCase().startsWith('INSERT')) {
      const newRow: Row = {};
      let autoIncrementId = this.autoIncrementCounters.get(this.tableName) || 0;
      
      // Handle INSERT statement
      const valuesMatch = this.sql.match(/VALUES\s*\((.+)\)/i);
      if (valuesMatch) {
        const values = valuesMatch[1].split(',').map(v => v.trim());
        
        // Simple parsing - in a real implementation this would be more robust
        values.forEach((value, index) => {
          if (value.toUpperCase() === 'NULL') {
            newRow[`column${index}`] = null;
          } else if (value.startsWith("'") && value.endsWith("'")) {
            newRow[`column${index}`] = value.slice(1, -1);
          } else if (!isNaN(Number(value))) {
            newRow[`column${index}`] = Number(value);
          } else {
            newRow[`column${index}`] = value;
          }
        });
      }

      // Handle auto-increment
      if (!newRow.id) {
        autoIncrementId++;
        newRow.id = autoIncrementId;
        this.autoIncrementCounters.set(this.tableName, autoIncrementId);
      }

      table.set(newRow.id, newRow);
      changes = 1;
    } else if (this.sql.toUpperCase().startsWith('UPDATE')) {
      // Handle UPDATE statement
      const setMatch = this.sql.match(/SET\s+(.+?)(?:\s+WHERE|$)/i);
      if (setMatch) {
        const setClause = setMatch[1];
        const setParts = setClause.split(',').map(part => part.trim());
        const setters: [string, any][] = [];
        
        setParts.forEach(part => {
          const [key, value] = part.split('=').map(p => p.trim());
          let parsedValue: any = value;
          
          if (value.toUpperCase() === 'NULL') {
            parsedValue = null;
          } else if (value.startsWith("'") && value.endsWith("'")) {
            parsedValue = value.slice(1, -1);
          } else if (!isNaN(Number(value))) {
            parsedValue = Number(value);
          }
          
          setters.push([key, parsedValue]);
        });

        // Apply to all rows (WHERE clause not implemented in this simple version)
        for (const row of table.values()) {
          setters.forEach(([key, value]) => {
            row[key] = value;
          });
          changes++;
        }
      }
    } else if (this.sql.toUpperCase().startsWith('DELETE')) {
      // Handle DELETE statement
      // Delete all rows (WHERE clause not implemented in this simple version)
      changes = table.size;
      table.clear();
    }

    return changes;
  }

  private executeSelect(params: any[], limitOne: boolean): Row[] {
    const results: Row[] = [];

    if (!this.tableName) {
      throw new Error('Could not determine table name from SQL statement');
    }

    const table = this.tables.get(this.tableName);
    if (!table) {
      return results;
    }

    // Simple implementation - return all rows
    for (const row of table.values()) {
      results.push({ ...row });
      if (limitOne && results.length >= 1) {
        break;
      }
    }

    return results;
  }
}

// Export the main database class as the default export
// to maintain compatibility with better-sqlite3 import style
export = InMemoryDatabase;