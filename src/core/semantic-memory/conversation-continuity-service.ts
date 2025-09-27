/**
 * Conversation Continuity Service
 * Provides intelligent conversation flow analysis and continuity management
 * Maintains conversation context and provides recommendations for seamless transitions
 */

import { EnhancedProjectMemorySystem } from './enhanced-memory-system';
import { SessionStateManager } from './session-state-manager';
import { CrossSessionMemoryBridge } from './cross-session-memory-bridge';
import { MemorySearchResult } from './semantic-search-engine';

export interface ConversationThread {
  threadId: string;
  projectId: number;
  startTime: Date;
  lastActivity: Date;
  participants: string[];
  topics: ConversationTopic[];
  continuityScore: number;
  memoryReferences: string[];
}

export interface ConversationTopic {
  topicId: string;
  name: string;
  keywords: string[];
  relevanceScore: number;
  firstMentioned: Date;
  lastMentioned: Date;
  evolutionStages: TopicEvolution[];
}

export interface TopicEvolution {
  stage: 'introduction' | 'exploration' | 'implementation' | 'resolution';
  timestamp: Date;
  description: string;
  keyDecisions: string[];
}

export interface ContinuityRecommendation {
  recommendationType: 'context_bridge' | 'topic_revival' | 'memory_injection' | 'theme_continuation';
  confidence: number;
  description: string;
  suggestedContext: string;
  relatedMemories: MemorySearchResult[];
}

export interface ConversationAnalysis {
  threadAnalysis: ConversationThread;
  topicProgression: ConversationTopic[];
  continuityGaps: ContinuityGap[];
  recommendations: ContinuityRecommendation[];
  overallContinuityScore: number;
}

export interface ContinuityGap {
  gapType: 'temporal' | 'topical' | 'contextual';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedFix: string;
  relatedTopics: string[];
}

export class ConversationContinuityService {
  private memorySystem: EnhancedProjectMemorySystem;
  private sessionManager: SessionStateManager;
  private bridgeSystem: CrossSessionMemoryBridge;

  constructor() {
    this.memorySystem = new EnhancedProjectMemorySystem();
    this.sessionManager = new SessionStateManager();
    this.bridgeSystem = new CrossSessionMemoryBridge();
  }

  /**
   * Initialize conversation continuity service
   */
  async initialize(): Promise<boolean> {
    try {
      const [memoryInit, sessionInit, bridgeInit] = await Promise.all([
        this.memorySystem.initialize(),
        this.sessionManager.initialize(),
        this.bridgeSystem.initialize()
      ]);

      if (!memoryInit.success || !sessionInit || !bridgeInit) {
        console.error('Failed to initialize Conversation Continuity Service');
        return false;
      }

      console.log('Conversation Continuity Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Conversation Continuity Service initialization failed:', error);
      return false;
    }
  }

  /**
   * Analyze conversation continuity for a project
   */
  async analyzeConversationContinuity(
    projectId: number,
    timeWindow: number = 72 // hours
  ): Promise<ConversationAnalysis> {
    try {
      // Get all conversation memories within time window
      const conversationMemories = await this.getConversationMemories(projectId, timeWindow);

      // Extract conversation threads
      const threads = this.extractConversationThreads(conversationMemories);
      const primaryThread = this.selectPrimaryThread(threads);

      // Analyze topic progression
      const topicProgression = await this.analyzeTopicProgression(conversationMemories);

      // Identify continuity gaps
      const continuityGaps = this.identifyContinuityGaps(primaryThread, topicProgression);

      // Generate continuity recommendations
      const recommendations = await this.generateContinuityRecommendations(
        primaryThread,
        topicProgression,
        continuityGaps,
        projectId
      );

      // Calculate overall continuity score
      const overallContinuityScore = this.calculateOverallContinuityScore(
        primaryThread,
        topicProgression,
        continuityGaps
      );

      return {
        threadAnalysis: primaryThread,
        topicProgression,
        continuityGaps,
        recommendations,
        overallContinuityScore
      };

    } catch (error) {
      console.error('Conversation continuity analysis failed:', error);
      return this.getDefaultAnalysis(projectId);
    }
  }

