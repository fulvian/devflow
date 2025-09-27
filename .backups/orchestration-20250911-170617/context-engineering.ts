/**
 * DevFlow Advanced Multi-Agent Orchestration System
 * Context Engineering Framework - Phase 1.5 Implementation
 * 
 * Four-tier context classification system for intelligent agent coordination
 */

export interface DomainMap {
  [domain: string]: {
    concepts: string[];
    relationships: Map<string, string[]>;
    patterns: string[];
  };
}

export interface PatternLibrary {
  architectural: Map<string, string>;
  design: Map<string, string>;
  implementation: Map<string, string>;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  steps: WorkflowStep[];
  dependencies: string[];
  expectedDuration: number;
}

export interface WorkflowStep {
  id: string;
  action: string;
  requiredContext: string[];
  expectedOutput: string[];
}

export interface ProcedureSet {
  [category: string]: {
    procedures: Procedure[];
    priority: number;
  };
}

export interface Procedure {
  id: string;
  name: string;
  description: string;
  steps: string[];
  requirements: string[];
}

export interface PracticeGuide {
  id: string;
  title: string;
  category: string;
  practices: string[];
  antiPatterns: string[];
}

export interface InteractionLog {
  id: string;
  timestamp: Date;
  agentType: string;
  taskId: string;
  context: any;
  outcome: 'success' | 'failure' | 'partial';
  metrics: {
    duration: number;
    tokensUsed: number;
    complexity: number;
  };
}

export interface OutcomeMap {
  [pattern: string]: {
    successRate: number;
    averageDuration: number;
    commonIssues: string[];
    optimizations: string[];
  };
}

export interface MetricsStore {
  totalInteractions: number;
  successRate: number;
  averageResponseTime: number;
  contextEfficiency: number;
  agentPerformance: Map<string, AgentMetrics>;
}

export interface AgentMetrics {
  taskCount: number;
  successRate: number;
  averageTokens: number;
  preferredContextTypes: string[];
}

export interface SystemState {
  availableAgents: string[];
  systemLoad: number;
  memoryUsage: number;
  apiLimits: Map<string, number>;
}

export interface APIRegistry {
  [service: string]: {
    endpoint: string;
    limits: {
      callsPerHour: number;
      tokensPerCall: number;
      concurrentCalls: number;
    };
    currentUsage: {
      calls: number;
      tokens: number;
      lastReset: Date;
    };
  };
}

export interface ResourceMonitor {
  cpu: number;
  memory: number;
  network: number;
  storage: number;
  apiQuotas: Map<string, number>;
}

/**
 * Four-tier context framework for DevFlow orchestration
 */
export interface DevFlowContextFramework {
  semantic: {
    codeRelationships: Map<string, string[]>;
    domainKnowledge: DomainMap;
    architecturalPatterns: PatternLibrary;
  };
  procedural: {
    workflowPatterns: WorkflowTemplate[];
    operationalProcedures: ProcedureSet;
    bestPractices: PracticeGuide[];
  };
  episodic: {
    interactionHistory: InteractionLog[];
    outcomePatterns: OutcomeMap;
    successFailureMetrics: MetricsStore;
  };
  environmental: {
    systemStates: SystemState;
    apiCapabilities: APIRegistry;
    resourceAvailability: ResourceMonitor;
  };
}

export interface ContextRelevanceScore {
  overall: number;
  semantic: number;
  procedural: number;
  episodic: number;
  environmental: number;
  factors: string[];
}

export interface ContextCompressionResult {
  compressedContext: any;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  preservedElements: string[];
  removedElements: string[];
}

/**
 * Advanced Context Manager for intelligent context selection and management
 */
export class ContextManager {
  private contextStore: DevFlowContextFramework;
  private compressionThreshold: number = 8000; // tokens
  private relevanceThreshold: number = 0.7;

  constructor(initialContext?: Partial<DevFlowContextFramework>) {
    this.contextStore = {
      semantic: {
        codeRelationships: new Map(),
        domainKnowledge: {},
        architecturalPatterns: {
          architectural: new Map(),
          design: new Map(),
          implementation: new Map()
        }
      },
      procedural: {
        workflowPatterns: [],
        operationalProcedures: {},
        bestPractices: []
      },
      episodic: {
        interactionHistory: [],
        outcomePatterns: {},
        successFailureMetrics: {
          totalInteractions: 0,
          successRate: 0,
          averageResponseTime: 0,
          contextEfficiency: 0,
          agentPerformance: new Map()
        }
      },
      environmental: {
        systemStates: {
          availableAgents: [],
          systemLoad: 0,
          memoryUsage: 0,
          apiLimits: new Map()
        },
        apiCapabilities: {},
        resourceAvailability: {
          cpu: 0,
          memory: 0,
          network: 0,
          storage: 0,
          apiQuotas: new Map()
        }
      },
      ...initialContext
    };
  }

