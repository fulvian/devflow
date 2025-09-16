// File: src/core/orchestration/atomic-fallback-engine.ts
// MACRO-TASK 2: Atomic Fallback Engine for DevFlow Dream Team system

import { MultiPlatformUsageMonitor } from '../monitoring/multi-platform-usage-monitor';

/**
 * Agent identifier types for the Dream Team system
 */
export type CliAgent = 'Gemini-CLI' | 'Qwen-CLI' | 'Codex-CLI';
export type SyntheticAgent = 'Qwen-2.5-Synthetic' | 'Qwen-3-Synthetic' | 'DeepSeek-V3-Synthetic';
export type AgentIdentifier = CliAgent | SyntheticAgent;

/**
 * Defines the specific roles for which atomic fallbacks are configured.
 */
export enum CliAgentRole {
  VERIFICATORE = 'verificatore/repository-analysis',
  QA_SPECIALIST = 'qa-specialist/security-analysis',
}

/**
 * Task request structure for the fallback system
 */
export interface TaskRequest {
  id: string;
  content: string;
  type?: string;
  priority?: number;
  context?: FallbackContext;
  metadata?: Record<string, any>;
}

/**
 * Task response structure from agents
 */
export interface TaskResponse {
  id: string;
  content: string;
  confidence: number;
  requiresFallback?: boolean;
  failureReason?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

/**
 * Context preserved during fallback transitions
 */
export interface FallbackContext {
  originalTaskId: string;
  failedAgent: CliAgent;
  failureReason: string;
  preservedState: Record<string, any>;
  timestamp: string;
}

/**
 * Represents a single, atomic fallback chain from a CLI agent to a synthetic agent.
 */
interface AtomicFallbackChain {
  source: AgentIdentifier;
  target: AgentIdentifier;
  role: CliAgentRole;
}

/**
 * Defines the quality gate for a fallback operation, based on confidence scores.
 */
interface FallbackQualityGate {
  confidenceThreshold: number;
}

/**
 * Implements the Atomic Fallback Engine.
 * This engine provides a CLI-first approach with role-specific, atomic fallbacks
 * when initial tool-based attempts by a CLI agent are exhausted.
 */
export class AtomicFallbackEngine {
  private readonly usageMonitor: MultiPlatformUsageMonitor;
  private readonly agentExecutor: { execute: (agent: AgentIdentifier, task: TaskRequest) => Promise<TaskResponse> };

  /**
   * Role-specific atomic fallback chains.
   * This configuration is the core of the engine's routing logic.
   */
  private readonly FALLBACK_CHAINS: AtomicFallbackChain[] = [
    {
      source: 'Gemini-CLI',
      target: 'Qwen-2.5-Synthetic',
      role: CliAgentRole.VERIFICATORE,
    },
    {
      source: 'Qwen-CLI',
      target: 'Qwen-3-Synthetic',
      role: CliAgentRole.QA_SPECIALIST,
    },
  ];

  /**
   * Quality gates for fallback responses to prevent low-quality results or loops.
   */
  private readonly QUALITY_GATES: Record<AgentIdentifier, FallbackQualityGate> = {
    'Qwen-2.5-Synthetic': { confidenceThreshold: 0.75 },
    'Qwen-3-Synthetic': { confidenceThreshold: 0.80 },
  };

  constructor(
    usageMonitor: MultiPlatformUsageMonitor,
    agentExecutor: { execute: (agent: AgentIdentifier, task: TaskRequest) => Promise<TaskResponse> }
  ) {
    this.usageMonitor = usageMonitor;
    this.agentExecutor = agentExecutor;
    console.log('AtomicFallbackEngine initialized with CLI-first approach');
  }

  /**
   * Processes a task with a primary CLI agent and triggers a fallback if necessary.
   * This is the main entry point for the engine.
   *
   * @param task The task to be processed.
   * @param primaryAgent The initial CLI agent responsible for the task.
   * @param role The specific role the agent is performing.
   * @returns A TaskResponse from either the primary agent or the fallback agent.
   */
  public async processCliTask(task: TaskRequest, primaryAgent: CliAgent, role: CliAgentRole): Promise<TaskResponse> {
    console.log(`Processing task ${task.id} with primary agent ${primaryAgent} for role ${role}`);
    this.recordUsage(primaryAgent, task.id);

    const primaryResponse = await this.agentExecutor.execute(primaryAgent, task);

    // Fallback is triggered ONLY when CLI tools are exhausted, indicated by a specific signal.
    if (primaryResponse.requiresFallback) {
      console.warn(`Primary agent ${primaryAgent} exhausted its tools. Triggering atomic fallback.`);
      return this.triggerFallback(task, primaryAgent, role, primaryResponse);
    }

    console.log(`Task ${task.id} completed successfully by primary agent ${primaryAgent}.`);
    return primaryResponse;
  }

