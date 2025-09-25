/**
 * Agent Classification Engine for DevFlow Cognitive System
 * 
 * This module implements intelligent agent routing with automatic delegation hierarchy:
 * Sonnet (90% usage) → Codex → Gemini → Synthetic
 * 
 * Key Features:
 * - Task classification for optimal agent assignment
 * - Usage monitoring and session limit prevention
 * - Automatic delegation based on task type and complexity
 * - Integration with existing DevFlow cognitive system
 */

// Import required modules
import { Agent, Task, TaskType, AgentCapability, ClassificationResult } from './devflow-types';
import { DevFlowCognitiveSystem } from './devflow-core';
import { TaskIDStandardizationService } from './task-id-standardization';
import { QCHoldQueue, TaskStatus, ImplementationStatus } from './phase3/qc-hold-queue';
import { AgentHealthMonitor, AgentType } from './fallback/agent-health-monitor';
import { FallbackEngine, FallbackResult } from './fallback/fallback-engine';
import { CircuitBreakerManager } from './fallback/circuit-breaker';
import { syntheticRateLimiter, SyntheticRateLimiter } from './fallback/synthetic-rate-limiter';

/**
 * MANDATORY MCP Tools whitelist - only these tools are authorized
 */
const WHITELISTED_MCP_TOOLS = [
  'synthetic_code',
  'synthetic_reasoning',
  'synthetic_context',
  'synthetic_auto',
  'synthetic_file_read',
  'synthetic_file_write',
  'synthetic_batch_operations'
] as const;

type WhitelistedMCPTool = typeof WHITELISTED_MCP_TOOLS[number];

/**
 * Configuration for the Agent Classification Engine
 */
interface AgentClassificationConfig {
  /** Sonnet usage threshold (percentage) */
  sonnetUsageThreshold: number;
  /** Maximum session duration in milliseconds (5 hours = 18000000 ms) */
  maxSessionDuration: number;
  /** Token limit for Sonnet to prevent session blocks */
  sonnetTokenLimit: number;
}

/**
 * Agent usage statistics
 */
interface AgentUsageStats {
  totalRequests: number;
  sonnetRequests: number;
  currentSessionStart: number | null;
  totalTokensUsed: number;
}

/**
 * Task classification metadata
 */
interface TaskClassification {
  primaryAgent: Agent;
  confidence: number;
  reasoning: string;
  alternativeAgents: Agent[];
}

/**
 * Agent Classification Engine
 * 
 * Manages intelligent routing of tasks to appropriate agents based on:
 * - Task type and complexity
 * - Agent capabilities
 * - Usage patterns and limits
 */
export class AgentClassificationEngine {
  private config: AgentClassificationConfig;
  private usageStats: AgentUsageStats;
  private cognitiveSystem: DevFlowCognitiveSystem;
  private agents: Map<Agent, AgentCapability[]>;
  private qcHoldQueue: QCHoldQueue;
  private healthMonitor: AgentHealthMonitor;
  private fallbackEngine: FallbackEngine;
  private circuitBreakerManager: CircuitBreakerManager;

  constructor(cognitiveSystem: DevFlowCognitiveSystem) {
    this.cognitiveSystem = cognitiveSystem;
    this.qcHoldQueue = new QCHoldQueue(); // Initialize QC Hold Queue for Phase 3

    // Initialize fallback system components
    this.healthMonitor = new AgentHealthMonitor();
    this.fallbackEngine = new FallbackEngine(this.healthMonitor);
    this.circuitBreakerManager = new CircuitBreakerManager();

    this.config = {
      sonnetUsageThreshold: 90,
      maxSessionDuration: 18000000, // 5 hours in milliseconds
      sonnetTokenLimit: 100000 // Token limit to prevent session blocks
    };

    this.usageStats = {
      totalRequests: 0,
      sonnetRequests: 0,
      currentSessionStart: null,
      totalTokensUsed: 0
    };

    console.log('[AGENT-ENGINE] Fallback system initialized and operational');

    // Initialize agent capabilities
    this.agents = new Map([
      [Agent.Sonnet, [
        AgentCapability.ARCHITECTURE_DESIGN,
        AgentCapability.TECH_LEAD_DECISIONS,
        AgentCapability.SYSTEM_OPTIMIZATION,
        AgentCapability.COMPLEX_PROBLEM_SOLVING
      ]],
      [Agent.Codex, [
        AgentCapability.CODE_GENERATION,
        AgentCapability.CODE_REVIEW,
        AgentCapability.BUG_FIXING,
        AgentCapability.TEST_IMPLEMENTATION
      ]],
      [Agent.Gemini, [
        AgentCapability.CODE_GENERATION,
        AgentCapability.DOCUMENTATION,
        AgentCapability.DEBUGGING,
        AgentCapability.SIMPLE_TASKS
      ]],
      [Agent.Synthetic, [
        AgentCapability.BASIC_CODING,
        AgentCapability.TEMPLATE_FILLING,
        AgentCapability.ROUTINE_TASKS,
        AgentCapability.SHELL_COMMANDS
      ]]
    ]);
  }

