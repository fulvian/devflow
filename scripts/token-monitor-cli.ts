#!/usr/bin/env npx ts-node

/**
 * CLI interface for RealTimeTokenMonitor
 * Usage: npx ts-node scripts/token-monitor-cli.ts
 * Returns JSON with current token usage for footer integration
 */

import { tokenMonitor } from '../src/core/token-tracker/real-time-token-monitor';

async function main() {
  try {
    const quickCounts = await tokenMonitor.getQuickTokenCounts();

    // Output JSON for bash integration
    console.log(JSON.stringify({
      session: quickCounts.session,
      task: quickCounts.task,
      success: true
    }));
  } catch (error) {
    // Output error state
    console.log(JSON.stringify({
      session: '0',
      task: '0',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}