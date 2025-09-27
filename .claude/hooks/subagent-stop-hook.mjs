#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Delegate to intelligent-save-hook
const hook = await import(path.resolve(__dirname, 'intelligent-save-hook.mjs'));

