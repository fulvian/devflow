/**
 * Cometa Unified Memory System
 *
 * Implements the unified memory and task management system for DevFlow
 * replacing cc-session with centralized SQLite-based approach
 */

import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sqlite3';
import { promisify } from 'util';

const sqlite3 = require('sqlite3').verbose();

interface CometaTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: string; // JSON string
}

interface CometaSession {
  id: string;
  name: string;
  context: string;
  metadata: string;
  created_at: string;
  updated_at: string;
  agent_type?: string;
  delegation_history: string; // JSON array
}

interface CometaMemoryBlock {
  id: string;
  session_id: string;
  content: string;
  content_type: 'task' | 'context' | 'decision' | 'result';
  embeddings: string; // JSON array of vectors
  created_at: string;
  tags: string; // JSON array
}

class CometaUnifiedMemory {
  private db: Database;
  private readonly dbPath = 'data/devflow.sqlite';

  constructor() {
    this.db = new sqlite3.Database(this.dbPath);
  }

  /**
   * Initialize the unified memory system
   */
  async initialize(): Promise<void> {
    console.log('🧠 Initializing Cometa Unified Memory System...');

    try {
      await this.createEnhancedSchema();
      await this.migrateExistingData();
      await this.setupMemoryIndexes();

      console.log('✅ Cometa Unified Memory System initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Cometa system:', error);
      throw error;
    }
  }

