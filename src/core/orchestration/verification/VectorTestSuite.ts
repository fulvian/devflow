import { TestSuite, TestResult } from './types';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

/**
 * VectorTestSuite - Tests actual DevFlow vector operations
 */
export class VectorTestSuite implements TestSuite {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data/devflow.sqlite');
  }

  getName(): string {
    return 'Vector Operations';
  }

  async runTests(): Promise<TestResult[]> {
    const tests = [
      this.testVectorMemoriesTable.bind(this),
      this.testMemoryBlocksTable.bind(this),
      this.testMemoryBlockEmbeddings.bind(this),
      this.testVectorOperations.bind(this)
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

        // Test table schema
        db.all("PRAGMA table_info(vector_memories)", (pragmaErr, columns) => {
          if (pragmaErr) {
            db.close();
            resolve({
              testName: 'Vector Memories Table',
              status: 'failed',
              errorMessage: `Schema check failed: ${pragmaErr.message}`,
              executionTime: Date.now() - startTime,
              evidence: { schemaError: pragmaErr.message }
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
                columns: columns || [],
                recordCount: (countRow as any)?.count || 0
              }
            });
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

        // Count records and test structure
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

  private async testMemoryBlockEmbeddings(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='memory_block_embeddings'", (err, row) => {
        if (err || !row) {
          db.close();
          resolve({
            testName: 'Memory Block Embeddings Table',
            status: 'failed',
            errorMessage: 'memory_block_embeddings table does not exist',
            executionTime: Date.now() - startTime,
            evidence: { tableExists: false }
          });
          return;
        }

        // Count embeddings
        db.get("SELECT COUNT(*) as count FROM memory_block_embeddings", (countErr, countRow) => {
          db.close();
          resolve({
            testName: 'Memory Block Embeddings Table',
            status: 'passed',
            executionTime: Date.now() - startTime,
            evidence: { 
              tableExists: true,
              embeddingCount: (countRow as any)?.count || 0
            }
          });
        });
      });
    });
  }

  private async testVectorOperations(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      // Test creating a vector memory
      const testId = `vector_test_${Date.now()}`;
      const testVector = Buffer.from([0.1, 0.2, 0.3, 0.4]); // Mock embedding
      
      db.run(
        "INSERT INTO vector_memories (id, content, type, embedding_vector, dimensions, model_id) VALUES (?, ?, ?, ?, ?, ?)",
        [testId, 'Test vector content', 'test', testVector, 4, 'test-model'],
        function(insertErr) {
          if (insertErr) {
            db.close();
            resolve({
              testName: 'Vector Operations',
              status: 'failed',
              errorMessage: `Vector insert failed: ${insertErr.message}`,
              executionTime: Date.now() - startTime,
              evidence: { operation: 'insert', error: insertErr.message }
            });
            return;
          }

          // Test reading the vector
          db.get("SELECT * FROM vector_memories WHERE id = ?", [testId], (selectErr, row) => {
            if (selectErr || !row) {
              db.close();
              resolve({
                testName: 'Vector Operations',
                status: 'failed',
                errorMessage: 'Vector read failed',
                executionTime: Date.now() - startTime,
                evidence: { operation: 'select', error: selectErr?.message }
              });
              return;
            }

            // Cleanup
            db.run("DELETE FROM vector_memories WHERE id = ?", [testId], (deleteErr) => {
              db.close();
              resolve({
                testName: 'Vector Operations',
                status: 'passed',
                executionTime: Date.now() - startTime,
                evidence: { 
                  insertWorked: true,
                  selectWorked: true,
                  deleteWorked: !deleteErr,
                  testRecord: {
                    id: (row as any).id,
                    content: (row as any).content,
                    dimensions: (row as any).dimensions
                  }
                }
              });
            });
          });
        }
      );
    });
  }
}