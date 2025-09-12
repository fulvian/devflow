import { SessionService } from './sessions.js';
import { EventEmitter } from 'events';

/**
 * Configuration interface for discussion enforcement rules
 */
export interface DiscussionEnforcementConfig {
  /** List of tools that require approval before execution */
  blockedTools: string[];
  /** Phrases that indicate approval has been given */
  approvalPhrases: string[];
  /** Whether enforcement is enabled */
  enabled: boolean;
  /** Timeout for approval requests (in milliseconds) */
  approvalTimeoutMs: number;
}

/**
 * Represents an approval request
 */
export interface ApprovalRequest {
  id: string;
  toolName: string;
  reason: string;
  timestamp: Date;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

/**
 * Event types for the DiscussionEnforcer
 */
export type DiscussionEnforcerEvents = {
  'approval.requested': (request: ApprovalRequest) => void;
  'approval.granted': (request: ApprovalRequest) => void;
  'approval.denied': (request: ApprovalRequest) => void;
  'enforcement.violation': (toolName: string, reason: string) => void;
};

/**
 * Discussion Enforcer class that blocks implementation tools until approval is given
 * Implements a hook system that cannot be bypassed
 */
export class DiscussionEnforcer extends EventEmitter {
  private config: DiscussionEnforcementConfig;
  private approvalRequests: Map<string, ApprovalRequest>;
  private sessionService: SessionService;
  private isInitialized: boolean = false;

  constructor(
    sessionService: SessionService,
    config?: Partial<DiscussionEnforcementConfig>
  ) {
    super();
    this.sessionService = sessionService;
    
    // Default configuration matching cc-sessions patterns
    this.config = {
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
      enabled: true,
      approvalTimeoutMs: 300000 // 5 minutes
    };

    // Override with provided config
    if (config) {
      Object.assign(this.config, config);
    }

    this.approvalRequests = new Map();
    this.initializeHooks();
  }

  /**
   * Initialize the hook system that cannot be bypassed
   */
  private initializeHooks(): void {
    // Register with existing session service if available
    if (this.sessionService && typeof this.sessionService.registerPreExecutionHook === 'function') {
      this.sessionService.registerPreExecutionHook(
        'discussion-enforcement',
        this.enforcementHook.bind(this)
      );

      this.sessionService.registerPostMessageHook(
        'approval-detection', 
        this.approvalDetectionHook.bind(this)
      );
    }

    this.isInitialized = true;
  }

  /**
   * Hook that runs before tool execution to enforce discussion requirements
   */
  private async enforcementHook(toolName: string, args: any): Promise<boolean> {
    // If enforcement is disabled, allow execution
    if (!this.config.enabled) {
      return true;
    }

    // If tool is not in blocked list, allow execution
    if (!this.config.blockedTools.includes(toolName)) {
      return true;
    }

    // Check if there's an existing approved request for this tool
    const existingApprovedRequest = this.getApprovedRequestForTool(toolName);
    if (existingApprovedRequest) {
      // Mark as used and allow execution
      this.markRequestAsUsed(existingApprovedRequest.id);
      return true;
    }

    // Block execution and request approval
    const requestId = this.createApprovalRequest(toolName, args);
    this.emit('approval.requested', this.approvalRequests.get(requestId)!);
    
    // Wait for approval or timeout
    try {
      const approved = await this.waitForApproval(requestId);
      if (approved) {
        this.emit('approval.granted', this.approvalRequests.get(requestId)!);
        return true;
      } else {
        this.emit('approval.denied', this.approvalRequests.get(requestId)!);
        return false;
      }
    } catch (error) {
      this.emit('enforcement.violation', toolName, `Approval timeout: ${error}`);
      return false;
    }
  }

  /**
   * Hook that runs after message receipt to detect approval phrases
   */
  private approvalDetectionHook(message: string): void {
    if (!this.config.enabled) return;

    // Check if message contains approval phrases
    const approvalPhrase = this.config.approvalPhrases.find(phrase => 
      message.toLowerCase().includes(phrase.toLowerCase())
    );

    if (approvalPhrase) {
      // Find the most recent pending approval request
      const pendingRequest = this.getMostRecentPendingRequest();
      if (pendingRequest) {
        this.approveRequest(pendingRequest.id, 'User');
      }
    }
  }

