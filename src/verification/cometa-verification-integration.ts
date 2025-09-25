import fs from 'fs';
import path from 'path';
import { Database } from 'sqlite3';
import { VerificationResult, Violation } from './verification-types';

export class CometaVerificationIntegration {
  private db: Database;
  private dbPath: string;

  constructor() {
    const projectRoot = process.env.PROJECT_ROOT || '.';
    this.dbPath = path.join(projectRoot, 'devflow_unified.sqlite');
    
    // Initialize database connection
    try {
      this.db = new Database(this.dbPath);
      this.initializeDatabase();
    } catch (error) {
      console.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  private initializeDatabase(): void {
    // Create verification_results table if it doesn't exist
    this.db.run(`
      CREATE TABLE IF NOT EXISTS verification_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        timestamp TEXT,
        passed INTEGER,
        total_files INTEGER,
        total_violations INTEGER,
        critical_violations INTEGER,
        high_violations INTEGER,
        medium_violations INTEGER,
        low_violations INTEGER,
        raw_result TEXT
      )
    `);
    
    // Create violations table if it doesn't exist
    this.db.run(`
      CREATE TABLE IF NOT EXISTS violations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verification_id INTEGER,
        type TEXT,
        rule TEXT,
        severity TEXT,
        file_path TEXT,
        line_number INTEGER,
        message TEXT,
        suggestion TEXT,
        FOREIGN KEY(verification_id) REFERENCES verification_results(id)
      )
    `);
    
    // Create correction_tasks table if it doesn't exist
    this.db.run(`
      CREATE TABLE IF NOT EXISTS correction_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        verification_id INTEGER,
        violation_id INTEGER,
        task_id TEXT,
        title TEXT,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT,
        created_at TEXT,
        FOREIGN KEY(verification_id) REFERENCES verification_results(id),
        FOREIGN KEY(violation_id) REFERENCES violations(id)
      )
    `);
  }

  public async saveVerificationResult(result: VerificationResult): Promise<void> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO verification_results 
        (task_id, timestamp, passed, total_files, total_violations, 
         critical_violations, high_violations, medium_violations, low_violations, raw_result)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        result.taskId || null,
        result.timestamp,
        result.passed ? 1 : 0,
        result.summary.totalFiles,
        result.summary.totalViolations,
        result.summary.criticalViolations,
        result.summary.highViolations,
        result.summary.mediumViolations,
        result.summary.lowViolations,
        JSON.stringify(result)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log(`💾 Verification result saved with ID: ${this.lastID}`);
          resolve();
        }
      });
      
      stmt.finalize();
    });
  }

  public async generateCorrectionTasks(result: VerificationResult): Promise<void> {
    // Get the verification ID first
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM verification_results WHERE timestamp = ?',
        [result.timestamp],
        async (err, row: { id: number } | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!row) {
            reject(new Error('Could not find verification result'));
            return;
          }
          
          const verificationId = row.id;
          
          // Save violations and generate tasks
          for (const violation of result.violations) {
            try {
              const violationId = await this.saveViolation(verificationId, violation);
              await this.createCorrectionTask(verificationId, violationId, violation, result.taskId);
            } catch (error) {
              console.error('Failed to create correction task for violation:', error);
            }
          }
          
          console.log(`🛠️  Generated correction tasks for ${result.violations.length} violations`);
          resolve();
        }
      );
    });
  }

  private async saveViolation(verificationId: number, violation: Violation): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO violations 
        (verification_id, type, rule, severity, file_path, line_number, message, suggestion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        verificationId,
        violation.type,
        violation.rule,
        violation.severity,
        violation.filePath,
        violation.line,
        violation.message,
        violation.suggestion
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      stmt.finalize();
    });
  }

  private async createCorrectionTask(
    verificationId: number, 
    violationId: number, 
    violation: Violation,
    parentTaskId: string | null
  ): Promise<void> {
    // Generate a new task ID
    const taskId = `CORRECTION-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    
    // Create task title and description
    const title = `[${violation.severity.toUpperCase()}] Fix ${violation.rule} in ${violation.filePath}`;
    const description = `
## Violation Details
- **File**: ${violation.filePath}:${violation.line}
- **Rule**: ${violation.rule}
- **Severity**: ${violation.severity}
- **Issue**: ${violation.message}

## Suggested Fix
${violation.suggestion}

## Context
This correction task was automatically generated by the Claude Verification Protocol.
${parentTaskId ? `It relates to parent task: ${parentTaskId}` : ''}
    `;
    
    // Determine priority based on severity
    const priority = violation.severity === 'critical' ? 'high' : 
                    violation.severity === 'high' ? 'medium' : 'low';
    
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO correction_tasks 
        (verification_id, violation_id, task_id, title, description, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        verificationId,
        violationId,
        taskId,
        title,
        description,
        priority,
        new Date().toISOString()
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          console.log(`✅ Correction task created: ${taskId}`);
          resolve();
        }
      });
      
      stmt.finalize();
    });
  }

  public async getRecentVerifications(limit: number = 5): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM verification_results 
         ORDER BY timestamp DESC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
