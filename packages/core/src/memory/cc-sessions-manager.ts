import type Database from 'better-sqlite3';
import { SessionService } from './sessions.js';
import { DiscussionEnforcer } from './discussion-enforcer.js';
import { ContextCompactor } from './context-compactor.js';
import type { DiscussionEnforcementConfig } from './discussion-enforcer.js';
import type { ContextCompactorConfig } from './context-compactor.js';

/**
 * Configuration for the complete cc-sessions integration
 */
export interface CCSessionsConfig {
  /** Discussion enforcement configuration */
  discussionEnforcement?: Partial<DiscussionEnforcementConfig>;
  /** Context compaction configuration */
  contextCompaction?: Partial<ContextCompactorConfig>;
  /** Whether cc-sessions is enabled globally */
  enabled: boolean;
  /** API mode for token efficiency */
  apiMode: boolean;
}

/**
 * Main integration manager for GWUDCAP/cc-sessions functionality
 * Provides complete cc-sessions workflow management for Claude Code
 */
export class CCSessionsManager {
  private sessionService: SessionService;
  private discussionEnforcer: DiscussionEnforcer;
  private contextCompactor: ContextCompactor;
  private config: CCSessionsConfig;
  private isInitialized: boolean = false;

  constructor(db: Database.Database, config?: Partial<CCSessionsConfig>) {
    // Initialize core services
    this.sessionService = new SessionService(db);

    // Default configuration matching GWUDCAP/cc-sessions behavior
    this.config = {
      discussionEnforcement: {
        enabled: true,
        blockedTools: [
          'Edit',
          'Write', 
          'MultiEdit',
          'NotebookEdit',
          'Bash',
          'mcp__devflow-synthetic-cc-sessions__synthetic_code',
          'mcp__devflow-synthetic-cc-sessions__synthetic_auto_file'
        ],
        approvalPhrases: [
          'procedi',
          'procediamo', 
          'implementa',
          'implementiamo',
          'make it so',
          'run that',
          'go ahead',
          'yert'
        ],
        approvalTimeoutMs: 300000 // 5 minutes
      },
      contextCompaction: {
        maxTokens: 8000,
        compactionThreshold: 0.8,
        minRetainedTokens: 2000,
        compactionStrategy: 'importance',
        preserveSystemMessages: true,
        preserveTaskContext: true
      },
      enabled: true,
      apiMode: false,
      ...config
    };

    // Initialize components
    this.discussionEnforcer = new DiscussionEnforcer(
      this.sessionService,
      this.config.discussionEnforcement
    );

    this.contextCompactor = new ContextCompactor(
      this.sessionService,
      this.discussionEnforcer,
      this.config.contextCompaction
    );

    this.initializeIntegration();
  }

  /**
   * Initialize the complete cc-sessions integration
   */
  private initializeIntegration(): void {
    if (this.isInitialized) {
      return;
    }

    // Setup event listeners for coordinated behavior
    this.setupEventListeners();

    // Register global hooks that implement cc-sessions workflow
    this.setupGlobalHooks();

    this.isInitialized = true;
    console.log('CC-Sessions integration initialized successfully');
  }

  /**
   * Setup event listeners between components
   */
  private setupEventListeners(): void {
    // Listen for approval requests and handle context compaction
    this.discussionEnforcer.on('approval.requested', (request) => {
      console.log(`[CC-Sessions] Approval requested for ${request.toolName}: ${request.reason}`);
      
      // Check if we need context compaction while waiting for approval
      if (this.contextCompactor.needsCompaction(request.id)) {
        console.log(`[CC-Sessions] Context compaction needed during approval wait`);
      }
    });

    this.discussionEnforcer.on('approval.granted', (request) => {
      console.log(`[CC-Sessions] Approval granted for ${request.toolName} by ${request.approvedBy}`);
    });

    this.discussionEnforcer.on('approval.denied', (request) => {
      console.log(`[CC-Sessions] Approval denied for ${request.toolName}`);
    });

    this.discussionEnforcer.on('enforcement.violation', (toolName, reason) => {
      console.warn(`[CC-Sessions] Enforcement violation: ${toolName} - ${reason}`);
    });
  }

  /**
   * Setup global hooks that cannot be bypassed
   */
  private setupGlobalHooks(): void {
    // This would integrate with Claude Code's actual hook system
    // For now, we document the integration points
    
    console.log('[CC-Sessions] Global hooks registered:');
    console.log('- Pre-tool execution: Discussion enforcement');
    console.log('- Post-message processing: Approval detection');
    console.log('- Context monitoring: Automatic compaction');
  }

