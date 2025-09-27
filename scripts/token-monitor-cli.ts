#!/usr/bin/env npx ts-node

/**
 * DEPRECATED: Use simple-token-monitor.ts instead
 *
 * This complex token monitor with task tracking is deprecated in favor of
 * the simpler Input/Output format provided by simple-token-monitor.ts
 *
 * The database tables are kept for background analytics but not displayed
 * Usage: Use scripts/simple-token-monitor.ts for footer integration
 */

import { enhancedTokenMonitor } from '../src/core/token-tracker/enhanced-real-time-token-monitor';

async function main() {
  try {
    const quickCounts = await enhancedTokenMonitor.getQuickTokenCounts();

    // Output JSON for bash integration
    console.log(JSON.stringify({
      session: quickCounts.session,
      task: quickCounts.task,
      success: quickCounts.success
    }));
  } catch (error) {
    // Output error state
    console.log(JSON.stringify({
      session: '0',
      task: '0',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  } finally {
    // Cleanup connections
    try {
      await enhancedTokenMonitor.close();
    } catch (error) {
      // Silent cleanup error
    }
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}