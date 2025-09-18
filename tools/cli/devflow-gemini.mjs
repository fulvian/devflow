#!/usr/bin/env node
// DevFlow Gemini CLI wrapper (complete integration)
// Uses a local Gemini CLI binary; returns non-zero if unavailable.

import { spawnSync } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const input = args.join(' ').trim();
if (!input) {
  console.error('Usage: devflow-gemini <input string>');
  process.exit(2);
}

const GEMINI_CLI_CMD = process.env.GEMINI_CLI_CMD || 'gemini';
const GEMINI_CLI_ARGS = (process.env.GEMINI_CLI_ARGS || '')
  .split(' ')
  .filter(Boolean);

function detectDesiredAuthType(env) {
  // Prefer API key if present (either var implies API-key auth)
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) return 'api-key';
  // Prefer Google ADC / service account if creds path is present
  if (env.GOOGLE_APPLICATION_CREDENTIALS) return 'google-credentials';
  // Otherwise likely oauth-personal (interactive-only)
  return 'oauth-personal';
}

function harmonizeAuthEnv(env) {
  // Ensure both env vars are set if only one is present (CLI supports either)
  if (env.GEMINI_API_KEY && !env.GOOGLE_API_KEY) {
    env.GOOGLE_API_KEY = env.GEMINI_API_KEY;
  } else if (env.GOOGLE_API_KEY && !env.GEMINI_API_KEY) {
    env.GEMINI_API_KEY = env.GOOGLE_API_KEY;
  }
  return env;
}

function getCandidateConfigDirs(env) {
  const dirs = [];
  if (env.GEMINI_CONFIG_DIR && env.GEMINI_CONFIG_DIR.length > 0) {
    dirs.push(env.GEMINI_CONFIG_DIR);
  }
  const xdg = env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) dirs.push(path.join(xdg, 'gemini'));
  const home = env.HOME || env.USERPROFILE || '';
  if (home) {
    dirs.push(path.join(home, '.config', 'gemini'));
    dirs.push(path.join(home, '.gemini'));
  }
  return Array.from(new Set(dirs));
}