  /**
   * Calculate context relevance score for a given task
   */
  public calculateRelevanceScore(
    taskType: string,
    taskContext: any,
    availableContext: Partial<DevFlowContextFramework>
  ): ContextRelevanceScore {
    const scores = {
      semantic: this.calculateSemanticRelevance(taskType, taskContext, availableContext.semantic),
      procedural: this.calculateProceduralRelevance(taskType, taskContext, availableContext.procedural),
      episodic: this.calculateEpisodicRelevance(taskType, taskContext, availableContext.episodic),
      environmental: this.calculateEnvironmentalRelevance(taskType, taskContext, availableContext.environmental)
    };

    const overall = (scores.semantic * 0.3 + scores.procedural * 0.25 + 
                     scores.episodic * 0.25 + scores.environmental * 0.2);

    return {
      overall,
      ...scores,
      factors: this.identifyRelevanceFactors(scores, taskType)
    };
  }

  /**
   * Intelligent context selection based on task requirements
   */
  public selectRelevantContext(
    taskType: string,
    taskContext: any,
    maxTokens: number = 8000
  ): Partial<DevFlowContextFramework> {
    const relevanceScore = this.calculateRelevanceScore(taskType, taskContext, this.contextStore);
    
    const selectedContext: Partial<DevFlowContextFramework> = {};

    // Select contexts above relevance threshold
    if (relevanceScore.semantic >= this.relevanceThreshold) {
      selectedContext.semantic = this.selectSemanticContext(taskType, taskContext);
    }
    
    if (relevanceScore.procedural >= this.relevanceThreshold) {
      selectedContext.procedural = this.selectProceduralContext(taskType, taskContext);
    }
    
    if (relevanceScore.episodic >= this.relevanceThreshold) {
      selectedContext.episodic = this.selectEpisodicContext(taskType, taskContext);
    }
    
    if (relevanceScore.environmental >= this.relevanceThreshold) {
      selectedContext.environmental = this.selectEnvironmentalContext(taskType, taskContext);
    }

    // Compress if necessary
    const estimatedTokens = this.estimateContextSize(selectedContext);
    if (estimatedTokens > maxTokens) {
      return this.compressContext(selectedContext, maxTokens).compressedContext;
    }

    return selectedContext;
  }

  /**
   * Dynamic context injection for agent coordination
   */
  public injectContextForAgent(
    agentType: string,
    taskId: string,
    baseContext: any
  ): any {
    const agentSpecificContext = this.getAgentSpecificContext(agentType);
    const taskHistory = this.getTaskHistory(taskId);
    const environmentalContext = this.getCurrentEnvironmentalContext();

    return {
      ...baseContext,
      agentSpecific: agentSpecificContext,
      taskHistory,
      environmental: environmentalContext,
      injectionMetadata: {
        timestamp: new Date(),
        agentType,
        taskId,
        contextVersion: '1.0'
      }
    };
  }

  /**
   * Cross-agent context sharing mechanism
   */
  public shareContextBetweenAgents(
    sourceAgentType: string,
    targetAgentType: string,
    sharedContext: any
  ): any {
    const sourcePreferences = this.getAgentContextPreferences(sourceAgentType);
    const targetPreferences = this.getAgentContextPreferences(targetAgentType);

    const sharedElements = this.findCommonContextElements(sourcePreferences, targetPreferences);
    
    return {
      sharedElements,
      sourceSpecific: this.filterContextForAgent(sharedContext, sourceAgentType),
      targetSpecific: this.filterContextForAgent(sharedContext, targetAgentType),
      sharingMetadata: {
        timestamp: new Date(),
        sourceAgent: sourceAgentType,
        targetAgent: targetAgentType,
        elementsShared: sharedElements.length
      }
    };
  }

