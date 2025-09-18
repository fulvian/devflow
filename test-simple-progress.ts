#!/usr/bin/env node

/**
 * Simple test script to verify progress tracking works
 */

import { ProgressTracker } from './src/core/monitoring/progress-tracker.js';
import { ClaudeCodeUsageMonitor } from './src/core/monitoring/claude-usage-monitor.js';

async function testProgressTracker() {
  console.log('Testing Progress Tracker...');
  
  // Create usage monitor and progress tracker
  const usageMonitor = new ClaudeCodeUsageMonitor();
  const progressTracker = new ProgressTracker(usageMonitor);
  
  console.log('Initial token count:', usageMonitor.getCurrentTokenCount());
  console.log('Initial progress percentage:', usageMonitor.getUsagePercentage());
  
  // Simulate some token usage
  usageMonitor.incrementTokenCount(5000);
  console.log('After adding 5000 tokens:');
  console.log('Token count:', usageMonitor.getCurrentTokenCount());
  console.log('Progress percentage:', usageMonitor.getUsagePercentage());
  
  // Update task progress
  await progressTracker.updateTaskProgress('devflow-v3_1-deployment');
  
  console.log('Test completed!');
}

testProgressTracker().catch(console.error);