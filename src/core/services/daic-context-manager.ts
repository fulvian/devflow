#!/usr/bin/env node
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { EventEmitter } from 'events';

export interface TaskContext {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
}

export interface TaskWorkflowState {
  id: string;
  task_id: string;
  workflow_phase: 'planning' | 'implementation' | 'testing' | 'review' | 'completed';
  daic_mode_suggestion: 'discussion' | 'implementation' | 'none';
  user_preference: 'auto' | 'manual' | 'never';
  last_interaction: string;
  context_metadata?: string;
}

export interface DAICIntervention {
  id: string;
  task_id?: string;
  intervention_type: 'mode_suggestion' | 'implementation_block' | 'workflow_guidance';
  context_data?: string;
  user_accepted: boolean;
  user_feedback?: string;
  timestamp: string;
  session_id?: string;
}

export interface BranchGovernanceRule {
  id: string;
  rule_name: string;
  rule_type: 'naming' | 'validation' | 'automation';
  rule_config: string;
  enabled: boolean;
}

export class DAICContextManager extends EventEmitter {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    super();
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'devflow.sqlite');
    this.db = new sqlite3.Database(this.dbPath);
  }

  private async runQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  private async runSingle(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private async runExec(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Task Context Methods
  async getCurrentTask(): Promise<TaskContext | null> {
    try {
      const task = await this.runSingle(
        'SELECT * FROM task_contexts WHERE status = ? ORDER BY updated_at DESC LIMIT 1',
        ['in_progress']
      );
      return task || null;
    } catch (error) {
      console.error('[DAIC Context] Error getting current task:', error);
      return null;
    }
  }

  async getTaskById(taskId: string): Promise<TaskContext | null> {
    try {
      const task = await this.runSingle(
        'SELECT * FROM task_contexts WHERE id = ?',
        [taskId]
      );
      return task || null;
    } catch (error) {
      console.error('[DAIC Context] Error getting task by ID:', error);
      return null;
    }
  }

  // DAIC Workflow State Methods
  async getTaskWorkflowState(taskId: string): Promise<TaskWorkflowState | null> {
    try {
      const state = await this.runSingle(
        'SELECT * FROM task_workflow_states WHERE task_id = ?',
        [taskId]
      );
      return state || null;
    } catch (error) {
      console.error('[DAIC Context] Error getting workflow state:', error);
      return null;
    }
  }

  async updateTaskWorkflowState(
    taskId: string,
    phase: TaskWorkflowState['workflow_phase'],
    daicSuggestion?: TaskWorkflowState['daic_mode_suggestion'],
    contextMetadata?: any
  ): Promise<void> {
    try {
      const existingState = await this.getTaskWorkflowState(taskId);

      if (existingState) {
        await this.runExec(
          `UPDATE task_workflow_states
           SET workflow_phase = ?, daic_mode_suggestion = ?, context_metadata = ?, last_interaction = datetime('now')
           WHERE task_id = ?`,
          [phase, daicSuggestion || existingState.daic_mode_suggestion, JSON.stringify(contextMetadata), taskId]
        );
      } else {
        await this.runExec(
          `INSERT INTO task_workflow_states
           (task_id, workflow_phase, daic_mode_suggestion, user_preference, context_metadata)
           VALUES (?, ?, ?, ?, ?)`,
          [taskId, phase, daicSuggestion || 'discussion', 'auto', JSON.stringify(contextMetadata)]
        );
      }

      this.emit('workflowStateUpdated', { taskId, phase, daicSuggestion, contextMetadata });
    } catch (error) {
      console.error('[DAIC Context] Error updating workflow state:', error);
      throw error;
    }
  }

  // DAIC Intervention Methods
  async recordDAICIntervention(intervention: Omit<DAICIntervention, 'id' | 'timestamp'>): Promise<string> {
    try {
      const id = this.generateId();
      await this.runExec(
        `INSERT INTO daic_interventions
         (id, task_id, intervention_type, context_data, user_accepted, user_feedback, session_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          intervention.task_id,
          intervention.intervention_type,
          intervention.context_data,
          intervention.user_accepted,
          intervention.user_feedback,
          intervention.session_id
        ]
      );

      this.emit('interventionRecorded', { id, ...intervention });
      return id;
    } catch (error) {
      console.error('[DAIC Context] Error recording intervention:', error);
      throw error;
    }
  }

  async getDAICInterventionHistory(taskId?: string, limit: number = 50): Promise<DAICIntervention[]> {
    try {
      const sql = taskId
        ? 'SELECT * FROM daic_interventions WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?'
        : 'SELECT * FROM daic_interventions ORDER BY timestamp DESC LIMIT ?';
      const params = taskId ? [taskId, limit] : [limit];

      return await this.runQuery(sql, params);
    } catch (error) {
      console.error('[DAIC Context] Error getting intervention history:', error);
      return [];
    }
  }

  // Smart DAIC Mode Suggestion
  async suggestDAICMode(taskId?: string, userIntent?: string): Promise<TaskWorkflowState['daic_mode_suggestion']> {
    try {
      const currentTask = taskId ? await this.getTaskById(taskId) : await this.getCurrentTask();
      if (!currentTask) return 'discussion';

      const workflowState = await this.getTaskWorkflowState(currentTask.id);
      if (!workflowState) return 'discussion';

      // Get recent interventions to understand user patterns
      const recentInterventions = await this.getDAICInterventionHistory(currentTask.id, 10);
      const userAcceptanceRate = recentInterventions.length > 0
        ? recentInterventions.filter(i => i.user_accepted).length / recentInterventions.length
        : 0.5;

      // Smart mode logic based on context
      const suggestion = this.calculateDAICModeSuggestion(
        workflowState,
        userIntent,
        userAcceptanceRate,
        recentInterventions
      );

      // Record this suggestion for learning
      await this.recordDAICIntervention({
        task_id: currentTask.id,
        intervention_type: 'mode_suggestion',
        context_data: JSON.stringify({
          workflow_phase: workflowState.workflow_phase,
          user_intent: userIntent,
          acceptance_rate: userAcceptanceRate,
          suggestion
        }),
        user_accepted: false, // Will be updated when user responds
        session_id: process.env.CLAUDE_SESSION_ID
      });

      return suggestion;
    } catch (error) {
      console.error('[DAIC Context] Error suggesting DAIC mode:', error);
      return 'discussion';
    }
  }

  private calculateDAICModeSuggestion(
    workflowState: TaskWorkflowState,
    userIntent?: string,
    userAcceptanceRate: number = 0.5,
    recentInterventions: DAICIntervention[] = []
  ): TaskWorkflowState['daic_mode_suggestion'] {
    // User has explicitly disabled DAIC
    if (workflowState.user_preference === 'never') {
      return 'none';
    }

    // User prefers manual control and has low acceptance rate
    if (workflowState.user_preference === 'manual' && userAcceptanceRate < 0.3) {
      return 'none';
    }

    // Analyze user intent keywords
    const implementationKeywords = ['implement', 'code', 'write', 'create', 'build', 'fix', 'add'];
    const discussionKeywords = ['discuss', 'analyze', 'plan', 'explore', 'understand', 'investigate'];

    if (userIntent) {
      const intent = userIntent.toLowerCase();
      if (implementationKeywords.some(keyword => intent.includes(keyword))) {
        return 'implementation';
      }
      if (discussionKeywords.some(keyword => intent.includes(keyword))) {
        return 'discussion';
      }
    }

    // Workflow phase-based suggestions
    switch (workflowState.workflow_phase) {
      case 'planning':
        return 'discussion';
      case 'implementation':
        return 'implementation';
      case 'testing':
      case 'review':
        return 'discussion';
      case 'completed':
        return 'none';
      default:
        return 'discussion';
    }
  }

  // Branch Governance Methods
  async getBranchGovernanceRules(ruleType?: string): Promise<BranchGovernanceRule[]> {
    try {
      const sql = ruleType
        ? 'SELECT * FROM branch_governance_rules WHERE rule_type = ? AND enabled = 1'
        : 'SELECT * FROM branch_governance_rules WHERE enabled = 1';
      const params = ruleType ? [ruleType] : [];

      return await this.runQuery(sql, params);
    } catch (error) {
      console.error('[DAIC Context] Error getting governance rules:', error);
      return [];
    }
  }

  // Utility Methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close(() => {
        resolve();
      });
    });
  }

  // Health Check
  async healthCheck(): Promise<{ healthy: boolean; message: string; tables: string[] }> {
    try {
      const tables = await this.runQuery(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name IN ('task_contexts', 'task_workflow_states', 'daic_interventions', 'branch_governance_rules')
      `);

      const tableNames = tables.map((t: any) => t.name);
      const expectedTables = ['task_contexts', 'task_workflow_states', 'daic_interventions', 'branch_governance_rules'];
      const healthy = expectedTables.every(table => tableNames.includes(table));

      return {
        healthy,
        message: healthy ? 'All required tables present' : 'Missing required tables',
        tables: tableNames
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Database error: ${error}`,
        tables: []
      };
    }
  }
}

export default DAICContextManager;