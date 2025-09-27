import { SessionService } from './sessions.js';
import type { DiscussionEnforcer } from './discussion-enforcer.js';

/**
 * Configuration options for the ContextCompactor
 */
export interface ContextCompactorConfig {
  /** Maximum tokens allowed before compaction is triggered */
  maxTokens: number;
  /** Threshold at which compaction is triggered (percentage of maxTokens) */
  compactionThreshold: number;
  /** Minimum tokens to retain after compaction */
  minRetainedTokens: number;
  /** Strategy for selecting messages to compact */
  compactionStrategy: 'fifo' | 'lru' | 'importance';
  /** Whether to preserve system messages */
  preserveSystemMessages: boolean;
  /** Whether to preserve the first user message (task context) */
  preserveTaskContext: boolean;
}

/**
 * Represents a message in the context
 */
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Represents a session with messages
 */
export interface Session {
  id: string;
  messages: Message[];
  metadata?: Record<string, any>;
}

/**
 * Represents compacted context that can be restored
 */
export interface CCCompactedContext {
  /** Session ID this context belongs to */
  sessionId: string;
  /** Preserved essential messages */
  preservedMessages: Message[];
  /** Compacted summary of removed messages */
  contextSummary: string;
  /** Metadata about the compaction */
  metadata: {
    originalTokenCount: number;
    compactedTokenCount: number;
    compactionTimestamp: Date;
    strategyUsed: string;
  };
}

/**
 * Context compaction system for cc-sessions
 * Automatically compacts context when approaching token limits while preserving task context
 */
export class ContextCompactor {
  private sessionService: SessionService;
  private discussionEnforcer: DiscussionEnforcer | null;
  private config: ContextCompactorConfig;
  private compactedContexts: Map<string, CCCompactedContext>;
  private sessionCache: Map<string, Session>;

  constructor(
    sessionService: SessionService,
    discussionEnforcer?: DiscussionEnforcer,
    config?: Partial<ContextCompactorConfig>
  ) {
    this.sessionService = sessionService;
    this.discussionEnforcer = discussionEnforcer || null;
    this.compactedContexts = new Map();
    this.sessionCache = new Map();

    // Default configuration based on Claude Code context limits
    this.config = {
      maxTokens: 8000,
      compactionThreshold: 0.8,
      minRetainedTokens: 2000,
      compactionStrategy: 'importance',
      preserveSystemMessages: true,
      preserveTaskContext: true,
      ...config
    };
  }

  /**
   * Checks if a session needs compaction based on current token count
   */
  needsCompaction(sessionId: string): boolean {
    try {
      const session = this.getSession(sessionId);
      if (!session) {
        console.warn(`Session ${sessionId} not found for compaction check`);
        return false;
      }

      const currentTokens = this.estimateTokenCount(session.messages);
      const thresholdTokens = this.config.maxTokens * this.config.compactionThreshold;

      return currentTokens >= thresholdTokens;
    } catch (error) {
      console.error('Error checking compaction need:', error);
      return false;
    }
  }

