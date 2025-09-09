import type Database from 'better-sqlite3';
import type { TaskContext } from '@devflow/shared';
import { Queries } from '../database/queries.js';

export class ContextService {
  private q: Queries;
  constructor(db: Database.Database) {
    this.q = new Queries(db);
  }

  create(ctx: Omit<TaskContext, 'id' | 'createdAt' | 'updatedAt'>): string {
    return this.q.createTaskContext(ctx);
  }

  get(id: string): TaskContext | null {
    return this.q.getTaskContext(id);
  }

  update(id: string, updates: Partial<TaskContext>): void {
    this.q.updateTaskContext(id, updates);
  }

  search(q: string): TaskContext[] {
    return this.q.searchTaskContexts(q);
  }
}
