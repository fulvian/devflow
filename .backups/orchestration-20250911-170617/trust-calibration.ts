/**
 * DevFlow Advanced Multi-Agent Orchestration System
 * Trust Calibration Engine - Phase 1.5 Implementation
 * 
 * Adaptive trust scoring and calibration for intelligent agent delegation
 */

export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'expert';
export type ArchitecturalImpact = 'local' | 'component' | 'system' | 'critical';
export type BusinessRisk = 'low' | 'medium' | 'high' | 'critical';
export type ContextRequirement = 'minimal' | 'moderate' | 'extensive' | 'comprehensive';
export type TrustLevel = 'low' | 'medium' | 'high' | 'full';
export type AgentType = 'code' | 'reasoning' | 'context' | 'auto';

export interface TaskComplexityMatrix {
  codeComplexity: ComplexityLevel;
  architecturalImpact: ArchitecturalImpact;
  businessRisk: BusinessRisk;
  contextRequirements: ContextRequirement;
}

export interface Task {
  id: string;
  type: string;
  description: string;
  requirements: string[];
  expectedDuration: number;
  complexity?: TaskComplexityMatrix;
  assignedAgent?: AgentType;
  priority: number;
}

export interface AgentCapability {
  agentType: AgentType;
  strengths: string[];
  limitations: string[];
  optimalComplexity: ComplexityLevel[];
  successRate: number;
  averageResponseTime: number;
  tokenEfficiency: number;
}

export interface TrustCalibrationResult {
  trustLevel: TrustLevel;
  confidence: number;
  recommendedAgent: AgentType;
  alternativeAgents: AgentType[];
  reasoning: string[];
  calibrationFactors: {
    complexityScore: number;
    historicalSuccess: number;
    contextAvailability: number;
    resourceConstraints: number;
  };
}

export interface CalibrationFeedback {
  taskId: string;
  agentType: AgentType;
  actualOutcome: 'success' | 'failure' | 'partial';
  expectedOutcome: 'success' | 'failure' | 'partial';
  actualDuration: number;
  expectedDuration: number;
  tokensUsed: number;
  qualityScore: number;
  userSatisfaction: number;
  improvementSuggestions: string[];
}

export interface LearningPattern {
  pattern: string;
  frequency: number;
  successRate: number;
  contexts: string[];
  recommendations: string[];
}

/**
 * Advanced Trust Calibration Engine with adaptive complexity scoring
 */
export class TrustCalibrationEngine {
  private agentCapabilities: Map<AgentType, AgentCapability> = new Map();
  private taskHistory: Map<string, CalibrationFeedback[]> = new Map();
  private learningPatterns: LearningPattern[] = [];
  private calibrationThresholds = {
    low: 0.3,
    medium: 0.6,
    high: 0.8,
    full: 0.95
  };

  constructor() {
    this.initializeAgentCapabilities();
    this.initializeLearningPatterns();
  }

  /**
   * Calculate trust level for a task with adaptive complexity scoring
   */
  public calculateTrustLevel(task: Task): TrustCalibrationResult {
    const complexityScore = this.assessComplexity(task);
    const historicalSuccess = this.getAgentSuccessRate(task.type, task.assignedAgent);
    const contextAvailability = this.assessContextCompleteness(task);
    const resourceConstraints = this.assessResourceConstraints(task);

    const overallScore = this.adaptiveTrustCalculation(
      complexityScore,
      historicalSuccess,
      contextAvailability,
      resourceConstraints
    );

    const trustLevel = this.scoreToterustle(overallScore);
    const recommendedAgent = this.selectOptimalAgent(task, complexityScore);
    const alternativeAgents = this.getAlternativeAgents(task, recommendedAgent);

    return {
      trustLevel,
      confidence: overallScore,
      recommendedAgent,
      alternativeAgents,
      reasoning: this.generateReasoning(task, complexityScore, historicalSuccess, contextAvailability),
      calibrationFactors: {
        complexityScore,
        historicalSuccess,
        contextAvailability,
        resourceConstraints
      }
    };
  }

