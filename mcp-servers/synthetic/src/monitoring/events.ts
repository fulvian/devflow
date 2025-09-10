import { EventEmitter } from 'events';
import { SessionEvent, SessionData } from './types';

class SessionEventEmitter extends EventEmitter {
  emitSessionEvent(event: SessionEvent): boolean {
    return this.emit('sessionEvent', event);
  }

  emitSessionUpdate(session: SessionData): boolean {
    return this.emit('sessionUpdate', session);
  }

  emitLimitWarning(session: SessionData, estimatedTimeToLimit: number): boolean {
    return this.emit('limitWarning', { session, estimatedTimeToLimit });
  }

  emitLimitExceeded(session: SessionData): boolean {
    return this.emit('limitExceeded', session);
  }

  emitSessionRecovered(session: SessionData): boolean {
    return this.emit('sessionRecovered', session);
  }

  emitHealthDegraded(session: SessionData, health: string): boolean {
    return this.emit('healthDegraded', { session, health });
  }
}

export const sessionEvents = new SessionEventEmitter();

// Event types for type safety
export const SESSION_EVENTS = {
  SESSION_EVENT: 'sessionEvent',
  SESSION_UPDATE: 'sessionUpdate',
  LIMIT_WARNING: 'limitWarning',
  LIMIT_EXCEEDED: 'limitExceeded',
  SESSION_RECOVERED: 'sessionRecovered',
  HEALTH_DEGRADED: 'healthDegraded'
} as const;

export type SessionEventType = typeof SESSION_EVENTS[keyof typeof SESSION_EVENTS];