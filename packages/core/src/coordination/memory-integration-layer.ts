// File: src/integrations/memory/CCRMemoryIntegration.ts

import { MemorySystem } from '../../memory/MemorySystem';
import { CCREnhancedManager } from '../../managers/CCREnhancedManager';
import { MemoryEntry, MemoryType } from '../../memory/types';
import { Logger } from '../../utils/Logger';
import { EventEmitter } from 'events';

/**
 * Memory integration layer for CCR manager
 * Handles context retrieval, state persistence, and cross-session continuity
 */
export class CCRMemoryIntegration extends EventEmitter {
  private memorySystem: MemorySystem;
  private ccrManager: CCREnhancedManager;
  private logger: Logger;
  private sessionId: string;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(memorySystem: MemorySystem, ccrManager: CCREnhancedManager) {
    super();
    this.memorySystem = memorySystem;
    this.ccrManager = ccrManager;
    this.logger = new Logger('CCRMemoryIntegration');
    this.sessionId = this.generateSessionId();
    
    this.setupEventListeners();
    this.initializeCleanupProcess();
  }

  /**
   * Initialize event listeners for CCR manager events
   */
  private setupEventListeners(): void {
    this.ccrManager.on('stateChange', this.handleStateChange.bind(this));
    this.ccrManager.on('contextUpdate', this.handleContextUpdate.bind(this));
    this.ccrManager.on('taskCompleted', this.handleTaskCompletion.bind(this));
  }

  /**
   * Handle state changes in CCR manager
   */
  private async handleStateChange(state: any): Promise<void> {
    try {
      await this.persistState(state);
      this.emit('statePersisted', state);
    } catch (error) {
      this.logger.error('Failed to persist state', error);
      this.emit('error', new Error(`State persistence failed: ${error}`));
    }
  }

  /**
   * Handle context updates from CCR manager
   */
  private async handleContextUpdate(context: any): Promise<void> {
    try {
      await this.storeContext(context);
      this.emit('contextStored', context);
    } catch (error) {
      this.logger.error('Failed to store context', error);
      this.emit('error', new Error(`Context storage failed: ${error}`));
    }
  }

  /**
   * Handle task completion events
   */
  private async handleTaskCompletion(taskResult: any): Promise<void> {
    try {
      await this.storeTaskResult(taskResult);
      this.emit('taskResultStored', taskResult);
    } catch (error) {
      this.logger.error('Failed to store task result', error);
      this.emit('error', new Error(`Task result storage failed: ${error}`));
    }
  }

  /**
   * Retrieve context from memory for current session
   */
  public async retrieveContext(sessionId?: string): Promise<any> {
    try {
      const targetSessionId = sessionId || this.sessionId;
      const contextEntry = await this.memorySystem.retrieve(
        `context_${targetSessionId}`,
        MemoryType.CONTEXT
      );
      
      return contextEntry ? contextEntry.data : null;
    } catch (error) {
      this.logger.error('Failed to retrieve context', error);
      throw new Error(`Context retrieval failed: ${error}`);
    }
  }

  /**
   * Store context in memory
   */
  public async storeContext(context: any): Promise<void> {
    try {
      const contextEntry: MemoryEntry = {
        id: `context_${this.sessionId}`,
        type: MemoryType.CONTEXT,
        data: context,
        timestamp: Date.now(),
        sessionId: this.sessionId
      };

      await this.memorySystem.store(contextEntry);
      this.logger.debug(`Context stored for session ${this.sessionId}`);
    } catch (error) {
      this.logger.error('Failed to store context', error);
      throw new Error(`Context storage failed: ${error}`);
    }
  }

  /**
   * Persist CCR manager state
   */
  public async persistState(state: any): Promise<void> {
    try {
      const stateEntry: MemoryEntry = {
        id: `state_${this.sessionId}`,
        type: MemoryType.STATE,
        data: state,
        timestamp: Date.now(),
        sessionId: this.sessionId
      };

      await this.memorySystem.store(stateEntry);
      this.logger.debug(`State persisted for session ${this.sessionId}`);
    } catch (error) {
      this.logger.error('Failed to persist state', error);
      throw new Error(`State persistence failed: ${error}`);
    }
  }

  /**
   * Retrieve persisted state
   */
  public async retrieveState(sessionId?: string): Promise<any> {
    try {
      const targetSessionId = sessionId || this.sessionId;
      const stateEntry = await this.memorySystem.retrieve(
        `state_${targetSessionId}`,
        MemoryType.STATE
      );
      
      return stateEntry ? stateEntry.data : null;
    } catch (error) {
      this.logger.error('Failed to retrieve state', error);
      throw new Error(`State retrieval failed: ${error}`);
    }
  }

  /**
   * Store task result in memory
   */
  public async storeTaskResult(taskResult: any): Promise<void> {
    try {
      const taskEntry: MemoryEntry = {
        id: `task_${this.sessionId}_${Date.now()}`,
        type: MemoryType.TASK_RESULT,
        data: taskResult,
        timestamp: Date.now(),
        sessionId: this.sessionId
      };

      await this.memorySystem.store(taskEntry);
      this.logger.debug(`Task result stored for session ${this.sessionId}`);
    } catch (error) {
      this.logger.error('Failed to store task result', error);
      throw new Error(`Task result storage failed: ${error}`);
    }
  }

  /**
   * Restore CCR manager state from memory
   */
  public async restoreState(): Promise<boolean> {
    try {
      const persistedState = await this.retrieveState();
      
      if (persistedState) {
        await this.ccrManager.restoreState(persistedState);
        this.logger.info(`State restored for session ${this.sessionId}`);
        this.emit('stateRestored', persistedState);
        return true;
      }
      
      this.logger.info('No persisted state found for restoration');
      return false;
    } catch (error) {
      this.logger.error('Failed to restore state', error);
      throw new Error(`State restoration failed: ${error}`);
    }
  }

  /**
   * Restore context from memory
   */
  public async restoreContext(): Promise<boolean> {
    try {
      const context = await this.retrieveContext();
      
      if (context) {
        await this.ccrManager.setContext(context);
        this.logger.info(`Context restored for session ${this.sessionId}`);
        this.emit('contextRestored', context);
        return true;
      }
      
      this.logger.info('No context found for restoration');
      return false;
    } catch (error) {
      this.logger.error('Failed to restore context', error);
      throw new Error(`Context restoration failed: ${error}`);
    }
  }

  /**
   * Initialize cleanup process for expired memory entries
   */
  private initializeCleanupProcess(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performMemoryCleanup();
      } catch (error) {
        this.logger.error('Memory cleanup failed', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Perform cleanup of expired memory entries
   */
  public async performMemoryCleanup(expirationTime: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const cutoffTime = Date.now() - expirationTime;
      await this.memorySystem.cleanup(cutoffTime);
      this.logger.info('Memory cleanup completed');
      this.emit('cleanupCompleted');
    } catch (error) {
      this.logger.error('Memory cleanup failed', error);
      throw new Error(`Memory cleanup failed: ${error}`);
    }
  }

  /**
   * Create a new session and update session ID
   */
  public createNewSession(): string {
    this.sessionId = this.generateSessionId();
    this.logger.info(`New session created: ${this.sessionId}`);
    this.emit('sessionCreated', this.sessionId);
    return this.sessionId;
  }

  /**
   * Get current session ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown integration and cleanup resources
   */
  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Perform final cleanup
    try {
      await this.performMemoryCleanup();
    } catch (error) {
      this.logger.error('Final memory cleanup failed during shutdown', error);
    }

    this.logger.info('CCR Memory Integration shutdown completed');
    this.emit('shutdown');
  }
}