  /**
   * Create conversation bridge between sessions
   */
  async createConversationBridge(
    fromSessionId: string,
    toSessionId: string,
    projectId: number
  ): Promise<{
    success: boolean;
    bridgeContext: string;
    continuityScore: number;
    recommendations: ContinuityRecommendation[];
  }> {
    try {
      // Analyze conversation continuity
      const analysis = await this.analyzeConversationContinuity(projectId);

      // Get memories from both sessions
      const [fromMemories, toMemories] = await Promise.all([
        this.getSessionConversationMemories(fromSessionId, projectId),
        this.getSessionConversationMemories(toSessionId, projectId)
      ]);

      // Find conversation bridges
      const bridges = this.findConversationBridges(fromMemories, toMemories, analysis);

      // Create bridge context
      const bridgeContext = this.assembleBridgeContext(bridges, analysis);

      // Generate session-specific recommendations
      const recommendations = await this.generateSessionBridgeRecommendations(
        bridges,
        analysis,
        projectId
      );

      // Calculate bridge continuity score
      const continuityScore = this.calculateBridgeContinuityScore(bridges, analysis);

      console.log(`Conversation bridge created: ${bridges.length} bridges, ` +
                  `continuity ${(continuityScore * 100).toFixed(1)}%`);

      return {
        success: true,
        bridgeContext,
        continuityScore,
        recommendations
      };

    } catch (error) {
      console.error('Conversation bridge creation failed:', error);
      return {
        success: false,
        bridgeContext: '',
        continuityScore: 0,
        recommendations: []
      };
    }
  }

  /**
   * Get conversation flow recommendations for current context
   */
  async getConversationFlowRecommendations(
    currentContext: string,
    projectId: number,
    maxRecommendations: number = 5
  ): Promise<ContinuityRecommendation[]> {
    try {
      // Analyze current conversation state
      const analysis = await this.analyzeConversationContinuity(projectId);

      // Find relevant conversation patterns
      const relevantMemories = await this.memorySystem.searchMemories({
        query: currentContext,
        projectId,
        contentTypes: ['conversation', 'context'],
        limit: 10
      });

      if (!relevantMemories.success || !relevantMemories.data) {
        return [];
      }

      // Generate flow-specific recommendations
      const recommendations = this.generateFlowRecommendations(
        currentContext,
        relevantMemories.data,
        analysis,
        maxRecommendations
      );

      return recommendations.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      console.error('Conversation flow recommendations failed:', error);
      return [];
    }
  }

  /**
   * Update conversation thread with new activity
   */
  async updateConversationThread(
    threadId: string,
    projectId: number,
    newContent: string,
    contentType: 'prompt' | 'response' | 'decision'
  ): Promise<boolean> {
    try {
      // Store the new conversation memory
      const memoryContent = {
        content: newContent,
        contentType: 'conversation' as const,
        projectId,
        metadata: {
          threadId,
          conversationContentType: contentType,
          timestamp: new Date().toISOString()
        }
      };

      const storageResult = await this.memorySystem.storeMemory(memoryContent);

      if (!storageResult.success) {
        console.error('Failed to update conversation thread:', storageResult.error);
        return false;
      }

      // Update thread continuity analysis
      await this.updateThreadContinuity(threadId, projectId);

      return true;

    } catch (error) {
      console.error('Conversation thread update failed:', error);
      return false;
    }
  }

  /**
   * Get conversation memories within time window
   */
  private async getConversationMemories(
    projectId: number,
    timeWindow: number
  ): Promise<MemorySearchResult[]> {
    const searchResult = await this.memorySystem.searchMemories({
      query: 'conversation context session',
      projectId,
      contentTypes: ['conversation', 'context'],
      limit: 50
    });

    if (!searchResult.success || !searchResult.data) {
      return [];
    }

    // Filter by time window
    const cutoffTime = Date.now() - (timeWindow * 60 * 60 * 1000);
    return searchResult.data.filter(memory =>
      memory.memory.createdAt.getTime() > cutoffTime
    );
  }

