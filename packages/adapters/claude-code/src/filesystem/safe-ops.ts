import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
export type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

export function safeMkdir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function safeMkdirSafe(path: string): Result<void> {
  try {
    if (!existsSync(path)) mkdirSync(path, { recursive: true });
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
}

export function writeJSONSafe(filePath: string, data: unknown) {
  const dir = dirname(filePath);
  safeMkdir(dir);
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    // swallow to avoid disrupting user flow
  }
}

export function tryWriteJSON(filePath: string, data: unknown): Result<void> {
  try {
    const dir = dirname(filePath);
    const dirRes = safeMkdirSafe(dir);
    if (!dirRes.ok) return dirRes;
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
}

export function readJSONSafe<T = unknown>(filePath: string): T | null {
  try {
    const buf = readFileSync(filePath, 'utf8');
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}

export function tryReadJSON<T = unknown>(filePath: string): Result<T | null> {
  try {
    const buf = readFileSync(filePath, 'utf8');
    return { ok: true, value: JSON.parse(buf) as T };
  } catch (e) {
    return { ok: false, error: e as Error };
  }
}

export function listFilesRecursively(dir: string): string[] {
  const out: string[] = [];
  const base = resolve(dir);
  function walk(d: string) {
    let entries: string[] = [];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const e of entries) {
      const p = resolve(d, e);
      let s: ReturnType<typeof statSync> | null = null;
      try { s = statSync(p); } catch { continue; }
      if (s.isDirectory()) walk(p);
      else out.push(p);
    }
  }
  walk(base);
  return out;
}
