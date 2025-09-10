#!/usr/bin/env node
/**
 * Unified launcher: DevFlow + CCR (Claude Code Router)
 * - Stops existing CCR/DevFlow background processes
 * - Starts CCR in background (proxy/fallback chain)
 * - Starts DevFlow MCP server in background
 * - Prints connection info for Claude Code interface
 */

import { spawn, exec } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, watch as fsWatch } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = process.cwd();
const PROJECT_CLAUDE_DIR = join(PROJECT_ROOT, '.claude');
const PROJECT_TRANSCRIPTS_DIR = join(PROJECT_CLAUDE_DIR, 'transcripts');
const CCR_BIN = '@musistudio/claude-code-router';
const CCR_HOME_DIR = join(process.env.HOME || '', '.claude-code-router');
const CCR_HOME_CONFIG = join(CCR_HOME_DIR, 'config.json');
const PROJ_CCR_CONFIG = join(PROJECT_ROOT, 'configs', 'ccr-config.json');
const USER_CLAUDE_CFG = join(process.env.HOME || '', '.claude-code', 'config.json');

function log(msg) { console.log(msg); }
function warn(msg) { console.warn(msg); }
function err(msg) { console.error(msg); }

function pkill(pattern) {
  return new Promise((resolve) => {
    exec(`pkill -f "${pattern}" || true`, () => resolve());
  });
}

async function stopExisting() {
  log('🔄 Stopping existing background processes (CCR/DevFlow)...');
  await pkill('claude-code-router');
  await pkill('mcp-server.js');
  await pkill('start-devflow.mjs');
}

function ensureCCRConfig() {
  if (!existsSync(CCR_HOME_DIR)) mkdirSync(CCR_HOME_DIR, { recursive: true });
  if (existsSync(PROJ_CCR_CONFIG)) {
    try {
      const cfg = JSON.parse(readFileSync(PROJ_CCR_CONFIG, 'utf-8'));
      // propagate API keys if provided via env
      if (process.env.OPENAI_API_KEY) cfg.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (process.env.OPENROUTER_API_KEY) cfg.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
      writeFileSync(CCR_HOME_CONFIG, JSON.stringify(cfg, null, 2));
      log(`✅ CCR config applied: ${CCR_HOME_CONFIG}`);
    } catch (e) {
      warn(`⚠️ Failed to apply project CCR config: ${e.message}`);
    }
  } else {
    warn('⚠️ Project CCR config not found at ./configs/ccr-config.json; using existing/global config.');
  }
}

function startBackground(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, ...env },
  });
  child.unref();
  return child;
}

async function startCCR({ port }) {
  // Some CCR builds honor PORT from env. If not supported, CCR will still start with its default.
  const env = {};
  if (port) env.PORT = String(port);
  log(`🚀 Starting CCR (Claude Code Router)${port ? ` on port ${port}` : ''}...`);
  startBackground('npx', [CCR_BIN, 'start'], env);
}

async function startDevFlow() {
  // Use the provided startup script which launches the MCP server
  const scriptPath = join(PROJECT_ROOT, 'start-devflow.mjs');
  if (!existsSync(scriptPath)) {
    throw new Error('start-devflow.mjs not found. Please ensure DevFlow startup script exists.');
  }
  log('🚀 Starting DevFlow MCP server in background...');
  startBackground('node', [scriptPath], { DEVFLOW_CCR_ENABLED: 'true' });
}

function getLatestTranscriptFile() {
  if (!existsSync(PROJECT_TRANSCRIPTS_DIR)) return undefined;
  const files = readdirSync(PROJECT_TRANSCRIPTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ f, t: statSync(join(PROJECT_TRANSCRIPTS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files.length ? join(PROJECT_TRANSCRIPTS_DIR, files[0].f) : undefined;
}

function forceClaudeToUseCCR(port) {
  try {
    if (!existsSync(USER_CLAUDE_CFG)) return false;
    const raw = readFileSync(USER_CLAUDE_CFG, 'utf-8');
    const cfg = JSON.parse(raw);
    const endpoint = `http://localhost:${port || 3001}`;
    // minimal fields commonly used
    if (!cfg.claude) cfg.claude = {};
    cfg.claude.apiEndpoint = endpoint;
    if (!cfg.ctir) cfg.ctir = {};
    cfg.ctir.proxyUrl = endpoint;
    cfg.ctir.healthCheck = `${endpoint}/health`;
    writeFileSync(USER_CLAUDE_CFG, JSON.stringify(cfg, null, 2));
    log(`🔀 Updated ~/.claude-code/config.json to use CCR at ${endpoint}`);
    return true;
  } catch (e) {
    warn(`⚠️ Unable to update Claude client config: ${e.message}`);
    return false;
  }
}

function startLimitWatcher(port) {
  try {
    if (!existsSync(PROJECT_CLAUDE_DIR)) return;
    if (!existsSync(PROJECT_TRANSCRIPTS_DIR)) return;
  } catch {
    return;
  }
  let armed = true;
  const pattern = /(5\s*-?hour limit|limit reached|usage limit)/i;
  const primeFile = getLatestTranscriptFile();
  const readContent = (p) => {
    try { return readFileSync(p, 'utf-8'); } catch { return ''; }
  };
  let lastSeenPath = primeFile;
  fsWatch(PROJECT_TRANSCRIPTS_DIR, { persistent: false }, () => {
    if (!armed) return;
    const latest = getLatestTranscriptFile();
    if (!latest || latest === lastSeenPath) return;
    lastSeenPath = latest;
    const content = readContent(latest);
    if (pattern.test(content)) {
      armed = false;
      log('⛔ Detected Claude session usage limit. Enabling CCR proxy for client...');
      forceClaudeToUseCCR(port);
      // Ensure CCR is running (idempotent)
      startBackground('npx', [CCR_BIN, 'start'], port ? { PORT: String(port) } : {});
      log('✅ Auto-switch prepared. Reopen a new Claude chat; routing will use CCR.');
    }
  });
}

async function main() {
  try {
    const portArg = process.argv.find((a) => a.startsWith('--port='));
    const port = portArg ? Number(portArg.split('=')[1]) : undefined;

    await stopExisting();
    ensureCCRConfig();
    await startCCR({ port });
    await startDevFlow();
    startLimitWatcher(port);

    log('\n✅ All set. Next steps:');
    log('- Open Claude Code interface (your usual app/extension).');
    log('- Configure endpoint to your CCR proxy (see ~/.claude-code/config.json).');
    log('- Session limit detection and automatic switch to CCR are active via router.');
    log('\nHelpful checks:');
    log('  ccr status');
    log('  ps aux | grep claude-code-router | grep -v grep');
  } catch (e) {
    err(`❌ Launch failed: ${e.message}`);
    process.exit(1);
  }
}

main();


