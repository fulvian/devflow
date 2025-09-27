#!/usr/bin/env node

/**
 * Context7 Footer Refresh Trigger
 * Simple event-based notification trigger for footer updates
 */

const { exec } = require('child_process');
const path = require('path');

const FOOTER_SCRIPT = './.claude/cometa-footer.sh';

function triggerFooterRefresh(mode) {
  console.log(`[Footer] Triggering refresh for mode: ${mode}`);

  exec(FOOTER_SCRIPT, {
    timeout: 5000,
    cwd: process.cwd()
  }, (error, stdout, stderr) => {
    if (error) {
      console.error(`[Footer] Refresh failed: ${error.message}`);
    } else {
      console.log(`[Footer] Refreshed successfully for mode: ${mode}`);
      if (stdout) {
        console.log(`[Footer] Output: ${stdout.substring(0, 200)}`);
      }
    }
  });
}

// If called directly with a mode argument
if (require.main === module) {
  const mode = process.argv[2] || 'unknown';
  triggerFooterRefresh(mode);
}

module.exports = { triggerFooterRefresh };