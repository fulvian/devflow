/**
 * DevFlow Database Population Script
 *
 * This script populates the DevFlow SQLite database with sessions, docs, and .claude state data.
 * It reads from the specified directories and inserts the data into the appropriate tables.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'sqlite3';
import { promisify } from 'util';

// Promisify database methods for easier async/await usage
const sqlite3 = require('sqlite3').verbose();

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Session {
  id: string;
  name: string;
  context: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

class DevFlowDBPopulator {
  private db: Database;
  private readonly sessionsDir = 'sessions/tasks';
  private readonly docsDir = 'docs';
  private readonly claudeStateDir = '.claude/state';
  private readonly dbPath = 'data/devflow.sqlite';

  constructor() {
    this.db = new sqlite3.Database(this.dbPath);
  }

  /**
   * Promisified database methods
   */
  private async runQuery(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err: Error | null) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async allQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Read all files from a directory
   */
  private async readDirectory(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(dirPath);
      return files.map(file => path.join(dirPath, file));
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dirPath}`, error);
      return [];
    }
  }

  /**
   * Read file content
   */
  private async readFile(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Parse JSON file content
   */
  private async parseJsonFile(filePath: string): Promise<any> {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error parsing JSON file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Parse markdown file content
   */
  private async parseMarkdownFile(filePath: string): Promise<{ title: string; content: string }> {
    try {
      const content = await this.readFile(filePath);
      // Extract title from first line if it's a header
      const lines = content.split('\n');
      let title = path.basename(filePath, path.extname(filePath));

      if (lines[0].startsWith('# ')) {
        title = lines[0].substring(2).trim();
      }

      return { title, content };
    } catch (error) {
      console.error(`Error parsing markdown file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Process task files from sessions directory
   */
  private async processTasks(): Promise<void> {
    console.log('Processing tasks...');

    const taskFiles = await this.readDirectory(this.sessionsDir);

    for (const filePath of taskFiles) {
      try {
        if (path.extname(filePath) === '.md') {
          const { title, content } = await this.parseMarkdownFile(filePath);

          // Extract task ID from filename
          const taskId = path.basename(filePath, '.md');

          // Insert task into database
          const sql = `
            INSERT OR REPLACE INTO tasks
            (id, title, description, status, priority, parent_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;

          const params = [
            taskId,
            title,
            content,
            'pending',
            'medium',
            null,
            new Date().toISOString(),
            new Date().toISOString()
          ];

          await this.runQuery(sql, params);
          console.log(`Inserted task: ${title}`);
        }
      } catch (error) {
        console.error(`Error processing task file ${filePath}:`, error);
      }
    }
  }

  /**
   * Process documentation files
   */
  private async processDocs(): Promise<void> {
    console.log('Processing documentation...');

    const docFiles = await this.readDirectory(this.docsDir);

    for (const filePath of docFiles) {
      try {
        if (path.extname(filePath) === '.md') {
          const { title, content } = await this.parseMarkdownFile(filePath);

          // Create a session entry for the documentation
          const sessionId = `doc_${path.basename(filePath, '.md')}`;
          const sql = `
            INSERT OR REPLACE INTO sessions
            (id, name, context, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `;

          const params = [
            sessionId,
            title,
            content,
            JSON.stringify({ source: 'docs', filePath }),
            new Date().toISOString(),
            new Date().toISOString()
          ];

          await this.runQuery(sql, params);
          console.log(`Inserted documentation session: ${title}`);
        }
      } catch (error) {
        console.error(`Error processing documentation file ${filePath}:`, error);
      }
    }
  }

  /**
   * Process Claude state files
   */
  private async processClaudeState(): Promise<void> {
    console.log('Processing Claude state...');

    const stateFiles = await this.readDirectory(this.claudeStateDir);

    for (const filePath of stateFiles) {
      try {
        if (path.extname(filePath) === '.json') {
          const stateData = await this.parseJsonFile(filePath);

          // Create a session entry for the Claude state
          const sessionId = `claude_${path.basename(filePath, '.json')}`;
          const sql = `
            INSERT OR REPLACE INTO sessions
            (id, name, context, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `;

          const params = [
            sessionId,
            `Claude State - ${path.basename(filePath)}`,
            JSON.stringify(stateData),
            JSON.stringify({
              source: 'claude',
              filePath,
              type: 'state'
            }),
            new Date().toISOString(),
            new Date().toISOString()
          ];

          await this.runQuery(sql, params);
          console.log(`Inserted Claude state session: ${sessionId}`);
        }
      } catch (error) {
        console.error(`Error processing Claude state file ${filePath}:`, error);
      }
    }
  }

  /**
   * Validate database schema
   */
  private async validateSchema(): Promise<boolean> {
    try {
      const tables = await this.allQuery(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name IN ('tasks', 'sessions')
      `);

      const tableNames = tables.map((row: any) => row.name);
      const hasTasks = tableNames.includes('tasks');
      const hasSessions = tableNames.includes('sessions');

      if (!hasTasks || !hasSessions) {
        console.error('Required tables not found in database');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating database schema:', error);
      return false;
    }
  }

  /**
   * Main population process
   */
  public async populate(): Promise<void> {
    console.log('Starting DevFlow database population...');

    try {
      // Validate database schema
      const isSchemaValid = await this.validateSchema();
      if (!isSchemaValid) {
        throw new Error('Database schema validation failed');
      }

      // Process all data types
      await this.processTasks();
      await this.processDocs();
      await this.processClaudeState();

      console.log('Database population completed successfully');
    } catch (error) {
      console.error('Database population failed:', error);
      throw error;
    } finally {
      this.db.close();
    }
  }
}

// Execute the population script
async function main() {
  const populator = new DevFlowDBPopulator();

  try {
    await populator.populate();
    process.exit(0);
  } catch (error) {
    console.error('Population script failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export default DevFlowDBPopulator;