  /**
   * Extract conversation threads from memories
   */
  private extractConversationThreads(memories: MemorySearchResult[]): ConversationThread[] {
    // Group memories by session or thread ID
    const threadGroups = new Map<string, MemorySearchResult[]>();

    memories.forEach(memory => {
      const threadId = memory.memory.metadata.threadId ||
                      memory.memory.metadata.sessionId ||
                      'default';

      if (!threadGroups.has(threadId)) {
        threadGroups.set(threadId, []);
      }
      threadGroups.get(threadId)!.push(memory);
    });

    // Convert groups to conversation threads
    return Array.from(threadGroups.entries()).map(([threadId, threadMemories]) =>
      this.createConversationThread(threadId, threadMemories)
    );
  }

  /**
   * Create conversation thread from memories
   */
  private createConversationThread(
    threadId: string,
    memories: MemorySearchResult[]
  ): ConversationThread {
    const sortedMemories = memories.sort((a, b) =>
      a.memory.createdAt.getTime() - b.memory.createdAt.getTime()
    );

    const startTime = sortedMemories[0]?.memory.createdAt || new Date();
    const lastActivity = sortedMemories[sortedMemories.length - 1]?.memory.createdAt || new Date();

    const topics = this.extractThreadTopics(sortedMemories);
    const continuityScore = this.calculateThreadContinuity(sortedMemories);

    return {
      threadId,
      projectId: sortedMemories[0]?.memory.projectId || 1,
      startTime,
      lastActivity,
      participants: ['user', 'assistant'],
      topics,
      continuityScore,
      memoryReferences: sortedMemories.map(m => m.memory.contentHash)
    };
  }

  /**
   * Select primary conversation thread
   */
  private selectPrimaryThread(threads: ConversationThread[]): ConversationThread {
    if (threads.length === 0) {
      return this.createDefaultThread();
    }

    // Select thread with highest continuity score and recent activity
    return threads.reduce((primary, thread) => {
      const recencyScore = this.calculateRecencyScore(thread.lastActivity);
      const threadScore = thread.continuityScore * 0.7 + recencyScore * 0.3;
      const primaryScore = primary.continuityScore * 0.7 +
                          this.calculateRecencyScore(primary.lastActivity) * 0.3;

      return threadScore > primaryScore ? thread : primary;
    });
  }

