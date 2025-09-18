#!/usr/bin/env node
/**
 * Migration Script: cc-sessions to DevFlow SQLite
 *
 * Migrates tasks and memory from Claude Code Sessions format to DevFlow unified database
 * Context7 compliant migration ensuring all AI platforms use DevFlow as single source of truth
 */

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DEVFLOW_ROOT = process.env.DEVFLOW_ROOT || '/Users/fulvioventura/devflow';
const DB_PATH = path.join(DEVFLOW_ROOT, 'data/devflow.sqlite');
const SESSIONS_DIR = path.join(DEVFLOW_ROOT, 'sessions/tasks');
const CLAUDE_STATE_DIR = path.join(DEVFLOW_ROOT, '.claude/state');

class SessionsToDevFlowMigration {
  constructor() {
    this.db = null;
    this.migrationStats = {
      tasksProcessed: 0,
      memoriesCreated: 0,
      sessionsArchived: 0
    };
  }

  async init() {
    console.log('🔄 Initializing DevFlow Migration...');

    // Open DevFlow SQLite database
    this.db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    console.log(`✅ Connected to DevFlow database: ${DB_PATH}`);
  }

  async migrateTasks() {
    console.log('📋 Migrating tasks from cc-sessions to DevFlow...');

    // Read current_task.json
    const currentTaskPath = path.join(CLAUDE_STATE_DIR, 'current_task.json');
    if (fs.existsSync(currentTaskPath)) {
      const currentTask = JSON.parse(fs.readFileSync(currentTaskPath, 'utf8'));

      // Extract task details
      const taskData = {
        id: currentTask.task,
        title: currentTask.task.replace(/-/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'),
        description: `Migrated from cc-sessions: ${currentTask.task}`,
        status: 'active',
        priority: 'high',
        metadata: JSON.stringify({
          branch: currentTask.branch,
          services: currentTask.services,
          migration_source: 'cc-sessions',
          migration_date: new Date().toISOString()
        })
      };

      // Insert into DevFlow database
      await this.db.run(`
        INSERT OR REPLACE INTO task_contexts
        (id, title, description, status, priority, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [taskData.id, taskData.title, taskData.description, taskData.status, taskData.priority, taskData.metadata]);

      this.migrationStats.tasksProcessed++;
      console.log(`✅ Migrated task: ${taskData.title}`);
    }

    // Process sessions/tasks directory
    if (fs.existsSync(SESSIONS_DIR)) {
      const taskFiles = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.md'));

      for (const file of taskFiles) {
        await this.processTaskFile(path.join(SESSIONS_DIR, file));
      }
    }
  }

  async processTaskFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath, '.md');

    // Parse frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return;

    const frontmatter = {};
    frontmatterMatch[1].split('\n').forEach(line => {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        frontmatter[key.trim()] = valueParts.join(':').trim();
      }
    });

    // Extract memory content for vector storage
    const memorySections = this.extractMemoryContent(content);

    // Store task in DevFlow
    const taskData = {
      id: frontmatter.task || fileName,
      title: frontmatter.task || fileName,
      description: `Session task: ${fileName}`,
      status: frontmatter.status || 'completed',
      priority: 'medium',
      metadata: JSON.stringify({
        ...frontmatter,
        migration_source: 'sessions',
        migration_date: new Date().toISOString(),
        file_path: filePath
      })
    };

    await this.db.run(`
      INSERT OR REPLACE INTO task_contexts
      (id, title, description, status, priority, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [taskData.id, taskData.title, taskData.description, taskData.status, taskData.priority, taskData.metadata]);

    // Store memory blocks
    for (const memory of memorySections) {
      await this.storeMemoryBlock(memory, taskData.id);
    }

    this.migrationStats.tasksProcessed++;
    console.log(`✅ Processed session: ${fileName}`);
  }

  extractMemoryContent(content) {
    const memories = [];

    // Extract work logs, implementation details, decisions
    const sections = [
      { pattern: /## Work Log([\s\S]*?)(?=##|$)/, type: 'work_log' },
      { pattern: /## Implementation([\s\S]*?)(?=##|$)/, type: 'implementation' },
      { pattern: /## Architecture([\s\S]*?)(?=##|$)/, type: 'architecture' },
      { pattern: /## Decisions([\s\S]*?)(?=##|$)/, type: 'decisions' }
    ];

    sections.forEach(section => {
      const match = content.match(section.pattern);
      if (match) {
        memories.push({
          type: section.type,
          content: match[1].trim(),
          metadata: { extracted_from: 'cc-sessions' }
        });
      }
    });

    return memories;
  }

  async storeMemoryBlock(memory, taskId) {
    const blockId = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.run(`
      INSERT INTO memory_blocks
      (id, content, type, timestamp, metadata, task_id)
      VALUES (?, ?, ?, datetime('now'), ?, ?)
    `, [
      blockId,
      memory.content,
      memory.type,
      JSON.stringify(memory.metadata),
      taskId
    ]);

    this.migrationStats.memoriesCreated++;
  }

  async archiveSessions() {
    console.log('📦 Archiving cc-sessions files...');

    const archiveDir = path.join(DEVFLOW_ROOT, 'data/archived-sessions');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    // Archive current_task.json
    const currentTaskPath = path.join(CLAUDE_STATE_DIR, 'current_task.json');
    if (fs.existsSync(currentTaskPath)) {
      const archivePath = path.join(archiveDir, `current_task_${Date.now()}.json`);
      fs.copyFileSync(currentTaskPath, archivePath);

      // Update to point to DevFlow
      const newCurrentTask = {
        task: "unified-devflow-system",
        branch: "feature/unified-devflow",
        services: ["devflow-orchestrator"],
        updated: new Date().toISOString().split('T')[0],
        migration_note: "Tasks now managed via DevFlow SQLite database"
      };

      fs.writeFileSync(currentTaskPath, JSON.stringify(newCurrentTask, null, 2));
      this.migrationStats.sessionsArchived++;
    }

    console.log(`✅ Archived sessions to: ${archiveDir}`);
  }

  async updateDevFlowConfig() {
    console.log('⚙️  Updating DevFlow configuration for Context7 compliance...');

    // Create/update DevFlow configuration
    const configPath = path.join(DEVFLOW_ROOT, 'config/devflow.json');
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const devflowConfig = {
      version: "3.1.0",
      database: {
        path: "./data/devflow.sqlite",
        unified: true,
        context7_compliant: true
      },
      memory: {
        vector_store: "./data/vector.sqlite",
        embedding_model: "gemma2-embeddings"
      },
      integrations: {
        claude_code: {
          mode: "devflow_native",
          legacy_sessions: false
        },
        external_agents: {
          codex: { enabled: true, mode: "api_direct" },
          gemini: { enabled: true, mode: "mcp_bridge" },
          qwen: { enabled: false, mode: "mcp_bridge" }
        }
      },
      migration: {
        completed: true,
        date: new Date().toISOString(),
        source: "cc-sessions"
      }
    };

    fs.writeFileSync(configPath, JSON.stringify(devflowConfig, null, 2));
    console.log(`✅ DevFlow configuration updated: ${configPath}`);
  }

  async run() {
    try {
      await this.init();
      await this.migrateTasks();
      await this.archiveSessions();
      await this.updateDevFlowConfig();

      console.log('\n🎉 Migration completed successfully!');
      console.log('📊 Migration Statistics:');
      console.log(`   Tasks processed: ${this.migrationStats.tasksProcessed}`);
      console.log(`   Memory blocks created: ${this.migrationStats.memoriesCreated}`);
      console.log(`   Sessions archived: ${this.migrationStats.sessionsArchived}`);
      console.log('\n✅ DevFlow is now the unified source of truth for all AI platforms');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    } finally {
      if (this.db) await this.db.close();
    }
  }
}

// Run migration
const migration = new SessionsToDevFlowMigration();
migration.run();