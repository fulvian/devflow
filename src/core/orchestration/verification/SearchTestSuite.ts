import { TestSuite, TestResult } from './types';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * SearchTestSuite - Tests actual DevFlow search system
 */
export class SearchTestSuite implements TestSuite {
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data/devflow.sqlite');
  }

  getName(): string {
    return 'Search Operations';
  }

  async runTests(): Promise<TestResult[]> {
    const tests = [
      this.testSearchTables.bind(this),
      this.testSearchDistFiles.bind(this),
      this.testCoordinationSessionsTable.bind(this),
      this.testSearchModules.bind(this)
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

  private async testSearchTables(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      // Check for FTS tables
      db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'search_fts%'", (err, rows) => {
        db.close();
        
        if (err) {
          resolve({
            testName: 'Search FTS Tables',
            status: 'failed',
            errorMessage: `Database query failed: ${err.message}`,
            executionTime: Date.now() - startTime,
            evidence: { error: err.message }
          });
          return;
        }

        const ftsTablesFound = rows?.length || 0;
        const expectedTables = ['search_fts', 'search_fts_config', 'search_fts_content', 'search_fts_data', 'search_fts_docsize', 'search_fts_idx'];
        
        resolve({
          testName: 'Search FTS Tables',
          status: ftsTablesFound >= 6 ? 'passed' : 'failed',
          errorMessage: ftsTablesFound < 6 ? `Only found ${ftsTablesFound} FTS tables, expected 6` : undefined,
          executionTime: Date.now() - startTime,
          evidence: { 
            tablesFound: ftsTablesFound,
            expectedTables,
            actualTables: rows?.map((r: any) => r.name) || []
          }
        });
      });
    });
  }

  private async testSearchDistFiles(): Promise<TestResult> {
    const startTime = Date.now();
    const searchDistPath = path.join(process.cwd(), 'dist/search');
    
    try {
      const searchIntegrationExists = fs.existsSync(path.join(searchDistPath, 'search-integration.js'));
      const searchHelpersExists = fs.existsSync(path.join(searchDistPath, 'search-helpers.js'));
      
      return {
        testName: 'Search Dist Files',
        status: searchIntegrationExists && searchHelpersExists ? 'passed' : 'failed',
        errorMessage: !searchIntegrationExists || !searchHelpersExists ? 'Missing compiled search files' : undefined,
        executionTime: Date.now() - startTime,
        evidence: {
          searchDistPath,
          searchIntegrationExists,
          searchHelpersExists,
          distFiles: fs.existsSync(searchDistPath) ? fs.readdirSync(searchDistPath) : []
        }
      };
    } catch (error) {
      return {
        testName: 'Search Dist Files',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        evidence: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private async testCoordinationSessionsTable(): Promise<TestResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const db = new sqlite3.Database(this.dbPath);
      
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='coordination_sessions'", (err, row) => {
        db.close();
        
        const tableExists = !err && !!row;
        
        resolve({
          testName: 'Coordination Sessions Table',
          status: tableExists ? 'passed' : 'failed',
          errorMessage: !tableExists ? 'coordination_sessions table is missing - this is why search initialization fails' : undefined,
          executionTime: Date.now() - startTime,
          evidence: { 
            tableExists,
            note: 'This table is required by search system but missing from database schema'
          }
        });
      });
    });
  }

  private async testSearchModules(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Try to require search modules
      const searchIntegrationPath = path.join(process.cwd(), 'dist/search/search-integration.js');
      const searchHelpersPath = path.join(process.cwd(), 'dist/search/search-helpers.js');
      
      let integrationLoadable = false;
      let helpersLoadable = false;
      let integrationError = '';
      let helpersError = '';
      
      try {
        require(searchIntegrationPath);
        integrationLoadable = true;
      } catch (err) {
        integrationError = err instanceof Error ? err.message : 'Unknown error';
      }
      
      try {
        require(searchHelpersPath);
        helpersLoadable = true;
      } catch (err) {
        helpersError = err instanceof Error ? err.message : 'Unknown error';
      }
      
      return {
        testName: 'Search Module Loading',
        status: integrationLoadable && helpersLoadable ? 'passed' : 'failed',
        errorMessage: !integrationLoadable || !helpersLoadable ? 'Search modules cannot be loaded' : undefined,
        executionTime: Date.now() - startTime,
        evidence: {
          integrationLoadable,
          helpersLoadable,
          integrationError,
          helpersError
        }
      };
    } catch (error) {
      return {
        testName: 'Search Module Loading',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        evidence: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}