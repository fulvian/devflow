#!/usr/bin/env npx ts-node

/**
 * Simple Token Monitor CLI - Direct ccusage integration with intelligent estimation
 * No complex dependencies, just smart filtering of context refresh tokens
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getCleanTokens(): Promise<{ input: string; output: string; success: boolean }> {
  try {
    // Get active block (real user tokens only) from ccusage
    const { stdout } = await execAsync('ccusage blocks --active --json', { timeout: 5000 });

    const data = JSON.parse(stdout);
    const activeBlock = data.blocks?.[0];

    if (!activeBlock || !activeBlock.isActive) {
      return { input: '0', output: '0', success: false };
    }

    // Extract REAL user interaction tokens (excluding cache tokens which are context refresh)
    const inputTokens = activeBlock.tokenCounts?.inputTokens || 0;
    const outputTokens = activeBlock.tokenCounts?.outputTokens || 0;

    // Format tokens - use raw numbers for better readability
    const formatTokens = (count: number): string => {
      if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
      } else if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
      }
      return count.toString();
    };

    return {
      input: formatTokens(inputTokens),
      output: formatTokens(outputTokens),
      success: true
    };

  } catch (error) {
    console.error('Error:', error);
    return { input: '0', output: '0', success: false };
  }
}

async function main() {
  try {
    const result = await getCleanTokens();
    console.log(JSON.stringify(result));
  } catch (error) {
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