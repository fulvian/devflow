/**
 * DevFlow Workflow State Manager
 * Based on Context7 patterns for serializable workflow context
 *
 * Manages persistent state for long-running task automation workflows
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class WorkflowState {
  constructor(data = {}) {
    this.workflowId = data.workflowId || `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.projectId = data.projectId || null;
    this.currentStage = data.currentStage || 'initialized';
    this.projectContext = data.projectContext || {};
    this.proposedTasks = data.proposedTasks || [];
    this.approvedTasks = data.approvedTasks || [];
    this.pendingApprovals = data.pendingApprovals || [];
    this.executionPlan = data.executionPlan || null;
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
    this.status = data.status || 'active'; // active, paused, completed, failed
  }

  // Serialize for database storage
  toDict() {
    return {
      workflowId: this.workflowId,
      projectId: this.projectId,
      currentStage: this.currentStage,
      projectContext: JSON.stringify(this.projectContext),
      proposedTasks: JSON.stringify(this.proposedTasks),
      approvedTasks: JSON.stringify(this.approvedTasks),
      pendingApprovals: JSON.stringify(this.pendingApprovals),
      executionPlan: JSON.stringify(this.executionPlan),
      metadata: JSON.stringify(this.metadata),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      status: this.status
    };
  }

  // Deserialize from database
  static fromDict(data) {
    return new WorkflowState({
      workflowId: data.workflowId,
      projectId: data.projectId,
      currentStage: data.currentStage,
      projectContext: JSON.parse(data.projectContext || '{}'),
      proposedTasks: JSON.parse(data.proposedTasks || '[]'),
      approvedTasks: JSON.parse(data.approvedTasks || '[]'),
      pendingApprovals: JSON.parse(data.pendingApprovals || '[]'),
      executionPlan: JSON.parse(data.executionPlan || 'null'),
      metadata: JSON.parse(data.metadata || '{}'),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      status: data.status
    });
  }

  updateStage(newStage, additionalData = {}) {
    this.currentStage = newStage;
    this.updatedAt = new Date().toISOString();
    Object.assign(this.metadata, additionalData);
  }
}

class WorkflowStateManager {
  constructor(dbPath = './data/devflow_unified.sqlite') {
    this.dbPath = dbPath;
    this.db = null;
    this.inMemoryStore = new Map(); // Fast access cache
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Create workflow_states table if not exists
        this.db.run(`
          CREATE TABLE IF NOT EXISTS workflow_states (
            workflow_id TEXT PRIMARY KEY,
            project_id INTEGER,
            current_stage TEXT,
            project_context TEXT,
            proposed_tasks TEXT,
            approved_tasks TEXT,
            pending_approvals TEXT,
            execution_plan TEXT,
            metadata TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            status TEXT,
            FOREIGN KEY (project_id) REFERENCES projects (id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  }

  async saveWorkflowState(workflowState) {
    const data = workflowState.toDict();

    // Update in-memory cache
    this.inMemoryStore.set(workflowState.workflowId, workflowState);

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO workflow_states (
          workflow_id, project_id, current_stage, project_context,
          proposed_tasks, approved_tasks, pending_approvals, execution_plan,
          metadata, created_at, updated_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        data.workflowId, data.projectId, data.currentStage, data.projectContext,
        data.proposedTasks, data.approvedTasks, data.pendingApprovals, data.executionPlan,
        data.metadata, data.createdAt, data.updatedAt, data.status
      ], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async loadWorkflowState(workflowId) {
    // Check in-memory cache first
    if (this.inMemoryStore.has(workflowId)) {
      return this.inMemoryStore.get(workflowId);
    }

    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM workflow_states WHERE workflow_id = ?';

      this.db.get(sql, [workflowId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        const workflowState = WorkflowState.fromDict(row);
        this.inMemoryStore.set(workflowId, workflowState);
        resolve(workflowState);
      });
    });
  }

  async getActiveWorkflows() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM workflow_states WHERE status = "active" ORDER BY updated_at DESC';

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const workflows = rows.map(row => WorkflowState.fromDict(row));
        resolve(workflows);
      });
    });
  }

  async getPendingApprovals() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM workflow_states
        WHERE status = "active"
        AND JSON_ARRAY_LENGTH(pending_approvals) > 0
        ORDER BY updated_at ASC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const workflows = rows.map(row => WorkflowState.fromDict(row));
        resolve(workflows);
      });
    });
  }

  async markWorkflowCompleted(workflowId, finalResults = {}) {
    const workflowState = await this.loadWorkflowState(workflowId);
    if (!workflowState) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflowState.status = 'completed';
    workflowState.currentStage = 'completed';
    workflowState.metadata.finalResults = finalResults;
    workflowState.metadata.completedAt = new Date().toISOString();

    await this.saveWorkflowState(workflowState);

    // Remove from in-memory cache for completed workflows
    this.inMemoryStore.delete(workflowId);

    return workflowState;
  }

  async markWorkflowFailed(workflowId, error, recoveryOptions = {}) {
    const workflowState = await this.loadWorkflowState(workflowId);
    if (!workflowState) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflowState.status = 'failed';
    workflowState.currentStage = 'failed';
    workflowState.metadata.error = error;
    workflowState.metadata.recoveryOptions = recoveryOptions;
    workflowState.metadata.failedAt = new Date().toISOString();

    await this.saveWorkflowState(workflowState);
    return workflowState;
  }

  async cleanup(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();

    return new Promise((resolve, reject) => {
      const sql = `
        DELETE FROM workflow_states
        WHERE status IN ('completed', 'failed')
        AND updated_at < ?
      `;

      this.db.run(sql, [cutoffISO], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async close() {
    if (this.db) {
      return new Promise((resolve) => {
        this.db.close((err) => {
          if (err) console.error('Database closing error:', err);
          resolve();
        });
      });
    }
  }
}

module.exports = { WorkflowState, WorkflowStateManager };