import { Queries } from '../database/queries.js';
export class ContextService {
    q;
    constructor(db) {
        this.q = new Queries(db);
    }
    create(ctx) {
        return this.q.createTaskContext(ctx);
    }
    get(id) {
        return this.q.getTaskContext(id);
    }
    update(id, updates) {
        this.q.updateTaskContext(id, updates);
    }
    search(q) {
        return this.q.searchTaskContexts(q);
    }
}
//# sourceMappingURL=contexts.js.map