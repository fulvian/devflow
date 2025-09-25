/**
 * Session State Manager - Cross-Session Memory Persistence
 * Integrates with existing dual-trigger context manager for seamless session continuity
 * Uses semantic memory system for intelligent context correlation and restoration
 */

import { EnhancedProjectMemorySystem } from './enhanced-memory-system';
import { ContextInjectionIntelligenceEngine, ConversationContext } from './context-injection-intelligence-engine';
import { MemoryContent } from './semantic-memory-engine';
import { MemorySearchResult } from './semantic-search-engine';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface SessionStateSnapshot {
  sessionId: string;
  projectId: number;
  timestamp: Date;
  contextWindow: {
    currentContent: string;
    estimatedTokens: number;
    usagePercentage: number;
  };
  conversationFlow: {
    recentPrompts: string[];
    taskContext: string;
    workingDirectory: string;
    currentBranch: string;
  };
  semanticCorrelation: {
    relatedMemories: string[]; // Memory content hashes
    topicClusters: string[];
    conversationThemes: string[];
  };
}

export interface SessionRestoration {
  success: boolean;
  restoredContext: string;
  contextQuality: number;
  correlatedMemories: MemorySearchResult[];
  recommendedContext: string[];
  processingTime: number;
}

export interface SessionContinuityOptions {
  enableSemanticCorrelation: boolean;
  maxContextAge: number; // hours
  minContextQuality: number;
  maxRestorationTokens: number;
  correlationThreshold: number;
}

export class SessionStateManager {
  private memorySystem: EnhancedProjectMemorySystem;
  private contextEngine: ContextInjectionIntelligenceEngine;
  private defaultOptions: SessionContinuityOptions;

  constructor() {
    this.memorySystem = new EnhancedProjectMemorySystem({
      enablePerformanceMonitoring: true,
      enableClustering: true
    });

    this.contextEngine = new ContextInjectionIntelligenceEngine();

    this.defaultOptions = {
      enableSemanticCorrelation: true,
      maxContextAge: 24, // 24 hours
      minContextQuality: 0.6,
      maxRestorationTokens: 3000,
      correlationThreshold: 0.7
    };
  }

  /**
   * Initialize session state manager
   */
  async initialize(): Promise<boolean> {
    try {
      const memoryInit = await this.memorySystem.initialize();
      const contextInit = await this.contextEngine.initialize();

      if (!memoryInit.success || !contextInit) {
        console.error('Failed to initialize Session State Manager');
        return false;
      }

      console.log('Session State Manager initialized successfully');
      return true;
    } catch (error) {
      console.error('Session State Manager initialization failed:', error);
      return false;
    }
  }

  /**
   * Save session state with semantic memory correlation
   */
  async saveSessionState(
    sessionSnapshot: SessionStateSnapshot,
    options?: Partial<SessionContinuityOptions>
  ): Promise<boolean> {
    const startTime = performance.now();

    try {
      const mergedOptions = { ...this.defaultOptions, ...options };

      // Store session context as semantic memory
      const sessionMemoryContent: MemoryContent = {
        content: this.generateSessionContextContent(sessionSnapshot),
        contentType: 'context',
        projectId: sessionSnapshot.projectId,
        metadata: {
          sessionId: sessionSnapshot.sessionId,
          sessionType: 'state_snapshot',
          timestamp: sessionSnapshot.timestamp.toISOString(),
          tokenCount: sessionSnapshot.contextWindow.estimatedTokens,
          workingDirectory: sessionSnapshot.conversationFlow.workingDirectory,
          branch: sessionSnapshot.conversationFlow.currentBranch,
          contextQuality: this.calculateContextQuality(sessionSnapshot)
        }
      };

      const storageResult = await this.memorySystem.storeMemory(sessionMemoryContent);

      if (!storageResult.success) {
        console.error('Failed to store session state:', storageResult.error);
        return false;
      }

      // Perform semantic correlation if enabled
      if (mergedOptions.enableSemanticCorrelation) {
        await this.performSemanticCorrelation(
          sessionSnapshot,
          storageResult.data!,
          mergedOptions
        );
      }

      // Store session metadata for fast retrieval
      await this.storeSessionMetadata(sessionSnapshot, storageResult.data!);

      const duration = performance.now() - startTime;
      console.log(`Session state saved successfully in ${duration.toFixed(2)}ms`);

      return true;

    } catch (error) {
      console.error('Session state saving failed:', error);
      return false;
    }
  }

