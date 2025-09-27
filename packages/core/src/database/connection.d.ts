import Database from 'better-sqlite3';
export interface DBConfig {
    path?: string;
    readonly?: boolean;
    verbose?: boolean;
}
type DBHandle = Database.Database;
export declare function getDB(config?: DBConfig): DBHandle;
export declare function closeDB(path?: string): void;
export declare function withDB<T>(fn: (db: DBHandle) => T, config?: DBConfig): T;
export {};
//# sourceMappingURL=connection.d.ts.map