  /**
   * Context compression for token limit management
   */
  public compressContext(
    context: Partial<DevFlowContextFramework>,
    maxTokens: number
  ): ContextCompressionResult {
    const originalSize = this.estimateContextSize(context);
    
    if (originalSize <= maxTokens) {
      return {
        compressedContext: context,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0,
        preservedElements: Object.keys(context),
        removedElements: []
      };
    }

    const compressionRatio = maxTokens / originalSize;
    const compressedContext = this.performCompression(context, compressionRatio);
    const compressedSize = this.estimateContextSize(compressedContext);

    return {
      compressedContext,
      originalSize,
      compressedSize,
      compressionRatio,
      preservedElements: this.identifyPreservedElements(context, compressedContext),
      removedElements: this.identifyRemovedElements(context, compressedContext)
    };
  }

  /**
   * Update context store with new information
   */
  public updateContext(
    contextType: keyof DevFlowContextFramework,
    updateData: any
  ): void {
    switch (contextType) {
      case 'semantic':
        this.updateSemanticContext(updateData);
        break;
      case 'procedural':
        this.updateProceduralContext(updateData);
        break;
      case 'episodic':
        this.updateEpisodicContext(updateData);
        break;
      case 'environmental':
        this.updateEnvironmentalContext(updateData);
        break;
    }
  }

  // Private helper methods
  private calculateSemanticRelevance(taskType: string, taskContext: any, semantic?: any): number {
    if (!semantic) return 0;
    
    // Calculate based on code relationships and domain knowledge
    const codeRelevance = this.calculateCodeRelevance(taskType, semantic.codeRelationships);
    const domainRelevance = this.calculateDomainRelevance(taskType, semantic.domainKnowledge);
    const patternRelevance = this.calculatePatternRelevance(taskType, semantic.architecturalPatterns);
    
    return (codeRelevance + domainRelevance + patternRelevance) / 3;
  }

  private calculateProceduralRelevance(taskType: string, taskContext: any, procedural?: any): number {
    if (!procedural) return 0;
    
    // Calculate based on workflows, procedures, and best practices
    const workflowRelevance = this.calculateWorkflowRelevance(taskType, procedural.workflowPatterns);
    const procedureRelevance = this.calculateProcedureRelevance(taskType, procedural.operationalProcedures);
    const practiceRelevance = this.calculatePracticeRelevance(taskType, procedural.bestPractices);
    
    return (workflowRelevance + procedureRelevance + practiceRelevance) / 3;
  }

  private calculateEpisodicRelevance(taskType: string, taskContext: any, episodic?: any): number {
    if (!episodic) return 0;
    
    // Calculate based on interaction history and outcome patterns
    const historyRelevance = this.calculateHistoryRelevance(taskType, episodic.interactionHistory);
    const outcomeRelevance = this.calculateOutcomeRelevance(taskType, episodic.outcomePatterns);
    const metricsRelevance = this.calculateMetricsRelevance(taskType, episodic.successFailureMetrics);
    
    return (historyRelevance + outcomeRelevance + metricsRelevance) / 3;
  }

  private calculateEnvironmentalRelevance(taskType: string, taskContext: any, environmental?: any): number {
    if (!environmental) return 0;
    
    // Calculate based on system state and resource availability
    const systemRelevance = this.calculateSystemRelevance(taskType, environmental.systemStates);
    const apiRelevance = this.calculateAPIRelevance(taskType, environmental.apiCapabilities);
    const resourceRelevance = this.calculateResourceRelevance(taskType, environmental.resourceAvailability);
    
    return (systemRelevance + apiRelevance + resourceRelevance) / 3;
  }

  private identifyRelevanceFactors(scores: any, taskType: string): string[] {
    const factors: string[] = [];
    
    if (scores.semantic > 0.8) factors.push('high-semantic-match');
    if (scores.procedural > 0.8) factors.push('established-workflow');
    if (scores.episodic > 0.8) factors.push('historical-success');
    if (scores.environmental > 0.8) factors.push('optimal-resources');
    
    return factors;
  }

  // Additional helper methods would continue here...
  private selectSemanticContext(taskType: string, taskContext: any): any {
    // Implementation for selecting relevant semantic context
    return this.contextStore.semantic;
  }

  private selectProceduralContext(taskType: string, taskContext: any): any {
    // Implementation for selecting relevant procedural context
    return this.contextStore.procedural;
  }

  private selectEpisodicContext(taskType: string, taskContext: any): any {
    // Implementation for selecting relevant episodic context
    return this.contextStore.episodic;
  }

  private selectEnvironmentalContext(taskType: string, taskContext: any): any {
    // Implementation for selecting relevant environmental context
    return this.contextStore.environmental;
  }

