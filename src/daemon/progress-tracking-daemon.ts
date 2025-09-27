#!/usr/bin/env node

/**
 * Progress Tracking Daemon - Context7 Compliant
 * Real-time task progress monitoring using modern ts-node patterns
 */

import { TaskProgressTracker } from '../core/orchestration/task-progress-tracker.js';
import * as fs from 'fs';
import * as path from 'path';

interface TaskState {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

class ProgressTrackingDaemon {
  private progressTracker: TaskProgressTracker;
  private currentTask: TaskState | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.progressTracker = new TaskProgressTracker();
    this.loadCurrentTask();
    this.setupProgressListener();
  }

  private loadCurrentTask(): void {
    const stateDir = path.resolve(process.cwd(), '.claude/state');
    const currentTaskPath = path.join(stateDir, 'current_task.json');

    if (fs.existsSync(currentTaskPath)) {
      try {
        const taskData = JSON.parse(fs.readFileSync(currentTaskPath, 'utf-8'));
        this.currentTask = {
          id: taskData.id || Date.now().toString(),
          title: taskData.title || taskData.task || 'devflow-v3_1-deployment',
          status: taskData.status || 'pending',
          created_at: taskData.created_at || new Date().toISOString()
        };
        console.log(`✅ Loaded current task: ${this.currentTask.title}`);
      } catch (error) {
        console.error('❌ Could not read current task, using default');
        this.createDefaultTask();
      }
    } else {
      this.createDefaultTask();
    }
  }

  private createDefaultTask(): void {
    this.currentTask = {
      id: Date.now().toString(),
      title: 'devflow-startup-compliance-implementation',
      status: 'in_progress',
      created_at: new Date().toISOString()
    };
  }

  private setupProgressListener(): void {
    this.progressTracker.addProgressListener((progress: number, taskId: string) => {
      this.updateFooterState(progress);
      console.log(`📊 Task ${taskId} progress: ${progress}%`);
    });
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