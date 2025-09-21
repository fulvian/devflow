// proactive-context-engine.ts
import { EventEmitter } from 'events';
import { ToolCall } from './types/tool-types';
import { SessionState } from './types/session-types';
import { ContextData } from './types/context-types';
import { SemanticSearchClient } from './semantic-search-client';
import { StateBridgeManager } from './state-bridge-manager';
import { MCPClient } from './mcp-client';

/**
 * Configuration interface for the Proactive Context Injection Engine
 */
export interface ProactiveContextConfig {
  /** Time interval for periodic context refresh (in milliseconds) */
  refreshInterval: number;
  
  /** Maximum tokens allowed for context injection */
  maxContextTokens: number;
  
  /** Threshold for triggering context injection based on token usage */
  tokenUsageThreshold: number;
  
  /** Semantic similarity threshold for context relevance */
  similarityThreshold: number;
  
  /** Maximum number of context items to inject */
  maxContextItems: number;
  
  /** Enable/disable automatic context injection on session start */
  autoInjectOnSessionStart: boolean;
  
  /** Enable/disable tool usage triggers */
  enableToolTriggers: boolean;
  
  /** Enable/disable decision point detection */
  enableDecisionPointDetection: boolean;
  
  /** Enable/disable time-based refresh */
  enableTimeBasedRefresh: boolean;
  
  /** Enable/disable error recovery boost */
  enableErrorRecovery: boolean;
}

/**
 * Events emitted by the Proactive Context Engine
 */
export interface ProactiveContextEvents {
  'context-injected': (context: ContextData[], sessionId: string) => void;
  'context-refresh': (sessionId: string) => void;
  'error': (error: Error, sessionId: string) => void;
  'token-budget-exceeded': (sessionId: string) => void;
}

/**
 * Proactive Context Injection Engine
 * Automatically injects context into Claude Code sessions based on multiple triggers
 */
export class ProactiveContextEngine extends EventEmitter {
  private config: ProactiveContextConfig;
  private semanticSearch: SemanticSearchClient;
  private stateBridge: StateBridgeManager;
  private mcpClient: MCPClient;
  private activeSessions: Map<string, SessionState>;
  private refreshTimers: Map<string, NodeJS.Timeout>;
  private tokenUsage: Map<string, number>;

  constructor(
    config: ProactiveContextConfig,
    semanticSearch: SemanticSearchClient,
    stateBridge: StateBridgeManager,
    mcpClient: MCPClient
  ) {
    super();
    this.config = config;
    this.semanticSearch = semanticSearch;
    this.stateBridge = stateBridge;
    this.mcpClient = mcpClient;
    this.activeSessions = new Map();
    this.refreshTimers = new Map();
    this.tokenUsage = new Map();
  }

  /**
   * Initialize the engine for a new session
   * @param sessionId Unique identifier for the session
   * @param initialState Initial session state
   */
  public async initializeSession(sessionId: string, initialState: SessionState): Promise<void> {
    this.activeSessions.set(sessionId, initialState);
    this.tokenUsage.set(sessionId, 0);

    // Set up periodic refresh if enabled
    if (this.config.enableTimeBasedRefresh) {
      this.scheduleRefresh(sessionId);
    }

    // Auto-inject context on session start if enabled
    if (this.config.autoInjectOnSessionStart) {
      try {
        await this.injectContext(sessionId);
      } catch (error) {
        this.handleError(error, sessionId);
      }
    }
  }

  /**
   * Handle tool usage events as triggers for context injection
   * @param sessionId Session identifier
   * @param toolCall Tool call information
   */
  public async handleToolUsage(sessionId: string, toolCall: ToolCall): Promise<void> {
    if (!this.config.enableToolTriggers) return;

    // Check if this tool call should trigger context injection
    if (this.shouldTriggerOnTool(toolCall)) {
      try {
        await this.injectContext(sessionId);
      } catch (error) {
        this.handleError(error, sessionId);
      }
    }
  }

  /**
   * Handle decision point detection
   * @param sessionId Session identifier
   * @param decisionPoint Information about the decision point
   */
  public async handleDecisionPoint(sessionId: string, decisionPoint: any): Promise<void> {
    if (!this.config.enableDecisionPointDetection) return;

    try {
      await this.injectContext(sessionId);
    } catch (error) {
      this.handleError(error, sessionId);
    }
  }

