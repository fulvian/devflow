/**
 * Fallback Engine - Intelligent agent substitution and failure recovery
 * Part of DevFlow Dream Team Fallback System
 */

import { AgentHealthMonitor, AgentType, AgentHealthStatus } from './agent-health-monitor';

export type TaskType = 'implementation' | 'documentation' | 'testing' | 'architecture' | 'analysis';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  type: TaskType;
  priority: TaskPriority;
  complexity: number; // 0.0-1.0
  estimatedTokens: number;
  dependencies: string[];
  context: any;
  originalAgent?: AgentType;
}

export interface FallbackResult {
  selectedAgent: AgentType;
  fallbackLevel: number; // 0 = primary, 1 = first fallback, etc.
  reason: string;
  strategy: FallbackStrategy;
  degradedMode: boolean;
  estimatedImpact: string;
}

export type FallbackStrategy = 'compatible_substitution' | 'degraded_operation' | 'task_decomposition' | 'emergency_mode';

export class FallbackEngine {
  private healthMonitor: AgentHealthMonitor;

  // Fallback hierarchy matrix
  private readonly fallbackMatrix: Map<AgentType, AgentType[]> = new Map([
    ['codex', ['synthetic', 'qwen', 'gemini', 'claude']],
    ['gemini', ['synthetic', 'qwen', 'claude']],
    ['qwen', ['synthetic', 'gemini', 'claude']],
    ['synthetic', ['claude']], // Synthetic is the universal fallback
    ['claude', []] // Claude has no fallback (always available)
  ]);

  // Agent compatibility matrix by task type
  private readonly compatibilityMatrix: Map<TaskType, AgentType[]> = new Map([
    ['implementation', ['codex', 'synthetic', 'qwen', 'gemini']],
    ['documentation', ['gemini', 'synthetic', 'qwen', 'claude']],
    ['testing', ['qwen', 'synthetic', 'gemini', 'claude']],
    ['architecture', ['claude', 'gemini', 'synthetic']],
    ['analysis', ['claude', 'gemini', 'synthetic', 'qwen']]
  ]);

  // Agent specialization scores (0.0-1.0)
  private readonly specializationScores: Map<AgentType, Map<TaskType, number>> = new Map([
    ['codex', new Map([
      ['implementation', 0.95],
      ['documentation', 0.6],
      ['testing', 0.7],
      ['architecture', 0.8],
      ['analysis', 0.7]
    ])],
    ['gemini', new Map([
      ['implementation', 0.7],
      ['documentation', 0.95],
      ['testing', 0.6],
      ['architecture', 0.8],
      ['analysis', 0.9]
    ])],
    ['qwen', new Map([
      ['implementation', 0.8],
      ['documentation', 0.7],
      ['testing', 0.95],
      ['architecture', 0.6],
      ['analysis', 0.8]
    ])],
    ['synthetic', new Map([
      ['implementation', 0.85],
      ['documentation', 0.8],
      ['testing', 0.8],
      ['architecture', 0.7],
      ['analysis', 0.75]
    ])],
    ['claude', new Map([
      ['implementation', 0.6],
      ['documentation', 0.8],
      ['testing', 0.7],
      ['architecture', 0.95],
      ['analysis', 0.9]
    ])]
  ]);

  constructor(healthMonitor: AgentHealthMonitor) {
    this.healthMonitor = healthMonitor;
  }

  /**
   * Main fallback resolution method
   */
  async resolveFallback(task: Task, primaryAgent: AgentType): Promise<FallbackResult> {
    console.log(`[FALLBACK-ENGINE] Resolving fallback for task ${task.id}, primary agent: ${primaryAgent}`);

    // Check if primary agent is available
    if (!this.healthMonitor.requiresFallback(primaryAgent)) {
      return {
        selectedAgent: primaryAgent,
        fallbackLevel: 0,
        reason: 'Primary agent available',
        strategy: 'compatible_substitution',
        degradedMode: false,
        estimatedImpact: 'No impact'
      };
    }

    // Strategy 1: Compatible Agent Substitution
    const compatibleResult = this.tryCompatibleSubstitution(task, primaryAgent);
    if (compatibleResult) {
      return compatibleResult;
    }

    // Strategy 2: Degraded Mode Operation
    if (task.priority !== 'critical') {
      const degradedResult = this.tryDegradedMode(task, primaryAgent);
      if (degradedResult) {
        return degradedResult;
      }
    }

    // Strategy 3: Task Decomposition
    if (task.complexity > 0.7 && task.type === 'implementation') {
      const decompositionResult = this.tryTaskDecomposition(task);
      if (decompositionResult) {
        return decompositionResult;
      }
    }

    // Strategy 4: Emergency Mode (Claude always available)
    return this.emergencyMode(task);
  }

