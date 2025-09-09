import type Database from 'better-sqlite3';
import type { CoordinationSession } from '@devflow/shared';
import { Queries } from '../database/queries.js';

export class SessionService {
  private q: Queries;
  constructor(db: Database.Database) {
    this.q = new Queries(db);
  }

  start(session: Omit<CoordinationSession, 'id' | 'startTime' | 'durationSeconds'>): string {
    return this.q.startSession(session);
  }

  end(sessionId: string, metrics: Parameters<Queries['endSession']>[1]): void {
    this.q.endSession(sessionId, metrics);
  }
}
