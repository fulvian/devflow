#!/usr/bin/env node

/**
 * Dynamic Progress Calculator - Context7 Compliant
 * Based on AI Dev Tasks patterns for real implementation plan tracking
 * Calculates real progress instead of static 80% values
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class DynamicProgressCalculator {
  constructor() {
    this.dbPath = '/Users/fulvioventura/devflow/data/devflow_unified.sqlite';
    this.stateFile = '/Users/fulvioventura/devflow/.devflow/footer-state.json';
    this.currentTaskFile = '/Users/fulvioventura/devflow/.claude/state/current_task.json';
  }

  /**
   * Calculate dynamic progress based on Context7 AI Dev Tasks patterns
   */
  async calculateProgress() {
    try {
      const currentTask = await this.getCurrentTask();
      if (!currentTask) return { progress: 0, taskName: 'no_active_task' };

      // Get sub-tasks completion status using AI Dev Tasks pattern
      const subTasks = await this.getSubTasksProgress(currentTask.id);
      const progress = this.calculateTaskProgress(subTasks);

      return {
        progress: Math.round(progress),
        taskName: currentTask.name || 'unknown_task',
        completed: subTasks.completed,
        total: subTasks.total,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Progress calculation error:', error);
      return { progress: 0, taskName: 'calculation_error' };
    }
  }

  /**
   * Get current task from state file (Context7 pattern)
   */
  async getCurrentTask() {
    try {
      const stateData = fs.readFileSync(this.currentTaskFile, 'utf8');
      const state = JSON.parse(stateData);

      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(this.dbPath);
        db.get(
          'SELECT * FROM tasks WHERE id = ? OR name = ?',
          [state.id, state.task],
          (err, row) => {
            db.close();
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Get sub-tasks progress using Context7 adapted pattern for existing schema
   * Based on project/plan hierarchy and todo tracking patterns
   */
  async getSubTasksProgress(taskId) {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath);

      // Context7 Pattern: Use project-based task grouping since no parent_task_id
      db.all(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
         FROM tasks t1
         WHERE t1.project_id = (SELECT project_id FROM tasks WHERE id = ?)
         OR (t1.plan_id = (SELECT plan_id FROM tasks WHERE id = ?) AND t1.plan_id IS NOT NULL)
         OR (t1.project_id IS NULL AND t1.plan_id IS NULL AND t1.id = ?)`,
        [taskId, taskId, taskId],
        (err, rows) => {
          db.close();
          if (err) {
            reject(err);
          } else {
            const result = rows[0] || { total: 1, completed: 0, in_progress: 0 };
            resolve(result);
          }
        }
      );
    });
  }

  /**
   * Calculate progress using Context7 weighted completion algorithm
   * Based on ProgressMeter library patterns found in Context7 research
   */
  calculateTaskProgress(subTasks) {
    const { total, completed, in_progress } = subTasks;

    if (total === 0) return 0;

    // Context7 Pattern: Weighted progress calculation
    // Completed tasks = 100% weight
    // In-progress tasks = 50% weight (partial completion)
    const weightedProgress = (completed * 1.0) + (in_progress * 0.5);
    const progressPercentage = (weightedProgress / total) * 100;

    // Apply Context7 progress bounds (never 0% if work started, never 100% until complete)
    if (progressPercentage === 0 && in_progress > 0) return 10;
    if (progressPercentage >= 100 && completed < total) return 95;

    return progressPercentage;
  }

  /**
   * Update footer state with calculated progress (Context7 caching pattern)
   */
  async updateFooterState(progressData) {
    try {
      const stateData = {
        progress: `${progressData.progress}%`,
        completed: progressData.completed,
        total: progressData.total,
        timestamp: progressData.timestamp,
        calculation_method: 'dynamic_context7'
      };

      fs.writeFileSync(this.stateFile, JSON.stringify(stateData, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to update footer state:', error);
      return false;
    }
  }
}

// Execute if called directly
if (require.main === module) {
  const calculator = new DynamicProgressCalculator();

  calculator.calculateProgress()
    .then(async (progress) => {
      console.log(JSON.stringify(progress, null, 2));
      await calculator.updateFooterState(progress);
    })
    .catch(error => {
      console.error('Execution failed:', error);
      process.exit(1);
    });
}

module.exports = DynamicProgressCalculator;