  /**
   * Strategy 1: Find compatible agent based on task type and specialization
   */
  private tryCompatibleSubstitution(task: Task, primaryAgent: AgentType): FallbackResult | null {
    const compatibleAgents = this.compatibilityMatrix.get(task.type) || [];
    const fallbackCandidates = this.fallbackMatrix.get(primaryAgent) || [];

    // Find best fallback from compatible agents
    for (let i = 0; i < fallbackCandidates.length; i++) {
      const candidate = fallbackCandidates[i];

      if (compatibleAgents.includes(candidate) && !this.healthMonitor.requiresFallback(candidate)) {
        const specializationScore = this.getSpecializationScore(candidate, task.type);
        const qualityImpact = this.calculateQualityImpact(primaryAgent, candidate, task.type);

        console.log(`[FALLBACK-ENGINE] Compatible substitution: ${primaryAgent} → ${candidate} (specialization: ${specializationScore.toFixed(2)})`);

        return {
          selectedAgent: candidate,
          fallbackLevel: i + 1,
          reason: `Compatible agent substitution - specialization score: ${specializationScore.toFixed(2)}`,
          strategy: 'compatible_substitution',
          degradedMode: qualityImpact > 0.2,
          estimatedImpact: qualityImpact > 0.2 ? 'Minor quality degradation' : 'Quality maintained'
        };
      }
    }

    return null;
  }

  /**
   * Strategy 2: Degraded mode with reduced expectations
   */
  private tryDegradedMode(task: Task, primaryAgent: AgentType): FallbackResult | null {
    const availableAgents = this.healthMonitor.getAvailableAgents();

    // Find any available agent that can handle the task type
    const compatibleAgents = this.compatibilityMatrix.get(task.type) || [];
    const degradedCandidates = availableAgents.filter(agent =>
      compatibleAgents.includes(agent) && agent !== primaryAgent
    );

    if (degradedCandidates.length > 0) {
      // Sort by specialization score
      const bestCandidate = degradedCandidates.sort((a, b) =>
        this.getSpecializationScore(b, task.type) - this.getSpecializationScore(a, task.type)
      )[0];

      console.log(`[FALLBACK-ENGINE] Degraded mode: ${primaryAgent} → ${bestCandidate}`);

      return {
        selectedAgent: bestCandidate,
        fallbackLevel: this.getFallbackLevel(primaryAgent, bestCandidate),
        reason: `Degraded mode operation - reduced complexity handling`,
        strategy: 'degraded_operation',
        degradedMode: true,
        estimatedImpact: 'Reduced complexity, extended timeline'
      };
    }

    return null;
  }

  /**
   * Strategy 3: Task decomposition for complex tasks
   */
  private tryTaskDecomposition(task: Task): FallbackResult | null {
    if (task.complexity <= 0.7) return null;

    const availableAgents = this.healthMonitor.getAvailableAgents();
    if (availableAgents.length < 2) return null;

    // Use Claude for orchestration of decomposed tasks
    if (availableAgents.includes('claude')) {
      console.log(`[FALLBACK-ENGINE] Task decomposition: ${task.id} → Claude orchestration`);

      return {
        selectedAgent: 'claude',
        fallbackLevel: 99, // Special indicator for decomposition
        reason: 'Complex task decomposed into manageable subtasks',
        strategy: 'task_decomposition',
        degradedMode: false,
        estimatedImpact: 'Extended timeline but quality maintained'
      };
    }

    return null;
  }

