#!/usr/bin/env npx ts-node

/**
 * DevFlow Schema Unification Migration Runner
 * Executes the database migration safely with validation and rollback capability
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

interface MigrationResult {
  success: boolean;
  rowsMigrated: number;
  errors: string[];
  rollbackAvailable: boolean;
}

class SchemaMigrationRunner {
  private db: Database.Database;
  private migrationPath: string;

  constructor(dbPath: string = './data/devflow.sqlite') {
    this.db = new Database(dbPath);
    this.migrationPath = path.join(__dirname, 'schema-unification-migration.sql');

    // Enable foreign keys and WAL mode for safety
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Pre-migration validation
   */
  validatePreMigration(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    try {
      // Check if memory_blocks table exists (dependency)
      const memoryBlocksExists = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='memory_blocks'
      `).get();

      if (!memoryBlocksExists) {
        issues.push('memory_blocks table does not exist - required for FK constraint');
      }

      // Check current schema state
      const currentSchema = this.db.prepare(`
        SELECT sql FROM sqlite_master
        WHERE type='table' AND name='memory_block_embeddings'
      `).get() as any;

      if (currentSchema) {
        console.log('Current schema detected:', currentSchema.sql);
      }

      // Create migration_log table if it doesn't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migration_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          migration_name TEXT NOT NULL,
          completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          affected_tables TEXT,
          rows_migrated INTEGER
        )
      `);

    } catch (error) {
      issues.push(`Pre-migration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Execute the migration
   */
  async runMigration(): Promise<MigrationResult> {
    console.log('🚀 Starting DevFlow Schema Unification Migration...');

    const validation = this.validatePreMigration();
    if (!validation.valid) {
      return {
        success: false,
        rowsMigrated: 0,
        errors: validation.issues,
        rollbackAvailable: false
      };
    }

    try {
      // Read migration SQL
      const migrationSQL = fs.readFileSync(this.migrationPath, 'utf8');

      // Count existing rows for verification
      let existingRows = 0;
      try {
        const countResult = this.db.prepare(`
          SELECT COUNT(*) as count FROM memory_block_embeddings
        `).get() as any;
        existingRows = countResult?.count || 0;
      } catch {
        // Table might not exist yet
        existingRows = 0;
      }

      console.log(`📊 Existing rows in memory_block_embeddings: ${existingRows}`);

      // Execute migration in transaction (already wrapped in migration SQL)
      console.log('🔄 Executing migration script...');
      this.db.exec(migrationSQL);

      // Verify migration success
      const newCount = this.db.prepare(`
        SELECT COUNT(*) as count FROM memory_block_embeddings
      `).get() as any;

      const rowsMigrated = newCount?.count || 0;

      console.log(`✅ Migration completed successfully`);
      console.log(`📊 Rows migrated: ${rowsMigrated}`);

      // Verify schema structure
      const finalSchema = this.db.prepare(`
        SELECT sql FROM sqlite_master
        WHERE type='table' AND name='memory_block_embeddings'
      `).get() as any;

      console.log('📋 Final schema:', finalSchema?.sql);

      return {
        success: true,
        rowsMigrated,
        errors: [],
        rollbackAvailable: true
      };

    } catch (error) {
      console.error('❌ Migration failed:', error);

      return {
        success: false,
        rowsMigrated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown migration error'],
        rollbackAvailable: this.checkBackupExists()
      };
    }
  }

  /**
   * Check if backup table exists for rollback
   */
  private checkBackupExists(): boolean {
    try {
      const backup = this.db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='memory_block_embeddings_backup'
      `).get();
      return !!backup;
    } catch {
      return false;
    }
  }

  /**
   * Rollback migration if needed
   */
  rollback(): boolean {
    try {
      if (!this.checkBackupExists()) {
        console.error('❌ No backup available for rollback');
        return false;
      }

      console.log('🔄 Rolling back migration...');

      this.db.exec(`
        BEGIN TRANSACTION;
        DROP TABLE IF EXISTS memory_block_embeddings;
        ALTER TABLE memory_block_embeddings_backup RENAME TO memory_block_embeddings;
        COMMIT;
      `);

      console.log('✅ Rollback completed');
      return true;
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      return false;
    }
  }

  /**
   * Clean up backup table after successful migration
   */
  cleanup(): void {
    try {
      this.db.exec('DROP TABLE IF EXISTS memory_block_embeddings_backup');
      console.log('🧹 Backup cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'migrate';

  const runner = new SchemaMigrationRunner();

  try {
    switch (command) {
      case 'migrate':
        const result = await runner.runMigration();
        if (result.success) {
          console.log('🎉 Schema unification migration completed successfully!');
          console.log(`📊 Summary: ${result.rowsMigrated} rows migrated`);

          // Ask user if they want to cleanup backup
          console.log('💡 Run with "cleanup" to remove backup table');
        } else {
          console.error('❌ Migration failed:');
          result.errors.forEach(error => console.error(`  - ${error}`));
          if (result.rollbackAvailable) {
            console.log('💡 Run with "rollback" to restore previous state');
          }
          process.exit(1);
        }
        break;

      case 'rollback':
        const success = runner.rollback();
        process.exit(success ? 0 : 1);
        break;

      case 'cleanup':
        runner.cleanup();
        break;

      case 'validate':
        const validation = runner.validatePreMigration();
        if (validation.valid) {
          console.log('✅ Pre-migration validation passed');
        } else {
          console.log('❌ Pre-migration validation issues:');
          validation.issues.forEach(issue => console.log(`  - ${issue}`));
          process.exit(1);
        }
        break;

      default:
        console.log('Usage: npx ts-node run-schema-migration.ts [migrate|rollback|cleanup|validate]');
        process.exit(1);
    }
  } finally {
    runner.close();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { SchemaMigrationRunner };