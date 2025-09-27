#!/usr/bin/env node

/**
 * Progress Tracking Daemon
 * Periodically updates the progress percentage to simulate real token usage
 */

import { ProgressTracker } from '../core/orchestration/task-progress-tracker.js';
import { UsageMonitor } from '../core/ui/enhanced-footer/task-progress-tracker.js';
import * as fs from 'fs';
import * as path from 'path';

class ProgressTrackingDaemon {
  private usageMonitor: ClaudeCodeUsageMonitor;
  private progressTracker: ProgressTracker;
  private taskId: string;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.usageMonitor = new ClaudeCodeUsageMonitor();
    this.progressTracker = new ProgressTracker(this.usageMonitor);
    this.taskId = this.getCurrentTaskId();
  }

  private getCurrentTaskId(): string {
    const stateDir = path.resolve(process.cwd(), '.claude/state');
    const currentTaskPath = path.join(stateDir, 'current_task.json');
    
    if (fs.existsSync(currentTaskPath)) {
      try {
        const currentTaskData = JSON.parse(fs.readFileSync(currentTaskPath, 'utf-8'));
        return currentTaskData.task || 'devflow-v3_1-deployment';
      } catch (error) {
        console.error('Could not read current task, using default');
      }
    }
    
    return 'devflow-v3_1-deployment';
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Daemon is already running');
      return;
    }

    console.log('Starting Progress Tracking Daemon...');
    this.isRunning = true;

    // Update progress immediately
    await this.updateProgress();

    // Set up periodic updates every 30 seconds
    this.intervalId = setInterval(() => {
      this.updateProgress().catch(console.error);
    }, 30000);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Daemon is not running');
      return;
    }

    console.log('Stopping Progress Tracking Daemon...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async updateProgress(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Get current progress
      const currentTokens = this.usageMonitor.getCurrentTokenCount();
      const progressPercentage = this.usageMonitor.getUsagePercentage();
      
      console.log(`[${new Date().toISOString()}] Updating progress: Tokens: ${currentTokens}, Progress: ${progressPercentage}%`);
      
      // Update the task progress
      await this.progressTracker.updateTaskProgress(this.taskId);
      
      // Also update footer state
      await this.updateFooterState(progressPercentage, currentTokens);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error updating progress:`, error);
    }
  }

  private async updateFooterState(progressPercentage: number, tokenCount: number): Promise<void> {
    try {
      const devflowDir = path.resolve(process.cwd(), '.devflow');
      const footerStatePath = path.join(devflowDir, 'footer-state.json');
      
      console.log(`[${new Date().toISOString()}] Daemon: Attempting to update footer state at ${footerStatePath}`);
      
      if (fs.existsSync(footerStatePath)) {
        const footerState = JSON.parse(fs.readFileSync(footerStatePath, 'utf-8'));
        
        // Update progress information
        footerState.progress.percentage = progressPercentage;
        footerState.progress.token_count = tokenCount;
        footerState.timestamp = new Date().toISOString();
        
        fs.writeFileSync(footerStatePath, JSON.stringify(footerState, null, 2), 'utf-8');
        console.log(`[${new Date().toISOString()}] Daemon: Successfully updated footer state with progress: ${progressPercentage}% and ${tokenCount} tokens`);
      } else {
        console.log(`[${new Date().toISOString()}] Daemon: Footer state file not found at ${footerStatePath}`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Daemon: Error updating footer state:`, error);
    }
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down...');
  await daemon.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down...');
  await daemon.stop();
  process.exit(0);
});

// Create and start the daemon
const daemon = new ProgressTrackingDaemon();

// Start the daemon
daemon.start().catch(console.error);

// Keep the process running
setInterval(() => {
  // Keep alive
}, 1000);