  /**
   * Assess task complexity across multiple dimensions
   */
  public assessComplexity(task: Task): number {
    if (task.complexity) {
      return this.calculateComplexityFromMatrix(task.complexity);
    }

    // Fallback complexity assessment based on task characteristics
    const codeComplexity = this.assessCodeComplexity(task);
    const architecturalImpact = this.assessArchitecturalImpact(task);
    const businessRisk = this.assessBusinessRisk(task);
    const contextRequirements = this.assessContextRequirements(task);

    const matrix: TaskComplexityMatrix = {
      codeComplexity,
      architecturalImpact,
      businessRisk,
      contextRequirements
    };

    return this.calculateComplexityFromMatrix(matrix);
  }

  /**
   * Get agent success rate for specific task types
   */
  public getAgentSuccessRate(taskType: string, agentType?: AgentType): number {
    if (!agentType) return 0.5; // Default neutral score

    const agent = this.agentCapabilities.get(agentType);
    if (!agent) return 0.5;

    // Check task-specific history
    const taskHistories = Array.from(this.taskHistory.values()).flat();
    const relevantHistory = taskHistories.filter(
      feedback => feedback.agentType === agentType && 
      this.isTaskTypeSimilar(taskType, feedback.taskId)
    );

    if (relevantHistory.length === 0) {
      return agent.successRate; // Use general success rate
    }

    const successCount = relevantHistory.filter(
      feedback => feedback.actualOutcome === 'success'
    ).length;

    return successCount / relevantHistory.length;
  }

  /**
   * Assess context completeness for task execution
   */
  public assessContextCompleteness(task: Task): number {
    const requiredContextTypes = this.identifyRequiredContextTypes(task);
    const availableContextTypes = this.getAvailableContextTypes();

    const coverage = requiredContextTypes.filter(
      type => availableContextTypes.includes(type)
    ).length;

    return coverage / requiredContextTypes.length;
  }

  /**
   * Assess current resource constraints
   */
  public assessResourceConstraints(task: Task): number {
    const constraints = {
      apiQuota: this.checkAPIQuotaAvailability(),
      systemLoad: this.checkSystemLoad(),
      agentAvailability: this.checkAgentAvailability(task.assignedAgent),
      memoryUsage: this.checkMemoryUsage()
    };

    const averageConstraint = Object.values(constraints).reduce((sum, val) => sum + val, 0) / 4;
    return 1 - averageConstraint; // Higher resource availability = lower constraint score
  }

  /**
   * Adaptive trust calculation with weighted factors
   */
  public adaptiveTrustCalculation(
    complexityScore: number,
    historicalSuccess: number,
    contextAvailability: number,
    resourceConstraints: number
  ): number {
    // Dynamic weight adjustment based on task characteristics
    const weights = this.calculateDynamicWeights(complexityScore);

    return (
      complexityScore * weights.complexity +
      historicalSuccess * weights.history +
      contextAvailability * weights.context +
      resourceConstraints * weights.resources
    );
  }

