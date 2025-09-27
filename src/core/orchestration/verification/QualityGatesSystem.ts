// quality-gates-system.ts

import { AspectVerifiersSystem } from './aspect-verifiers-system';
import { RealityCheckEngine } from './reality-check-engine';

/**
 * Quality levels representing different stages of the development lifecycle
 */
export enum QualityLevel {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

/**
 * Quality aspect types that can be measured
 */
export enum QualityAspect {
  CODE_COVERAGE = 'code_coverage',
  TEST_PASS_RATE = 'test_pass_rate',
  CODE_COMPLEXITY = 'code_complexity',
  SECURITY_VULNERABILITIES = 'security_vulnerabilities',
  PERFORMANCE_RESPONSE_TIME = 'performance_response_time',
  MAINTAINABILITY_INDEX = 'maintainability_index',
  DUPLICATION_RATE = 'duplication_rate'
}

/**
 * Threshold configuration for quality aspects
 */
export interface QualityThreshold {
  /** Minimum acceptable value */
  minValue?: number;
  /** Maximum acceptable value */
  maxValue?: number;
  /** Whether this threshold is critical (failure blocks progression) */
  isCritical: boolean;
}

/**
 * Configuration for quality gates at different levels
 */
export interface QualityGateConfig {
  /** Quality level this configuration applies to */
  level: QualityLevel;
  /** Thresholds for different quality aspects */
  thresholds: Record<QualityAspect, QualityThreshold>;
  /** Custom rules to evaluate */
  customRules?: QualityRule[];
}

/**
 * Custom quality rule definition
 */
export interface QualityRule {
  /** Unique identifier for the rule */
  id: string;
  /** Human-readable description */
  description: string;
  /** Function to evaluate the rule */
  evaluator: (metrics: QualityMetrics) => boolean;
  /** Whether failure of this rule blocks progression */
  isCritical: boolean;
}

/**
 * Quality metrics collected from various sources
 */
export interface QualityMetrics {
  /** Current quality level being evaluated */
  level: QualityLevel;
  /** Metrics for each quality aspect */
  aspects: Record<QualityAspect, number>;
  /** Custom metrics from external systems */
  customMetrics?: Record<string, any>;
  /** Timestamp when metrics were collected */
  timestamp: Date;
}

/**
 * Result of a quality gate evaluation
 */
export interface QualityGateResult {
  /** Whether the quality gate passed */
  passed: boolean;
  /** Whether progression is blocked */
  blocked: boolean;
  /** Detailed results for each aspect */
  aspectResults: Record<QualityAspect, {
    /** Measured value */
    value: number;
    /** Whether this aspect meets threshold requirements */
    passed: boolean;
    /** Whether this aspect failure blocks progression */
    isBlocking: boolean;
  }>;
  /** Results for custom rules */
  customRuleResults: Record<string, {
    /** Whether this rule passed */
    passed: boolean;
    /** Whether this rule failure blocks progression */
    isBlocking: boolean;
  }>;
  /** Overall quality score (0-100) */
  qualityScore: number;
  /** Timestamp of evaluation */
  evaluatedAt: Date;
}

/**
 * Quality gate evaluation report
 */
export interface QualityReport {
  /** Quality gate result */
  result: QualityGateResult;
  /** Metrics used for evaluation */
  metrics: QualityMetrics;
  /** Quality gate configuration used */
  config: QualityGateConfig;
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Historical quality metrics tracking
 */
export interface QualityHistoryEntry {
  /** Quality metrics */
  metrics: QualityMetrics;
  /** Evaluation result */
  result: QualityGateResult;
  /** Duration of evaluation */
  evaluationTimeMs: number;
}

/**
 * Main Quality Gates System
 */
export class QualityGatesSystem {
  private configs: Map<QualityLevel, QualityGateConfig> = new Map();
  private history: QualityHistoryEntry[] = [];
  private aspectVerifiers: AspectVerifiersSystem;
  private realityCheckEngine: RealityCheckEngine;

  /**
   * Creates a new Quality Gates System
   * @param aspectVerifiers System for verifying quality aspects
   * @param realityCheckEngine Engine for reality checks
   */
  constructor(
    aspectVerifiers: AspectVerifiersSystem,
    realityCheckEngine: RealityCheckEngine
  ) {
    this.aspectVerifiers = aspectVerifiers;
    this.realityCheckEngine = realityCheckEngine;
  }

  /**
   * Configure quality gates for a specific level
   * @param config Quality gate configuration
   */
  configureGate(config: QualityGateConfig): void {
    this.configs.set(config.level, config);
  }

