#!/usr/bin/env node
// DevFlow Gemini CLI wrapper (complete integration)
// Uses a local Gemini CLI binary; returns non-zero if unavailable.

import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const input = args.join(' ').trim();
if (!input) {
  console.error('Usage: devflow-gemini <input string>');
  process.exit(2);
}

const GEMINI_CLI_CMD = process.env.GEMINI_CLI_CMD || 'gemini';
const GEMINI_CLI_ARGS = (process.env.GEMINI_CLI_ARGS || '').split(' ').filter(Boolean);

function exists(cmd) {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const res = spawnSync(which, [cmd], { stdio: 'ignore' });
  return res.status === 0;
}

if (!exists(GEMINI_CLI_CMD)) {
  console.error(`[gemini-cli] Not found: ${GEMINI_CLI_CMD}. Set GEMINI_CLI_CMD or install the CLI.`);
  process.exit(127);
}

// Execute CLI in non-interactive mode using --prompt flag (per Gemini CLI docs)
try {
  // Construct args for non-interactive execution
  const args = [...GEMINI_CLI_ARGS, '--prompt', input];

  // Add debug flag if DEBUG environment variable is set
  if (process.env.DEBUG) {
    args.push('--debug');
  }

  const res = spawnSync(GEMINI_CLI_CMD, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000  // 30s timeout for oauth-personal auth if needed
  });

  // Check for authentication errors and provide helpful message
  if (res.stderr && res.stderr.includes('re-authenticate with the correct type')) {
    console.error('[gemini-cli] Authentication Error: Gemini CLI requires re-authentication.');
    console.error('[gemini-cli] Please run: gemini');
    console.error('[gemini-cli] Then follow the authentication prompts.');
    console.error('[gemini-cli] DevFlow will continue with Codex and Qwen platforms.');
    process.exit(2); // Special exit code for auth errors
  }

  // Forward output and exit code
  if (res.stdout && res.stdout.length > 0) {
    process.stdout.write(res.stdout);
  }
  if (res.stderr && res.stderr.length > 0) {
    process.stderr.write(res.stderr);
  }
  process.exit(typeof res.status === 'number' ? res.status : 1);
} catch (err) {
  console.error('[gemini-cli] Execution failed:', err?.message || String(err));
  process.exit(1);
}