  /**
   * Select optimal agent based on task requirements and calibration
   */
  public selectOptimalAgent(task: Task, complexityScore: number): AgentType {
    const agentScores = new Map<AgentType, number>();

    for (const [agentType, capability] of this.agentCapabilities) {
      const score = this.calculateAgentFitScore(task, agentType, capability, complexityScore);
      agentScores.set(agentType, score);
    }

    // Return agent with highest fit score
    return Array.from(agentScores.entries())
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  /**
   * Get alternative agents for fallback scenarios
   */
  public getAlternativeAgents(task: Task, primaryAgent: AgentType): AgentType[] {
    const agentScores = new Map<AgentType, number>();
    const complexityScore = this.assessComplexity(task);

    for (const [agentType, capability] of this.agentCapabilities) {
      if (agentType === primaryAgent) continue;
      
      const score = this.calculateAgentFitScore(task, agentType, capability, complexityScore);
      agentScores.set(agentType, score);
    }

    return Array.from(agentScores.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([agentType]) => agentType);
  }

  /**
   * Process calibration feedback for continuous learning
   */
  public processFeedback(feedback: CalibrationFeedback): void {
    // Store feedback
    if (!this.taskHistory.has(feedback.taskId)) {
      this.taskHistory.set(feedback.taskId, []);
    }
    this.taskHistory.get(feedback.taskId)!.push(feedback);

    // Update agent capabilities
    this.updateAgentCapabilities(feedback);

    // Extract and update learning patterns
    this.updateLearningPatterns(feedback);

    // Adjust calibration thresholds if necessary
    this.adjustCalibrationThresholds(feedback);
  }

  /**
   * Generate learning-based recommendations
   */
  public generateRecommendations(task: Task): string[] {
    const recommendations: string[] = [];
    const complexity = this.assessComplexity(task);
    const taskType = task.type.toLowerCase();

    // Pattern-based recommendations
    const relevantPatterns = this.learningPatterns.filter(pattern =>
      pattern.contexts.some(context => 
        taskType.includes(context.toLowerCase())
      )
    );

    relevantPatterns.forEach(pattern => {
      recommendations.push(...pattern.recommendations);
    });

    // Complexity-based recommendations
    if (complexity > 0.8) {
      recommendations.push('Consider breaking down into smaller subtasks');
      recommendations.push('Allocate additional context and resources');
    }

    if (complexity < 0.3) {
      recommendations.push('Suitable for rapid execution with minimal oversight');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Pre-task calibration assessment
   */
  public preTaskCalibration(task: Task): TrustCalibrationResult {
    const calibration = this.calculateTrustLevel(task);
    
    // Add pre-task specific adjustments
    if (calibration.trustLevel === 'low') {
      // Suggest task modifications or additional resources
      calibration.reasoning.push('Consider providing additional context or breaking down the task');
    }

    return calibration;
  }

  /**
   * Real-time monitoring and adjustment during task execution
   */
  public monitorTaskProgress(
    taskId: string, 
    currentProgress: number, 
    intermediateResults: any[]
  ): { shouldContinue: boolean; adjustments: string[] } {
    const adjustments: string[] = [];
    let shouldContinue = true;

    // Check progress rate
    const expectedProgress = this.calculateExpectedProgress(taskId);
    if (currentProgress < expectedProgress * 0.5) {
      adjustments.push('Task progressing slower than expected');
      adjustments.push('Consider increasing agent autonomy or providing additional context');
    }

    // Check quality of intermediate results
    const qualityScore = this.assessIntermediateQuality(intermediateResults);
    if (qualityScore < 0.6) {
      adjustments.push('Quality concerns detected in intermediate results');
      adjustments.push('Consider switching to more capable agent or providing corrective guidance');
      
      if (qualityScore < 0.3) {
        shouldContinue = false;
        adjustments.push('Recommend task halt and reassignment');
      }
    }

    return { shouldContinue, adjustments };
  }

  /**
   * Post-task learning and system improvement
   */
  public postTaskLearning(feedback: CalibrationFeedback): void {
    this.processFeedback(feedback);

    // Generate insights for system improvement
    const insights = this.generateSystemInsights(feedback);
    
    // Update predictive models
    this.updatePredictiveModels(feedback);
    
    // Adjust agent selection algorithms
    this.refineAgentSelectionAlgorithms(feedback);
  }

  // Private implementation methods
  private initializeAgentCapabilities(): void {
    this.agentCapabilities.set('code', {
      agentType: 'code',
      strengths: ['implementation', 'refactoring', 'debugging', 'rapid-prototyping'],
      limitations: ['strategic-planning', 'high-level-architecture', 'complex-reasoning'],
      optimalComplexity: ['simple', 'moderate'],
      successRate: 0.85,
      averageResponseTime: 15000,
      tokenEfficiency: 0.8
    });

    this.agentCapabilities.set('reasoning', {
      agentType: 'reasoning',
      strengths: ['analysis', 'architecture', 'decision-making', 'strategic-planning'],
      limitations: ['implementation-details', 'rapid-prototyping', 'routine-tasks'],
      optimalComplexity: ['complex', 'expert'],
      successRate: 0.78,
      averageResponseTime: 25000,
      tokenEfficiency: 0.7
    });

    this.agentCapabilities.set('context', {
      agentType: 'context',
      strengths: ['documentation', 'analysis', 'summarization', 'large-context-processing'],
      limitations: ['code-implementation', 'real-time-processing', 'rapid-execution'],
      optimalComplexity: ['moderate', 'complex'],
      successRate: 0.82,
      averageResponseTime: 20000,
      tokenEfficiency: 0.75
    });

    this.agentCapabilities.set('auto', {
      agentType: 'auto',
      strengths: ['adaptive', 'multi-modal', 'intelligent-selection', 'versatility'],
      limitations: ['specialization-depth', 'predictability'],
      optimalComplexity: ['simple', 'moderate', 'complex'],
      successRate: 0.80,
      averageResponseTime: 18000,
      tokenEfficiency: 0.77
    });
  }

  private initializeLearningPatterns(): void {
    this.learningPatterns = [
      {
        pattern: 'code-implementation-with-context',
        frequency: 25,
        successRate: 0.88,
        contexts: ['implementation', 'coding', 'development'],
        recommendations: ['Provide architectural context', 'Include relevant code examples']
      },
      {
        pattern: 'complex-analysis-requires-reasoning',
        frequency: 18,
        successRate: 0.79,
        contexts: ['analysis', 'decision-making', 'architecture'],
        recommendations: ['Use reasoning agent', 'Provide comprehensive context']
      },
      // Additional patterns would be added based on learning
    ];
  }

  private calculateComplexityFromMatrix(matrix: TaskComplexityMatrix): number {
    const scores = {
      codeComplexity: this.mapComplexityToScore(matrix.codeComplexity),
      architecturalImpact: this.mapArchitecturalImpactToScore(matrix.architecturalImpact),
      businessRisk: this.mapBusinessRiskToScore(matrix.businessRisk),
      contextRequirements: this.mapContextRequirementsToScore(matrix.contextRequirements)
    };

    // Weighted average with emphasis on code complexity and architectural impact
    return (
      scores.codeComplexity * 0.35 +
      scores.architecturalImpact * 0.3 +
      scores.businessRisk * 0.2 +
      scores.contextRequirements * 0.15
    );
  }

  private mapComplexityToScore(complexity: ComplexityLevel): number {
    const mapping = { simple: 0.2, moderate: 0.5, complex: 0.8, expert: 1.0 };
    return mapping[complexity];
  }

  private mapArchitecturalImpactToScore(impact: ArchitecturalImpact): number {
    const mapping = { local: 0.2, component: 0.5, system: 0.8, critical: 1.0 };
    return mapping[impact];
  }

  private mapBusinessRiskToScore(risk: BusinessRisk): number {
    const mapping = { low: 0.2, medium: 0.5, high: 0.8, critical: 1.0 };
    return mapping[risk];
  }

  private mapContextRequirementsToScore(requirement: ContextRequirement): number {
    const mapping = { minimal: 0.2, moderate: 0.5, extensive: 0.8, comprehensive: 1.0 };
    return mapping[requirement];
  }

  private assessCodeComplexity(task: Task): ComplexityLevel {
    const description = task.description.toLowerCase();
    const requirements = task.requirements.join(' ').toLowerCase();
    const content = `${description} ${requirements}`;

    if (content.includes('refactor') || content.includes('optimize') || content.includes('architecture')) {
      return 'expert';
    }
    if (content.includes('complex') || content.includes('algorithm') || content.includes('system')) {
      return 'complex';
    }
    if (content.includes('implement') || content.includes('add') || content.includes('modify')) {
      return 'moderate';
    }
    return 'simple';
  }

  private assessArchitecturalImpact(task: Task): ArchitecturalImpact {
    const description = task.description.toLowerCase();
    
    if (description.includes('system') || description.includes('architecture') || description.includes('infrastructure')) {
      return 'critical';
    }
    if (description.includes('service') || description.includes('module') || description.includes('component')) {
      return 'system';
    }
    if (description.includes('function') || description.includes('method') || description.includes('class')) {
      return 'component';
    }
    return 'local';
  }

  private assessBusinessRisk(task: Task): BusinessRisk {
    const priority = task.priority;
    
    if (priority >= 8) return 'critical';
    if (priority >= 6) return 'high';
    if (priority >= 4) return 'medium';
    return 'low';
  }

  private assessContextRequirements(task: Task): ContextRequirement {
    const requirementCount = task.requirements.length;
    const descriptionLength = task.description.length;
    
    if (requirementCount > 10 || descriptionLength > 500) return 'comprehensive';
    if (requirementCount > 5 || descriptionLength > 300) return 'extensive';
    if (requirementCount > 2 || descriptionLength > 150) return 'moderate';
    return 'minimal';
  }

  private scoreToterustle(score: number): TrustLevel {
    if (score >= this.calibrationThresholds.full) return 'full';
    if (score >= this.calibrationThresholds.high) return 'high';
    if (score >= this.calibrationThresholds.medium) return 'medium';
    return 'low';
  }

  private generateReasoning(
    task: Task,
    complexityScore: number,
    historicalSuccess: number,
    contextAvailability: number
  ): string[] {
    const reasoning: string[] = [];

    if (complexityScore > 0.8) {
      reasoning.push('High complexity task requiring specialized expertise');
    }
    if (historicalSuccess > 0.9) {
      reasoning.push('Strong historical performance for similar tasks');
    }
    if (contextAvailability < 0.5) {
      reasoning.push('Limited context availability may impact execution quality');
    }
    if (complexityScore < 0.3 && historicalSuccess > 0.8) {
      reasoning.push('Low complexity task with high success probability');
    }

    return reasoning;
  }

  private identifyRequiredContextTypes(task: Task): string[] {
    const contextTypes = ['semantic', 'procedural', 'environmental'];
    
    // Add episodic context for complex tasks
    if (this.assessComplexity(task) > 0.6) {
      contextTypes.push('episodic');
    }
    
    return contextTypes;
  }

  private getAvailableContextTypes(): string[] {
    // This would query the actual context store
    return ['semantic', 'procedural', 'episodic', 'environmental'];
  }

  private checkAPIQuotaAvailability(): number {
    // This would check actual API quotas
    return 0.7; // 70% quota available
  }

  private checkSystemLoad(): number {
    // This would check actual system load
    return 0.3; // 30% system load
  }

  private checkAgentAvailability(agentType?: AgentType): number {
    // This would check actual agent availability
    return agentType ? 0.9 : 0.8; // High availability
  }

  private checkMemoryUsage(): number {
    // This would check actual memory usage
    return 0.4; // 40% memory usage
  }

  private calculateDynamicWeights(complexityScore: number): {
    complexity: number;
    history: number;
    context: number;
    resources: number;
  } {
    // Adjust weights based on complexity
    if (complexityScore > 0.8) {
      return { complexity: 0.4, history: 0.3, context: 0.2, resources: 0.1 };
    } else if (complexityScore > 0.5) {
      return { complexity: 0.3, history: 0.35, context: 0.25, resources: 0.1 };
    } else {
      return { complexity: 0.2, history: 0.4, context: 0.3, resources: 0.1 };
    }
  }

  private calculateAgentFitScore(
    task: Task,
    agentType: AgentType,
    capability: AgentCapability,
    complexityScore: number
  ): number {
    const complexity = this.assessComplexity(task);
    const complexityLevel = this.scoreToComplexityLevel(complexityScore);
    
    // Base fit score based on optimal complexity match
    let fitScore = capability.optimalComplexity.includes(complexityLevel) ? 0.8 : 0.4;
    
    // Adjust for success rate
    fitScore += capability.successRate * 0.2;
    
    // Adjust for task type alignment
    const taskTypeAlignment = this.calculateTaskTypeAlignment(task, capability);
    fitScore += taskTypeAlignment * 0.3;
    
    return Math.min(1.0, fitScore);
  }

  private scoreToComplexityLevel(score: number): ComplexityLevel {
    if (score >= 0.8) return 'expert';
    if (score >= 0.6) return 'complex';
    if (score >= 0.3) return 'moderate';
    return 'simple';
  }

  private calculateTaskTypeAlignment(task: Task, capability: AgentCapability): number {
    const taskDescription = task.description.toLowerCase();
    const taskRequirements = task.requirements.join(' ').toLowerCase();
    const taskContent = `${taskDescription} ${taskRequirements}`;
    
    const strengthMatches = capability.strengths.filter(strength =>
      taskContent.includes(strength.toLowerCase().replace('-', ' '))
    ).length;
    
    const limitationMatches = capability.limitations.filter(limitation =>
      taskContent.includes(limitation.toLowerCase().replace('-', ' '))
    ).length;
    
    const alignmentScore = (strengthMatches - limitationMatches * 0.5) / capability.strengths.length;
    return Math.max(0, Math.min(1, alignmentScore));
  }

  private isTaskTypeSimilar(taskType1: string, taskType2: string): boolean {
    const type1 = taskType1.toLowerCase();
    const type2 = taskType2.toLowerCase();
    
    return type1.includes(type2) || type2.includes(type1) ||
           this.shareCommonKeywords(type1, type2);
  }

  private shareCommonKeywords(type1: string, type2: string): boolean {
    const keywords1 = type1.split(/[\s-_]+/);
    const keywords2 = type2.split(/[\s-_]+/);
    
    const commonKeywords = keywords1.filter(keyword =>
      keywords2.includes(keyword) && keyword.length > 2
    );
    
    return commonKeywords.length > 0;
  }

  private updateAgentCapabilities(feedback: CalibrationFeedback): void {
    const agent = this.agentCapabilities.get(feedback.agentType);
    if (!agent) return;

    // Update success rate with exponential moving average
    const alpha = 0.1; // Learning rate
    const currentSuccess = feedback.actualOutcome === 'success' ? 1 : 0;
    agent.successRate = agent.successRate * (1 - alpha) + currentSuccess * alpha;

    // Update average response time
    agent.averageResponseTime = agent.averageResponseTime * (1 - alpha) + 
                               feedback.actualDuration * alpha;

    // Update token efficiency
    const tokenEfficiency = Math.min(1, feedback.expectedDuration / Math.max(feedback.tokensUsed, 1));
    agent.tokenEfficiency = agent.tokenEfficiency * (1 - alpha) + tokenEfficiency * alpha;
  }

  private updateLearningPatterns(feedback: CalibrationFeedback): void {
    // Extract patterns from successful interactions
    if (feedback.actualOutcome === 'success' && feedback.qualityScore > 0.8) {
      const pattern = this.extractPattern(feedback);
      const existingPattern = this.learningPatterns.find(p => p.pattern === pattern.pattern);
      
      if (existingPattern) {
        existingPattern.frequency++;
        existingPattern.successRate = (existingPattern.successRate + 1) / 2; // Simple update
      } else {
        this.learningPatterns.push(pattern);
      }
    }
  }

  private adjustCalibrationThresholds(feedback: CalibrationFeedback): void {
    // Adjust thresholds based on feedback patterns
    // This is a simplified implementation - in practice would use more sophisticated algorithms
    if (feedback.actualOutcome !== feedback.expectedOutcome) {
      const adjustment = 0.01;
      
      if (feedback.actualOutcome === 'success' && feedback.expectedOutcome === 'failure') {
        // Lower thresholds slightly to be less conservative
        Object.keys(this.calibrationThresholds).forEach(key => {
          this.calibrationThresholds[key as keyof typeof this.calibrationThresholds] = 
            Math.max(0.1, this.calibrationThresholds[key as keyof typeof this.calibrationThresholds] - adjustment);
        });
      }
    }
  }

  private extractPattern(feedback: CalibrationFeedback): LearningPattern {
    return {
      pattern: `${feedback.agentType}-${feedback.actualOutcome}`,
      frequency: 1,
      successRate: feedback.qualityScore,
      contexts: [feedback.taskId.split('-')[0]], // Extract context from task ID
      recommendations: feedback.improvementSuggestions
    };
  }

  private calculateExpectedProgress(taskId: string): number {
    // This would calculate expected progress based on historical data
    return 0.5; // Simplified: 50% expected at this point
  }

  private assessIntermediateQuality(intermediateResults: any[]): number {
    // This would assess quality of intermediate results
    return intermediateResults.length > 0 ? 0.75 : 0.5; // Simplified quality score
  }

  private generateSystemInsights(feedback: CalibrationFeedback): string[] {
    const insights: string[] = [];
    
    if (feedback.actualDuration > feedback.expectedDuration * 1.5) {
      insights.push('Task took significantly longer than expected - consider adjusting duration estimates');
    }
    
    if (feedback.qualityScore < 0.6) {
      insights.push('Quality concerns - may need additional agent training or context enhancement');
    }
    
    return insights;
  }

  private updatePredictiveModels(feedback: CalibrationFeedback): void {
    // Update ML models for better predictions
    // This would interface with actual ML models
  }

  private refineAgentSelectionAlgorithms(feedback: CalibrationFeedback): void {
    // Refine selection algorithms based on feedback
    // This would update the agent selection logic
  }
}

export default TrustCalibrationEngine;