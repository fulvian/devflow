import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
export function safeMkdir(path) {
    if (!existsSync(path))
        mkdirSync(path, { recursive: true });
}
export function safeMkdirSafe(path) {
    try {
        if (!existsSync(path))
            mkdirSync(path, { recursive: true });
        return { ok: true, value: undefined };
    }
    catch (e) {
        return { ok: false, error: e };
    }
}
export function writeJSONSafe(filePath, data) {
    const dir = dirname(filePath);
    safeMkdir(dir);
    try {
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    catch (e) {
        // swallow to avoid disrupting user flow
    }
}
export function tryWriteJSON(filePath, data) {
    try {
        const dir = dirname(filePath);
        const dirRes = safeMkdirSafe(dir);
        if (!dirRes.ok)
            return dirRes;
        writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return { ok: true, value: undefined };
    }
    catch (e) {
        return { ok: false, error: e };
    }
}
export function readJSONSafe(filePath) {
    try {
        const buf = readFileSync(filePath, 'utf8');
        return JSON.parse(buf);
    }
    catch {
        return null;
    }
}
export function tryReadJSON(filePath) {
    try {
        const buf = readFileSync(filePath, 'utf8');
        return { ok: true, value: JSON.parse(buf) };
    }
    catch (e) {
        return { ok: false, error: e };
    }
}
export function listFilesRecursively(dir) {
    const out = [];
    const base = resolve(dir);
    function walk(d) {
        let entries = [];
        try {
            entries = readdirSync(d);
        }
        catch {
            return;
        }
        for (const e of entries) {
            const p = resolve(d, e);
            let s = null;
            try {
                s = statSync(p);
            }
            catch {
                continue;
            }
            if (s.isDirectory())
                walk(p);
            else
                out.push(p);
        }
    }
    walk(base);
    return out;
}
//# sourceMappingURL=safe-ops.js.map