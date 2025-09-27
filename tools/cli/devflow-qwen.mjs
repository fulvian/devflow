#!/usr/bin/env node
// DevFlow Qwen Code CLI wrapper (complete integration)
// Uses Qwen official terminal CLI (qwen or qwen-code). Returns non-zero if unavailable.

import { spawnSync } from 'child_process';

const input = process.argv.slice(2).join(' ').trim();
if (!input) {
  console.error('Usage: devflow-qwen <input string>');
  process.exit(2);
}

const QWEN_CLI_CMD = process.env.QWEN_CLI_CMD || 'qwen';
const QWEN_CLI_ARGS = (process.env.QWEN_CLI_ARGS || '').split(' ').filter(Boolean);

function exists(cmd) {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const res = spawnSync(which, [cmd], { stdio: 'ignore' });
  return res.status === 0;
}

// Try primary; fallback to qwen-code if present and QWEN_CLI_CMD is default
let cliCmd = QWEN_CLI_CMD;
if (!exists(cliCmd)) {
  if (QWEN_CLI_CMD === 'qwen' && exists('qwen-code')) {
    cliCmd = 'qwen-code';
  } else {
    console.error(`[qwen-cli] Not found: ${QWEN_CLI_CMD}. Set QWEN_CLI_CMD or install the CLI.`);
    process.exit(127);
  }
}

try {
  const res = spawnSync(cliCmd, QWEN_CLI_ARGS, {
    input,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });

  if (res.stdout && res.stdout.length > 0) {
    process.stdout.write(res.stdout);
  }
  if (res.stderr && res.stderr.length > 0) {
    process.stderr.write(res.stderr);
  }
  process.exit(typeof res.status === 'number' ? res.status : 1);
} catch (err) {
  console.error('[qwen-cli] Execution failed:', err?.message || String(err));
  process.exit(1);
}