  private estimateContextSize(context: any): number {
    // Rough estimation: 4 characters per token average
    return JSON.stringify(context).length / 4;
  }

  private performCompression(context: any, ratio: number): any {
    // Implementation for intelligent context compression
    return context; // Simplified for now
  }

  private identifyPreservedElements(original: any, compressed: any): string[] {
    return Object.keys(compressed);
  }

  private identifyRemovedElements(original: any, compressed: any): string[] {
    const originalKeys = Object.keys(original);
    const compressedKeys = Object.keys(compressed);
    return originalKeys.filter(key => !compressedKeys.includes(key));
  }

  // Context update methods
  private updateSemanticContext(updateData: any): void {
    Object.assign(this.contextStore.semantic, updateData);
  }

  private updateProceduralContext(updateData: any): void {
    Object.assign(this.contextStore.procedural, updateData);
  }

  private updateEpisodicContext(updateData: any): void {
    Object.assign(this.contextStore.episodic, updateData);
  }

  private updateEnvironmentalContext(updateData: any): void {
    Object.assign(this.contextStore.environmental, updateData);
  }

  // Agent-specific methods
  private getAgentSpecificContext(agentType: string): any {
    return {
      preferences: this.getAgentContextPreferences(agentType),
      capabilities: this.getAgentCapabilities(agentType),
      limitations: this.getAgentLimitations(agentType)
    };
  }

  private getTaskHistory(taskId: string): any {
    return this.contextStore.episodic.interactionHistory.filter(
      log => log.taskId === taskId
    );
  }

  private getCurrentEnvironmentalContext(): any {
    return this.contextStore.environmental;
  }

  private getAgentContextPreferences(agentType: string): string[] {
    const preferences: { [key: string]: string[] } = {
      'code': ['semantic', 'procedural'],
      'reasoning': ['semantic', 'episodic'],
      'context': ['semantic', 'environmental'],
      'auto': ['semantic', 'procedural', 'episodic', 'environmental']
    };
    
    return preferences[agentType] || [];
  }

  private getAgentCapabilities(agentType: string): string[] {
    const capabilities: { [key: string]: string[] } = {
      'code': ['implementation', 'refactoring', 'debugging'],
      'reasoning': ['analysis', 'architecture', 'decision-making'],
      'context': ['documentation', 'analysis', 'summarization'],
      'auto': ['adaptive', 'multi-modal', 'intelligent-selection']
    };
    
    return capabilities[agentType] || [];
  }

  private getAgentLimitations(agentType: string): string[] {
    const limitations: { [key: string]: string[] } = {
      'code': ['strategic-planning', 'high-level-architecture'],
      'reasoning': ['implementation-details', 'rapid-prototyping'],
      'context': ['code-implementation', 'real-time-processing'],
      'auto': ['specialization-depth']
    };
    
    return limitations[agentType] || [];
  }

  private findCommonContextElements(source: string[], target: string[]): string[] {
    return source.filter(element => target.includes(element));
  }

  private filterContextForAgent(context: any, agentType: string): any {
    const preferences = this.getAgentContextPreferences(agentType);
    const filteredContext: any = {};
    
    preferences.forEach(contextType => {
      if (context[contextType]) {
        filteredContext[contextType] = context[contextType];
      }
    });
    
    return filteredContext;
  }

  // Relevance calculation helper methods
  private calculateCodeRelevance(taskType: string, codeRelationships?: Map<string, string[]>): number {
    if (!codeRelationships || codeRelationships.size === 0) return 0;
    
    // Simple relevance based on task type matching
    const relevantKeys = Array.from(codeRelationships.keys())
      .filter(key => key.toLowerCase().includes(taskType.toLowerCase()));
    
    return relevantKeys.length / codeRelationships.size;
  }

  private calculateDomainRelevance(taskType: string, domainKnowledge?: DomainMap): number {
    if (!domainKnowledge || Object.keys(domainKnowledge).length === 0) return 0;
    
    const relevantDomains = Object.keys(domainKnowledge)
      .filter(domain => domain.toLowerCase().includes(taskType.toLowerCase()));
    
    return relevantDomains.length / Object.keys(domainKnowledge).length;
  }

