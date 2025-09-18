import { Database } from 'sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Database fix runner utility
 * Applies database schema fixes automatically
 */

// Type definitions
interface TriggerInfo {
  name: string;
  table: string;
}

export class DatabaseFixRunner {
  private db: Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
  }

  /**
   * Check for existing trigger conflicts
   */
  public async checkTriggerConflicts(): Promise<TriggerInfo[]> {
    return new Promise((resolve, reject) => {
      const conflictTriggers = [
        'tasks_fts_insert',
        'tasks_fts_delete',
        'tasks_fts_update',
        'memory_fts_insert',
        'memory_fts_delete',
        'memory_fts_update'
      ];

      const query = `SELECT name, tbl_name as table FROM sqlite_master WHERE type = 'trigger' AND name IN (${conflictTriggers.map(() => '?').join(',')})`;
      
      this.db.all(query, conflictTriggers, (err, rows: TriggerInfo[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Apply database fixes from SQL file
   */
  public async applyFixes(): Promise<void> {
    try {
      console.log('Checking for database trigger conflicts...');
      const conflicts = await this.checkTriggerConflicts();
      
      if (conflicts.length > 0) {
        console.log(`Found ${conflicts.length} conflicting triggers:`);
        conflicts.forEach(trigger => {
          console.log(`  - ${trigger.name} on table ${trigger.table}`);
        });
        
        console.log('Applying database fixes...');
        const sqlPath = join(__dirname, 'fix-fts-triggers.sql');
        const sql = readFileSync(sqlPath, 'utf8');
        
        await this.executeSQL(sql);
        console.log('Database fixes applied successfully');
      } else {
        console.log('No conflicting triggers found. Database is up to date.');
      }
    } catch (error) {
      console.error('Error applying database fixes:', error);
      throw error;
    }
  }

  /**
   * Execute SQL statements
   */
  private async executeSQL(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Close database connection
   */
  public close(): void {
    this.db.close();
  }
}

/**
 * Run database fixes as part of startup validation
 */
export async function runDatabaseFixes(dbPath: string = 'devflow.sqlite'): Promise<void> {
  const fixRunner = new DatabaseFixRunner(dbPath);
  
  try {
    await fixRunner.applyFixes();
  } finally {
    fixRunner.close();
  }
}

// Run fixes if executed directly
if (require.main === module) {
  runDatabaseFixes().catch(error => {
    console.error('Failed to apply database fixes:', error);
    process.exit(1);
  });
}
