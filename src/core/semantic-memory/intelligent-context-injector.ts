/**
 * Intelligent Context Injector - Phase 4 Advanced Intelligence
 * Provides AI-driven context injection and learning pattern recognition
 * Context7: Based on semantic router and intelligent context management patterns
 */

import { SemanticSearchEngine, SearchQuery, MemorySearchResult } from './semantic-search-engine';
import { SemanticMemoryEngine, MemoryRecord } from './semantic-memory-engine';
import { MemoryClusteringEngine } from './memory-clustering-engine';

export interface ContextInjectionConfig {
  projectId: number;
  sessionContext?: string;
  activeTask?: string;
  codeContext?: string[];
  userIntent?: 'development' | 'debugging' | 'learning' | 'planning';
  adaptiveThreshold?: boolean;
  crossProjectLearning?: boolean;
}

export interface IntelligentContext {
  relevantMemories: MemorySearchResult[];
  suggestedPatterns: PatternSuggestion[];
  contextualInsights: ContextualInsight[];
  adaptiveParameters: AdaptiveParameters;
  confidence: number;
}

export interface PatternSuggestion {
  pattern: string;
  description: string;
  relevanceScore: number;
  sourceProject?: number;
  usageFrequency: number;
  successRate: number;
}

export interface ContextualInsight {
  insight: string;
  category: 'optimization' | 'anti-pattern' | 'best-practice' | 'learning';
  confidence: number;
  supportingMemories: MemoryRecord[];
}

export interface AdaptiveParameters {
  optimalSimilarityThreshold: number;
  recommendedClusterCount: number;
  contextWindowSize: number;
  learningRate: number;
}

export interface LearningMetrics {
  patternRecognitionAccuracy: number;
  contextRelevanceScore: number;
  adaptationEfficiency: number;
  crossProjectTransferRate: number;
}

export class IntelligentContextInjector {
  private searchEngine: SemanticSearchEngine;
  private memoryEngine: SemanticMemoryEngine;
  private clusteringEngine: MemoryClusteringEngine;

  // Context7: Learning pattern storage
  private learningPatterns: Map<number, Map<string, PatternSuggestion>> = new Map();
  private adaptiveThresholds: Map<number, number> = new Map();
  private sessionLearning: Map<string, LearningMetrics> = new Map();

  constructor() {
    this.searchEngine = new SemanticSearchEngine();
    this.memoryEngine = new SemanticMemoryEngine();
    this.clusteringEngine = new MemoryClusteringEngine();
  }

