import type Database from 'better-sqlite3';
import type { TaskContext } from '@devflow/shared';
export declare class ContextService {
    private q;
    constructor(db: Database.Database);
    create(ctx: Omit<TaskContext, 'id' | 'createdAt' | 'updatedAt'>): string;
    get(id: string): TaskContext | null;
    update(id: string, updates: Partial<TaskContext>): void;
    search(q: string): TaskContext[];
}
//# sourceMappingURL=contexts.d.ts.map