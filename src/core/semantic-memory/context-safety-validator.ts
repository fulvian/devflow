/**
 * Context Safety Validator - Context7 Compliant Safety Layer
 * Prevents LLM performance degradation through intelligent context validation
 *
 * Based on 2025 Context Engineering best practices:
 * - Context rot prevention (32k token safety limit)
 * - Context poisoning detection
 * - Performance degradation monitoring
 * - Adversarial pattern detection
 */

export interface ContextSafetyMetrics {
  tokenCount: number;
  coherenceScore: number;
  poisoningRisk: number;
  adversarialScore: number;
  performanceScore: number;
  safetyLevel: 'SAFE' | 'WARNING' | 'DANGER' | 'CRITICAL';
}

export interface ContextValidationResult {
  isValid: boolean;
  safetyMetrics: ContextSafetyMetrics;
  warnings: string[];
  errors: string[];
  fallbackRecommended: boolean;
  optimizationSuggestions: string[];
}

export interface ContextSafetyConfig {
  maxTokens: number;
  minCoherenceScore: number;
  maxPoisoningRisk: number;
  maxAdversarialScore: number;
  enableAdversarialDetection: boolean;
  enablePerformanceMonitoring: boolean;
  enableGracefulDegradation: boolean;
}

export class ContextSafetyValidator {
  private config: ContextSafetyConfig;
  private performanceHistory: number[] = [];

  // Context7 Pattern: Known adversarial patterns from research
  private readonly ADVERSARIAL_PATTERNS = [
    /ignore.*previous.*instruction/gi,
    /forget.*everything/gi,
    /new.*instruction.*override/gi,
    /system.*prompt.*replace/gi,
    /jailbreak/gi,
    /prompt.*injection/gi,
    /context.*poison/gi,
    /override.*safety/gi
  ];

