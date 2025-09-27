#!/usr/bin/env node
// Simple environment validation for DevFlow CLI integrations

import { spawnSync } from 'child_process';
import http from 'http';

function exists(cmd) {
  const which = process.platform === 'win32' ? 'where' : 'which';
  const res = spawnSync(which, [cmd], { stdio: 'ignore' });
  return res.status === 0;
}

function version(cmd) {
  try {
    const res = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (res.status === 0) return (res.stdout || res.stderr || '').trim();
  } catch (_) {}
  return '';
}

function logStatus(name, ok, detail) {
  const status = ok ? 'OK' : 'MISSING';
  console.log(`${name}: ${status}${detail ? ` (${detail})` : ''}`);
}

// Gemini CLI
const geminiCmd = process.env.GEMINI_CLI_CMD || 'gemini';
const hasGemini = exists(geminiCmd);
logStatus('Gemini CLI', hasGemini, hasGemini ? version(geminiCmd) : `set GEMINI_CLI_CMD or install '${geminiCmd}'`);

// Qwen Code CLI
let qwenCmd = process.env.QWEN_CLI_CMD || 'qwen';
let hasQwen = exists(qwenCmd);
if (!hasQwen && qwenCmd === 'qwen' && exists('qwen-code')) {
  qwenCmd = 'qwen-code';
  hasQwen = true;
}
logStatus('Qwen Code CLI', hasQwen, hasQwen ? version(qwenCmd) : `set QWEN_CLI_CMD or install 'qwen'/'qwen-code'`);

// Codex MCP health
const host = process.env.CODEX_MCP_HOST || '127.0.0.1';
const port = parseInt(process.env.CODEX_MCP_PORT || '3101', 10);
const req = http.request({ host, port, path: '/health', method: 'GET', timeout: 1500 }, (res) => {
  let data = '';
  res.setEncoding('utf8');
  res.on('data', chunk => (data += chunk));
  res.on('end', () => {
    try {
      const json = JSON.parse(data || '{}');
      if (json.status === 'healthy') {
        logStatus('Codex MCP', true, `sessions=${json.sessions ?? 0}`);
      } else {
        logStatus('Codex MCP', false, 'unhealthy');
      }
    } catch (_) {
      logStatus('Codex MCP', false, 'invalid response');
    }
  });
});
req.on('error', () => logStatus('Codex MCP', false, `http://${host}:${port}/health unreachable`));
req.on('timeout', () => { req.destroy(); logStatus('Codex MCP', false, 'timeout'); });
req.end();