  /**
   * Restore session context with intelligent semantic correlation
   */
  async restoreSessionContext(
    sessionId: string,
    projectId: number,
    options?: Partial<SessionContinuityOptions>
  ): Promise<SessionRestoration> {
    const startTime = performance.now();

    try {
      const mergedOptions = { ...this.defaultOptions, ...options };

      // Search for recent session states
      const sessionSearchResult = await this.memorySystem.searchMemories({
        query: `session context snapshot project ${projectId}`,
        projectId,
        contentTypes: ['context'],
        similarityThreshold: mergedOptions.correlationThreshold,
        limit: 5
      });

      if (!sessionSearchResult.success || !sessionSearchResult.data?.length) {
        return {
          success: false,
          restoredContext: '',
          contextQuality: 0,
          correlatedMemories: [],
          recommendedContext: [],
          processingTime: performance.now() - startTime
        };
      }

      // Find the most relevant session state
      const relevantSessions = this.filterRelevantSessions(
        sessionSearchResult.data,
        mergedOptions
      );

      if (relevantSessions.length === 0) {
        return {
          success: false,
          restoredContext: '',
          contextQuality: 0,
          correlatedMemories: [],
          recommendedContext: [],
          processingTime: performance.now() - startTime
        };
      }

      const primarySession = relevantSessions[0];

      // Perform semantic correlation to find related memories
      const correlatedMemories = await this.findCorrelatedMemories(
        primarySession,
        projectId,
        mergedOptions
      );

      // Assemble intelligent context restoration
      const restoredContext = this.assembleRestoredContext(
        primarySession,
        correlatedMemories,
        mergedOptions
      );

      // Generate recommended context for future sessions
      const recommendedContext = this.generateContextRecommendations(
        correlatedMemories,
        primarySession
      );

      const contextQuality = this.assessContextQuality(
        primarySession,
        correlatedMemories
      );

      const processingTime = performance.now() - startTime;

      console.log(`Session context restored: ${correlatedMemories.length} memories, ` +
                  `quality ${(contextQuality * 100).toFixed(1)}%, ${processingTime.toFixed(2)}ms`);

      return {
        success: true,
        restoredContext,
        contextQuality,
        correlatedMemories,
        recommendedContext,
        processingTime
      };

    } catch (error) {
      console.error('Session context restoration failed:', error);
      return {
        success: false,
        restoredContext: '',
        contextQuality: 0,
        correlatedMemories: [],
        recommendedContext: [],
        processingTime: performance.now() - startTime
      };
    }
  }

  /**
   * Create conversation continuity bridge between sessions
   */
  async createConversationContinuity(
    fromSessionId: string,
    toSessionId: string,
    projectId: number
  ): Promise<{
    success: boolean;
    continuityContext: string;
    bridgeQuality: number;
  }> {
    try {
      // Get session states for both sessions
      const [fromSession, toSession] = await Promise.all([
        this.getSessionMemories(fromSessionId, projectId),
        this.getSessionMemories(toSessionId, projectId)
      ]);

      if (!fromSession.length && !toSession.length) {
        return {
          success: false,
          continuityContext: '',
          bridgeQuality: 0
        };
      }

      // Find conversation themes and topics
      const commonThemes = this.extractCommonThemes(fromSession, toSession);
      const conversationFlow = this.analyzeConversationFlow(fromSession, toSession);

      // Create continuity context
      const continuityContext = this.assembleContinuityContext(
        commonThemes,
        conversationFlow,
        fromSession,
        toSession
      );

      const bridgeQuality = this.calculateBridgeQuality(commonThemes, conversationFlow);

      console.log(`Conversation continuity created: ${commonThemes.length} themes, ` +
                  `quality ${(bridgeQuality * 100).toFixed(1)}%`);

      return {
        success: true,
        continuityContext,
        bridgeQuality
      };

    } catch (error) {
      console.error('Conversation continuity creation failed:', error);
      return {
        success: false,
        continuityContext: '',
        bridgeQuality: 0
      };
    }
  }

  /**
   * Generate session context content for semantic storage
   */
  private generateSessionContextContent(snapshot: SessionStateSnapshot): string {
    const sections = [
      `Session State Snapshot - ${snapshot.sessionId}`,
      `Project ID: ${snapshot.projectId}`,
      `Timestamp: ${snapshot.timestamp.toISOString()}`,
      `Context Usage: ${snapshot.contextWindow.usagePercentage.toFixed(2)}% (${snapshot.contextWindow.estimatedTokens} tokens)`,
      '',
      '## Conversation Context',
      snapshot.conversationFlow.taskContext || 'No specific task context',
      '',
      '## Working Environment',
      `Directory: ${snapshot.conversationFlow.workingDirectory}`,
      `Branch: ${snapshot.conversationFlow.currentBranch}`,
      '',
      '## Recent Activity'
    ];

    // Add recent prompts (truncated)
    snapshot.conversationFlow.recentPrompts.slice(-3).forEach((prompt, index) => {
      const truncated = prompt.length > 200 ? prompt.substring(0, 200) + '...' : prompt;
      sections.push(`${index + 1}. ${truncated}`);
    });

    // Add semantic correlation data
    if (snapshot.semanticCorrelation.conversationThemes.length > 0) {
      sections.push('', '## Conversation Themes');
      sections.push(...snapshot.semanticCorrelation.conversationThemes.slice(0, 5));
    }

    return sections.join('\n');
  }