  /**
   * Create a new approval request
   */
  private createApprovalRequest(toolName: string, args: any): string {
    const requestId = this.generateRequestId();
    const request: ApprovalRequest = {
      id: requestId,
      toolName,
      reason: this.extractReasonFromArgs(args),
      timestamp: new Date(),
      approved: false
    };

    this.approvalRequests.set(requestId, request);
    return requestId;
  }

  /**
   * Extract reason from tool arguments
   */
  private extractReasonFromArgs(args: any): string {
    if (typeof args === 'string') {
      return args.substring(0, 200);
    }
    
    if (args && typeof args === 'object') {
      if (args.reason) return args.reason;
      if (args.description) return args.description;
      if (args.purpose) return args.purpose;
      if (args.objective) return args.objective;
      if (args.file_path) return `Modify: ${args.file_path}`;
      return JSON.stringify(args).substring(0, 200);
    }
    
    return 'No reason provided';
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Wait for approval of a specific request
   */
  private waitForApproval(requestId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const request = this.approvalRequests.get(requestId);
      if (!request) {
        return reject(new Error('Approval request not found'));
      }

      // Set timeout for approval
      const timeout = setTimeout(() => {
        reject(new Error('Approval timeout exceeded'));
      }, this.config.approvalTimeoutMs);

      // Listen for approval events
      const approvalListener = (approvedRequest: ApprovalRequest) => {
        if (approvedRequest.id === requestId) {
          clearTimeout(timeout);
          this.off('approval.granted', approvalListener);
          this.off('approval.denied', denialListener);
          resolve(approvedRequest.approved);
        }
      };

      const denialListener = (deniedRequest: ApprovalRequest) => {
        if (deniedRequest.id === requestId) {
          clearTimeout(timeout);
          this.off('approval.granted', approvalListener);
          this.off('approval.denied', denialListener);
          resolve(false);
        }
      };

      this.on('approval.granted', approvalListener);
      this.on('approval.denied', denialListener);
    });
  }

  /**
   * Approve a specific request
   */
  public approveRequest(requestId: string, approvedBy: string): boolean {
    const request = this.approvalRequests.get(requestId);
    if (!request) {
      return false;
    }

    if (request.approved) {
      return false; // Already approved
    }

    request.approved = true;
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();

    return true;
  }

  /**
   * Get an approved request for a specific tool that hasn't been used yet
   */
  private getApprovedRequestForTool(toolName: string): ApprovalRequest | undefined {
    for (const request of this.approvalRequests.values()) {
      if (request.toolName === toolName && request.approved && !request.approvedAt) {
        return request;
      }
    }
    return undefined;
  }

  /**
   * Mark an approval request as used
   */
  private markRequestAsUsed(requestId: string): boolean {
    const request = this.approvalRequests.get(requestId);
    if (!request || !request.approved) {
      return false;
    }

    request.approvedAt = new Date(); // Mark as used
    return true;
  }

  /**
   * Get the most recent pending approval request
   */
  private getMostRecentPendingRequest(): ApprovalRequest | undefined {
    let mostRecent: ApprovalRequest | undefined;
    for (const request of this.approvalRequests.values()) {
      if (!request.approved && (!mostRecent || request.timestamp > mostRecent.timestamp)) {
        mostRecent = request;
      }
    }
    return mostRecent;
  }

  /**
   * Get all pending approval requests
   */
  public getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.approvalRequests.values())
      .filter(request => !request.approved);
  }

  /**
   * Check if enforcement is currently enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enable or disable enforcement
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<DiscussionEnforcementConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Clear all approval requests
   */
  public clearRequests(): void {
    this.approvalRequests.clear();
  }
}

// Type definitions for EventEmitter extension  
export declare interface DiscussionEnforcer {
  on<U extends keyof DiscussionEnforcerEvents>(
    event: U, listener: DiscussionEnforcerEvents[U]
  ): this;

  emit<U extends keyof DiscussionEnforcerEvents>(
    event: U, ...args: Parameters<DiscussionEnforcerEvents[U]>
  ): boolean;
}