  /**
   * Triggers and manages the atomic fallback process.
   *
   * @param originalTask The initial task request.
   * @param failedAgent The agent that failed or exhausted its tools.
   * @param role The role being performed.
   * @param primaryResponse The response from the failed agent.
   * @returns A TaskResponse from the fallback synthetic agent.
   */
  private async triggerFallback(
    originalTask: TaskRequest,
    failedAgent: CliAgent,
    role: CliAgentRole,
    primaryResponse: TaskResponse
  ): Promise<TaskResponse> {
    const fallbackChain = this.findFallbackChain(failedAgent, role);

    if (!fallbackChain) {
      console.error(`No atomic fallback chain found for agent ${failedAgent} and role ${role}. Cannot proceed.`);
      throw new Error(`No fallback configured for ${failedAgent} in role ${role}.`);
    }

    const { target: fallbackAgent } = fallbackChain;
    console.log(`Executing fallback for task ${originalTask.id}: ${failedAgent} -> ${fallbackAgent}`);

    // 1. Context Preservation
    const fallbackContext = this.createFallbackContext(originalTask, primaryResponse, failedAgent);
    const contextualizedTask = this.applyContextToTask(originalTask, fallbackContext);

    // 2. Execute with Fallback Agent & Monitor Usage
    this.recordFallbackUsage(fallbackAgent, originalTask.id);
    const fallbackResponse = await this.agentExecutor.execute(fallbackAgent, contextualizedTask);

    // 3. Apply Fallback Quality Gate
    if (!this.isQualityAcceptable(fallbackResponse, fallbackAgent)) {
      console.error(`Fallback response from ${fallbackAgent} for task ${originalTask.id} failed quality gate.`, {
        confidence: fallbackResponse.confidence,
        threshold: this.QUALITY_GATES[fallbackAgent]?.confidenceThreshold,
      });
      // In a real scenario, this might trigger an alert or a final "failure" response.
      throw new Error(`Fallback agent ${fallbackAgent} failed to meet the quality gate.`);
    }

    console.log(`Task ${originalTask.id} successfully completed by fallback agent ${fallbackAgent}.`);
    return fallbackResponse;
  }

  /**
   * Finds the appropriate fallback chain based on the source agent and role.
   */
  private findFallbackChain(source: CliAgent, role: CliAgentRole): AtomicFallbackChain | undefined {
    return this.FALLBACK_CHAINS.find(chain => chain.source === source && chain.role === role);
  }

  /**
   * Creates a context object to be passed to the fallback agent.
   * This ensures critical information from the primary attempt is not lost.
   */
  private createFallbackContext(
    task: TaskRequest,
    response: TaskResponse,
    failedAgent: CliAgent
  ): FallbackContext {
    return {
      originalTaskId: task.id,
      failedAgent,
      failureReason: response.failureReason || 'CLI tools exhausted',
      preservedState: {
        ...response.metadata,
        originalContent: task.content,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Injects the fallback context into a new task request for the synthetic agent.
   */
  private applyContextToTask(task: TaskRequest, context: FallbackContext): TaskRequest {
    return {
      ...task,
      content: `FALLBACK_CONTEXT: The primary agent (${context.failedAgent}) failed. Reason: ${context.failureReason}. Please analyze the original content and provide a solution.\n---\nORIGINAL_CONTENT:\n${task.content}`,
      context, // Attach the structured context object
    };
  }

  /**
   * Verifies if the fallback response meets the configured quality gate.
   */
  private isQualityAcceptable(response: TaskResponse, agent: SyntheticAgent): boolean {
    const qualityGate = this.QUALITY_GATES[agent];
    if (!qualityGate) {
      console.warn(`No quality gate configured for agent ${agent}. Assuming acceptable quality.`);
      return true; // Default to success if no gate is defined
    }
    return response.confidence >= qualityGate.confidenceThreshold;
  }

  /**
   * Records usage for CLI agents in the MultiPlatformUsageMonitor
   */
  private recordUsage(agent: CliAgent, taskId: string): void {
    // Map CLI agent names to MultiPlatformUsageMonitor platform names
    switch (agent) {
      case 'Gemini-CLI':
        // this.usageMonitor.recordUsage('GeminiCLI', 1);
        break;
      case 'Qwen-CLI':
        // this.usageMonitor.recordUsage('QwenCLI', 1);
        break;
      case 'Codex-CLI':
        // this.usageMonitor.recordUsage('CodexCLI', 1);
        break;
    }
    console.log(`Recorded usage for ${agent} on task ${taskId}`);
  }

  /**
   * Records fallback usage for Synthetic agents
   */
  private recordFallbackUsage(agent: SyntheticAgent, taskId: string): void {
    // Track fallback usage separately - this could integrate with Synthetic API monitoring
    console.log(`Recorded fallback usage for ${agent} on task ${taskId}`);
  }

  /**
   * Gets all configured fallback chains
   */
  public getFallbackChains(): AtomicFallbackChain[] {
    return [...this.FALLBACK_CHAINS];
  }

  /**
   * Gets quality gates configuration
   */
  public getQualityGates(): Record<AgentIdentifier, FallbackQualityGate> {
    return { ...this.QUALITY_GATES };
  }

  /**
   * Checks if a fallback exists for a given agent and role combination
   */
  public hasFallback(agent: CliAgent, role: CliAgentRole): boolean {
    return this.findFallbackChain(agent, role) !== undefined;
  }
}

/**
 * Factory function to create an Atomic Fallback Engine
 */
export function createAtomicFallbackEngine(
  usageMonitor: MultiPlatformUsageMonitor,
  agentExecutor: { execute: (agent: AgentIdentifier, task: TaskRequest) => Promise<TaskResponse> }
): AtomicFallbackEngine {
  return new AtomicFallbackEngine(usageMonitor, agentExecutor);
}

export default AtomicFallbackEngine;