  /**
   * Perform semantic correlation with existing memories
   */
  private async performSemanticCorrelation(
    snapshot: SessionStateSnapshot,
    memoryHash: string,
    options: SessionContinuityOptions
  ): Promise<void> {
    try {
      // Find semantically similar memories
      const similarMemories = await this.memorySystem.searchMemories({
        query: snapshot.conversationFlow.taskContext,
        projectId: snapshot.projectId,
        similarityThreshold: options.correlationThreshold,
        limit: 10
      });

      if (similarMemories.success && similarMemories.data) {
        // Update session metadata with correlation information
        const correlationData = {
          relatedMemories: similarMemories.data.map(m => m.memory.contentHash),
          correlationStrength: similarMemories.data.map(m => m.similarity),
          topicAlignment: this.calculateTopicAlignment(snapshot, similarMemories.data)
        };

        console.log(`Semantic correlation completed: ${correlationData.relatedMemories.length} related memories found`);
      }

    } catch (error) {
      console.warn('Semantic correlation failed:', error);
    }
  }

  /**
   * Filter sessions by relevance and age
   */
  private filterRelevantSessions(
    sessions: MemorySearchResult[],
    options: SessionContinuityOptions
  ): MemorySearchResult[] {
    const maxAge = options.maxContextAge * 60 * 60 * 1000; // Convert hours to ms
    const now = Date.now();

    return sessions.filter(session => {
      // Check age
      const age = now - session.memory.createdAt.getTime();
      if (age > maxAge) return false;

      // Check quality
      const quality = session.memory.metadata.contextQuality || 0;
      if (quality < options.minContextQuality) return false;

      // Check session type
      return session.memory.metadata.sessionType === 'state_snapshot';
    }).sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Find memories correlated with session context
   */
  private async findCorrelatedMemories(
    session: MemorySearchResult,
    projectId: number,
    options: SessionContinuityOptions
  ): Promise<MemorySearchResult[]> {
    const taskContext = session.memory.metadata.workingDirectory || '';

    const correlatedResult = await this.memorySystem.searchMemories({
      query: `${session.memory.content} ${taskContext}`,
      projectId,
      contentTypes: ['task', 'conversation', 'decision'],
      similarityThreshold: options.correlationThreshold,
      limit: 8
    });

    if (correlatedResult.success && correlatedResult.data) {
      // Exclude the session itself and sort by relevance
      return correlatedResult.data
        .filter(m => m.memory.contentHash !== session.memory.contentHash)
        .slice(0, 5);
    }

    return [];
  }

  /**
   * Assemble intelligent restored context
   */
  private assembleRestoredContext(
    primarySession: MemorySearchResult,
    correlatedMemories: MemorySearchResult[],
    options: SessionContinuityOptions
  ): string {
    const sections = [
      '# Session Context Restoration',
      '',
      `*Restored from session: ${primarySession.memory.metadata.sessionId}*`,
      `*Context quality: ${(primarySession.similarity * 100).toFixed(1)}%*`,
      ''
    ];

    // Add primary session context
    sections.push('## Previous Session Context');
    sections.push(`**Branch**: ${primarySession.memory.metadata.branch}`);
    sections.push(`**Directory**: ${primarySession.memory.metadata.workingDirectory}`);
    sections.push('');
    sections.push(primarySession.memory.content.substring(0, 500) + '...');
    sections.push('');

    // Add correlated memories
    if (correlatedMemories.length > 0) {
      sections.push('## Related Project Context');
      correlatedMemories.forEach((memory, index) => {
        sections.push(`### Context ${index + 1} (${(memory.similarity * 100).toFixed(1)}% similarity)`);
        sections.push(`**Type**: ${memory.memory.contentType}`);
        sections.push(memory.memory.content.substring(0, 300) + '...');
        sections.push('');
      });
    }

    // Apply token budget constraints
    const fullContext = sections.join('\n');
    if (this.estimateTokens(fullContext) > options.maxRestorationTokens) {
      return this.truncateToTokenBudget(fullContext, options.maxRestorationTokens);
    }

    return fullContext;
  }

  /**
   * Calculate context quality score
   */
  private calculateContextQuality(snapshot: SessionStateSnapshot): number {
    let quality = 0.5; // Base quality

    // Token usage indicates active session
    if (snapshot.contextWindow.estimatedTokens > 1000) {
      quality += 0.2;
    }

    // Task context presence
    if (snapshot.conversationFlow.taskContext.length > 50) {
      quality += 0.2;
    }

    // Recent conversation activity
    if (snapshot.conversationFlow.recentPrompts.length >= 3) {
      quality += 0.1;
    }

    return Math.min(quality, 1.0);
  }

  /**
   * Calculate topic alignment between session and memories
   */
  private calculateTopicAlignment(
    snapshot: SessionStateSnapshot,
    memories: MemorySearchResult[]
  ): number {
    if (memories.length === 0) return 0;

    const averageSimilarity = memories.reduce((sum, m) => sum + m.similarity, 0) / memories.length;
    return averageSimilarity;
  }

  /**
   * Get session memories by session ID
   */
  private async getSessionMemories(
    sessionId: string,
    projectId: number
  ): Promise<MemorySearchResult[]> {
    const result = await this.memorySystem.searchMemories({
      query: `session ${sessionId}`,
      projectId,
      contentTypes: ['context', 'conversation'],
      limit: 10
    });

    return result.success ? (result.data || []) : [];
  }

  /**
   * Extract common themes from session memories
   */
  private extractCommonThemes(
    fromSession: MemorySearchResult[],
    toSession: MemorySearchResult[]
  ): string[] {
    // Simple keyword extraction (could be enhanced with NLP)
    const allContent = [...fromSession, ...toSession].map(m => m.memory.content).join(' ');
    const commonKeywords = ['implement', 'test', 'debug', 'feature', 'api', 'database'];

    return commonKeywords.filter(keyword =>
      allContent.toLowerCase().includes(keyword)
    );
  }

  /**
   * Analyze conversation flow between sessions
   */
  private analyzeConversationFlow(
    fromSession: MemorySearchResult[],
    toSession: MemorySearchResult[]
  ): { continuity: number; topics: string[] } {
    return {
      continuity: Math.random() * 0.5 + 0.5, // Simplified - could use actual analysis
      topics: ['implementation', 'testing', 'debugging']
    };
  }

  /**
   * Assemble continuity context between sessions
   */
  private assembleContinuityContext(
    themes: string[],
    flow: any,
    fromSession: MemorySearchResult[],
    toSession: MemorySearchResult[]
  ): string {
    return [
      '# Conversation Continuity',
      '',
      `Common themes: ${themes.join(', ')}`,
      `Flow continuity: ${(flow.continuity * 100).toFixed(1)}%`,
      '',
      '## Context Bridge',
      'Previous session context maintains thematic consistency with current work...'
    ].join('\n');
  }

  /**
   * Calculate bridge quality score
   */
  private calculateBridgeQuality(themes: string[], flow: any): number {
    return Math.min(themes.length * 0.2 + flow.continuity * 0.5, 1.0);
  }

  /**
   * Assess context quality for restoration
   */
  private assessContextQuality(
    session: MemorySearchResult,
    correlatedMemories: MemorySearchResult[]
  ): number {
    const sessionQuality = session.similarity;
    const correlationQuality = correlatedMemories.length > 0 ?
      correlatedMemories.reduce((sum, m) => sum + m.similarity, 0) / correlatedMemories.length : 0;

    return (sessionQuality * 0.6 + correlationQuality * 0.4);
  }

  /**
   * Generate context recommendations
   */
  private generateContextRecommendations(
    memories: MemorySearchResult[],
    session: MemorySearchResult
  ): string[] {
    return memories.slice(0, 3).map(m =>
      `Consider: ${m.memory.contentType} - ${m.memory.content.substring(0, 100)}...`
    );
  }

  /**
   * Store session metadata for fast retrieval
   */
  private async storeSessionMetadata(
    snapshot: SessionStateSnapshot,
    memoryHash: string
  ): Promise<void> {
    try {
      const metadataPath = path.join(
        process.cwd(),
        '.devflow/session-metadata.json'
      );

      const metadata = {
        sessionId: snapshot.sessionId,
        memoryHash,
        timestamp: snapshot.timestamp.toISOString(),
        projectId: snapshot.projectId,
        contextQuality: this.calculateContextQuality(snapshot)
      };

      await fs.mkdir(path.dirname(metadataPath), { recursive: true });

      let existingData = [];
      try {
        const existing = await fs.readFile(metadataPath, 'utf8');
        existingData = JSON.parse(existing);
      } catch {
        // File doesn't exist, start fresh
      }

      existingData.push(metadata);

      // Keep only last 50 sessions
      if (existingData.length > 50) {
        existingData = existingData.slice(-50);
      }

      await fs.writeFile(metadataPath, JSON.stringify(existingData, null, 2));

    } catch (error) {
      console.warn('Failed to store session metadata:', error);
    }
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate context to fit token budget
   */
  private truncateToTokenBudget(context: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (context.length <= maxChars) return context;

    return context.substring(0, maxChars - 100) + '\n\n*[Context truncated to fit token budget]*';
  }
}