import * as fs from 'fs';
import * as path from 'path';
import { ClaudeCodeUsageMonitor } from './claude-usage-monitor.js';

/**
 * ProgressTracker - Monitors token usage and updates task progress
 * 
 * This service tracks actual token consumption and updates the progress percentage
 * in the current_task.json file for accurate footer display.
 */
export class ProgressTracker {
  private usageMonitor: ClaudeCodeUsageMonitor;
  private readonly stateDir: string;
  private readonly maxContextTokens: number;

  constructor(usageMonitor: ClaudeCodeUsageMonitor, maxContextTokens: number = 200000) {
    this.usageMonitor = usageMonitor;
    this.stateDir = path.resolve(process.cwd(), '.claude/state');
    this.maxContextTokens = maxContextTokens;
  }

  /**
   * Updates the progress percentage in current_task.json based on current token usage
   */
  async updateTaskProgress(taskId?: string): Promise<void> {
    if (!taskId) return;

    try {
      // Get current token usage
      const currentTokens = this.usageMonitor.getCurrentTokenCount();
      
      // Calculate progress percentage
      const progressPercentage = this.usageMonitor.getUsagePercentage();
      
      console.log(`[${new Date().toISOString()}] ProgressTracker: Updating task ${taskId} with progress ${progressPercentage}% and ${currentTokens} tokens`);
      
      // Read current task file
      const currentTaskPath = path.join(this.stateDir, 'current_task.json');
      if (!fs.existsSync(currentTaskPath)) {
        console.log(`[${new Date().toISOString()}] ProgressTracker: current_task.json not found at ${currentTaskPath}`);
        return;
      }
      
      const currentTaskData = JSON.parse(fs.readFileSync(currentTaskPath, 'utf-8'));
      
      // Update with progress percentage
      const updatedTaskData = {
        ...currentTaskData,
        progress_percentage: progressPercentage,
        token_count: currentTokens,
        updated: new Date().toISOString()
      };
      
      // Write back to file
      fs.writeFileSync(currentTaskPath, JSON.stringify(updatedTaskData, null, 2), 'utf-8');
      console.log(`[${new Date().toISOString()}] ProgressTracker: Successfully updated current_task.json`);
    } catch (error) {
      // Silently fail to avoid disrupting normal operation
      console.error(`[${new Date().toISOString()}] ProgressTracker: Failed to update task progress`, error);
    }
  }

  /**
   * Gets the current progress percentage for a task
   */
  async getTaskProgress(taskId?: string): Promise<number> {
    if (!taskId) return 0;

    try {
      const currentTaskPath = path.join(this.stateDir, 'current_task.json');
      if (!fs.existsSync(currentTaskPath)) return 0;
      
      const currentTaskData = JSON.parse(fs.readFileSync(currentTaskPath, 'utf-8'));
      return currentTaskData.progress_percentage || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Resets progress for a task
   */
  async resetTaskProgress(taskId?: string): Promise<void> {
    if (!taskId) return;

    try {
      const currentTaskPath = path.join(this.stateDir, 'current_task.json');
      if (!fs.existsSync(currentTaskPath)) return;
      
      const currentTaskData = JSON.parse(fs.readFileSync(currentTaskPath, 'utf-8'));
      const updatedTaskData = {
        ...currentTaskData,
        progress_percentage: 0,
        token_count: 0,
        updated: new Date().toISOString()
      };
      
      fs.writeFileSync(currentTaskPath, JSON.stringify(updatedTaskData, null, 2), 'utf-8');
    } catch (error) {
      // Silently fail
    }
  }
}