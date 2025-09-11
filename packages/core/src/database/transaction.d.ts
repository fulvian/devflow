import type Database from 'better-sqlite3';
export declare function withTransaction<T>(db: Database.Database, fn: () => T): T;
//# sourceMappingURL=transaction.d.ts.map