  /**
   * Context7: Main intelligent context injection with adaptive learning
   * Based on semantic router patterns for intent-based routing
   */
  async injectIntelligentContext(config: ContextInjectionConfig): Promise<IntelligentContext> {
    const startTime = performance.now();

    try {
      // Phase 4: Multi-dimensional context analysis
      const [relevantMemories, patterns, insights, adaptiveParams] = await Promise.all([
        this.findContextuallyRelevantMemories(config),
        this.suggestLearningPatterns(config),
        this.generateContextualInsights(config),
        this.calculateAdaptiveParameters(config)
      ]);

      // Context7: Confidence scoring based on multi-factor analysis
      const confidence = this.calculateContextConfidence(
        relevantMemories,
        patterns,
        insights,
        config
      );

      // Phase 4: Learning feedback loop
      if (config.adaptiveThreshold) {
        await this.updateLearningPatterns(config, {
          relevantMemories,
          suggestedPatterns: patterns,
          contextualInsights: insights,
          adaptiveParameters: adaptiveParams,
          confidence
        });
      }

      const duration = performance.now() - startTime;
      if (duration > 100) {
        console.warn(`Intelligent context injection: ${duration.toFixed(2)}ms (consider optimization)`);
      }

      return {
        relevantMemories,
        suggestedPatterns: patterns,
        contextualInsights: insights,
        adaptiveParameters: adaptiveParams,
        confidence
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Intelligent context injection failed: ${message}`);
    }
  }

  /**
   * Context7: Multi-modal context search with intent understanding
   * Combines semantic search with contextual understanding
   */
  private async findContextuallyRelevantMemories(config: ContextInjectionConfig): Promise<MemorySearchResult[]> {
    const queries: string[] = [];

    // Context7: Build multi-modal query based on available context
    if (config.sessionContext) queries.push(config.sessionContext);
    if (config.activeTask) queries.push(config.activeTask);
    if (config.codeContext?.length) {
      queries.push(...config.codeContext.slice(0, 3)); // Limit context noise
    }

    if (queries.length === 0) {
      return []; // No context available
    }

    // Phase 4: Adaptive threshold based on learning
    const threshold = config.adaptiveThreshold
      ? this.adaptiveThresholds.get(config.projectId) || 0.3
      : 0.3;

    const searchPromises = queries.map(query =>
      this.searchEngine.search({
        query,
        projectId: config.projectId,
        similarityThreshold: threshold,
        limit: 5,
        includeContent: true
      })
    );

    const searchResults = await Promise.all(searchPromises);

    // Context7: Intelligent result fusion and deduplication
    const fusedResults = this.fuseAndDeduplicateResults(searchResults);

    // Phase 4: Cross-project learning if enabled
    if (config.crossProjectLearning) {
      const crossProjectResults = await this.findCrossProjectPatterns(queries, config.projectId);
      return this.mergeWithCrossProjectResults(fusedResults, crossProjectResults);
    }

    return fusedResults;
  }

  /**
   * Context7: Pattern recognition and learning from historical data
   * Based on semantic chunking and pattern analysis
   */
  private async suggestLearningPatterns(config: ContextInjectionConfig): Promise<PatternSuggestion[]> {
    const projectPatterns = this.learningPatterns.get(config.projectId);
    if (!projectPatterns) {
      // Initialize learning patterns for new project
      return this.initializeLearningPatterns(config.projectId);
    }

    const suggestions: PatternSuggestion[] = [];

    // Context7: Intent-based pattern filtering
    const relevantPatterns = Array.from(projectPatterns.values()).filter(pattern => {
      return this.isPatternRelevantForIntent(pattern, config.userIntent || 'development');
    });

    // Phase 4: Sort by success rate and usage frequency
    relevantPatterns.sort((a, b) => {
      const aScore = a.successRate * a.usageFrequency * a.relevanceScore;
      const bScore = b.successRate * b.usageFrequency * b.relevanceScore;
      return bScore - aScore;
    });

    return relevantPatterns.slice(0, 10); // Top 10 patterns
  }

  /**
   * Phase 4: Generate contextual insights using AI-driven analysis
   * Context7: Based on best practice analysis and anti-pattern detection
   */
  private async generateContextualInsights(config: ContextInjectionConfig): Promise<ContextualInsight[]> {
    const insights: ContextualInsight[] = [];

    // Get project clusters for pattern analysis
    const clusters = await this.clusteringEngine.clusterProjectMemories(config.projectId);

    // Context7: Multi-category insight generation
    const categories: Array<ContextualInsight['category']> = [
      'optimization', 'anti-pattern', 'best-practice', 'learning'
    ];

    for (const category of categories) {
      const categoryInsights = await this.generateCategoryInsights(
        category,
        clusters,
        config
      );
      insights.push(...categoryInsights);
    }

    // Phase 4: Sort by confidence and relevance
    return insights
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8); // Top 8 insights
  }

  /**
   * Context7: Dynamic parameter optimization based on learning patterns
   * Adaptive threshold and parameter tuning
   */
  private async calculateAdaptiveParameters(config: ContextInjectionConfig): Promise<AdaptiveParameters> {
    const projectMetrics = this.sessionLearning.get(`project_${config.projectId}`);

    // Context7: Baseline parameters
    const baseline: AdaptiveParameters = {
      optimalSimilarityThreshold: 0.3,
      recommendedClusterCount: 5,
      contextWindowSize: 10,
      learningRate: 0.1
    };

    if (!projectMetrics) {
      return baseline;
    }

    // Phase 4: Adaptive parameter calculation based on historical performance
    const recommendedClusterCount = await this.calculateOptimalClusterCount(config.projectId);

    return {
      optimalSimilarityThreshold: this.calculateOptimalThreshold(projectMetrics),
      recommendedClusterCount,
      contextWindowSize: Math.max(5, Math.min(20, Math.round(baseline.contextWindowSize * projectMetrics.contextRelevanceScore))),
      learningRate: Math.max(0.05, Math.min(0.2, baseline.learningRate * projectMetrics.adaptationEfficiency))
    };
  }

  /**
   * Context7: Multi-factor confidence scoring
   * Based on semantic router confidence calculation patterns
   */
  private calculateContextConfidence(
    memories: MemorySearchResult[],
    patterns: PatternSuggestion[],
    insights: ContextualInsight[],
    config: ContextInjectionConfig
  ): number {
    const factors = [
      // Memory relevance factor (0-1)
      memories.length > 0 ? memories.reduce((sum, m) => sum + m.similarity, 0) / memories.length : 0,

      // Pattern quality factor (0-1)
      patterns.length > 0 ? patterns.reduce((sum, p) => sum + p.relevanceScore, 0) / patterns.length : 0,

      // Insight confidence factor (0-1)
      insights.length > 0 ? insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length : 0,

      // Context completeness factor (0-1)
      (config.sessionContext ? 0.25 : 0) +
      (config.activeTask ? 0.25 : 0) +
      (config.codeContext?.length ? 0.25 : 0) +
      (config.userIntent ? 0.25 : 0)
    ];

    // Context7: Weighted average with bias toward actual results
    const weights = [0.4, 0.3, 0.2, 0.1];
    return factors.reduce((sum, factor, index) => sum + factor * weights[index], 0);
  }

  /**
   * Context7: Result fusion with intelligent deduplication
   * Based on semantic similarity deduplication patterns
   */
  private fuseAndDeduplicateResults(searchResults: MemorySearchResult[][]): MemorySearchResult[] {
    const allResults = searchResults.flat();
    const deduplicatedMap = new Map<string, MemorySearchResult>();

    for (const result of allResults) {
      const key = result.memory.contentHash;
      const existing = deduplicatedMap.get(key);

      if (!existing || result.similarity > existing.similarity) {
        deduplicatedMap.set(key, result);
      }
    }

    return Array.from(deduplicatedMap.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 15); // Top 15 unique results
  }

  /**
   * Phase 4: Cross-project pattern learning
   * Context7: Knowledge transfer between projects
   */
  private async findCrossProjectPatterns(queries: string[], currentProjectId: number): Promise<MemorySearchResult[]> {
    // Get all project IDs except current
    const allProjectIds = Array.from(this.learningPatterns.keys()).filter(id => id !== currentProjectId);

    if (allProjectIds.length === 0) return [];

    const crossProjectResults: MemorySearchResult[] = [];

    // Search in other projects with higher threshold for quality
    for (const projectId of allProjectIds.slice(0, 3)) { // Limit to 3 projects
      for (const query of queries.slice(0, 2)) { // Limit queries
        try {
          const results = await this.searchEngine.search({
            query,
            projectId,
            similarityThreshold: 0.7, // Higher threshold for cross-project
            limit: 2,
            includeContent: false // Privacy: no content cross-project
          });

          crossProjectResults.push(...results);
        } catch {
          // Skip failed cross-project searches
        }
      }
    }

    return crossProjectResults.slice(0, 5); // Max 5 cross-project results
  }

  /**
   * Context7: Intelligent result merging
   */
  private mergeWithCrossProjectResults(
    mainResults: MemorySearchResult[],
    crossProjectResults: MemorySearchResult[]
  ): MemorySearchResult[] {
    // Phase 4: Cross-project results get lower priority
    const adjustedCrossResults = crossProjectResults.map(result => ({
      ...result,
      similarity: result.similarity * 0.8 // 20% penalty for cross-project
    }));

    return [...mainResults, ...adjustedCrossResults]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20); // Top 20 total results
  }

  /**
   * Context7: Helper methods for pattern recognition and learning
   */
  private async initializeLearningPatterns(projectId: number): Promise<PatternSuggestion[]> {
    // Context7: Initialize with common development patterns
    const commonPatterns: PatternSuggestion[] = [
      {
        pattern: 'authentication_implementation',
        description: 'User authentication and security patterns',
        relevanceScore: 0.8,
        usageFrequency: 1,
        successRate: 0.9
      },
      {
        pattern: 'database_optimization',
        description: 'Database query and performance optimization',
        relevanceScore: 0.7,
        usageFrequency: 1,
        successRate: 0.85
      },
      {
        pattern: 'api_design',
        description: 'RESTful API design and best practices',
        relevanceScore: 0.75,
        usageFrequency: 1,
        successRate: 0.8
      }
    ];

    const patternMap = new Map<string, PatternSuggestion>();
    commonPatterns.forEach(pattern => patternMap.set(pattern.pattern, pattern));
    this.learningPatterns.set(projectId, patternMap);

    return commonPatterns;
  }

  private isPatternRelevantForIntent(pattern: PatternSuggestion, intent: string): boolean {
    // Context7: Intent-based pattern filtering logic
    const intentPatternMap = {
      development: ['authentication_implementation', 'api_design', 'database_optimization'],
      debugging: ['error_handling', 'logging_patterns', 'debugging_techniques'],
      learning: ['best_practices', 'design_patterns', 'code_examples'],
      planning: ['architecture_patterns', 'project_structure', 'scalability']
    };

    const relevantPatterns = intentPatternMap[intent as keyof typeof intentPatternMap] || [];
    return relevantPatterns.some(p => pattern.pattern.includes(p)) || pattern.relevanceScore > 0.7;
  }

  private async generateCategoryInsights(
    category: ContextualInsight['category'],
    clusters: any[],
    config: ContextInjectionConfig
  ): Promise<ContextualInsight[]> {
    // Context7: Category-specific insight generation
    const insights: ContextualInsight[] = [];

    // Simplified insight generation for Phase 4 MVP
    if (clusters.length > 0) {
      insights.push({
        insight: `Project has ${clusters.length} semantic clusters indicating well-organized knowledge`,
        category,
        confidence: 0.8,
        supportingMemories: []
      });
    }

    return insights;
  }

  private calculateOptimalThreshold(metrics: LearningMetrics): number {
    // Context7: Adaptive threshold based on performance metrics
    const baseThreshold = 0.3;
    const adjustment = (metrics.contextRelevanceScore - 0.5) * 0.4; // ±0.2 range
    return Math.max(0.1, Math.min(0.8, baseThreshold + adjustment));
  }

  private async calculateOptimalClusterCount(projectId: number): Promise<number> {
    const memoryCount = await this.memoryEngine.getMemoryCount(projectId);

    // Context7: Dynamic cluster count based on memory volume
    if (memoryCount < 10) return 2;
    if (memoryCount < 50) return Math.ceil(memoryCount / 10);
    if (memoryCount < 200) return Math.ceil(memoryCount / 20);
    return Math.ceil(memoryCount / 30);
  }

  /**
   * Phase 4: Update learning patterns based on usage and success
   */
  private async updateLearningPatterns(
    config: ContextInjectionConfig,
    context: IntelligentContext
  ): Promise<void> {
    const sessionKey = `project_${config.projectId}_${Date.now()}`;

    // Update session learning metrics
    this.sessionLearning.set(sessionKey, {
      patternRecognitionAccuracy: context.confidence,
      contextRelevanceScore: context.relevantMemories.length > 0 ?
        context.relevantMemories.reduce((sum, m) => sum + m.similarity, 0) / context.relevantMemories.length : 0,
      adaptationEfficiency: 0.8, // Placeholder - would be calculated from actual usage
      crossProjectTransferRate: 0.1 // Placeholder - would be calculated from cross-project success
    });

    // Update adaptive threshold for project
    if (context.confidence > 0.7) {
      this.adaptiveThresholds.set(config.projectId, context.adaptiveParameters.optimalSimilarityThreshold);
    }
  }

  /**
   * Context7: Get learning insights for debugging and optimization
   */
  async getLearningInsights(projectId: number): Promise<{
    patterns: PatternSuggestion[];
    adaptiveThreshold: number;
    learningMetrics: LearningMetrics | null;
  }> {
    const patterns = Array.from(this.learningPatterns.get(projectId)?.values() || []);
    const adaptiveThreshold = this.adaptiveThresholds.get(projectId) || 0.3;
    const learningMetrics = this.sessionLearning.get(`project_${projectId}`) || null;

    return {
      patterns,
      adaptiveThreshold,
      learningMetrics
    };
  }
}