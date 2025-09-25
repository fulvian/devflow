/**
 * Context Injection Intelligence Engine
 * Bridges existing semantic memory system with DevFlow hook system
 * Provides intelligent context selection based on conversation flow analysis
 */

import { EnhancedProjectMemorySystem, MemoryOperationResult } from './enhanced-memory-system';
import { MemorySearchResult, SearchQuery } from './semantic-search-engine';
import * as crypto from 'crypto';

export interface ConversationContext {
  currentPrompt: string;
  projectId: number;
  sessionId: string;
  conversationHistory?: string[];
  taskContext?: string;
  timestamp: Date;
}

export interface ContextInjectionResult {
  success: boolean;
  relevantMemories: MemorySearchResult[];
  injectedContext: string;
  relevanceScore: number;
  processingTime: number;
  tokenCount: number;
}

export interface ContextSelectionCriteria {
  semanticWeight: number;
  temporalWeight: number;
  usageWeight: number;
  projectWeight: number;
  maxTokens: number;
  similarityThreshold: number;
}

export interface ConversationFlow {
  conversationId: string;
  flowPattern: string;
  contextRelevance: number;
  expectedMemoryTypes: string[];
  priorityTopics: string[];
}

export class ContextInjectionIntelligenceEngine {
  private memorySystem: EnhancedProjectMemorySystem;
  private defaultSelectionCriteria: ContextSelectionCriteria;

  constructor() {
    this.memorySystem = new EnhancedProjectMemorySystem({
      enablePerformanceMonitoring: true,
      enableClustering: true
    });

    this.defaultSelectionCriteria = {
      semanticWeight: 0.4,
      temporalWeight: 0.2,
      usageWeight: 0.25,
      projectWeight: 0.15,
      maxTokens: 2000,
      similarityThreshold: 0.7
    };
  }

  /**
   * Initialize the intelligence engine
   */
  async initialize(): Promise<boolean> {
    try {
      const result = await this.memorySystem.initialize();
      return result.success;
    } catch (error) {
      console.error('Failed to initialize Context Injection Intelligence Engine:', error);
      return false;
    }
  }

  /**
   * Analyze conversation flow and inject intelligent context
   */
  async injectIntelligentContext(
    conversationContext: ConversationContext,
    criteria?: Partial<ContextSelectionCriteria>
  ): Promise<ContextInjectionResult> {
    const startTime = performance.now();

    try {
      const mergedCriteria = { ...this.defaultSelectionCriteria, ...criteria };

      // Analyze conversation flow for context patterns
      const conversationFlow = await this.analyzeConversationFlow(conversationContext);

      // Get relevant memories using enhanced semantic search
      const searchQuery: SearchQuery = {
        query: conversationContext.currentPrompt,
        projectId: conversationContext.projectId,
        contentTypes: conversationFlow.expectedMemoryTypes,
        similarityThreshold: mergedCriteria.similarityThreshold,
        limit: 10
      };

      const memoryResult = await this.memorySystem.searchMemories(searchQuery);

      if (!memoryResult.success || !memoryResult.data) {
        return {
          success: false,
          relevantMemories: [],
          injectedContext: '',
          relevanceScore: 0,
          processingTime: performance.now() - startTime,
          tokenCount: 0
        };
      }

      // Apply intelligent context selection
      const selectedMemories = await this.selectOptimalContext(
        memoryResult.data,
        conversationFlow,
        mergedCriteria
      );

      // Assemble structured context injection
      const injectedContext = this.assembleContextInjection(
        selectedMemories,
        conversationFlow
      );

      const relevanceScore = this.calculateOverallRelevance(
        selectedMemories,
        conversationFlow
      );

      const tokenCount = this.estimateTokenCount(injectedContext);
      const processingTime = performance.now() - startTime;

      return {
        success: true,
        relevantMemories: selectedMemories,
        injectedContext,
        relevanceScore,
        processingTime,
        tokenCount
      };

    } catch (error) {
      const processingTime = performance.now() - startTime;
      console.error('Context injection intelligence failed:', error);

      return {
        success: false,
        relevantMemories: [],
        injectedContext: '',
        relevanceScore: 0,
        processingTime,
        tokenCount: 0
      };
    }
  }

  /**
   * Analyze conversation flow patterns for context relevance
   */
  private async analyzeConversationFlow(
    context: ConversationContext
  ): Promise<ConversationFlow> {
    // Extract conversation patterns from prompt and history
    const conversationId = this.generateConversationId(context);

    // Detect flow pattern based on prompt characteristics
    const flowPattern = this.detectFlowPattern(context.currentPrompt);

    // Calculate context relevance score
    const contextRelevance = this.calculateContextRelevance(context);

    // Determine expected memory types based on conversation flow
    const expectedMemoryTypes = this.inferMemoryTypes(context.currentPrompt, flowPattern);

    // Extract priority topics from conversation
    const priorityTopics = this.extractPriorityTopics(context);

    return {
      conversationId,
      flowPattern,
      contextRelevance,
      expectedMemoryTypes,
      priorityTopics
    };
  }

  /**
   * Select optimal context based on multi-factor relevance scoring
   */
  private async selectOptimalContext(
    memories: MemorySearchResult[],
    flow: ConversationFlow,
    criteria: ContextSelectionCriteria
  ): Promise<MemorySearchResult[]> {
    // Score each memory using multi-factor analysis
    const scoredMemories = memories.map(memory => ({
      ...memory,
      compositeScore: this.calculateCompositeScore(memory, flow, criteria)
    }));

    // Sort by composite score
    scoredMemories.sort((a, b) => b.compositeScore - a.compositeScore);

    // Apply token budget constraints
    const selectedMemories: MemorySearchResult[] = [];
    let tokenBudget = criteria.maxTokens;

    for (const memory of scoredMemories) {
      const memoryTokens = this.estimateTokenCount(memory.memory.content);

      if (tokenBudget >= memoryTokens && memory.compositeScore > 0.5) {
        selectedMemories.push(memory);
        tokenBudget -= memoryTokens;
      }

      if (tokenBudget < 100) break; // Reserve minimum tokens
    }

    return selectedMemories;
  }

