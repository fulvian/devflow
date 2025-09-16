import { Database } from 'sqlite';

/**
 * Enhanced schema migration for DevFlow Hub
 * Supports multi-platform state management, session tracking,
 * conflict resolution, and version control
 */
export interface Migration {
  up(db: Database): Promise<void>;
  down(db: Database): Promise<void>;
}

export class EnhancedSchemaMigration implements Migration {
  async up(db: Database): Promise<void> {
    // Create platform adapter tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS platform_adapters (
        id TEXT PRIMARY KEY,
        platform_name TEXT NOT NULL UNIQUE,
        adapter_version TEXT NOT NULL,
        config TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Enhanced sessions table with platform support
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sessions_enhanced (
        id TEXT PRIMARY KEY,
        platform_id TEXT REFERENCES platform_adapters(id),
        user_id TEXT,
        session_token TEXT NOT NULL UNIQUE,
        device_info TEXT,
        ip_address TEXT,
        user_agent TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        status TEXT DEFAULT 'active',
        metadata TEXT,
        FOREIGN KEY (platform_id) REFERENCES platform_adapters(id)
      );
    `);

    // Conflict resolution tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        platform_id TEXT REFERENCES platform_adapters(id),
        conflict_data TEXT NOT NULL,
        resolution_strategy TEXT,
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at DATETIME,
        resolved_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (platform_id) REFERENCES platform_adapters(id)
      );
    `);

    // Version control tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        description TEXT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS entity_versions (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        data_hash TEXT NOT NULL,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(entity_type, entity_id, version_number)
      );
    `);

    // Create indexes for performance
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_platform ON sessions_enhanced(platform_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions_enhanced(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions_enhanced(session_token);
      CREATE INDEX IF NOT EXISTS idx_entity_versions_lookup ON entity_versions(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_conflicts_entity ON conflicts(entity_type, entity_id);
    `);

    // Insert initial schema version
    await db.run(`
      INSERT OR IGNORE INTO schema_versions (version, description)
      VALUES ('2.0.0', 'Enhanced multi-platform schema with conflict resolution')
    `);

    // Insert default platform adapters
    await db.run(`
      INSERT OR IGNORE INTO platform_adapters (id, platform_name, adapter_version)
      VALUES
      ('claude-code', 'Claude Code', '1.0.0'),
      ('codex', 'OpenAI Codex', '1.0.0'),
      ('gemini', 'Google Gemini CLI', '1.0.0'),
      ('qwen', 'Qwen CLI', '1.0.0')
    `);
  }

  async down(db: Database): Promise<void> {
    // Drop enhanced tables
    await db.exec(`
      DROP TABLE IF EXISTS entity_versions;
      DROP TABLE IF EXISTS schema_versions;
      DROP TABLE IF EXISTS conflicts;
      DROP TABLE IF EXISTS sessions_enhanced;
      DROP TABLE IF EXISTS platform_adapters;
    `);
  }
}