function hasOauthTokens(env) {
  try {
    const dirs = getCandidateConfigDirs(env);
    for (const dir of dirs) {
      const candidates = [
        'oauth_creds.json',
        'auth.json',
        'settings.json',
        path.join('auth', 'tokens.json'),
      ];
      for (const file of candidates) {
        const fp = path.join(dir, file);
        if (fs.existsSync(fp)) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function runInteractiveAuth(cmd) {
  console.error('[gemini-cli] No OAuth personal tokens found. Launching interactive auth...');
  console.error('[gemini-cli] In the prompt type /auth, complete login, then exit (Ctrl+D or /quit).');
  const r = spawnSync(cmd, [], { stdio: 'inherit' });
  return r.status === 0;
}

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
  // Build args: prefer non-interactive --prompt for all modes
  const desiredAuth = detectDesiredAuthType(process.env);
  const autoAuthAllowed = process.env.DEVFLOW_GEMINI_AUTO_AUTH !== '0';
  let attemptedInteractiveAuth = false;
  if (desiredAuth === 'oauth-personal' && autoAuthAllowed && process.stdin.isTTY && !hasOauthTokens(process.env)) {
    const ok = runInteractiveAuth(GEMINI_CLI_CMD);
    if (!ok) {
      console.error('[gemini-cli] Interactive authentication aborted or failed.');
      process.exit(2);
    }
    attemptedInteractiveAuth = true;
  }
  let args = [...GEMINI_CLI_ARGS];
  args.push('--prompt', input);

  // Add debug flag if DEBUG environment variable is set
  if (process.env.DEBUG) {
    args.push('--debug');
  }

  // Prepare child env with auth fallbacks harmonized
  const childEnv = harmonizeAuthEnv({ ...process.env });

  const res = spawnSync(GEMINI_CLI_CMD, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000, // 30s timeout for oauth-personal auth if needed
    env: childEnv,
    // always use --prompt; avoid stdin to keep non-interactive semantics
  });

  // Check for authentication errors and provide helpful, actionable guidance
  const stderr = (res.stderr || '').toString();
  const stdout = (res.stdout || '').toString();
  const authErrorSignals = [
    're-authenticate with the correct type',
    'configured auth type is oauth',
    'current auth type is undefined',
    'authentication required',
  ];

  const isAuthError = authErrorSignals.some((s) => stderr.toLowerCase().includes(s));
  if (isAuthError || res.status === 2) {
    console.error('[gemini-cli] Authentication error detected.');
    console.error(`[gemini-cli] Detected desired non-interactive auth: ${desiredAuth}.`);

    // Auto interactive auth fallback once (for oauth-personal) then retry
    if (desiredAuth === 'oauth-personal' && autoAuthAllowed && process.stdin.isTTY && !attemptedInteractiveAuth) {
      if (!hasOauthTokens(process.env)) {
        const ok = runInteractiveAuth(GEMINI_CLI_CMD);
        if (ok) {
          const retry = spawnSync(GEMINI_CLI_CMD, args, {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30000,
            env: childEnv,
            // always use --prompt
          });
          const rStderr = (retry.stderr || '').toString();
          const rStdout = (retry.stdout || '').toString();
          if (rStdout) process.stdout.write(rStdout);
          if (rStderr) process.stderr.write(rStderr);
          process.exit(typeof retry.status === 'number' ? retry.status : 1);
        }
      }
    }

    // If oauth-personal without TTY, attempt to surface an OAuth URL via --debug
    if (
      desiredAuth === 'oauth-personal' &&
      !process.stdin.isTTY &&
      !hasOauthTokens(process.env)
    ) {
      try {
        const dbg = spawnSync(
          GEMINI_CLI_CMD,
          ['--debug', '--prompt', 'auth-check'],
          { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, env: childEnv, timeout: 15000 }
        );
        const combined = `${dbg.stdout || ''}\n${dbg.stderr || ''}`;
        const urls = Array.from(new Set((combined.match(/https?:\/\/[^\s'"<>]+/g) || [])))
          .filter((u) => /accounts\.google\.com|oauth|localhost:\d+/.test(u))
          .slice(0, 3);
        if (urls.length > 0) {
          console.error('[gemini-cli] Possible OAuth URLs detected (open in a browser):');
          urls.forEach((u) => console.error(`  - ${u}`));
          const candidates = getCandidateConfigDirs(process.env);
          console.error('[gemini-cli] Credential search paths:');
          candidates.forEach((d) => console.error(`  - ${d}`));
          console.error('[gemini-cli] Tip: If remote, port-forward the localhost callback port:');
          console.error('  ssh -L <port>:localhost:<port> user@server');
        }
      } catch {}
    }

    // Provide targeted remediation based on detected desired auth
    if (desiredAuth === 'api-key') {
      console.error('[gemini-cli] API key detected but auth mismatch persists.');
      console.error('[gemini-cli] Try ensuring both env vars are set:');
      console.error('  export GEMINI_API_KEY="$YOUR_API_KEY"');
      console.error('  export GOOGLE_API_KEY="$YOUR_API_KEY"');
      console.error('[gemini-cli] If your CLI settings enforce oauth-personal, disable enforcedType or select API key:');
      console.error('  - Edit ~/.config/gemini/settings.json security.auth.selectedType to "api_key"');
      console.error('  - Remove/adjust security.auth.enforcedType');
    } else if (desiredAuth === 'google-credentials') {
      console.error('[gemini-cli] Using Google credentials path; ensure ADC is set up:');
      console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"');
      console.error('  or run: gcloud auth application-default login');
      console.error('[gemini-cli] If CLI enforces oauth-personal, remove enforcement or run interactive /auth.');
    } else {
      console.error('[gemini-cli] Non-interactive oauth-personal is not supported without prior login.');
      console.error('[gemini-cli] Recommended fixes:');
      console.error('  1) Set an API key for non-interactive use:');
      console.error('     export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"');
      console.error('     export GOOGLE_API_KEY="YOUR_GEMINI_API_KEY"');
      console.error('  2) Or configure ADC / service account:');
      console.error('     export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"');
      console.error('     or run: gcloud auth application-default login');
      console.error('  3) Or run interactive auth once, then retry:');
      console.error('     gemini  (then run /auth and choose your method)');
    }

    console.error('[gemini-cli] DevFlow will continue with other platforms (Codex, Qwen).');
    process.exit(2); // Special exit code for auth errors
  }

  // Forward output and exit code
  if (stdout && stdout.length > 0) {
    process.stdout.write(stdout);
  }
  if (stderr && stderr.length > 0) {
    process.stderr.write(stderr);
  }
  process.exit(typeof res.status === 'number' ? res.status : 1);
} catch (err) {
  console.error('[gemini-cli] Execution failed:', err?.message || String(err));
  process.exit(1);
}