  /**
   * Calculate composite relevance score using multiple factors
   */
  private calculateCompositeScore(
    memory: MemorySearchResult,
    flow: ConversationFlow,
    criteria: ContextSelectionCriteria
  ): number {
    // Semantic similarity score (from existing search)
    const semanticScore = memory.similarity;

    // Temporal relevance (newer memories score higher)
    const ageInDays = (Date.now() - memory.memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const temporalScore = Math.max(0, 1 - ageInDays / 30); // Decay over 30 days

    // Usage effectiveness (simplified - could be enhanced with actual usage data)
    const usageScore = 0.8; // Placeholder for actual usage analytics

    // Project relevance (content type matching)
    const projectScore = flow.expectedMemoryTypes.includes(memory.memory.contentType) ? 1.0 : 0.5;

    // Composite score using weighted average
    return (
      semanticScore * criteria.semanticWeight +
      temporalScore * criteria.temporalWeight +
      usageScore * criteria.usageWeight +
      projectScore * criteria.projectWeight
    );
  }

  /**
   * Assemble structured context injection
   */
  private assembleContextInjection(
    memories: MemorySearchResult[],
    flow: ConversationFlow
  ): string {
    if (memories.length === 0) return '';

    const sections = [
      '# Relevant Project Context',
      '',
      `*Flow Pattern: ${flow.flowPattern} | Relevance: ${(flow.contextRelevance * 100).toFixed(1)}%*`,
      ''
    ];

    memories.forEach((memory, index) => {
      sections.push(`## Context ${index + 1} (Similarity: ${(memory.similarity * 100).toFixed(1)}%)`);
      sections.push(`**Type**: ${memory.memory.contentType}`);
      sections.push(`**Created**: ${memory.memory.createdAt.toLocaleDateString()}`);
      sections.push('');
      sections.push(memory.memory.content.substring(0, 500) + (memory.memory.content.length > 500 ? '...' : ''));
      sections.push('');
    });

    return sections.join('\n');
  }

  /**
   * Generate conversation ID for tracking
   */
  private generateConversationId(context: ConversationContext): string {
    const data = `${context.projectId}-${context.sessionId}-${context.timestamp.getTime()}`;
    return crypto.createHash('md5').update(data).digest('hex').substring(0, 8);
  }

  /**
   * Detect conversation flow pattern from prompt
   */
  private detectFlowPattern(prompt: string): string {
    const patterns = [
      { name: 'implementation', keywords: ['implement', 'create', 'build', 'develop', 'code'] },
      { name: 'debugging', keywords: ['fix', 'error', 'bug', 'issue', 'problem'] },
      { name: 'analysis', keywords: ['analyze', 'explain', 'understand', 'review'] },
      { name: 'planning', keywords: ['plan', 'design', 'architecture', 'strategy'] },
      { name: 'documentation', keywords: ['document', 'comment', 'describe', 'explain'] }
    ];

    const lowerPrompt = prompt.toLowerCase();

    for (const pattern of patterns) {
      if (pattern.keywords.some(keyword => lowerPrompt.includes(keyword))) {
        return pattern.name;
      }
    }

    return 'general';
  }

  /**
   * Calculate context relevance based on conversation characteristics
   */
  private calculateContextRelevance(context: ConversationContext): number {
    let relevance = 0.5; // Base relevance

    // Boost relevance for specific project mentions
    if (context.taskContext && context.currentPrompt.length > 20) {
      relevance += 0.2;
    }

    // Boost for conversation history presence
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      relevance += 0.1;
    }

    // Boost for technical keywords
    const technicalKeywords = ['implement', 'code', 'function', 'class', 'api', 'database'];
    const hasKeywords = technicalKeywords.some(keyword =>
      context.currentPrompt.toLowerCase().includes(keyword)
    );

    if (hasKeywords) relevance += 0.2;

    return Math.min(relevance, 1.0);
  }

  /**
   * Infer expected memory types from prompt and flow
   */
  private inferMemoryTypes(prompt: string, flowPattern: string): string[] {
    const allTypes = ['task', 'conversation', 'file', 'decision', 'context'];

    // Pattern-specific type preferences
    switch (flowPattern) {
      case 'implementation':
        return ['task', 'decision', 'file'];
      case 'debugging':
        return ['conversation', 'task', 'file'];
      case 'planning':
        return ['decision', 'task', 'context'];
      default:
        return allTypes;
    }
  }

  /**
   * Extract priority topics from conversation context
   */
  private extractPriorityTopics(context: ConversationContext): string[] {
    // Simple keyword extraction (could be enhanced with NLP)
    const prompt = context.currentPrompt.toLowerCase();
    const topics = [];

    // Technical topics
    if (prompt.includes('database')) topics.push('database');
    if (prompt.includes('api')) topics.push('api');
    if (prompt.includes('ui') || prompt.includes('interface')) topics.push('ui');
    if (prompt.includes('test')) topics.push('testing');

    return topics;
  }

  /**
   * Calculate overall relevance score for selected memories
   */
  private calculateOverallRelevance(
    memories: MemorySearchResult[],
    flow: ConversationFlow
  ): number {
    if (memories.length === 0) return 0;

    const averageSimilarity = memories.reduce((sum, m) => sum + m.similarity, 0) / memories.length;
    return averageSimilarity * flow.contextRelevance;
  }

  /**
   * Estimate token count for text content
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}