  /**
   * Automatically compacts context when approaching limits
   */
  async compactContext(sessionId: string): Promise<CCCompactedContext | null> {
    try {
      if (!this.needsCompaction(sessionId)) {
        return null;
      }

      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Preserve essential context
      const preservedMessages = this.preserveEssentialContext(session.messages);
      
      // Compact remaining messages based on strategy
      const { compactedMessages, summary } = await this.compactMessages(
        session.messages,
        preservedMessages
      );

      // Update session with compacted context
      const updatedMessages = [...preservedMessages, ...compactedMessages];
      const updatedSession: Session = {
        ...session,
        messages: updatedMessages
      };
      
      this.updateSession(sessionId, updatedSession);

      // Create and store compacted context record
      const compactedContext: CCCompactedContext = {
        sessionId,
        preservedMessages,
        contextSummary: summary,
        metadata: {
          originalTokenCount: this.estimateTokenCount(session.messages),
          compactedTokenCount: this.estimateTokenCount(updatedMessages),
          compactionTimestamp: new Date(),
          strategyUsed: this.config.compactionStrategy
        }
      };

      this.compactedContexts.set(sessionId, compactedContext);
      
      console.log(`Context compacted for session ${sessionId}. Tokens: ${compactedContext.metadata.originalTokenCount} → ${compactedContext.metadata.compactedTokenCount}`);
      
      return compactedContext;
    } catch (error) {
      console.error('Error compacting context:', error);
      throw new Error(`Failed to compact context for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Restores context from a previous compaction
   */
  restoreContext(sessionId: string): boolean {
    try {
      const compactedContext = this.compactedContexts.get(sessionId);
      if (!compactedContext) {
        console.warn(`No compacted context found for session ${sessionId}`);
        return false;
      }

      const session = this.getSession(sessionId);
      if (!session) {
        console.warn(`Session ${sessionId} not found for context restoration`);
        return false;
      }

      // Restore preserved messages and add summary as context
      const restoredMessages: Message[] = [
        ...compactedContext.preservedMessages,
        {
          role: 'system',
          content: `Previous context summary: ${compactedContext.contextSummary}`,
          timestamp: new Date()
        },
        ...session.messages.filter(m => 
          !compactedContext.preservedMessages.some(pm => pm.id === m.id)
        )
      ];

      const restoredSession: Session = {
        ...session,
        messages: restoredMessages
      };

      this.updateSession(sessionId, restoredSession);

      console.log(`Context restored for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error('Error restoring context:', error);
      return false;
    }
  }

  /**
   * Simple session management (in real implementation, this would use SessionService)
   */
  private getSession(sessionId: string): Session | null {
    return this.sessionCache.get(sessionId) || null;
  }

  /**
   * Update session in cache
   */
  private updateSession(sessionId: string, session: Session): void {
    this.sessionCache.set(sessionId, session);
  }

  /**
   * Add a session to the cache (for testing/demo)
   */
  public addSession(session: Session): void {
    this.sessionCache.set(session.id, session);
  }

  /**
   * Preserves essential context based on configuration
   */
  private preserveEssentialContext(messages: Message[]): Message[] {
    const preserved: Message[] = [];

    // Preserve system messages if configured
    if (this.config.preserveSystemMessages) {
      preserved.push(...messages.filter(m => m.role === 'system'));
    }

    // Preserve task context (first user message) if configured
    if (this.config.preserveTaskContext) {
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (firstUserMessage && !preserved.some(p => p.id === firstUserMessage.id)) {
        preserved.push(firstUserMessage);
      }
    }

    return preserved;
  }

  /**
   * Compacts messages based on the configured strategy
   */
  private async compactMessages(
    allMessages: Message[],
    preservedMessages: Message[]
  ): Promise<{ compactedMessages: Message[]; summary: string }> {
    // Filter out preserved messages
    const messagesToCompact = allMessages.filter(
      m => !preservedMessages.some(pm => pm.id === m.id)
    );

    let compactedMessages: Message[] = [];
    let summary = '';

    switch (this.config.compactionStrategy) {
      case 'fifo':
        compactedMessages = this.compactByFIFO(messagesToCompact);
        summary = await this.generateSummary(messagesToCompact.slice(0, messagesToCompact.length - compactedMessages.length));
        break;
      case 'lru':
        compactedMessages = this.compactByLRU(messagesToCompact);
        summary = await this.generateSummary(messagesToCompact.filter(m => !compactedMessages.some(c => c.id === m.id)));
        break;
      case 'importance':
        const result = await this.compactByImportance(messagesToCompact);
        compactedMessages = result.compactedMessages;
        summary = result.summary;
        break;
      default:
        throw new Error(`Unknown compaction strategy: ${this.config.compactionStrategy}`);
    }

    return { compactedMessages, summary };
  }

  /**
   * Compacts messages using First-In-First-Out strategy
   */
  private compactByFIFO(messages: Message[]): Message[] {
    const targetTokenCount = this.config.minRetainedTokens;
    let currentTokenCount = this.estimateTokenCount(messages);
    const compacted = [...messages];

    while (currentTokenCount > targetTokenCount && compacted.length > 0) {
      compacted.shift(); // Remove oldest message
      currentTokenCount = this.estimateTokenCount(compacted);
    }

    return compacted;
  }

  /**
   * Compacts messages using Least Recently Used strategy
   */
  private compactByLRU(messages: Message[]): Message[] {
    // Sort by timestamp (newest first) and keep most recent within limit
    const sortedMessages = [...messages].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const targetTokenCount = this.config.minRetainedTokens;
    let currentTokenCount = 0;
    const compacted: Message[] = [];

    for (const message of sortedMessages) {
      const messageTokens = this.estimateTokenCount([message]);
      if (currentTokenCount + messageTokens <= targetTokenCount) {
        compacted.push(message);
        currentTokenCount += messageTokens;
      }
    }

    // Sort back to chronological order
    return compacted.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Compacts messages based on importance (simplified version)
   */
  private async compactByImportance(messages: Message[]): Promise<{ 
    compactedMessages: Message[]; 
    summary: string 
  }> {
    try {
      // Simple importance scoring (in real implementation would use more sophisticated analysis)
      const importanceScores = messages.map((message) => {
        let score = 0;
        
        // System messages are important
        if (message.role === 'system') score += 10;
        
        // Recent messages are more important
        const age = Date.now() - new Date(message.timestamp).getTime();
        score += Math.max(0, 10 - (age / (1000 * 60 * 60))); // Decay over hours
        
        // Longer messages might be more important
        score += Math.min(5, message.content.length / 200);
        
        // Messages with code or technical terms are important
        if (message.content.match(/```|function|class|import|export/)) score += 5;
        
        return { message, score };
      });

      // Sort by importance (highest first)
      importanceScores.sort((a, b) => b.score - a.score);

      // Keep the most important messages within token limit
      const targetTokenCount = this.config.minRetainedTokens;
      const compacted: Message[] = [];
      let currentTokenCount = 0;

      for (const { message } of importanceScores) {
        const messageTokens = this.estimateTokenCount([message]);
        if (currentTokenCount + messageTokens <= targetTokenCount) {
          compacted.push(message);
          currentTokenCount += messageTokens;
        }
      }

      // Create a summary of removed context
      const removedMessages = messages.filter(
        m => !compacted.some(c => c.id === m.id)
      );

      const summary = await this.generateSummary(removedMessages);

      // Sort compacted messages back to chronological order
      compacted.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return { compactedMessages: compacted, summary };
    } catch (error) {
      console.error('Error in importance-based compaction:', error);
      // Fallback to FIFO if importance evaluation fails
      const compacted = this.compactByFIFO(messages);
      return { compactedMessages: compacted, summary: 'Context compacted due to system limitations' };
    }
  }

  /**
   * Generates a summary of messages
   */
  private async generateSummary(messages: Message[]): Promise<string> {
    try {
      const userMessages = messages.filter(m => m.role === 'user').length;
      const assistantMessages = messages.filter(m => m.role === 'assistant').length;
      const totalTokens = this.estimateTokenCount(messages);
      
      // Extract key topics from message content
      const allContent = messages.map(m => m.content).join(' ');
      const codeBlocks = allContent.match(/```[\s\S]*?```/g)?.length || 0;
      
      let summary = `Previous conversation included ${userMessages} user messages and ${assistantMessages} assistant responses (${totalTokens} tokens).`;
      
      if (codeBlocks > 0) {
        summary += ` Discussion included ${codeBlocks} code examples.`;
      }
      
      // Add key topics if available
      const topics = this.extractKeyTopics(allContent);
      if (topics.length > 0) {
        summary += ` Key topics: ${topics.slice(0, 3).join(', ')}.`;
      }
      
      return summary;
    } catch (error) {
      return 'Previous conversation context was compacted to save memory.';
    }
  }

  /**
   * Extract key topics from content (simple keyword extraction)
   */
  private extractKeyTopics(content: string): string[] {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Estimates token count for messages (simple approximation)
   */
  private estimateTokenCount(messages: Message[]): number {
    // Simple estimation: ~4 characters per token
    return messages.reduce((total, message) => {
      return total + Math.ceil(message.content.length / 4);
    }, 0);
  }

  /**
   * Updates the compactor configuration
   */
  updateConfig(newConfig: Partial<ContextCompactorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets the current configuration
   */
  getConfig(): ContextCompactorConfig {
    return { ...this.config };
  }

  /**
   * Gets compacted context information for a session
   */
  getCompactedContext(sessionId: string): CCCompactedContext | undefined {
    return this.compactedContexts.get(sessionId);
  }

  /**
   * Gets all sessions with compacted context
   */
  getAllCompactedContexts(): CCCompactedContext[] {
    return Array.from(this.compactedContexts.values());
  }

  /**
   * Clears compacted context for a session
   */
  clearCompactedContext(sessionId: string): boolean {
    return this.compactedContexts.delete(sessionId);
  }
}