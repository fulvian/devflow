export type Result<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: Error;
};
export declare function safeMkdir(path: string): void;
export declare function safeMkdirSafe(path: string): Result<void>;
export declare function writeJSONSafe(filePath: string, data: unknown): void;
export declare function tryWriteJSON(filePath: string, data: unknown): Result<void>;
export declare function readJSONSafe<T = unknown>(filePath: string): T | null;
export declare function tryReadJSON<T = unknown>(filePath: string): Result<T | null>;
export declare function listFilesRecursively(dir: string): string[];
//# sourceMappingURL=safe-ops.d.ts.map