  /**
   * Handle error recovery by injecting additional context
   * @param sessionId Session identifier
   * @param error Error information
   */
  public async handleErrorRecovery(sessionId: string, error: Error): Promise<void> {
    if (!this.config.enableErrorRecovery) return;

    try {
      // Boost context with error-specific information
      const errorContext = await this.generateErrorContext(error);
      await this.injectContext(sessionId, errorContext);
    } catch (recoveryError) {
      this.handleError(recoveryError, sessionId);
    }
  }

  /**
   * Manually trigger context injection
   * @param sessionId Session identifier
   * @param additionalContext Optional additional context to inject
   */
  public async injectContext(sessionId: string, additionalContext?: ContextData[]): Promise<void> {
    const sessionState = this.activeSessions.get(sessionId);
    if (!sessionState) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      // Check token budget
      if (this.isTokenBudgetExceeded(sessionId)) {
        this.emit('token-budget-exceeded', sessionId);
        return;
      }

      // Gather context from multiple sources
      const semanticContext = await this.getSemanticContext(sessionState);
      const stateContext = await this.getStateContext(sessionId);
      const toolContext = await this.getToolContext(sessionId);
      
      // Combine all context sources
      let combinedContext: ContextData[] = [
        ...semanticContext,
        ...stateContext,
        ...toolContext,
        ...(additionalContext || [])
      ];

      // Filter and rank context by relevance
      combinedContext = await this.rankAndFilterContext(combinedContext, sessionState);

      // Inject context into the session
      await this.deliverContext(sessionId, combinedContext);

      // Update token usage
      const tokensUsed = this.calculateTokens(combinedContext);
      this.updateTokenUsage(sessionId, tokensUsed);

      // Emit event
      this.emit('context-injected', combinedContext, sessionId);
    } catch (error) {
      this.handleError(error, sessionId);
      throw error;
    }
  }

  /**
   * Terminate a session and clean up resources
   * @param sessionId Session identifier
   */
  public terminateSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.tokenUsage.delete(sessionId);
    
    const timer = this.refreshTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.refreshTimers.delete(sessionId);
    }
  }

  /**
   * Update session state
   * @param sessionId Session identifier
   * @param state New session state
   */
  public updateSessionState(sessionId: string, state: SessionState): void {
    this.activeSessions.set(sessionId, state);
  }

  /**
   * Check if token budget is exceeded for a session
   * @param sessionId Session identifier
   * @returns True if token budget is exceeded
   */
  private isTokenBudgetExceeded(sessionId: string): boolean {
    const usage = this.tokenUsage.get(sessionId) || 0;
    return usage >= this.config.maxContextTokens;
  }

  /**
   * Schedule periodic context refresh
   * @param sessionId Session identifier
   */
  private scheduleRefresh(sessionId: string): void {
    const timer = setTimeout(async () => {
      try {
        await this.injectContext(sessionId);
        this.emit('context-refresh', sessionId);
      } catch (error) {
        this.handleError(error, sessionId);
      } finally {
        // Schedule next refresh
        this.scheduleRefresh(sessionId);
      }
    }, this.config.refreshInterval);

    this.refreshTimers.set(sessionId, timer);
  }

  /**
   * Determine if a tool call should trigger context injection
   * @param toolCall Tool call information
   * @returns True if context injection should be triggered
   */
  private shouldTriggerOnTool(toolCall: ToolCall): boolean {
    // Implement logic to determine if this tool call warrants context injection
    // This could be based on tool type, parameters, or other criteria
    return true; // Simplified for example
  }

  /**
   * Generate error-specific context for recovery
   * @param error Error information
   * @returns Error-specific context data
   */
  private async generateErrorContext(error: Error): Promise<ContextData[]> {
    // Analyze error and generate relevant context for recovery
    return [{
      id: 'error-context',
      content: `Error occurred: ${error.message}. Consider alternative approaches.`,
      relevance: 0.9,
      type: 'error-recovery'
    }];
  }

  /**
   * Retrieve semantic context based on session state
   * @param sessionState Current session state
   * @returns Semantic context data
   */
  private async getSemanticContext(sessionState: SessionState): Promise<ContextData[]> {
    try {
      const query = this.generateSemanticQuery(sessionState);
      const results = await this.semanticSearch.search(query, {
        limit: this.config.maxContextItems,
        threshold: this.config.similarityThreshold
      });
      
      return results.map(result => ({
        id: result.id,
        content: result.content,
        relevance: result.score,
        type: 'semantic'
      }));
    } catch (error) {
      this.handleError(error, 'semantic-search');
      return [];
    }
  }

  /**
   * Generate semantic search query from session state
   * @param sessionState Current session state
   * @returns Query string for semantic search
   */
  private generateSemanticQuery(sessionState: SessionState): string {
    // Generate a query based on current session context
    return sessionState.currentTask || sessionState.lastUserMessage || 'general context';
  }

  /**
   * Retrieve context from session state
   * @param sessionId Session identifier
   * @returns State-based context data
   */
  private async getStateContext(sessionId: string): Promise<ContextData[]> {
    try {
      const state = await this.stateBridge.getSessionState(sessionId);
      return [{
        id: 'session-state',
        content: JSON.stringify(state),
        relevance: 0.8,
        type: 'state'
      }];
    } catch (error) {
      this.handleError(error, sessionId);
      return [];
    }
  }

  /**
   * Retrieve context from tool usage history
   * @param sessionId Session identifier
   * @returns Tool-based context data
   */
  private async getToolContext(sessionId: string): Promise<ContextData[]> {
    try {
      const toolHistory = await this.mcpClient.getToolUsageHistory(sessionId);
      return toolHistory.map(tool => ({
        id: `tool-${tool.id}`,
        content: `Previously used tool: ${tool.name} with parameters ${JSON.stringify(tool.parameters)}`,
        relevance: 0.7,
        type: 'tool-history'
      }));
    } catch (error) {
      this.handleError(error, sessionId);
      return [];
    }
  }

  /**
   * Rank and filter context items by relevance
   * @param context Context data to rank
   * @param sessionState Current session state
   * @returns Ranked and filtered context
   */
  private async rankAndFilterContext(context: ContextData[], sessionState: SessionState): Promise<ContextData[]> {
    // Sort by relevance score
    const sortedContext = context.sort((a, b) => b.relevance - a.relevance);
    
    // Limit to max items
    return sortedContext.slice(0, this.config.maxContextItems);
  }

  /**
   * Deliver context to the session in real-time
   * @param sessionId Session identifier
   * @param context Context data to deliver
   */
  private async deliverContext(sessionId: string, context: ContextData[]): Promise<void> {
    // Deliver context through the MCP client
    await this.mcpClient.injectContext(sessionId, context);
  }

  /**
   * Calculate token usage for context data
   * @param context Context data
   * @returns Estimated token count
   */
  private calculateTokens(context: ContextData[]): number {
    // Simplified token calculation - in practice, use a proper tokenizer
    return context.reduce((total, item) => {
      return total + Math.ceil(item.content.length / 4); // Rough estimation
    }, 0);
  }

  /**
   * Update token usage for a session
   * @param sessionId Session identifier
   * @param tokens Number of tokens used
   */
  private updateTokenUsage(sessionId: string, tokens: number): void {
    const currentUsage = this.tokenUsage.get(sessionId) || 0;
    this.tokenUsage.set(sessionId, currentUsage + tokens);
  }

  /**
   * Handle errors and emit error events
   * @param error Error that occurred
   * @param sessionId Session identifier
   */
  private handleError(error: any, sessionId: string): void {
    this.emit('error', error instanceof Error ? error : new Error(String(error)), sessionId);
  }

  /**
   * Type guard for emitted events
   */
  public emit<K extends keyof ProactiveContextEvents>(
    event: K,
    ...args: Parameters<ProactiveContextEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Type-safe event listener registration
   */
  public on<K extends keyof ProactiveContextEvents>(
    event: K,
    listener: ProactiveContextEvents[K]
  ): this {
    return super.on(event, listener);
  }
}