  /**
   * Analyze topic progression within conversation
   */
  private async analyzeTopicProgression(
    memories: MemorySearchResult[]
  ): Promise<ConversationTopic[]> {
    const topicMap = new Map<string, ConversationTopic>();

    // Extract topics from conversation content
    memories.forEach(memory => {
      const topics = this.extractTopicsFromContent(memory.memory.content);
      const timestamp = memory.memory.createdAt;

      topics.forEach(topicName => {
        if (!topicMap.has(topicName)) {
          topicMap.set(topicName, {
            topicId: topicName.toLowerCase().replace(/\s+/g, '_'),
            name: topicName,
            keywords: [topicName],
            relevanceScore: 0,
            firstMentioned: timestamp,
            lastMentioned: timestamp,
            evolutionStages: []
          });
        }

        const topic = topicMap.get(topicName)!;
        topic.lastMentioned = timestamp;
        topic.relevanceScore += 0.1; // Simple relevance scoring
      });
    });

    // Convert to array and sort by relevance
    const topics = Array.from(topicMap.values());
    return topics.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Identify continuity gaps in conversation
   */
  private identifyContinuityGaps(
    thread: ConversationThread,
    topics: ConversationTopic[]
  ): ContinuityGap[] {
    const gaps: ContinuityGap[] = [];

    // Check for temporal gaps
    const hoursSinceLastActivity = (Date.now() - thread.lastActivity.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastActivity > 8) {
      gaps.push({
        gapType: 'temporal',
        severity: hoursSinceLastActivity > 24 ? 'high' : 'medium',
        description: `${hoursSinceLastActivity.toFixed(1)} hours since last activity`,
        suggestedFix: 'Provide session context restoration',
        relatedTopics: topics.slice(0, 3).map(t => t.name)
      });
    }

    // Check for topical gaps
    const activeTopics = topics.filter(t => {
      const hoursSinceLastMention = (Date.now() - t.lastMentioned.getTime()) / (1000 * 60 * 60);
      return hoursSinceLastMention < 4;
    });

    if (activeTopics.length === 0 && topics.length > 0) {
      gaps.push({
        gapType: 'topical',
        severity: 'medium',
        description: 'No recently active conversation topics',
        suggestedFix: 'Revive relevant topics from recent history',
        relatedTopics: topics.slice(0, 2).map(t => t.name)
      });
    }

    // Check for contextual continuity
    if (thread.continuityScore < 0.6) {
      gaps.push({
        gapType: 'contextual',
        severity: 'medium',
        description: 'Low conversation continuity score',
        suggestedFix: 'Inject relevant context from memory system',
        relatedTopics: []
      });
    }

    return gaps;
  }

  /**
   * Generate continuity recommendations
   */
  private async generateContinuityRecommendations(
    thread: ConversationThread,
    topics: ConversationTopic[],
    gaps: ContinuityGap[],
    projectId: number
  ): Promise<ContinuityRecommendation[]> {
    const recommendations: ContinuityRecommendation[] = [];

    // Address temporal gaps
    const temporalGaps = gaps.filter(g => g.gapType === 'temporal');
    if (temporalGaps.length > 0) {
      const contextMemories = await this.memorySystem.searchMemories({
        query: 'recent session context',
        projectId,
        contentTypes: ['context', 'conversation'],
        limit: 3
      });

      if (contextMemories.success && contextMemories.data) {
        recommendations.push({
          recommendationType: 'context_bridge',
          confidence: 0.8,
          description: 'Bridge temporal gap with recent session context',
          suggestedContext: this.createTemporalBridgeContext(contextMemories.data),
          relatedMemories: contextMemories.data
        });
      }
    }

    // Address topical gaps
    const topicalGaps = gaps.filter(g => g.gapType === 'topical');
    for (const gap of topicalGaps) {
      const topicMemories = await this.memorySystem.searchMemories({
        query: gap.relatedTopics.join(' '),
        projectId,
        contentTypes: ['conversation', 'task', 'decision'],
        limit: 2
      });

      if (topicMemories.success && topicMemories.data?.length) {
        recommendations.push({
          recommendationType: 'topic_revival',
          confidence: 0.7,
          description: `Revive discussion of ${gap.relatedTopics.join(', ')}`,
          suggestedContext: this.createTopicRevivalContext(topicMemories.data, gap.relatedTopics),
          relatedMemories: topicMemories.data
        });
      }
    }

    // General memory injection recommendation
    if (recommendations.length === 0) {
      const generalMemories = await this.memorySystem.searchMemories({
        query: 'project context implementation',
        projectId,
        limit: 2
      });

      if (generalMemories.success && generalMemories.data?.length) {
        recommendations.push({
          recommendationType: 'memory_injection',
          confidence: 0.5,
          description: 'Inject relevant project context',
          suggestedContext: this.createGeneralContextInjection(generalMemories.data),
          relatedMemories: generalMemories.data
        });
      }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate overall continuity score
   */
  private calculateOverallContinuityScore(
    thread: ConversationThread,
    topics: ConversationTopic[],
    gaps: ContinuityGap[]
  ): number {
    const threadScore = thread.continuityScore;
    const topicScore = topics.length > 0 ? topics[0].relevanceScore / 5 : 0; // Normalize
    const gapPenalty = gaps.reduce((penalty, gap) => {
      return penalty + (gap.severity === 'high' ? 0.3 : gap.severity === 'medium' ? 0.2 : 0.1);
    }, 0);

    return Math.max(0, Math.min(1, threadScore * 0.5 + topicScore * 0.3 - gapPenalty * 0.2));
  }

  /**
   * Extract topics from content using simple keyword detection
   */
  private extractTopicsFromContent(content: string): string[] {
    const topicKeywords = [
      'implement', 'implementation', 'feature', 'bug', 'fix', 'test', 'testing',
      'database', 'api', 'authentication', 'security', 'performance',
      'deployment', 'configuration', 'documentation'
    ];

    const lowerContent = content.toLowerCase();
    return topicKeywords.filter(keyword => lowerContent.includes(keyword));
  }

  /**
   * Extract topics from thread memories
   */
  private extractThreadTopics(memories: MemorySearchResult[]): ConversationTopic[] {
    const topicCounts = new Map<string, number>();

    memories.forEach(memory => {
      const topics = this.extractTopicsFromContent(memory.memory.content);
      topics.forEach(topic => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      });
    });

    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        topicId: name.replace(/\s+/g, '_'),
        name,
        keywords: [name],
        relevanceScore: count / memories.length,
        firstMentioned: memories[0]?.memory.createdAt || new Date(),
        lastMentioned: memories[memories.length - 1]?.memory.createdAt || new Date(),
        evolutionStages: []
      }));
  }

  /**
   * Calculate thread continuity score
   */
  private calculateThreadContinuity(memories: MemorySearchResult[]): number {
    if (memories.length < 2) return 0.5;

    // Simple continuity based on temporal consistency and content similarity
    const timeSpan = memories[memories.length - 1].memory.createdAt.getTime() -
                    memories[0].memory.createdAt.getTime();
    const avgGap = timeSpan / Math.max(1, memories.length - 1);

    // Penalize large gaps between memories
    const hourlyGap = avgGap / (1000 * 60 * 60);
    const temporalContinuity = Math.max(0, 1 - hourlyGap / 24); // Normalize to 0-1

    // Add content-based continuity (simplified)
    const contentContinuity = 0.7; // Placeholder for actual content analysis

    return temporalContinuity * 0.4 + contentContinuity * 0.6;
  }

  /**
   * Calculate recency score for thread activity
   */
  private calculateRecencyScore(lastActivity: Date): number {
    const hoursAgo = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);
    return Math.max(0, 1 - hoursAgo / 72); // Decay over 72 hours
  }

  /**
   * Create default conversation thread
   */
  private createDefaultThread(): ConversationThread {
    return {
      threadId: 'default',
      projectId: 1,
      startTime: new Date(),
      lastActivity: new Date(),
      participants: ['user', 'assistant'],
      topics: [],
      continuityScore: 0.5,
      memoryReferences: []
    };
  }

  /**
   * Get default analysis structure
   */
  private getDefaultAnalysis(projectId: number): ConversationAnalysis {
    return {
      threadAnalysis: this.createDefaultThread(),
      topicProgression: [],
      continuityGaps: [],
      recommendations: [],
      overallContinuityScore: 0.5
    };
  }

  /**
   * Get session conversation memories
   */
  private async getSessionConversationMemories(
    sessionId: string,
    projectId: number
  ): Promise<MemorySearchResult[]> {
    const result = await this.memorySystem.searchMemories({
      query: `session ${sessionId}`,
      projectId,
      contentTypes: ['conversation', 'context'],
      limit: 10
    });

    return result.success ? (result.data || []) : [];
  }

  /**
   * Find conversation bridges between session memories
   */
  private findConversationBridges(
    fromMemories: MemorySearchResult[],
    toMemories: MemorySearchResult[],
    analysis: ConversationAnalysis
  ): MemorySearchResult[] {
    // Simple bridge finding - could be enhanced with more sophisticated analysis
    const allMemories = [...fromMemories, ...toMemories];
    return allMemories.slice(0, 3); // Take top 3 for bridge context
  }

  /**
   * Assemble bridge context from conversation bridges
   */
  private assembleBridgeContext(
    bridges: MemorySearchResult[],
    analysis: ConversationAnalysis
  ): string {
    if (bridges.length === 0) return '';

    const sections = [
      '# Conversation Continuity Bridge',
      '',
      `Overall continuity: ${(analysis.overallContinuityScore * 100).toFixed(1)}%`,
      ''
    ];

    bridges.forEach((bridge, index) => {
      sections.push(`## Bridge Context ${index + 1}`);
      sections.push(bridge.memory.content.substring(0, 200) + '...');
      sections.push('');
    });

    return sections.join('\n');
  }

  /**
   * Generate session bridge recommendations
   */
  private async generateSessionBridgeRecommendations(
    bridges: MemorySearchResult[],
    analysis: ConversationAnalysis,
    projectId: number
  ): Promise<ContinuityRecommendation[]> {
    // Generate recommendations based on bridge analysis
    const recommendations: ContinuityRecommendation[] = [];

    if (analysis.continuityGaps.length > 0) {
      recommendations.push({
        recommendationType: 'context_bridge',
        confidence: 0.8,
        description: 'Address identified continuity gaps',
        suggestedContext: 'Bridge context to maintain conversation flow',
        relatedMemories: bridges
      });
    }

    return recommendations;
  }

  /**
   * Calculate bridge continuity score
   */
  private calculateBridgeContinuityScore(
    bridges: MemorySearchResult[],
    analysis: ConversationAnalysis
  ): number {
    if (bridges.length === 0) return 0.3;

    const bridgeQuality = bridges.reduce((sum, bridge) => sum + bridge.similarity, 0) / bridges.length;
    return bridgeQuality * 0.7 + analysis.overallContinuityScore * 0.3;
  }

  /**
   * Generate flow recommendations based on current context
   */
  private generateFlowRecommendations(
    currentContext: string,
    relevantMemories: MemorySearchResult[],
    analysis: ConversationAnalysis,
    maxRecommendations: number
  ): ContinuityRecommendation[] {
    const recommendations: ContinuityRecommendation[] = [];

    // Context-based recommendations
    if (relevantMemories.length > 0) {
      recommendations.push({
        recommendationType: 'memory_injection',
        confidence: 0.7,
        description: 'Inject relevant context from project memory',
        suggestedContext: this.createGeneralContextInjection(relevantMemories.slice(0, 2)),
        relatedMemories: relevantMemories.slice(0, 2)
      });
    }

    // Topic-based recommendations
    const activeTopics = analysis.topicProgression.slice(0, 2);
    for (const topic of activeTopics) {
      recommendations.push({
        recommendationType: 'theme_continuation',
        confidence: 0.6,
        description: `Continue discussion of ${topic.name}`,
        suggestedContext: `Consider previous work on ${topic.name} topic`,
        relatedMemories: []
      });
    }

    return recommendations.slice(0, maxRecommendations);
  }

  /**
   * Create temporal bridge context
   */
  private createTemporalBridgeContext(memories: MemorySearchResult[]): string {
    const sections = ['## Recent Context Bridge'];
    memories.forEach(memory => {
      sections.push(`- ${memory.memory.content.substring(0, 100)}...`);
    });
    return sections.join('\n');
  }

  /**
   * Create topic revival context
   */
  private createTopicRevivalContext(
    memories: MemorySearchResult[],
    topics: string[]
  ): string {
    return [
      `## Topic Revival: ${topics.join(', ')}`,
      'Previous discussion context:',
      ...memories.map(m => `- ${m.memory.content.substring(0, 100)}...`)
    ].join('\n');
  }

  /**
   * Create general context injection
   */
  private createGeneralContextInjection(memories: MemorySearchResult[]): string {
    const sections = ['## Relevant Project Context'];
    memories.forEach((memory, index) => {
      sections.push(`### Context ${index + 1}`);
      sections.push(memory.memory.content.substring(0, 150) + '...');
    });
    return sections.join('\n');
  }

  /**
   * Update thread continuity analysis
   */
  private async updateThreadContinuity(threadId: string, projectId: number): Promise<void> {
    // This would update internal continuity metrics
    // Implementation could include real-time analysis updates
    console.log(`Thread continuity updated for ${threadId} in project ${projectId}`);
  }
}