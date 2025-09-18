#!/usr/bin/env node
// Diagnose Gemini CLI OAuth readiness for non-interactive use
import fs from 'node:fs';
import path from 'node:path';

function getCandidateConfigDirs(env) {
  const dirs = [];
  if (env.GEMINI_CONFIG_DIR && env.GEMINI_CONFIG_DIR.length > 0) dirs.push(env.GEMINI_CONFIG_DIR);
  const xdg = env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) dirs.push(path.join(xdg, 'gemini'));
  const home = env.HOME || env.USERPROFILE || '';
  if (home) {
    dirs.push(path.join(home, '.config', 'gemini'));
    dirs.push(path.join(home, '.gemini'));
  }
  return Array.from(new Set(dirs));
}

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function readJsonSafe(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}

const dirs = getCandidateConfigDirs(process.env);
console.log('Gemini CLI credential search paths:');
dirs.forEach((d) => console.log(' -', d));

const files = ['settings.json', 'oauth_creds.json', 'auth.json', path.join('auth','tokens.json')];
let found = false;
for (const d of dirs) {
  for (const f of files) {
    const fp = path.join(d, f);
    if (exists(fp)) {
      found = true;
      console.log(`Found ${f} at: ${fp}`);
      const j = readJsonSafe(fp);
      if (j && typeof j === 'object') {
        if (j.selectedAuthType) console.log('  selectedAuthType:', j.selectedAuthType);
        if (j.security?.auth?.selectedType) console.log('  security.auth.selectedType:', j.security.auth.selectedType);
      }
    }
  }
}

if (!found) {
  console.log('No OAuth credentials/settings detected.');
  console.log('Next steps to enable non-interactive OAuth:');
  console.log('  1) Run `gemini` once on a machine with browser and complete login.');
  console.log('  2) Copy the resulting ~/.gemini or ~/.config/gemini to this machine.');
  console.log('  3) Or use SSH port-forwarding or `gemini --debug` to capture the OAuth URL.');
}