  /**
   * Classify a task and determine the optimal agent assignment
   *
   * @param task The task to classify
   * @returns Classification result with recommended agent and confidence
   */
  public async classifyTask(task: Task): Promise<ClassificationResult> {
    // MANDATORY: Validate Task ID format first
    TaskIDStandardizationService.enforceTaskIdCompliance(task.id);

    // MANDATORY: Validate MCP tools
    this.validateMCPTools(task);

    // MANDATORY: Check for CCR violations
    this.preventCCRViolations(task);

    // Update usage statistics
    this.updateUsageStats();

    // Check for session limits
    if (this.isSessionLimitExceeded()) {
      return this.handleSessionLimitExceeded(task);
    }

    // Classify the task
    const classification = await this.performTaskClassification(task);

    // FALLBACK SYSTEM: Apply fallback resolution with health monitoring
    const fallbackResult = await this.resolveFallbackAndRoute(
      classification.primaryAgent,
      task,
      classification.confidence
    );

    return {
      agent: fallbackResult.selectedAgent,
      confidence: classification.confidence * (fallbackResult.degradedMode ? 0.8 : 1.0),
      reasoning: `${classification.reasoning} | Fallback: ${fallbackResult.reason}`,
      alternativeAgents: classification.alternativeAgents,
      fallbackLevel: fallbackResult.fallbackLevel,
      degradedMode: fallbackResult.degradedMode
    };
  }

  /** 
   * Resolve fallback routing with health monitoring and circuit breaker protection
   * Maps Agent enum to AgentType for fallback engine
   * 
   * @param primaryAgent The primary recommended agent
   * @param task The task being classified
   * @param confidence Classification confidence level
   * @returns Fallback result with selected agent and metadata
   */
  private async resolveFallbackAndRoute(
    primaryAgent: Agent,
    task: Task,
    confidence: number
  ): Promise<FallbackResult> {
    // Map Agent enum to AgentType string
    const agentTypeMap: Record<Agent, AgentType> = {
      [Agent.Sonnet]: 'claude',
      [Agent.Codex]: 'codex',
      [Agent.Gemini]: 'gemini',
      [Agent.Synthetic]: 'synthetic',
      [Agent.Qwen]: 'qwen'
    };

    const primaryAgentType = agentTypeMap[primaryAgent];

    // Create fallback task object
    const fallbackTask: any = {
      id: task.id,
      type: this.mapTaskTypeToAgentType(task.type),
      priority: this.mapPriority(task.priority),
      complexity: task.complexity || 0.5,
      estimatedTokens: task.estimatedTokens || 1000,
      dependencies: task.dependencies || [],
      context: task.context || {}
    };

    try {
      // Check Synthetic rate limiting before proceeding
      if (primaryAgentType === 'synthetic' || task.type === TaskType.CODE_GENERATION) {
        const rateLimitCheck = await syntheticRateLimiter.requestCall();

        if (!rateLimitCheck.allowed) {
          console.log(`[AGENT-ROUTING] Synthetic rate limited: ${rateLimitCheck.reason}`);

          // Force fallback to alternative agent (Qwen)
          return {
            selectedAgent: 'qwen',
            fallbackLevel: 1,
            reason: `Synthetic rate limited: ${rateLimitCheck.reason}. Fallback to Qwen CLI`,
            strategy: 'compatible_substitution',
            degradedMode: false,
            estimatedImpact: 'No impact - intelligent fallback to Qwen CLI'
          };
        }

        // If throttled but allowed, add delay
        if (rateLimitCheck.delay && rateLimitCheck.delay > 0) {
          console.log(`[AGENT-ROUTING] Synthetic throttled, adding delay: ${rateLimitCheck.delay}ms`);
          await new Promise(resolve => setTimeout(resolve, rateLimitCheck.delay));
        }
      }

      // Execute with circuit breaker protection
      const fallbackResult = await this.circuitBreakerManager.executeWithProtection(
        primaryAgentType,
        async () => {
          // Use fallback engine to resolve routing
          return await this.fallbackEngine.resolveFallback(fallbackTask, primaryAgentType);
        }
      );

      // Record health monitoring
      this.healthMonitor.recordSuccess(primaryAgentType, 200); // Simulate response time

      return fallbackResult;
    } catch (error) {
      // Record failure in health monitoring
      this.healthMonitor.recordFailure(primaryAgentType, error instanceof Error ? error.message : String(error));

      // Fallback to emergency mode
      return {
        selectedAgent: 'claude',
        fallbackLevel: 999,
        reason: `Circuit breaker protection triggered: ${error instanceof Error ? error.message : String(error)}`,
        strategy: 'emergency_mode',
        degradedMode: true,
        estimatedImpact: 'Significant impact - manual processing required'
      };
    }
  }