  /**
   * Evaluate quality metrics against configured gates
   * @param metrics Quality metrics to evaluate
   * @returns Quality gate evaluation result
   */
  async evaluateQuality(metrics: QualityMetrics): Promise<QualityReport> {
    const startTime = Date.now();
    
    // Get configuration for the quality level
    const config = this.configs.get(metrics.level);
    if (!config) {
      throw new Error(`No quality gate configuration found for level: ${metrics.level}`);
    }

    // Verify aspects using the AspectVerifiersSystem
    const verifiedMetrics = await this.aspectVerifiers.verifyAspects(metrics);

    // Perform reality checks
    const realityCheckedMetrics = await this.realityCheckEngine.performRealityCheck(verifiedMetrics);

    // Evaluate quality aspects against thresholds
    const aspectResults: QualityGateResult['aspectResults'] = {} as any;
    let totalAspects = 0;
    let passedAspects = 0;
    let hasBlockingFailure = false;

    for (const [aspect, value] of Object.entries(realityCheckedMetrics.aspects)) {
      const threshold = config.thresholds[aspect as QualityAspect];
      if (!threshold) continue;

      totalAspects++;
      const passed = this.evaluateThreshold(value as number, threshold);
      
      if (passed) {
        passedAspects++;
      } else if (threshold.isCritical) {
        hasBlockingFailure = true;
      }

      aspectResults[aspect as QualityAspect] = {
        value: value as number,
        passed,
        isBlocking: threshold.isCritical && !passed
      };
    }

    // Evaluate custom rules
    const customRuleResults: QualityGateResult['customRuleResults'] = {};
    const customRules = config.customRules || [];
    
    for (const rule of customRules) {
      try {
        const passed = rule.evaluator(realityCheckedMetrics);
        customRuleResults[rule.id] = {
          passed,
          isBlocking: rule.isCritical && !passed
        };
        
        if (!passed && rule.isCritical) {
          hasBlockingFailure = true;
        }
      } catch (error) {
        // Failed rule evaluation is treated as rule failure
        customRuleResults[rule.id] = {
          passed: false,
          isBlocking: rule.isCritical
        };
        
        if (rule.isCritical) {
          hasBlockingFailure = true;
        }
      }
    }

    // Calculate quality score (0-100)
    const qualityScore = totalAspects > 0 ? Math.round((passedAspects / totalAspects) * 100) : 100;

    // Determine if gate passes
    const passed = !hasBlockingFailure;
    const blocked = hasBlockingFailure;

    const result: QualityGateResult = {
      passed,
      blocked,
      aspectResults,
      customRuleResults,
      qualityScore,
      evaluatedAt: new Date()
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(result, config);

    const report: QualityReport = {
      result,
      metrics: realityCheckedMetrics,
      config,
      recommendations
    };

    // Track in history
    const evaluationTimeMs = Date.now() - startTime;
    this.history.push({
      metrics: realityCheckedMetrics,
      result,
      evaluationTimeMs
    });

    // Keep only last 100 history entries
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    return report;
  }

  /**
   * Get quality history
   * @returns Historical quality entries
   */
  getQualityHistory(): QualityHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get quality trend over time
   * @param limit Number of recent entries to analyze
   * @returns Trend analysis
   */
  getQualityTrend(limit: number = 10): {
    trend: 'improving' | 'declining' | 'stable';
    averageScore: number;
    scoreChange: number;
  } {
    if (this.history.length < 2) {
      return {
        trend: 'stable',
        averageScore: 100,
        scoreChange: 0
      };
    }

    const recentEntries = this.history.slice(-limit);
    const scores = recentEntries.map(entry => entry.result.qualityScore);
    
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (scores.length < 2) {
      return {
        trend: 'stable',
        averageScore,
        scoreChange: 0
      };
    }

    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    const scoreChange = secondAvg - firstAvg;
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    
    if (scoreChange > 5) {
      trend = 'improving';
    } else if (scoreChange < -5) {
      trend = 'declining';
    }

    return {
      trend,
      averageScore,
      scoreChange
    };
  }

  /**
   * Add a custom quality rule
   * @param level Quality level to add rule to
   * @param rule Custom rule to add
   */
  addCustomRule(level: QualityLevel, rule: QualityRule): void {
    const config = this.configs.get(level);
    if (!config) {
      throw new Error(`No configuration found for quality level: ${level}`);
    }

    if (!config.customRules) {
      config.customRules = [];
    }

    config.customRules.push(rule);
    this.configs.set(level, config);
  }

  /**
   * Remove a custom quality rule
   * @param level Quality level to remove rule from
   * @param ruleId ID of rule to remove
   */
  removeCustomRule(level: QualityLevel, ruleId: string): void {
    const config = this.configs.get(level);
    if (!config) {
      throw new Error(`No configuration found for quality level: ${level}`);
    }

    if (config.customRules) {
      config.customRules = config.customRules.filter(rule => rule.id !== ruleId);
      this.configs.set(level, config);
    }
  }

  /**
   * Evaluate a value against its threshold
   * @param value Value to evaluate
   * @param threshold Threshold to compare against
   * @returns Whether the value meets threshold requirements
   */
  private evaluateThreshold(value: number, threshold: QualityThreshold): boolean {
    if (threshold.minValue !== undefined && value < threshold.minValue) {
      return false;
    }
    
    if (threshold.maxValue !== undefined && value > threshold.maxValue) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate recommendations based on quality gate results
   * @param result Quality gate result
   * @param config Configuration used
   * @returns List of recommendations
   */
  private generateRecommendations(result: QualityGateResult, config: QualityGateConfig): string[] {
    const recommendations: string[] = [];

    // Analyze aspect failures
    for (const [aspect, aspectResult] of Object.entries(result.aspectResults)) {
      if (!aspectResult.passed) {
        const threshold = config.thresholds[aspect as QualityAspect];
        if (threshold.minValue !== undefined && aspectResult.value < threshold.minValue) {
          recommendations.push(`Increase ${aspect} from ${aspectResult.value} to at least ${threshold.minValue}`);
        } else if (threshold.maxValue !== undefined && aspectResult.value > threshold.maxValue) {
          recommendations.push(`Reduce ${aspect} from ${aspectResult.value} to at most ${threshold.maxValue}`);
        }
      }
    }

    // Analyze custom rule failures
    for (const [ruleId, ruleResult] of Object.entries(result.customRuleResults)) {
      if (!ruleResult.passed) {
        const rule = config.customRules?.find(r => r.id === ruleId);
        if (rule) {
          recommendations.push(`Address custom rule: ${rule.description}`);
        }
      }
    }

    // General recommendations based on quality score
    if (result.qualityScore < 70) {
      recommendations.push('Overall quality needs significant improvement');
    } else if (result.qualityScore < 90) {
      recommendations.push('Consider improving quality to meet higher standards');
    }

    return recommendations;
  }
}

// Default configurations for different quality levels
export const DEFAULT_QUALITY_CONFIGS: QualityGateConfig[] = [
  {
    level: QualityLevel.DEVELOPMENT,
    thresholds: {
      [QualityAspect.CODE_COVERAGE]: { minValue: 60, isCritical: false },
      [QualityAspect.TEST_PASS_RATE]: { minValue: 80, isCritical: true },
      [QualityAspect.CODE_COMPLEXITY]: { maxValue: 10, isCritical: false },
      [QualityAspect.SECURITY_VULNERABILITIES]: { maxValue: 5, isCritical: true },
      [QualityAspect.PERFORMANCE_RESPONSE_TIME]: { maxValue: 500, isCritical: false },
      [QualityAspect.MAINTAINABILITY_INDEX]: { minValue: 60, isCritical: false },
      [QualityAspect.DUPLICATION_RATE]: { maxValue: 10, isCritical: false }
    }
  },
  {
    level: QualityLevel.STAGING,
    thresholds: {
      [QualityAspect.CODE_COVERAGE]: { minValue: 80, isCritical: true },
      [QualityAspect.TEST_PASS_RATE]: { minValue: 95, isCritical: true },
      [QualityAspect.CODE_COMPLEXITY]: { maxValue: 7, isCritical: true },
      [QualityAspect.SECURITY_VULNERABILITIES]: { maxValue: 1, isCritical: true },
      [QualityAspect.PERFORMANCE_RESPONSE_TIME]: { maxValue: 200, isCritical: true },
      [QualityAspect.MAINTAINABILITY_INDEX]: { minValue: 75, isCritical: true },
      [QualityAspect.DUPLICATION_RATE]: { maxValue: 5, isCritical: true }
    }
  },
  {
    level: QualityLevel.PRODUCTION,
    thresholds: {
      [QualityAspect.CODE_COVERAGE]: { minValue: 90, isCritical: true },
      [QualityAspect.TEST_PASS_RATE]: { minValue: 99, isCritical: true },
      [QualityAspect.CODE_COMPLEXITY]: { maxValue: 5, isCritical: true },
      [QualityAspect.SECURITY_VULNERABILITIES]: { maxValue: 0, isCritical: true },
      [QualityAspect.PERFORMANCE_RESPONSE_TIME]: { maxValue: 100, isCritical: true },
      [QualityAspect.MAINTAINABILITY_INDEX]: { minValue: 85, isCritical: true },
      [QualityAspect.DUPLICATION_RATE]: { maxValue: 2, isCritical: true }
    }
  }
];