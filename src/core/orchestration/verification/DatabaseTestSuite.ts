import { TestSuite, TestResult } from './types';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

/**
 * DatabaseTestSuite - Tests actual DevFlow SQLite database operations
 */
export class DatabaseTestSuite implements TestSuite {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data/devflow_unified.sqlite');
  }

  getName(): string {
    return 'Database Operations';
  }

  async runTests(): Promise<TestResult[]> {
    const tests = [
      this.testConnection.bind(this),
      this.testTaskContextsTable.bind(this),
      this.testSessionsTable.bind(this),
      this.testVectorMemoriesTable.bind(this),
      this.testMemoryBlocksTable.bind(this)
    ];

    const results: TestResult[] = [];
    
    for (const test of tests) {
      try {
        const result = await test();
        results.push(result);
      } catch (error) {
        results.push({
          testName: test.name,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          executionTime: 0,
          evidence: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }
    
    return results;
  }

  private async testConnection(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        const executionTime = Date.now() - startTime;
        
        if (err) {
          resolve({
            testName: 'Database Connection',
            status: 'failed',
            errorMessage: `Failed to connect to database: ${err.message}`,
            executionTime,
            evidence: { error: err.message, dbPath: this.dbPath }
          });
        } else {
          db.close();
          resolve({
            testName: 'Database Connection',
            status: 'passed',
            executionTime,
            evidence: { connected: true, dbPath: this.dbPath }
          });
        }
      });
    });
  }

  private async testTaskContextsTable(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      // Test table exists and has expected structure
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='task_contexts'", (err, row) => {
        if (err || !row) {
          db.close();
          resolve({
            testName: 'Task Contexts Table',
            status: 'failed',
            errorMessage: 'task_contexts table does not exist',
            executionTime: Date.now() - startTime,
            evidence: { tableExists: false }
          });
          return;
        }

        // Test CRUD operations
        const testId = `test_${Date.now()}`;
        db.run(
          "INSERT INTO task_contexts (id, title, description, status, priority) VALUES (?, ?, ?, ?, ?)",
          [testId, 'Test Task', 'Test Description', 'pending', 'medium'],
          function(insertErr) {
            if (insertErr) {
              db.close();
              resolve({
                testName: 'Task Contexts Table',
                status: 'failed',
                errorMessage: `Insert failed: ${insertErr.message}`,
                executionTime: Date.now() - startTime,
                evidence: { operation: 'insert', error: insertErr.message }
              });
              return;
            }

            // Test read
            db.get("SELECT * FROM task_contexts WHERE id = ?", [testId], (selectErr, selectRow) => {
              if (selectErr || !selectRow) {
                db.close();
                resolve({
                  testName: 'Task Contexts Table',
                  status: 'failed',
                  errorMessage: 'Read operation failed',
                  executionTime: Date.now() - startTime,
                  evidence: { operation: 'select', error: selectErr?.message }
                });
                return;
              }

              // Cleanup
              db.run("DELETE FROM task_contexts WHERE id = ?", [testId], (deleteErr) => {
                db.close();
                resolve({
                  testName: 'Task Contexts Table',
                  status: 'passed',
                  executionTime: Date.now() - startTime,
                  evidence: { 
                    tableExists: true,
                    insertWorked: true,
                    selectWorked: true,
                    deleteWorked: !deleteErr,
                    testRecord: selectRow
                  }
                });
              });
            });
          }
        );
      });
    });
  }

  private async testSessionsTable(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'", (err, row) => {
        if (err || !row) {
          db.close();
          resolve({
            testName: 'Sessions Table',
            status: 'failed',
            errorMessage: 'sessions table does not exist',
            executionTime: Date.now() - startTime,
            evidence: { tableExists: false }
          });
          return;
        }

        // Test structure
        db.all("PRAGMA table_info(sessions)", (pragmaErr, columns) => {
          db.close();
          resolve({
            testName: 'Sessions Table',
            status: 'passed',
            executionTime: Date.now() - startTime,
            evidence: { 
              tableExists: true,
              columns: columns || [],
              columnCount: columns?.length || 0
            }
          });
        });
      });
    });
  }

  private async testVectorMemoriesTable(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='vector_memories'", (err, row) => {
        if (err || !row) {
          db.close();
          resolve({
            testName: 'Vector Memories Table',
            status: 'failed',
            errorMessage: 'vector_memories table does not exist',
            executionTime: Date.now() - startTime,
            evidence: { tableExists: false }
          });
          return;
        }

        // Count records
        db.get("SELECT COUNT(*) as count FROM vector_memories", (countErr, countRow) => {
          db.close();
          resolve({
            testName: 'Vector Memories Table',
            status: 'passed',
            executionTime: Date.now() - startTime,
            evidence: { 
              tableExists: true,
              recordCount: (countRow as any)?.count || 0
            }
          });
        });
      });
    });
  }

  private async testMemoryBlocksTable(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_blocks'", (err, row) => {
        if (err || !row) {
          db.close();
          resolve({
            testName: 'Memory Blocks Table',
            status: 'failed',
            errorMessage: 'memory_blocks table does not exist',
            executionTime: Date.now() - startTime,
            evidence: { tableExists: false }
          });
          return;
        }

        // Count records
        db.get("SELECT COUNT(*) as count FROM memory_blocks", (countErr, countRow) => {
          db.close();
          resolve({
            testName: 'Memory Blocks Table',
            status: 'passed',
            executionTime: Date.now() - startTime,
            evidence: { 
              tableExists: true,
              recordCount: (countRow as any)?.count || 0
            }
          });
        });
      });
    });
  }
}