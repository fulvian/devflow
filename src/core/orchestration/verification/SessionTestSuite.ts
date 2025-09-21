import { TestSuite, TestResult } from './types';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';

/**
 * SessionTestSuite - Tests actual DevFlow session management
 */
export class SessionTestSuite implements TestSuite {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data/devflow.sqlite');
  }

  getName(): string {
    return 'Session Management';
  }

  async runTests(): Promise<TestResult[]> {
    const tests = [
      this.testSessionsTable.bind(this),
      this.testSessionCRUD.bind(this),
      this.testSessionMetadata.bind(this),
      this.testSessionCleanup.bind(this)
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

  private async testSessionsTable(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'", (err, row) => {
        if (err || !row) {
          db.close();
          resolve({
            testName: 'Sessions Table Exists',
            status: 'failed',
            errorMessage: 'sessions table does not exist',
            executionTime: Date.now() - startTime,
            evidence: { tableExists: false }
          });
          return;
        }

        // Check table structure
        db.all("PRAGMA table_info(sessions)", (pragmaErr, columns) => {
          db.close();
          
          if (pragmaErr) {
            resolve({
              testName: 'Sessions Table Exists',
              status: 'failed',
              errorMessage: `Schema check failed: ${pragmaErr.message}`,
              executionTime: Date.now() - startTime,
              evidence: { schemaError: pragmaErr.message }
            });
            return;
          }

          resolve({
            testName: 'Sessions Table Exists',
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

  private async testSessionCRUD(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      const testSessionId = `session_test_${Date.now()}`;
      const testSessionData = {
        id: testSessionId,
        name: 'Test Session',
        context: 'Test session context',
        metadata: JSON.stringify({ test: true, timestamp: Date.now() }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Test CREATE
      db.run(
        "INSERT INTO sessions (id, name, context, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [testSessionData.id, testSessionData.name, testSessionData.context, testSessionData.metadata, testSessionData.created_at, testSessionData.updated_at],
        function(insertErr) {
          if (insertErr) {
            db.close();
            resolve({
              testName: 'Session CRUD Operations',
              status: 'failed',
              errorMessage: `Session insert failed: ${insertErr.message}`,
              executionTime: Date.now() - startTime,
              evidence: { operation: 'insert', error: insertErr.message }
            });
            return;
          }

          // Test READ
          db.get("SELECT * FROM sessions WHERE id = ?", [testSessionId], (selectErr, row) => {
            if (selectErr || !row) {
              db.close();
              resolve({
                testName: 'Session CRUD Operations',
                status: 'failed',
                errorMessage: 'Session read failed',
                executionTime: Date.now() - startTime,
                evidence: { operation: 'select', error: selectErr?.message }
              });
              return;
            }

            // Test UPDATE
            const updatedContext = 'Updated test context';
            db.run(
              "UPDATE sessions SET context = ?, updated_at = ? WHERE id = ?",
              [updatedContext, new Date().toISOString(), testSessionId],
              (updateErr) => {
                if (updateErr) {
                  db.close();
                  resolve({
                    testName: 'Session CRUD Operations',
                    status: 'failed',
                    errorMessage: `Session update failed: ${updateErr.message}`,
                    executionTime: Date.now() - startTime,
                    evidence: { operation: 'update', error: updateErr.message }
                  });
                  return;
                }

                // Test DELETE (cleanup)
                db.run("DELETE FROM sessions WHERE id = ?", [testSessionId], (deleteErr) => {
                  db.close();
                  resolve({
                    testName: 'Session CRUD Operations',
                    status: 'passed',
                    executionTime: Date.now() - startTime,
                    evidence: { 
                      createWorked: true,
                      readWorked: true,
                      updateWorked: true,
                      deleteWorked: !deleteErr,
                      testSession: row
                    }
                  });
                });
              }
            );
          });
        }
      );
    });
  }

  private async testSessionMetadata(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      // Test JSON metadata handling
      const testSessionId = `metadata_test_${Date.now()}`;
      const complexMetadata = {
        userId: 'test-user',
        preferences: { theme: 'dark', language: 'en' },
        sessionData: { startTime: Date.now(), actions: ['login', 'navigate'] },
        nested: { deep: { value: 42 } }
      };
      
      db.run(
        "INSERT INTO sessions (id, name, context, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          testSessionId,
          'Metadata Test Session',
          'Testing metadata handling',
          JSON.stringify(complexMetadata),
          new Date().toISOString(),
          new Date().toISOString()
        ],
        function(insertErr) {
          if (insertErr) {
            db.close();
            resolve({
              testName: 'Session Metadata Handling',
              status: 'failed',
              errorMessage: `Metadata insert failed: ${insertErr.message}`,
              executionTime: Date.now() - startTime,
              evidence: { error: insertErr.message }
            });
            return;
          }

          // Read and parse metadata
          db.get("SELECT * FROM sessions WHERE id = ?", [testSessionId], (selectErr, row) => {
            if (selectErr || !row) {
              db.close();
              resolve({
                testName: 'Session Metadata Handling',
                status: 'failed',
                errorMessage: 'Metadata read failed',
                executionTime: Date.now() - startTime,
                evidence: { error: selectErr?.message }
              });
              return;
            }

            let parsedMetadata;
            try {
              parsedMetadata = JSON.parse((row as any).metadata);
            } catch (parseErr) {
              db.run("DELETE FROM sessions WHERE id = ?", [testSessionId]);
              db.close();
              resolve({
                testName: 'Session Metadata Handling',
                status: 'failed',
                errorMessage: 'Metadata parsing failed',
                executionTime: Date.now() - startTime,
                evidence: { parseError: parseErr instanceof Error ? parseErr.message : 'Unknown error' }
              });
              return;
            }

            // Cleanup
            db.run("DELETE FROM sessions WHERE id = ?", [testSessionId], () => {
              db.close();
              resolve({
                testName: 'Session Metadata Handling',
                status: 'passed',
                executionTime: Date.now() - startTime,
                evidence: { 
                  metadataStored: true,
                  metadataParsed: true,
                  originalMetadata: complexMetadata,
                  retrievedMetadata: parsedMetadata
                }
              });
            });
          });
        }
      );
    });
  }

  private async testSessionCleanup(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      // Count total sessions
      db.get("SELECT COUNT(*) as total FROM sessions", (countErr, countRow) => {
        if (countErr) {
          db.close();
          resolve({
            testName: 'Session Cleanup Capability',
            status: 'failed',
            errorMessage: `Count query failed: ${countErr.message}`,
            executionTime: Date.now() - startTime,
            evidence: { error: countErr.message }
          });
          return;
        }

        const totalSessions = (countRow as any)?.total || 0;
        
        // Test cleanup query (but don't actually delete)
        db.all(
          "SELECT id, created_at FROM sessions WHERE created_at < datetime('now', '-1 day') LIMIT 5",
          (cleanupErr, oldSessions) => {
            db.close();
            
            if (cleanupErr) {
              resolve({
                testName: 'Session Cleanup Capability',
                status: 'failed',
                errorMessage: `Cleanup query failed: ${cleanupErr.message}`,
                executionTime: Date.now() - startTime,
                evidence: { error: cleanupErr.message }
              });
              return;
            }

            resolve({
              testName: 'Session Cleanup Capability',
              status: 'passed',
              executionTime: Date.now() - startTime,
              evidence: { 
                totalSessions,
                oldSessionsFound: oldSessions?.length || 0,
                cleanupQueryWorks: true
              }
            });
          }
        );
      });
    });
  }
}