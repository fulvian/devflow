#!/usr/bin/env node

/**
 * Test script to demonstrate progress tracking
 * This script simulates token usage over time to show the progress bar changing
 */

import { ProgressTracker } from './src/core/monitoring/progress-tracker.js';
import { ClaudeCodeUsageMonitor } from './src/core/monitoring/claude-usage-monitor.js';
import * as fs from 'fs';
import * as path from 'path';

async function testProgressTracking() {
  console.log('Starting progress tracking test...');
  
  // Create usage monitor and progress tracker
  const usageMonitor = new ClaudeCodeUsageMonitor();
  const progressTracker = new ProgressTracker(usageMonitor);
  
  // Get current task ID from current_task.json
  const stateDir = path.resolve(process.cwd(), '.claude/state');
  const currentTaskPath = path.join(stateDir, 'current_task.json');
  
  let taskId = 'devflow-v3_1-deployment';
  if (fs.existsSync(currentTaskPath)) {
    try {
      const currentTaskData = JSON.parse(fs.readFileSync(currentTaskPath, 'utf-8'));
      taskId = currentTaskData.task || taskId;
    } catch (error) {
      console.log('Could not read current task, using default');
    }
  }
  
  console.log(`Tracking progress for task: ${taskId}`);
  
  // Simulate token usage over time
  for (let i = 0; i < 10; i++) {
    // Get current progress
    const currentTokens = usageMonitor.getCurrentTokenCount();
    const progressPercentage = usageMonitor.getUsagePercentage();
    
    console.log(`Step ${i + 1}: Tokens: ${currentTokens}, Progress: ${progressPercentage}%`);
    
    // Update the task progress
    await progressTracker.updateTaskProgress(taskId);
    
    // Wait 30 seconds to simulate real usage
    console.log('Waiting 30 seconds to simulate token usage...');
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  
  console.log('Test completed!');
}

// Run the test
testProgressTracking().catch(console.error);