  /**
   * Create enhanced schema for unified memory
   */
  private async createEnhancedSchema(): Promise<void> {
    const schema = `
      -- Enhanced Tasks table with memory integration
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT CHECK(status IN ('pending','in_progress','completed','blocked')) NOT NULL DEFAULT 'pending',
        priority TEXT CHECK(priority IN ('low','medium','high','urgent')) NOT NULL DEFAULT 'medium',
        parent_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (parent_id) REFERENCES tasks(id)
      );

      -- Enhanced Sessions table with agent delegation
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        context TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        agent_type TEXT,
        delegation_history TEXT DEFAULT '[]'
      );

      -- Memory blocks for semantic storage
      CREATE TABLE IF NOT EXISTS memory_blocks (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        content TEXT NOT NULL,
        content_type TEXT CHECK(content_type IN ('task','context','decision','result')) NOT NULL,
        embeddings TEXT,
        created_at TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      -- Task contexts for cross-session memory
      CREATE TABLE IF NOT EXISTS task_contexts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        context_type TEXT NOT NULL,
        context_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      -- Synthetic usage tracking
      CREATE TABLE IF NOT EXISTS synthetic_usage (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        model_used TEXT NOT NULL,
        tokens_used INTEGER NOT NULL,
        execution_time_ms INTEGER,
        created_at TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(schema, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('📋 Enhanced schema created');
          resolve();
        }
      });
    });
  }

  /**
   * Setup indexes for performance
   */
  private async setupMemoryIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id)',
      'CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_type)',
      'CREATE INDEX IF NOT EXISTS idx_memory_session ON memory_blocks(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_blocks(content_type)',
      'CREATE INDEX IF NOT EXISTS idx_contexts_task ON task_contexts(task_id)',
      'CREATE INDEX IF NOT EXISTS idx_synthetic_model ON synthetic_usage(model_used)'
    ];

    for (const indexSql of indexes) {
      await new Promise<void>((resolve, reject) => {
        this.db.run(indexSql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log('🔍 Memory indexes created');
  }

  /**
   * Migrate existing cc-session data
   */
  private async migrateExistingData(): Promise<void> {
    console.log('🔄 Migrating existing data...');

    try {
      // Migrate tasks from sessions/tasks/
      await this.migrateTaskFiles();

      // Migrate docs to sessions
      await this.migrateDocumentation();

      // Migrate .claude/state to memory blocks
      await this.migrateClaudeState();

      console.log('✅ Data migration completed');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Migrate task files from sessions/tasks/
   */
  private async migrateTaskFiles(): Promise<void> {
    const tasksDir = 'sessions/tasks';

    if (!fs.existsSync(tasksDir)) {
      console.log('⚠️ No tasks directory found, skipping task migration');
      return;
    }

    const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));

    for (const file of taskFiles) {
      try {
        const filePath = path.join(tasksDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const taskId = path.basename(file, '.md');

        // Extract title from first line if it's a header
        const lines = content.split('\n');
        let title = taskId;
        if (lines[0].startsWith('# ')) {
          title = lines[0].substring(2).trim();
        }

        const task: CometaTask = {
          id: taskId,
          title,
          description: content,
          status: 'pending',
          priority: 'medium',
          parent_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: JSON.stringify({ source: 'cc-session', file: filePath })
        };

        await this.insertTask(task);
        console.log(`📝 Migrated task: ${title}`);
      } catch (error) {
        console.error(`❌ Failed to migrate task ${file}:`, error);
      }
    }
  }

  /**
   * Migrate documentation to sessions
   */
  private async migrateDocumentation(): Promise<void> {
    const docsDir = 'docs';

    if (!fs.existsSync(docsDir)) {
      console.log('⚠️ No docs directory found, skipping docs migration');
      return;
    }

    const docFiles = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));

    for (const file of docFiles) {
      try {
        const filePath = path.join(docsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const sessionId = `doc_${path.basename(file, '.md')}`;

        // Extract title from first line
        const lines = content.split('\n');
        let title = path.basename(file, '.md');
        if (lines[0].startsWith('# ')) {
          title = lines[0].substring(2).trim();
        }

        const session: CometaSession = {
          id: sessionId,
          name: title,
          context: content,
          metadata: JSON.stringify({ source: 'docs', file: filePath }),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          agent_type: 'documentation',
          delegation_history: JSON.stringify([])
        };

        await this.insertSession(session);
        console.log(`📚 Migrated documentation: ${title}`);
      } catch (error) {
        console.error(`❌ Failed to migrate doc ${file}:`, error);
      }
    }
  }

  /**
   * Migrate Claude state to memory blocks
   */
  private async migrateClaudeState(): Promise<void> {
    const stateDir = '.claude/state';

    if (!fs.existsSync(stateDir)) {
      console.log('⚠️ No .claude/state directory found, skipping state migration');
      return;
    }

    const stateFiles = fs.readdirSync(stateDir).filter(f => f.endsWith('.json'));

    for (const file of stateFiles) {
      try {
        const filePath = path.join(stateDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const stateData = JSON.parse(content);

        const memoryBlock: CometaMemoryBlock = {
          id: `state_${path.basename(file, '.json')}_${Date.now()}`,
          session_id: 'claude_state',
          content: content,
          content_type: 'context',
          embeddings: JSON.stringify([]), // To be populated by vector service
          created_at: new Date().toISOString(),
          tags: JSON.stringify(['claude-state', file.replace('.json', '')])
        };

        await this.insertMemoryBlock(memoryBlock);
        console.log(`🧠 Migrated state: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to migrate state ${file}:`, error);
      }
    }
  }

  /**
   * Insert task into unified memory
   */
  private async insertTask(task: CometaTask): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO tasks
      (id, title, description, status, priority, parent_id, created_at, updated_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        task.id, task.title, task.description, task.status,
        task.priority, task.parent_id, task.created_at,
        task.updated_at, task.metadata
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Insert session into unified memory
   */
  private async insertSession(session: CometaSession): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO sessions
      (id, name, context, metadata, created_at, updated_at, agent_type, delegation_history)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        session.id, session.name, session.context, session.metadata,
        session.created_at, session.updated_at, session.agent_type,
        session.delegation_history
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Insert memory block
   */
  private async insertMemoryBlock(block: CometaMemoryBlock): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO memory_blocks
      (id, session_id, content, content_type, embeddings, created_at, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        block.id, block.session_id, block.content, block.content_type,
        block.embeddings, block.created_at, block.tags
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Query unified memory system
   */
  async queryMemory(query: string, type?: string): Promise<any[]> {
    let sql = `
      SELECT mb.*, s.name as session_name
      FROM memory_blocks mb
      LEFT JOIN sessions s ON mb.session_id = s.id
      WHERE mb.content LIKE ?
    `;

    const params = [`%${query}%`];

    if (type) {
      sql += ` AND mb.content_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY mb.created_at DESC LIMIT 50`;

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<Record<string, number>> {
    const queries = [
      'SELECT COUNT(*) as tasks FROM tasks',
      'SELECT COUNT(*) as sessions FROM sessions',
      'SELECT COUNT(*) as memory_blocks FROM memory_blocks',
      'SELECT COUNT(*) as task_contexts FROM task_contexts',
      'SELECT COUNT(*) as synthetic_usage FROM synthetic_usage'
    ];

    const stats: Record<string, number> = {};

    for (const query of queries) {
      try {
        const result = await new Promise<any>((resolve, reject) => {
          this.db.get(query, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        const key = Object.keys(result)[0];
        stats[key] = result[key];
      } catch (error) {
        console.error('Failed to get stats:', error);
      }
    }

    return stats;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close(() => {
        console.log('🔒 Cometa Unified Memory System closed');
        resolve();
      });
    });
  }
}

// Execute if run directly
async function main() {
  const cometa = new CometaUnifiedMemory();

  try {
    await cometa.initialize();

    // Show system statistics
    const stats = await cometa.getSystemStats();
    console.log('\n📊 Cometa System Statistics:');
    console.log(`Tasks: ${stats.tasks || 0}`);
    console.log(`Sessions: ${stats.sessions || 0}`);
    console.log(`Memory Blocks: ${stats.memory_blocks || 0}`);
    console.log(`Task Contexts: ${stats.task_contexts || 0}`);
    console.log(`Synthetic Usage Records: ${stats.synthetic_usage || 0}`);

    console.log('\n🎉 Cometa Unified Memory System is now operational!');

  } catch (error) {
    console.error('❌ Failed to initialize Cometa:', error);
    process.exit(1);
  } finally {
    await cometa.close();
  }
}

if (require.main === module) {
  main();
}

export default CometaUnifiedMemory;