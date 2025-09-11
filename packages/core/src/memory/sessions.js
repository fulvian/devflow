import { Queries } from '../database/queries.js';
export class SessionService {
    q;
    constructor(db) {
        this.q = new Queries(db);
    }
    start(session) {
        return this.q.startSession(session);
    }
    end(sessionId, metrics) {
        this.q.endSession(sessionId, metrics);
    }
}
//# sourceMappingURL=sessions.js.map