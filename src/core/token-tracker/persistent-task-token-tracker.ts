/**
 * PersistentTaskTokenTracker - Tracks task-specific token usage across sessions
 *
 * This module provides persistent tracking of token consumption per task,
 * maintaining accurate counts across multiple work sessions and task switches.
 */

import Database from 'better-sqlite3';
import { SmartTokenClassifier } from './smart-token-classifier';
import { CcusageBlockParser } from './ccusage-block-parser';
import { TaskTokenData, TaskState, TokenHistoryEntry } from './types/ccusage-types';

export class PersistentTaskTokenTracker {
  private db: Database.Database;
  public classifier: SmartTokenClassifier;  // Make public for external access
  private parser: CcusageBlockParser;
  private currentTaskId: string | null = null;
  private currentSessionBaseline: number = 0;
  private taskBaselines: Map<string, number> = new Map();

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.classifier = new SmartTokenClassifier();
    this.parser = new CcusageBlockParser();
    this.initializeDatabase();
  }

  /**
   * Initialize the database schema for task token tracking
   */
  private initializeDatabase(): void {
    // Create task tokens table
    const createTaskTokensTable = `
      CREATE TABLE IF NOT EXISTS task_tokens (
        task_id TEXT PRIMARY KEY,
        total_tokens INTEGER DEFAULT 0,
        session_tokens INTEGER DEFAULT 0,
        user_interaction_tokens INTEGER DEFAULT 0,
        system_overhead_tokens INTEGER DEFAULT 0,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create token history table
    const createHistoryTable = `
      CREATE TABLE IF NOT EXISTS token_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT,
        session_id TEXT,
        tokens_added INTEGER,
        user_tokens_added INTEGER,
        system_tokens_added INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES task_tokens (task_id)
      )
    `;

    this.db.exec(createTaskTokensTable);
    this.db.exec(createHistoryTable);
  }

  /**
   * Start tracking a new or existing task
   */
  async startTask(taskId: string): Promise<void> {
    // If switching from another task, save its state first
    if (this.currentTaskId && this.currentTaskId !== taskId) {
      await this.saveCurrentTaskState();
    }

    this.currentTaskId = taskId;

    // Get the task's baseline from database or initialize it
    const taskData = await this.getTaskData(taskId);
    if (!taskData) {
      // New task - initialize in database
      await this.createTaskEntry(taskId);
      this.taskBaselines.set(taskId, 0);
    } else {
      // Existing task - load its baseline
      this.taskBaselines.set(taskId, taskData.totalTokens);
    }

    // Set session baseline for this task
    this.currentSessionBaseline = await this.parser.getCurrentTokenCount();
  }

  /**
   * Record current token usage for the active task
   */
  async recordTokenUsage(sessionId?: string): Promise<{ taskTokens: number; sessionTokens: number }> {
    if (!this.currentTaskId) {
      throw new Error('No active task to record tokens for');
    }

    // Get recent blocks and classify them
    const blocks = await this.parser.getRecentBlocks(5);
    const classifications = this.classifier.classifyBlocks(blocks);

    // Calculate real user interaction tokens from recent activity
    const recentUserTokens = classifications.reduce((total, result) => {
      return total + result.userInteractionTokens;
    }, 0);

    // Get current total tokens
    const currentTotalTokens = await this.parser.getCurrentTokenCount();
    const sessionTokens = currentTotalTokens - this.currentSessionBaseline;

    // Calculate task tokens (baseline + real user tokens from this session)
    const taskId = this.currentTaskId;
    const baseline = this.taskBaselines.get(taskId) || 0;
    const taskTokens = baseline + recentUserTokens;

    // Update database only if we have meaningful token additions
    if (recentUserTokens > 0) {
      await this.updateTaskTokens(taskId, {
        totalTokens: taskTokens,
        sessionTokens: sessionTokens,
        userInteractionTokens: recentUserTokens,
        systemOverheadTokens: sessionTokens - recentUserTokens
      });

      // Record in history
      const sid = sessionId || this.generateSessionId();
      await this.recordTokenHistory(taskId, sid, {
        totalAdded: recentUserTokens,
        userAdded: recentUserTokens,
        systemAdded: 0
      });

      // Update baseline
      this.taskBaselines.set(taskId, taskTokens);
    }

    return {
      taskTokens,
      sessionTokens: currentTotalTokens
    };
  }

  /**
   * Get current token counts for display
   */
  async getCurrentCounts(): Promise<{ session: number; task: number; formatted: { session: string; task: string } }> {
    const currentTotal = await this.parser.getCurrentTokenCount();

    if (!this.currentTaskId) {
      const formatted = {
        session: this.formatTokenCount(currentTotal),
        task: '0'
      };
      return { session: currentTotal, task: 0, formatted };
    }

    const tokenData = await this.recordTokenUsage();

    const formatted = {
      session: this.formatTokenCount(tokenData.sessionTokens),
      task: this.formatTokenCount(tokenData.taskTokens)
    };

    return {
      session: tokenData.sessionTokens,
      task: tokenData.taskTokens,
      formatted
    };
  }

  /**
   * Get task token data from database
   */
  async getTaskData(taskId: string): Promise<TaskTokenData | null> {
    const stmt = this.db.prepare(`
      SELECT task_id, total_tokens, session_tokens, start_time, last_updated
      FROM task_tokens
      WHERE task_id = ?
    `);

    const row = stmt.get(taskId) as any;

    if (row) {
      return {
        taskId: row.task_id,
        totalTokens: row.total_tokens,
        sessionTokens: row.session_tokens,
        startTime: new Date(row.start_time),
        lastUpdated: new Date(row.last_updated)
      };
    }

    return null;
  }

  /**
   * Get all tasks with their token data
   */
  async getAllTasks(): Promise<TaskTokenData[]> {
    const stmt = this.db.prepare(`
      SELECT task_id, total_tokens, session_tokens, start_time, last_updated
      FROM task_tokens
      ORDER BY last_updated DESC
    `);

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      taskId: row.task_id,
      totalTokens: row.total_tokens,
      sessionTokens: row.session_tokens,
      startTime: new Date(row.start_time),
      lastUpdated: new Date(row.last_updated)
    }));
  }

  /**
   * Get token history for a specific task
   */
  async getTaskHistory(taskId: string, limit: number = 50): Promise<TokenHistoryEntry[]> {
    const stmt = this.db.prepare(`
      SELECT tokens_added, user_tokens_added, system_tokens_added, timestamp, session_id
      FROM token_history
      WHERE task_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(taskId, limit) as any[];

    return rows.map(row => ({
      tokensAdded: row.tokens_added,
      timestamp: new Date(row.timestamp),
      sessionId: row.session_id
    }));
  }

  /**
   * Save the current task state before switching
   */
  private async saveCurrentTaskState(): Promise<void> {
    if (!this.currentTaskId) return;

    // Record final state for the task
    await this.recordTokenUsage();
  }

  /**
   * Create a new task entry in the database
   */
  private async createTaskEntry(taskId: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO task_tokens (task_id, total_tokens, session_tokens)
      VALUES (?, 0, 0)
    `);

    stmt.run(taskId);
  }

  /**
   * Update task tokens in database
   */
  private async updateTaskTokens(taskId: string, tokens: {
    totalTokens: number;
    sessionTokens: number;
    userInteractionTokens: number;
    systemOverheadTokens: number;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE task_tokens
      SET total_tokens = ?,
          session_tokens = ?,
          user_interaction_tokens = ?,
          system_overhead_tokens = ?,
          last_updated = CURRENT_TIMESTAMP
      WHERE task_id = ?
    `);

    stmt.run(
      tokens.totalTokens,
      tokens.sessionTokens,
      tokens.userInteractionTokens,
      tokens.systemOverheadTokens,
      taskId
    );
  }

  /**
   * Record token history entry
   */
  private async recordTokenHistory(taskId: string, sessionId: string, tokens: {
    totalAdded: number;
    userAdded: number;
    systemAdded: number;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO token_history (task_id, session_id, tokens_added, user_tokens_added, system_tokens_added)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(taskId, sessionId, tokens.totalAdded, tokens.userAdded, tokens.systemAdded);
  }

  /**
   * Format token count for display
   */
  private formatTokenCount(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    } else {
      return tokens.toString();
    }
  }

  /**
   * Generate a session identifier
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    // Save current task state before closing
    await this.saveCurrentTaskState();
    this.db.close();
  }
}