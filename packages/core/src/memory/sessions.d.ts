import type Database from 'better-sqlite3';
import type { CoordinationSession } from '@devflow/shared';
import { Queries } from '../database/queries.js';
export declare class SessionService {
    private q;
    constructor(db: Database.Database);
    start(session: Omit<CoordinationSession, 'id' | 'startTime' | 'durationSeconds'>): string;
    end(sessionId: string, metrics: Parameters<Queries['endSession']>[1]): void;
}
//# sourceMappingURL=sessions.d.ts.map