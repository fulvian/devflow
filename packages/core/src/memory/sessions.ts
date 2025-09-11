import type Database from 'better-sqlite3';
import type { CoordinationSession } from '@devflow/shared';
import { Queries } from '../database/queries.js';

/**
 * Hook function types for SessionService
 */
export type PreExecutionHook = (toolName: string, args: any) => Promise<boolean>;
export type PostMessageHook = (message: string) => void;

export class SessionService {
  private q: Queries;
  private preExecutionHooks: Map<string, PreExecutionHook>;
  private postMessageHooks: Map<string, PostMessageHook>;

  constructor(db: Database.Database) {
    this.q = new Queries(db);
    this.preExecutionHooks = new Map();
    this.postMessageHooks = new Map();
  }

  start(session: Omit<CoordinationSession, 'id' | 'startTime' | 'durationSeconds'>): string {
    return this.q.startSession(session);
  }

  end(sessionId: string, metrics: Parameters<Queries['endSession']>[1]): void {
    this.q.endSession(sessionId, metrics);
  }

  /**
   * Register a hook that runs before tool execution
   * Used by DiscussionEnforcer to block tools requiring approval
   */
  registerPreExecutionHook(name: string, hook: PreExecutionHook): void {
    this.preExecutionHooks.set(name, hook);
  }

  /**
   * Register a hook that runs after message processing
   * Used by DiscussionEnforcer to detect approval phrases
   */
  registerPostMessageHook(name: string, hook: PostMessageHook): void {
    this.postMessageHooks.set(name, hook);
  }

  /**
   * Remove a pre-execution hook
   */
  unregisterPreExecutionHook(name: string): boolean {
    return this.preExecutionHooks.delete(name);
  }

  /**
   * Remove a post-message hook
   */
  unregisterPostMessageHook(name: string): boolean {
    return this.postMessageHooks.delete(name);
  }

  /**
   * Execute all pre-execution hooks before tool execution
   * Returns false if any hook blocks execution
   */
  async executePreExecutionHooks(toolName: string, args: any): Promise<boolean> {
    for (const [name, hook] of this.preExecutionHooks.entries()) {
      try {
        const allowed = await hook(toolName, args);
        if (!allowed) {
          console.log(`Tool execution blocked by hook: ${name}`);
          return false;
        }
      } catch (error) {
        console.error(`Error in pre-execution hook ${name}:`, error);
        return false;
      }
    }
    return true;
  }

  /**
   * Execute all post-message hooks after message processing
   */
  executePostMessageHooks(message: string): void {
    for (const [name, hook] of this.postMessageHooks.entries()) {
      try {
        hook(message);
      } catch (error) {
        console.error(`Error in post-message hook ${name}:`, error);
      }
    }
  }

  /**
   * Get list of registered pre-execution hooks
   */
  getPreExecutionHooks(): string[] {
    return Array.from(this.preExecutionHooks.keys());
  }

  /**
   * Get list of registered post-message hooks  
   */
  getPostMessageHooks(): string[] {
    return Array.from(this.postMessageHooks.keys());
  }
}
