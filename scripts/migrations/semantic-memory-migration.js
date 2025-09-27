// scripts/migrations/semantic-memory-migration.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Enhanced Project Memory & Context System - Database Migration
 * Phase 1: Semantic Foundation Schema
 */

const DB_PATH = path.join(__dirname, '../../data/devflow_unified.sqlite');

// Migration SQL statements
const MIGRATION_STATEMENTS = {
  project_memory_embeddings: `
    CREATE TABLE IF NOT EXISTS project_memory_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      content_hash TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      content_type TEXT NOT NULL CHECK (content_type IN ('task', 'conversation', 'file', 'decision', 'context')),
      embedding_vector BLOB NOT NULL,
      vector_dimension INTEGER DEFAULT 1536,
      metadata JSON DEFAULT '{}',
      similarity_threshold REAL DEFAULT 0.7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,

  project_memory_clusters: `
    CREATE TABLE IF NOT EXISTS project_memory_clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      cluster_name TEXT NOT NULL,
      cluster_centroid BLOB NOT NULL,
      memory_ids JSON NOT NULL DEFAULT '[]',
      relevance_score REAL DEFAULT 0.5 CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0),
      cluster_size INTEGER DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, cluster_name)
    )`,

  enhance_context_injections: `
    ALTER TABLE cometa_context_injections
    ADD COLUMN embedding_similarity REAL DEFAULT 0.0 CHECK (embedding_similarity >= 0.0 AND embedding_similarity <= 1.0)`,

  enhance_context_injections_feedback: `
    ALTER TABLE cometa_context_injections
    ADD COLUMN usage_feedback JSON DEFAULT '{}'`,

  enhance_context_injections_suggestions: `
    ALTER TABLE cometa_context_injections
    ADD COLUMN improvement_suggestions TEXT DEFAULT ''`
};

// Indexes for performance optimization
const INDEXES = {
  embeddings_content_type: `CREATE INDEX IF NOT EXISTS idx_embeddings_content_type
    ON project_memory_embeddings(project_id, content_type, created_at DESC)`,
  embeddings_similarity: `CREATE INDEX IF NOT EXISTS idx_embeddings_similarity
    ON project_memory_embeddings(project_id, similarity_threshold)`,
  clusters_relevance: `CREATE INDEX IF NOT EXISTS idx_clusters_relevance
    ON project_memory_clusters(project_id, relevance_score DESC)`,
  context_embedding_similarity: `CREATE INDEX IF NOT EXISTS idx_context_embedding_similarity
    ON cometa_context_injections(embedding_similarity DESC, created_at DESC)`
};

// Update triggers for automatic timestamp management
const TRIGGERS = {
  embeddings_update: `CREATE TRIGGER IF NOT EXISTS update_embeddings_timestamp
    AFTER UPDATE ON project_memory_embeddings
    BEGIN
      UPDATE project_memory_embeddings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END`,
  clusters_update: `CREATE TRIGGER IF NOT EXISTS update_clusters_timestamp
    AFTER UPDATE ON project_memory_clusters
    BEGIN
      UPDATE project_memory_clusters SET last_updated = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END`
};

async function runMigration(dbPath = DB_PATH) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(`Failed to open database: ${err.message}`);
        return;
      }
      console.log('✓ Connected to semantic memory migration database');
    });

    db.serialize(() => {
      // Begin transaction
      db.run('BEGIN TRANSACTION');

      // Create tables
      console.log('Creating semantic memory tables...');
      db.run(MIGRATION_STATEMENTS.project_memory_embeddings, (err) => {
        if (err) reject(`Failed to create embeddings table: ${err.message}`);
      });

      db.run(MIGRATION_STATEMENTS.project_memory_clusters, (err) => {
        if (err) reject(`Failed to create clusters table: ${err.message}`);
      });

      // Enhance existing tables (check if columns exist first)
      console.log('Enhancing context injections table...');
      db.all("PRAGMA table_info(cometa_context_injections)", (err, columns) => {
        if (err) {
          reject(`Failed to check table structure: ${err.message}`);
          return;
        }

        const existingColumns = columns.map(col => col.name);

        if (!existingColumns.includes('embedding_similarity')) {
          db.run(MIGRATION_STATEMENTS.enhance_context_injections);
        }
        if (!existingColumns.includes('usage_feedback')) {
          db.run(MIGRATION_STATEMENTS.enhance_context_injections_feedback);
        }
        if (!existingColumns.includes('improvement_suggestions')) {
          db.run(MIGRATION_STATEMENTS.enhance_context_injections_suggestions);
        }
      });

      // Create indexes
      console.log('Creating performance indexes...');
      Object.values(INDEXES).forEach(indexSql => {
        db.run(indexSql, (err) => {
          if (err) console.warn(`Index creation warning: ${err.message}`);
        });
      });

      // Create triggers
      console.log('Creating update triggers...');
      Object.values(TRIGGERS).forEach(triggerSql => {
        db.run(triggerSql, (err) => {
          if (err) console.warn(`Trigger creation warning: ${err.message}`);
        });
      });

      // Commit transaction
      db.run('COMMIT', (err) => {
        if (err) {
          reject(`Transaction commit failed: ${err.message}`);
          return;
        }

        db.close((closeErr) => {
          if (closeErr) {
            reject(`Failed to close database: ${closeErr.message}`);
          } else {
            console.log('✓ Semantic memory migration completed successfully');
            resolve(true);
          }
        });
      });
    });
  });
}

// Rollback function for migration reversal
async function rollbackMigration(dbPath = DB_PATH) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      // Drop created tables
      db.run('DROP TABLE IF EXISTS project_memory_clusters');
      db.run('DROP TABLE IF EXISTS project_memory_embeddings');

      // Drop triggers
      db.run('DROP TRIGGER IF EXISTS update_embeddings_timestamp');
      db.run('DROP TRIGGER IF EXISTS update_clusters_timestamp');

      // Note: Cannot easily remove columns from SQLite without recreating table
      console.log('WARNING: Added columns to cometa_context_injections remain (SQLite limitation)');

      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else {
          console.log('✓ Migration rollback completed');
          resolve(true);
        }
        db.close();
      });
    });
  });
}

// Execute migration if run directly
if (require.main === module) {
  const action = process.argv[2];

  if (action === 'rollback') {
    rollbackMigration().catch(console.error);
  } else {
    runMigration().catch(console.error);
  }
}

module.exports = { runMigration, rollbackMigration };