  // Context7 Pattern: Performance degradation indicators
  private readonly DEGRADATION_PATTERNS = [
    /(.{1,50}\n){100,}/g, // Excessive list operations (research shows higher degradation)
    /print\s*\([^)]*\)\s*\n.*print\s*\([^)]*\)\s*\n.*print\s*\([^)]*\)\s*\n/g, // Repetitive print statements
    /(.{1,20}\s+){500,}/g, // Excessive spacing/padding
    /(the|and|or|but|if|then|else|when|where|how|what|why|who)\s+\1/gi, // Word repetition
  ];

  constructor(config?: Partial<ContextSafetyConfig>) {
    this.config = {
      maxTokens: 30000, // Context7 Best Practice: Below 32k degradation threshold
      minCoherenceScore: 0.7,
      maxPoisoningRisk: 0.3,
      maxAdversarialScore: 0.2,
      enableAdversarialDetection: true,
      enablePerformanceMonitoring: true,
      enableGracefulDegradation: true,
      ...config
    };
  }

  /**
   * Context7 Main Validation Method
   * Validates context safety using 2025 best practices
   */
  async validateContextSafety(context: string, sessionId?: string): Promise<ContextValidationResult> {
    const startTime = performance.now();

    try {
      // Step 1: Basic token counting and length validation
      const tokenCount = this.estimateTokenCount(context);

      // Step 2: Context7 Pattern: Multi-dimensional safety analysis
      const [coherenceScore, poisoningRisk, adversarialScore] = await Promise.all([
        this.calculateCoherenceScore(context),
        this.detectContextPoisoning(context),
        this.detectAdversarialPatterns(context)
      ]);

      // Step 3: Performance scoring based on historical data
      const performanceScore = this.calculatePerformanceScore(tokenCount, coherenceScore);

      // Step 4: Determine overall safety level
      const safetyLevel = this.determineSafetyLevel(tokenCount, coherenceScore, poisoningRisk, adversarialScore);

      // Step 5: Generate validation result
      const safetyMetrics: ContextSafetyMetrics = {
        tokenCount,
        coherenceScore,
        poisoningRisk,
        adversarialScore,
        performanceScore,
        safetyLevel
      };

      const result: ContextValidationResult = {
        isValid: safetyLevel !== 'CRITICAL' && safetyLevel !== 'DANGER',
        safetyMetrics,
        warnings: this.generateWarnings(safetyMetrics),
        errors: this.generateErrors(safetyMetrics),
        fallbackRecommended: safetyLevel === 'DANGER' || safetyLevel === 'CRITICAL',
        optimizationSuggestions: this.generateOptimizationSuggestions(safetyMetrics, context)
      };

      // Step 6: Update performance history
      const processingTime = performance.now() - startTime;
      this.updatePerformanceHistory(processingTime);

      // Step 7: Log validation for monitoring (Context7 Best Practice)
      this.logValidationResult(result, sessionId, processingTime);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';

      return {
        isValid: false,
        safetyMetrics: {
          tokenCount: this.estimateTokenCount(context),
          coherenceScore: 0,
          poisoningRisk: 1.0,
          adversarialScore: 1.0,
          performanceScore: 0,
          safetyLevel: 'CRITICAL'
        },
        warnings: [],
        errors: [`Validation failed: ${errorMessage}`],
        fallbackRecommended: true,
        optimizationSuggestions: ['Use native context management until validation is fixed']
      };
    }
  }

  /**
   * Context7 Pattern: Token estimation using approximation
   * Research shows ~4 chars per token average
   */
  private estimateTokenCount(context: string): number {
    // Basic approximation: 4 characters per token
    const basicEstimate = Math.ceil(context.length / 4);

    // Adjust for whitespace and punctuation
    const whitespaceCount = (context.match(/\s+/g) || []).length;
    const punctuationCount = (context.match(/[.!?,:;(){}[\]]/g) || []).length;

    return basicEstimate + whitespaceCount * 0.5 + punctuationCount * 0.3;
  }

  /**
   * Context7 Pattern: Coherence scoring based on semantic patterns
   */
  private async calculateCoherenceScore(context: string): Promise<number> {
    // Simple coherence metrics (in production would use more sophisticated NLP)
    const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 0);

    if (sentences.length === 0) return 0;

    // Measure sentence length variation (coherent text has moderate variation)
    const sentenceLengths = sentences.map(s => s.trim().length);
    const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const variance = sentenceLengths.reduce((acc, len) => acc + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
    const stdDev = Math.sqrt(variance);

    // Coherence score based on length variation (0-1 scale)
    const lengthCoherence = Math.max(0, 1 - (stdDev / avgLength));

    // Check for repetitive patterns (incoherent text often repeats)
    const repetitionScore = this.calculateRepetitionScore(context);

    // Check for logical flow indicators
    const flowScore = this.calculateFlowScore(context);

    // Weighted combination
    return (lengthCoherence * 0.4 + repetitionScore * 0.3 + flowScore * 0.3);
  }

  /**
   * Context7 Pattern: Context poisoning detection
   */
  private async detectContextPoisoning(context: string): Promise<number> {
    let poisoningScore = 0;

    // Check for excessive repetition (sign of poisoning)
    const repetitionCount = this.countExcessiveRepetitions(context);
    poisoningScore += Math.min(repetitionCount / 100, 0.5);

    // Check for malformed patterns
    const malformedPatterns = this.detectMalformedPatterns(context);
    poisoningScore += malformedPatterns * 0.1;

    // Check for context confusion patterns (Context7 research)
    const confusionPatterns = this.detectConfusionPatterns(context);
    poisoningScore += confusionPatterns * 0.15;

    return Math.min(poisoningScore, 1.0);
  }

  /**
   * Context7 Pattern: Adversarial pattern detection
   */
  private async detectAdversarialPatterns(context: string): Promise<number> {
    if (!this.config.enableAdversarialDetection) return 0;

    let adversarialScore = 0;

    // Check known adversarial patterns
    for (const pattern of this.ADVERSARIAL_PATTERNS) {
      const matches = context.match(pattern);
      if (matches) {
        adversarialScore += matches.length * 0.2;
      }
    }

    // Check for prompt injection attempts
    const injectionScore = this.detectPromptInjection(context);
    adversarialScore += injectionScore;

    return Math.min(adversarialScore, 1.0);
  }

  /**
   * Context7 Pattern: Performance scoring based on research findings
   */
  private calculatePerformanceScore(tokenCount: number, coherenceScore: number): number {
    // Context7 Research: Performance degrades significantly after 32k tokens
    const tokenScore = tokenCount < 16000 ? 1.0 :
                     tokenCount < 32000 ? 0.8 :
                     tokenCount < 64000 ? 0.5 : 0.2;

    // Coherence contributes to performance
    const coherenceContribution = coherenceScore * 0.6;

    // Historical performance (if available)
    const historicalScore = this.performanceHistory.length > 0
      ? this.performanceHistory.slice(-10).reduce((a, b) => a + b, 0) / Math.min(this.performanceHistory.length, 10) / 1000
      : 1.0;

    return Math.min(tokenScore * 0.5 + coherenceContribution * 0.3 + historicalScore * 0.2, 1.0);
  }

  /**
   * Context7 Pattern: Safety level determination
   */
  private determineSafetyLevel(
    tokenCount: number,
    coherenceScore: number,
    poisoningRisk: number,
    adversarialScore: number
  ): ContextSafetyMetrics['safetyLevel'] {

    // Critical conditions (immediate fallback required)
    if (tokenCount > this.config.maxTokens * 1.5 ||
        adversarialScore > 0.7 ||
        poisoningRisk > 0.8) {
      return 'CRITICAL';
    }

    // Danger conditions (fallback recommended)
    if (tokenCount > this.config.maxTokens ||
        coherenceScore < 0.4 ||
        adversarialScore > this.config.maxAdversarialScore ||
        poisoningRisk > this.config.maxPoisoningRisk) {
      return 'DANGER';
    }

    // Warning conditions (monitoring required)
    if (tokenCount > this.config.maxTokens * 0.8 ||
        coherenceScore < this.config.minCoherenceScore ||
        adversarialScore > this.config.maxAdversarialScore * 0.7 ||
        poisoningRisk > this.config.maxPoisoningRisk * 0.7) {
      return 'WARNING';
    }

    return 'SAFE';
  }

  // Helper methods for pattern detection
  private calculateRepetitionScore(context: string): number {
    const words = context.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();

    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const totalWords = words.length;
    const uniqueWords = wordCounts.size;

    return Math.min(uniqueWords / totalWords, 1.0);
  }

  private calculateFlowScore(context: string): number {
    // Count transition words and logical connectors
    const transitionWords = ['however', 'therefore', 'meanwhile', 'furthermore', 'consequently', 'nevertheless'];
    let transitionCount = 0;

    transitionWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      transitionCount += (context.match(regex) || []).length;
    });

    const sentences = context.split(/[.!?]+/).length;
    return Math.min(transitionCount / sentences * 2, 1.0);
  }

  private countExcessiveRepetitions(context: string): number {
    let repetitions = 0;

    // Count patterns that appear more than 5 times
    const words = context.split(/\s+/);
    const wordCounts = new Map<string, number>();

    words.forEach(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (cleanWord.length > 3) {
        wordCounts.set(cleanWord, (wordCounts.get(cleanWord) || 0) + 1);
      }
    });

    wordCounts.forEach(count => {
      if (count > 5) repetitions += count - 5;
    });

    return repetitions;
  }

  private detectMalformedPatterns(context: string): number {
    let malformed = 0;

    // Check for malformed JSON
    const jsonMatches = context.match(/{[^}]*}/g) || [];
    jsonMatches.forEach(match => {
      try {
        JSON.parse(match);
      } catch {
        malformed++;
      }
    });

    // Check for incomplete code blocks
    const codeBlockMatches = context.match(/```[^`]*$/gm);
    if (codeBlockMatches) malformed += codeBlockMatches.length;

    return malformed;
  }

  private detectConfusionPatterns(context: string): number {
    let confusion = 0;

    // Check for contradictory statements
    const contradictionPatterns = [
      /yes.*no|no.*yes/gi,
      /true.*false|false.*true/gi,
      /enable.*disable|disable.*enable/gi
    ];

    contradictionPatterns.forEach(pattern => {
      const matches = context.match(pattern);
      if (matches) confusion += matches.length;
    });

    return confusion;
  }

  private detectPromptInjection(context: string): number {
    let injectionScore = 0;

    // Check for common injection patterns
    const injectionPatterns = [
      /system:?\s*ignore/gi,
      /new\s+instructions?:?/gi,
      /override\s+previous/gi,
      /assistant:?\s*please\s+ignore/gi
    ];

    injectionPatterns.forEach(pattern => {
      const matches = context.match(pattern);
      if (matches) injectionScore += matches.length * 0.3;
    });

    return injectionScore;
  }

  private generateWarnings(metrics: ContextSafetyMetrics): string[] {
    const warnings: string[] = [];

    if (metrics.tokenCount > this.config.maxTokens * 0.8) {
      warnings.push(`Context approaching token limit (${metrics.tokenCount}/${this.config.maxTokens})`);
    }

    if (metrics.coherenceScore < this.config.minCoherenceScore) {
      warnings.push(`Low coherence score (${metrics.coherenceScore.toFixed(3)})`);
    }

    if (metrics.poisoningRisk > this.config.maxPoisoningRisk * 0.7) {
      warnings.push(`Elevated context poisoning risk (${metrics.poisoningRisk.toFixed(3)})`);
    }

    if (metrics.adversarialScore > this.config.maxAdversarialScore * 0.5) {
      warnings.push(`Potential adversarial patterns detected (${metrics.adversarialScore.toFixed(3)})`);
    }

    return warnings;
  }

  private generateErrors(metrics: ContextSafetyMetrics): string[] {
    const errors: string[] = [];

    if (metrics.safetyLevel === 'CRITICAL') {
      errors.push('Critical safety level - context replacement blocked');
    }

    if (metrics.safetyLevel === 'DANGER') {
      errors.push('Dangerous context detected - fallback recommended');
    }

    return errors;
  }

  private generateOptimizationSuggestions(metrics: ContextSafetyMetrics, context: string): string[] {
    const suggestions: string[] = [];

    if (metrics.tokenCount > this.config.maxTokens * 0.8) {
      suggestions.push('Consider context compression or summarization');
    }

    if (metrics.coherenceScore < 0.6) {
      suggestions.push('Improve context structure and logical flow');
    }

    if (metrics.poisoningRisk > 0.5) {
      suggestions.push('Remove repetitive or malformed content');
    }

    if (metrics.performanceScore < 0.7) {
      suggestions.push('Optimize context for better LLM performance');
    }

    // Check for specific optimization opportunities
    if (this.DEGRADATION_PATTERNS.some(pattern => pattern.test(context))) {
      suggestions.push('Reduce list operations and repetitive patterns for better performance');
    }

    return suggestions;
  }

  private updatePerformanceHistory(processingTime: number): void {
    this.performanceHistory.push(processingTime);

    // Keep only last 100 measurements
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }
  }

  private logValidationResult(result: ContextValidationResult, sessionId?: string, processingTime?: number): void {
    // Context7 Best Practice: Structured logging for monitoring
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'unknown',
      safetyLevel: result.safetyMetrics.safetyLevel,
      tokenCount: result.safetyMetrics.tokenCount,
      coherenceScore: result.safetyMetrics.coherenceScore,
      poisoningRisk: result.safetyMetrics.poisoningRisk,
      adversarialScore: result.safetyMetrics.adversarialScore,
      isValid: result.isValid,
      fallbackRecommended: result.fallbackRecommended,
      processingTime: processingTime || 0,
      warningCount: result.warnings.length,
      errorCount: result.errors.length
    };

    // In production, this would go to a proper logging system
    console.log('[ContextSafetyValidator]', JSON.stringify(logEntry));
  }

  /**
   * Context7 Pattern: Get current safety configuration
   */
  getConfig(): ContextSafetyConfig {
    return { ...this.config };
  }

  /**
   * Context7 Pattern: Update safety configuration
   */
  updateConfig(newConfig: Partial<ContextSafetyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Context7 Pattern: Get performance statistics
   */
  getPerformanceStats(): {
    averageProcessingTime: number;
    minProcessingTime: number;
    maxProcessingTime: number;
    measurementCount: number;
  } {
    if (this.performanceHistory.length === 0) {
      return {
        averageProcessingTime: 0,
        minProcessingTime: 0,
        maxProcessingTime: 0,
        measurementCount: 0
      };
    }

    return {
      averageProcessingTime: this.performanceHistory.reduce((a, b) => a + b, 0) / this.performanceHistory.length,
      minProcessingTime: Math.min(...this.performanceHistory),
      maxProcessingTime: Math.max(...this.performanceHistory),
      measurementCount: this.performanceHistory.length
    };
  }
}