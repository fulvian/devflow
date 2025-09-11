import { SQLiteMemoryManager } from '@devflow/core';
export declare class ContextManager {
    private memory;
    private contextDir;
    constructor(memory: SQLiteMemoryManager, contextDir: string);
    extractAndStore(taskId: string, sessionId: string, meta?: {
        reason?: string;
    }): Promise<void>;
    inject(taskId: string | undefined, sessionId: string): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map