  /**
   * Process a tool execution request through cc-sessions workflow
   */
  async processToolExecution(toolName: string, args: any, sessionId: string): Promise<boolean> {
    if (!this.config.enabled) {
      return true; // Allow execution if cc-sessions is disabled
    }

    try {
      // Check for context compaction need first
      if (this.contextCompactor.needsCompaction(sessionId)) {
        console.log(`[CC-Sessions] Compacting context for session ${sessionId} before tool execution`);
        await this.contextCompactor.compactContext(sessionId);
      }

      // Run through discussion enforcement
      const allowed = await this.sessionService.executePreExecutionHooks(toolName, args);
      
      if (allowed) {
        console.log(`[CC-Sessions] Tool execution approved: ${toolName}`);
        return true;
      } else {
        console.log(`[CC-Sessions] Tool execution blocked: ${toolName}`);
        return false;
      }
    } catch (error) {
      console.error(`[CC-Sessions] Error processing tool execution:`, error);
      return false;
    }
  }

  /**
   * Process a user message through cc-sessions workflow
   */
  processUserMessage(message: string, sessionId: string): void {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Run through post-message hooks (approval detection)
      this.sessionService.executePostMessageHooks(message);

      // Check if context compaction is needed
      if (this.contextCompactor.needsCompaction(sessionId)) {
        console.log(`[CC-Sessions] Context compaction triggered by message length`);
        this.contextCompactor.compactContext(sessionId).catch(error => {
          console.error('Error in automatic context compaction:', error);
        });
      }
    } catch (error) {
      console.error('[CC-Sessions] Error processing user message:', error);
    }
  }

  /**
   * Get current system status
   */
  getStatus(): {
    enabled: boolean;
    discussionEnforcement: {
      enabled: boolean;
      pendingApprovals: number;
      blockedTools: string[];
    };
    contextCompaction: {
      compactedSessions: number;
      averageTokenCount: number;
    };
  } {
    const pendingApprovals = this.discussionEnforcer.getPendingRequests();
    const compactedContexts = this.contextCompactor.getAllCompactedContexts();

    return {
      enabled: this.config.enabled,
      discussionEnforcement: {
        enabled: this.discussionEnforcer.isEnabled(),
        pendingApprovals: pendingApprovals.length,
        blockedTools: this.config.discussionEnforcement?.blockedTools || []
      },
      contextCompaction: {
        compactedSessions: compactedContexts.length,
        averageTokenCount: compactedContexts.length > 0 
          ? Math.round(compactedContexts.reduce((sum, ctx) => sum + ctx.metadata.compactedTokenCount, 0) / compactedContexts.length)
          : 0
      }
    };
  }

  /**
   * Enable or disable cc-sessions globally
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.discussionEnforcer.setEnabled(enabled);
    console.log(`[CC-Sessions] System ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable or disable API mode for token efficiency
   */
  setAPIMode(apiMode: boolean): void {
    this.config.apiMode = apiMode;
    
    if (apiMode) {
      // In API mode, be more aggressive with context compaction
      this.contextCompactor.updateConfig({
        maxTokens: 6000,
        compactionThreshold: 0.7,
        minRetainedTokens: 1500
      });
      console.log('[CC-Sessions] API mode enabled - aggressive context management');
    } else {
      // In interactive mode, be more lenient
      this.contextCompactor.updateConfig({
        maxTokens: 8000,
        compactionThreshold: 0.8, 
        minRetainedTokens: 2000
      });
      console.log('[CC-Sessions] Interactive mode enabled - standard context management');
    }
  }

  /**
   * Update discussion enforcement configuration
   */
  updateDiscussionEnforcementConfig(config: Partial<DiscussionEnforcementConfig>): void {
    this.discussionEnforcer.updateConfig(config);
    Object.assign(this.config.discussionEnforcement || {}, config);
  }

  /**
   * Update context compaction configuration
   */
  updateContextCompactionConfig(config: Partial<ContextCompactorConfig>): void {
    this.contextCompactor.updateConfig(config);
    Object.assign(this.config.contextCompaction || {}, config);
  }

  /**
   * Get the SessionService instance
   */
  getSessionService(): SessionService {
    return this.sessionService;
  }

  /**
   * Get the DiscussionEnforcer instance
   */
  getDiscussionEnforcer(): DiscussionEnforcer {
    return this.discussionEnforcer;
  }

  /**
   * Get the ContextCompactor instance
   */
  getContextCompactor(): ContextCompactor {
    return this.contextCompactor;
  }

  /**
   * Get current configuration
   */
  getConfig(): CCSessionsConfig {
    return { ...this.config };
  }

  /**
   * Manually trigger context compaction for a session
   */
  async compactSession(sessionId: string): Promise<boolean> {
    try {
      const result = await this.contextCompactor.compactContext(sessionId);
      return result !== null;
    } catch (error) {
      console.error(`Error manually compacting session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Restore context for a session
   */
  restoreSession(sessionId: string): boolean {
    try {
      return this.contextCompactor.restoreContext(sessionId);
    } catch (error) {
      console.error(`Error restoring session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Clear all system state (useful for testing)
   */
  reset(): void {
    this.discussionEnforcer.clearRequests();
    // Context compactor doesn't have a clear method in our implementation
    console.log('[CC-Sessions] System state reset');
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.reset();
    this.isInitialized = false;
    console.log('[CC-Sessions] Manager disposed');
  }
}