  private calculatePatternRelevance(taskType: string, patterns?: PatternLibrary): number {
    if (!patterns) return 0;
    
    const totalPatterns = patterns.architectural.size + patterns.design.size + patterns.implementation.size;
    if (totalPatterns === 0) return 0;
    
    let relevantPatterns = 0;
    
    [patterns.architectural, patterns.design, patterns.implementation].forEach(patternMap => {
      Array.from(patternMap.keys()).forEach(key => {
        if (key.toLowerCase().includes(taskType.toLowerCase())) {
          relevantPatterns++;
        }
      });
    });
    
    return relevantPatterns / totalPatterns;
  }

  private calculateWorkflowRelevance(taskType: string, workflows?: WorkflowTemplate[]): number {
    if (!workflows || workflows.length === 0) return 0;
    
    const relevantWorkflows = workflows.filter(workflow => 
      workflow.name.toLowerCase().includes(taskType.toLowerCase())
    );
    
    return relevantWorkflows.length / workflows.length;
  }

  private calculateProcedureRelevance(taskType: string, procedures?: ProcedureSet): number {
    if (!procedures || Object.keys(procedures).length === 0) return 0;
    
    const totalProcedures = Object.values(procedures)
      .reduce((sum, category) => sum + category.procedures.length, 0);
    
    if (totalProcedures === 0) return 0;
    
    let relevantProcedures = 0;
    Object.values(procedures).forEach(category => {
      category.procedures.forEach(procedure => {
        if (procedure.name.toLowerCase().includes(taskType.toLowerCase())) {
          relevantProcedures++;
        }
      });
    });
    
    return relevantProcedures / totalProcedures;
  }

  private calculatePracticeRelevance(taskType: string, practices?: PracticeGuide[]): number {
    if (!practices || practices.length === 0) return 0;
    
    const relevantPractices = practices.filter(practice => 
      practice.category.toLowerCase().includes(taskType.toLowerCase()) ||
      practice.title.toLowerCase().includes(taskType.toLowerCase())
    );
    
    return relevantPractices.length / practices.length;
  }

  private calculateHistoryRelevance(taskType: string, history?: InteractionLog[]): number {
    if (!history || history.length === 0) return 0;
    
    const relevantInteractions = history.filter(log => 
      log.taskId.toLowerCase().includes(taskType.toLowerCase())
    );
    
    return relevantInteractions.length / history.length;
  }

  private calculateOutcomeRelevance(taskType: string, outcomes?: OutcomeMap): number {
    if (!outcomes || Object.keys(outcomes).length === 0) return 0;
    
    const relevantOutcomes = Object.keys(outcomes).filter(pattern => 
      pattern.toLowerCase().includes(taskType.toLowerCase())
    );
    
    return relevantOutcomes.length / Object.keys(outcomes).length;
  }

  private calculateMetricsRelevance(taskType: string, metrics?: MetricsStore): number {
    if (!metrics || !metrics.agentPerformance) return 0;
    
    // Check if we have historical data for similar task types
    const relevantAgents = Array.from(metrics.agentPerformance.keys())
      .filter(agentType => {
        const agentMetrics = metrics.agentPerformance.get(agentType);
        return agentMetrics && agentMetrics.taskCount > 0;
      });
    
    return relevantAgents.length > 0 ? 1.0 : 0.0;
  }

  private calculateSystemRelevance(taskType: string, systemState?: SystemState): number {
    if (!systemState) return 0;
    
    // High relevance if system has capacity for the task type
    const hasCapacity = systemState.systemLoad < 0.8 && systemState.memoryUsage < 0.8;
    const hasAgents = systemState.availableAgents.length > 0;
    
    return (hasCapacity && hasAgents) ? 1.0 : 0.5;
  }

  private calculateAPIRelevance(taskType: string, apiRegistry?: APIRegistry): number {
    if (!apiRegistry || Object.keys(apiRegistry).length === 0) return 0;
    
    // Check if relevant APIs have available quotas
    const availableAPIs = Object.values(apiRegistry).filter(api => 
      api.currentUsage.calls < api.limits.callsPerHour * 0.9
    );
    
    return availableAPIs.length / Object.keys(apiRegistry).length;
  }

  private calculateResourceRelevance(taskType: string, resources?: ResourceMonitor): number {
    if (!resources) return 0;
    
    // Simple resource availability check
    const resourceScore = (
      (1 - resources.cpu / 100) +
      (1 - resources.memory / 100) +
      (1 - resources.network / 100) +
      (1 - resources.storage / 100)
    ) / 4;
    
    return Math.max(0, Math.min(1, resourceScore));
  }
}

export default ContextManager;