#!/usr/bin/env ts-node

/**
 * Footer Auto-Refresh Daemon CLI
 * Context7 Chokidar-based real-time footer updates
 */

import { FooterAutoRefreshDaemon } from '../src/daemons/footer-auto-refresh';

function showHelp() {
  console.log(`
Footer Auto-Refresh Daemon - Real-time token tracking updates

Usage:
  npx ts-node scripts/footer-daemon.ts [options]

Options:
  --quiet          Disable logging output
  --help, -h       Show this help message
  --stats          Show daemon statistics and exit

Examples:
  npx ts-node scripts/footer-daemon.ts           # Start with logging
  npx ts-node scripts/footer-daemon.ts --quiet   # Start silently
  node dist/scripts/footer-daemon.js             # Use compiled version
  `);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const daemon = new FooterAutoRefreshDaemon({
    logEnabled: !args.includes('--quiet')
  });

  if (args.includes('--stats')) {
    const stats = daemon.getStats();
    console.log('Daemon Statistics:', JSON.stringify(stats, null, 2));
    return;
  }

  try {
    console.log('🧠 Starting Footer Auto-Refresh Daemon...');
    console.log('💡 Press Ctrl+C to stop');

    await daemon.start();

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\\n🛑 Received stop signal...');
      await daemon.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start daemon:', error);
    process.exit(1);
  }
}

main().catch(console.error);