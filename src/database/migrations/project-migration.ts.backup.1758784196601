// src/database/migrations/project-migration.ts
import { Database } from 'sqlite3';
import { runProjectMigration } from '../project-schema';

/**
 * Database migration script for project management schema
 * This script should be run once to add the project hierarchy to an existing DevFlow database
 */

async function executeMigration(dbPath: string = './data/devflow_unified.sqlite'): Promise<void> {
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(dbPath);
  
  try {
    await runProjectMigration(db);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Execute migration if run directly
if (require.main === module) {
  executeMigration().catch(console.error);
}

export default executeMigration;