  /**
   * Map TaskType enum to fallback engine TaskType
   * 
   * @param taskType The task type to map
   * @returns Mapped task type for fallback engine
   */
  private mapTaskTypeToAgentType(taskType: TaskType): any {
    const taskTypeMap: Partial<Record<TaskType, any>> = {
      [TaskType.ARCHITECTURE]: 'architecture',
      [TaskType.TECH_LEAD]: 'analysis',
      [TaskType.SYSTEM_DESIGN]: 'architecture',
      [TaskType.CODE_GENERATION]: 'implementation',
      [TaskType.CODE_REVIEW]: 'implementation',
      [TaskType.DEBUG]: 'testing',
      [TaskType.TEST]: 'testing',
      [TaskType.BASH]: 'implementation',
      [TaskType.DOCUMENTATION]: 'documentation'
    };

    return taskTypeMap[taskType] || 'analysis';
  }

  /**
   * Map task priority to fallback engine priority
   * 
   * @param priority The task priority to map
   * @returns Mapped priority for fallback engine
   */
  private mapPriority(priority: any): any {
    const priorityMap: Record<string, any> = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };

    return priorityMap[priority] || 'medium';
  }

  /**
   * Update usage statistics for monitoring
   */
  private updateUsageStats(): void {
    this.usageStats.totalRequests++;
    
    // Reset session if it's the first request
    if (this.usageStats.currentSessionStart === null) {
      this.usageStats.currentSessionStart = Date.now();
    }
  }

  /**
   * Check if session limits have been exceeded
   * 
   * @returns true if session limits exceeded, false otherwise
   */
  private isSessionLimitExceeded(): boolean {
    // Check session duration
    if (this.usageStats.currentSessionStart !== null) {
      const sessionDuration = Date.now() - this.usageStats.currentSessionStart;
      if (sessionDuration > this.config.maxSessionDuration) {
        return true;
      }
    }

    // Check Sonnet usage threshold
    if (this.usageStats.totalRequests > 0) {
      const sonnetUsagePercentage = (this.usageStats.sonnetRequests / this.usageStats.totalRequests) * 100;
      return sonnetUsagePercentage > this.config.sonnetUsageThreshold;
    }

    return false;
  }

  /**
   * Handle exceeded session limits by delegating to alternative agents
   * 
   * @param task The task to handle
   * @returns Classification result with alternative agent
   */
  private handleSessionLimitExceeded(task: Task): ClassificationResult {
    // For session limit exceeded, delegate to next available agent
    const alternativeAgent = this.getNextAvailableAgent(Agent.Sonnet, task.type);
    
    return {
      agent: alternativeAgent,
      confidence: 0.8,
      reasoning: "Session limits exceeded, delegating to alternative agent",
      alternativeAgents: [Agent.Codex, Agent.Gemini, Agent.Synthetic].filter(a => a !== alternativeAgent)
    };
  }

  /**
   * Perform detailed task classification using cognitive system
   * 
   * @param task The task to classify
   * @returns Task classification result
   */
  private async performTaskClassification(task: Task): Promise<TaskClassification> {
    // Use cognitive system to analyze task
    const analysis = await this.cognitiveSystem.analyzeTask(task);
    
    // Determine primary agent based on task type
    let primaryAgent: Agent;
    let confidence: number;
    let reasoning: string;

    switch (task.type) {
      case TaskType.ARCHITECTURE:
      case TaskType.TECH_LEAD:
      case TaskType.SYSTEM_DESIGN:
        primaryAgent = Agent.Sonnet;
        confidence = 0.95;
        reasoning = "High-impact architectural task requiring tech lead expertise";
        break;
      
      case TaskType.DEBUG:
      case TaskType.TEST:
      case TaskType.BASH:
        primaryAgent = this.getSecondaryAgentForTask(task.type);
        confidence = 0.9;
        reasoning = "Debug/test/bash task suitable for secondary agents";
        break;
      
      case TaskType.CODE_GENERATION:
      case TaskType.CODE_REVIEW:
        // MANDATORY RULE: Only Synthetic agents for coding tasks
        primaryAgent = Agent.Synthetic;
        confidence = 1.0;
        reasoning = "MANDATORY: Coding tasks must be handled exclusively by Synthetic agents";
        break;
      
      default:
        // Use cognitive analysis for complex classification
        primaryAgent = analysis.recommendedAgent;
        confidence = analysis.confidence;
        reasoning = analysis.reasoning;
    }

    // Track Sonnet usage
    if (primaryAgent === Agent.Sonnet) {
      this.usageStats.sonnetRequests++;
    }

    return {
      primaryAgent,
      confidence,
      reasoning,
      alternativeAgents: this.getAlternativeAgents(primaryAgent, task.type)
    };
  }

  /**
   * Apply delegation hierarchy rules
   * 
   * @param recommendedAgent The initially recommended agent
   * @param task The task being classified
   * @param confidence Classification confidence
   * @returns Final agent assignment after applying delegation rules
   */
  private applyDelegationHierarchy(
    recommendedAgent: Agent,
    task: Task,
    confidence: number
  ): Agent {
    // If Sonnet is recommended but usage limits would be exceeded, delegate down
    if (recommendedAgent === Agent.Sonnet && this.wouldExceedUsageLimits()) {
      return this.getNextAvailableAgent(Agent.Sonnet, task.type);
    }

    // For debug/test/bash tasks, ensure they go to secondary agents
    if ([TaskType.DEBUG, TaskType.TEST, TaskType.BASH].includes(task.type)) {
      return this.getSecondaryAgentForTask(task.type);
    }

    // If confidence is low, consider alternative agents
    if (confidence < 0.7) {
      return this.getNextAvailableAgent(recommendedAgent, task.type);
    }

    return recommendedAgent;
  }

  /**
   * Check if using Sonnet would exceed usage limits
   * 
   * @returns true if usage would exceed limits, false otherwise
   */
  private wouldExceedUsageLimits(): boolean {
    const projectedSonnetRequests = this.usageStats.sonnetRequests + 1;
    const projectedTotalRequests = this.usageStats.totalRequests + 1;
    
    if (projectedTotalRequests > 0) {
      const projectedUsage = (projectedSonnetRequests / projectedTotalRequests) * 100;
      return projectedUsage > this.config.sonnetUsageThreshold;
    }
    
    return false;
  }

  /**
   * Get the next available agent in the delegation hierarchy
   * 
   * @param currentAgent The current agent in the hierarchy
   * @param taskType The type of task
   * @returns The next appropriate agent
   */
  private getNextAvailableAgent(currentAgent: Agent, taskType: TaskType): Agent {
    const hierarchy: Agent[] = [Agent.Sonnet, Agent.Codex, Agent.Gemini, Agent.Synthetic];
    const currentIndex = hierarchy.indexOf(currentAgent);
    
    // Find the next agent that can handle this task type
    for (let i = currentIndex + 1; i < hierarchy.length; i++) {
      const agent = hierarchy[i];
      if (this.canHandleTask(agent, taskType)) {
        return agent;
      }
    }
    
    // If no agent in hierarchy can handle it, go back up the hierarchy
    for (let i = 0; i < currentIndex; i++) {
      const agent = hierarchy[i];
      if (this.canHandleTask(agent, taskType)) {
        return agent;
      }
    }
    
    // Fallback to Synthetic if no other agent is suitable
    return Agent.Synthetic;
  }

  /**
   * Get secondary agent for specific task types
   * 
   * @param taskType The task type
   * @returns Appropriate secondary agent
   */
  private getSecondaryAgentForTask(taskType: TaskType): Agent {
    switch (taskType) {
      case TaskType.DEBUG:
        return Agent.Gemini;
      case TaskType.TEST:
        return Agent.Codex;
      case TaskType.BASH:
        return Agent.Synthetic;
      default:
        return Agent.Gemini;
    }
  }

  /**
   * Get alternative agents for a given primary agent and task type
   * 
   * @param primaryAgent The primary agent
   * @param taskType The task type
   * @returns List of alternative agents
   */
  private getAlternativeAgents(primaryAgent: Agent, taskType: TaskType): Agent[] {
    const allAgents = [Agent.Sonnet, Agent.Codex, Agent.Gemini, Agent.Synthetic];
    return allAgents
      .filter(agent => agent !== primaryAgent)
      .filter(agent => this.canHandleTask(agent, taskType));
  }

  /**
   * Check if an agent can handle a specific task type
   * 
   * @param agent The agent to check
   * @param taskType The task type
   * @returns true if agent can handle the task, false otherwise
   */
  private canHandleTask(agent: Agent, taskType: TaskType): boolean {
    const capabilities = this.agents.get(agent) || [];
    
    switch (taskType) {
      case TaskType.ARCHITECTURE:
      case TaskType.TECH_LEAD:
      case TaskType.SYSTEM_DESIGN:
        return capabilities.includes(AgentCapability.ARCHITECTURE_DESIGN) ||
               capabilities.includes(AgentCapability.TECH_LEAD_DECISIONS);
      
      case TaskType.CODE_GENERATION:
        return capabilities.includes(AgentCapability.CODE_GENERATION);
      
      case TaskType.CODE_REVIEW:
        return capabilities.includes(AgentCapability.CODE_REVIEW);
      
      case TaskType.DEBUG:
        return capabilities.includes(AgentCapability.DEBUGGING);
      
      case TaskType.TEST:
        return capabilities.includes(AgentCapability.TEST_IMPLEMENTATION);
      
      case TaskType.BASH:
        return capabilities.includes(AgentCapability.SHELL_COMMANDS) ||
               capabilities.includes(AgentCapability.ROUTINE_TASKS);
      
      default:
        return true; // Assume general capability for unknown task types
    }
  }

  /**
   * Reset session statistics
   */
  public resetSession(): void {
    this.usageStats = {
      totalRequests: 0,
      sonnetRequests: 0,
      currentSessionStart: Date.now(),
      totalTokensUsed: 0
    };
  }

  /**
   * Get current usage statistics
   * 
   * @returns Current usage statistics
   */
  public getUsageStats(): AgentUsageStats {
    return { ...this.usageStats };
  }

  /**
   * Update configuration
   *
   * @param newConfig Partial configuration updates
   */
  public updateConfig(newConfig: Partial<AgentClassificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * MANDATORY: Validates that all tools in a task are authorized MCP tools
   *
   * @param task - The task to validate
   * @throws {Error} If any tool is not in the whitelist
   */
  private validateMCPTools(task: Task): void {
    console.log(`[VALIDATION] Checking MCP tools for task ${task.id}`);

    if (!task.requiredTools || task.requiredTools.length === 0) {
      console.log(`[VALIDATION] No tools found in task ${task.id}, validation passed`);
      return;
    }

    const unauthorizedTools: string[] = [];

    for (const tool of task.requiredTools) {
      if (!WHITELISTED_MCP_TOOLS.includes(tool as any)) {
        unauthorizedTools.push(tool);
      }
    }

    if (unauthorizedTools.length > 0) {
      const errorMessage = `MANDATORY VIOLATION: Unauthorized MCP tools detected in task ${task.id}: ${unauthorizedTools.join(', ')}. Only these tools are permitted: ${WHITELISTED_MCP_TOOLS.join(', ')}`;
      console.error(`[VALIDATION ERROR] ${errorMessage}`);

      throw new Error(errorMessage);
    }

    console.log(`[VALIDATION] MCP tools validation passed for task ${task.id}: ${task.requiredTools.join(', ')}`);
  }

  /**
   * MANDATORY: Prevents CCR (Cross-Context Reasoning) violations
   *
   * @param task - The task to check for CCR violations
   * @throws {Error} If CCR violations are detected
   */
  private preventCCRViolations(task: Task): void {
    console.log(`[CCR-CHECK] Checking CCR violations for task ${task.id}`);

    // Check for explicit CCR requests
    if (task.content?.toLowerCase().includes('cross-context') ||
        task.content?.toLowerCase().includes('ccr')) {
      const errorMessage = `MANDATORY VIOLATION: CCR (Cross-Context Reasoning) explicitly requested in task ${task.id}`;
      console.error(`[CCR VIOLATION] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Check for system prompt manipulation attempts
    if (task.content?.toLowerCase().includes('system prompt') ||
        task.content?.toLowerCase().includes('override') ||
        task.content?.toLowerCase().includes('bypass')) {
      const errorMessage = `MANDATORY VIOLATION: System manipulation attempt detected in task ${task.id}`;
      console.error(`[CCR VIOLATION] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    // Check for unauthorized agent requests
    if (task.preferredAgent && ['SONNET', 'CODEX', 'GEMINI'].includes(task.preferredAgent) &&
        [TaskType.CODE_GENERATION, TaskType.CODE_REVIEW].includes(task.type)) {
      const errorMessage = `MANDATORY VIOLATION: Coding task cannot use ${task.preferredAgent}. Only Synthetic agents are permitted for coding tasks.`;
      console.error(`[CCR VIOLATION] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    console.log(`[CCR-CHECK] CCR validation passed for task ${task.id}`);
  }

  /**
   * PHASE 3: Trigger automatic implementation flow for coding tasks
   * Integrates with QC Hold Queue for architect review
   *
   * @param task - The task that was successfully processed
   * @param response - The agent response containing generated code
   */
  private async triggerAutomaticImplementation(task: Task, response: any): Promise<void> {
    try {
      console.log(`[AUTO-IMPLEMENTATION] Triggering automatic implementation for task ${task.id}`);

      // Convert to QC Hold Queue task format
      const qcTask = {
        id: task.id,
        title: task.type === TaskType.CODE_GENERATION ? 'Code Generation Task' : 'Code Review Task',
        description: task.content || 'Synthetic agent task',
        status: TaskStatus.READY_FOR_IMPLEMENTATION,
        implementationStatus: ImplementationStatus.CODE_GENERATED,
        generatedCode: response.content || 'Generated synthetic content',
        domain: this.classifyTaskDomain(task),
        complexity: this.assessTaskComplexity(task),
        createdBy: 'synthetic-agent',
        assignedTo: 'synthetic-agent'
      };

      // Enqueue for QC review
      await this.qcHoldQueue.enqueueTask(qcTask);

      console.log(`[AUTO-IMPLEMENTATION] Task ${task.id} enqueued for architect review`);
    } catch (error) {
      console.error(`[AUTO-IMPLEMENTATION] Failed to trigger implementation for task ${task.id}:`, error);
      // Don't throw - this is a post-processing step that shouldn't fail the main task
    }
  }

  /**
   * Classify task domain for architect assignment
   *
   * @param task - The task to classify
   * @returns Domain classification
   */
  private classifyTaskDomain(task: Task): string {
    if (task.content?.toLowerCase().includes('security') ||
        task.content?.toLowerCase().includes('auth')) {
      return 'security';
    }

    if (task.content?.toLowerCase().includes('critical') ||
        task.content?.toLowerCase().includes('production')) {
      return 'critical';
    }

    if (task.type === TaskType.CODE_GENERATION) {
      return 'development';
    }

    return 'general';
  }

  /**
   * Assess task complexity for architect assignment
   *
   * @param task - The task to assess
   * @returns Complexity level
   */
  private assessTaskComplexity(task: Task): string {
    const contentLength = task.content?.length || 0;

    if (contentLength > 1000 || task.content?.toLowerCase().includes('complex')) {
      return 'high';
    }

    if (contentLength > 500 || task.content?.toLowerCase().includes('medium')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Get QC Hold Queue instance for external access
   *
   * @returns QC Hold Queue instance
   */
  public getQCHoldQueue(): QCHoldQueue {
    return this.qcHoldQueue;
  }
}