  /**
   * Strategy 4: Emergency mode - Claude handles everything
   */
  private emergencyMode(task: Task): FallbackResult {
    console.log(`[FALLBACK-ENGINE] EMERGENCY MODE activated for task ${task.id}`);

    return {
      selectedAgent: 'claude',
      fallbackLevel: 999, // Emergency indicator
      reason: 'Emergency mode - all specialized agents unavailable',
      strategy: 'emergency_mode',
      degradedMode: true,
      estimatedImpact: 'Significant impact - manual processing required'
    };
  }

  /**
   * Get specialization score for agent/task combination
   */
  private getSpecializationScore(agent: AgentType, taskType: TaskType): number {
    return this.specializationScores.get(agent)?.get(taskType) || 0.5;
  }

  /**
   * Calculate quality impact of fallback
   */
  private calculateQualityImpact(primaryAgent: AgentType, fallbackAgent: AgentType, taskType: TaskType): number {
    const primaryScore = this.getSpecializationScore(primaryAgent, taskType);
    const fallbackScore = this.getSpecializationScore(fallbackAgent, taskType);
    return Math.abs(primaryScore - fallbackScore);
  }

  /**
   * Get fallback level for agent transition
   */
  private getFallbackLevel(primaryAgent: AgentType, selectedAgent: AgentType): number {
    const fallbacks = this.fallbackMatrix.get(primaryAgent) || [];
    const index = fallbacks.indexOf(selectedAgent);
    return index >= 0 ? index + 1 : 999;
  }

  /**
   * Predict if fallback will be needed
   */
  predictFallbackNeed(agent: AgentType): { needsFallback: boolean; confidence: number; reason: string } {
    const health = this.healthMonitor.getAgentHealth(agent);
    if (!health) {
      return { needsFallback: true, confidence: 1.0, reason: 'Agent health unknown' };
    }

    let confidence = 0;
    let reasons: string[] = [];

    // Check consecutive failures
    if (health.consecutiveFailures > 0) {
      confidence += 0.3 * health.consecutiveFailures;
      reasons.push(`${health.consecutiveFailures} consecutive failures`);
    }

    // Check error rate
    if (health.errorRate > 0.1) {
      confidence += health.errorRate;
      reasons.push(`${(health.errorRate * 100).toFixed(1)}% error rate`);
    }

    // Check response time degradation
    if (health.responseTime > 20000) { // > 20s
      confidence += 0.2;
      reasons.push('Slow response times');
    }

    // Check if already degraded
    if (health.status === 'degraded') {
      confidence += 0.4;
      reasons.push('Currently degraded');
    }

    return {
      needsFallback: confidence > 0.5,
      confidence: Math.min(confidence, 1.0),
      reason: reasons.join(', ') || 'Agent healthy'
    };
  }

  /**
   * Get fallback statistics
   */
  getFallbackStats(): {
    totalAgents: number;
    availableAgents: number;
    degradedAgents: number;
    failedAgents: number;
    fallbackCapacity: { [key in TaskType]: number };
  } {
    const allAgents = Array.from(this.fallbackMatrix.keys());
    const availableAgents = this.healthMonitor.getAvailableAgents();
    const degradedAgents = this.healthMonitor.getDegradedAgents();

    // Calculate fallback capacity per task type
    const fallbackCapacity: { [key in TaskType]: number } = {
      implementation: 0,
      documentation: 0,
      testing: 0,
      architecture: 0,
      analysis: 0
    };

    for (const taskType of Object.keys(fallbackCapacity) as TaskType[]) {
      const compatibleAgents = this.compatibilityMatrix.get(taskType) || [];
      fallbackCapacity[taskType] = compatibleAgents.filter(agent =>
        availableAgents.includes(agent)
      ).length;
    }

    return {
      totalAgents: allAgents.length,
      availableAgents: availableAgents.length,
      degradedAgents: degradedAgents.length,
      failedAgents: allAgents.length - availableAgents.length,
      fallbackCapacity
    };
  }
}