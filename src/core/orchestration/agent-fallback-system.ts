/**
 * Complete Agent Fallback System for DevFlow v3.1
 * Integrates Context7 and Qwen3 into existing orchestration architecture
 * 
 * Fallback Chain: Claude → Codex → Gemini → Qwen3
 * Context7 documentation enhancement for all agents
 */

import { context7Integration } from '../../integrations/context7-mcp-integration';
import { qwenIntegration } from '../../integrations/qwen-cli-integration';
import { Agent, Task, TaskType, AgentCapability, ClassificationResult } from './devflow-types';

export interface AgentFallbackConfig {
  enableContext7: boolean;
  enableQwen3: boolean;
  maxRetryAttempts: number;
  fallbackDelayMs: number;
  documentationInjection: boolean;
}

export interface AgentWithContext {
  agent: Agent;
  available: boolean;
  lastUsed: number;
  context7Enhanced: boolean;
  capabilities: AgentCapability[];
}

export interface FallbackResult {
  success: boolean;
  agent: Agent;
  result?: any;
  error?: string;
  attemptsUsed: number;
  context7Used: boolean;
  executionTime: number;
}

export class AgentFallbackSystem {
  private config: AgentFallbackConfig;
  private agents: Map<Agent, AgentWithContext> = new Map();
  private fallbackChain: Agent[] = ['claude', 'codex', 'gemini', 'qwen3'];
  private usageStats: Map<Agent, number> = new Map();

  constructor(config: AgentFallbackConfig) {
    this.config = config;
    this.initializeAgents();
  }

  /**
   * Initialize agent definitions with Context7 and Qwen3 integration
   */
  private initializeAgents(): void {
    // Claude Code - Primary agent
    this.agents.set('claude', {
      agent: 'claude',
      available: true,
      lastUsed: 0,
      context7Enhanced: false,
      capabilities: ['reasoning', 'coding', 'analysis', 'writing']
    });

    // Codex - Structured coding
    this.agents.set('codex', {
      agent: 'codex',
      available: true,
      lastUsed: 0,
      context7Enhanced: false,
      capabilities: ['coding', 'api-development', 'structured-programming']
    });

    // Gemini - Integration testing
    this.agents.set('gemini', {
      agent: 'gemini',
      available: true,
      lastUsed: 0,
      context7Enhanced: false,
      capabilities: ['integration-testing', 'cross-system-coordination', 'validation']
    });

    // Qwen3-Coder - Architecture review (NEW)
    this.agents.set('qwen3', {
      agent: 'qwen3',
      available: true,
      lastUsed: 0,
      context7Enhanced: false,
      capabilities: ['code-architecture-review', 'pattern-analysis', 'large-context-analysis']
    });

    // Initialize usage stats
    this.fallbackChain.forEach(agent => {
      this.usageStats.set(agent, 0);
    });
  }

  /**
   * Execute task with complete fallback system
   */
  public async executeWithFallback(
    task: Task,
    taskType: TaskType,
    libraries: string[] = []
  ): Promise<FallbackResult> {
    const startTime = Date.now();
    let attempts = 0;
    let context7Used = false;

    // Pre-process: Inject Context7 documentation if enabled
    if (this.config.enableContext7 && libraries.length > 0) {
      try {
        await this.injectContext7Documentation(libraries);
        context7Used = true;
        console.log(`📚 Context7 documentation injected for: ${libraries.join(', ')}`);
      } catch (error) {
        console.warn('⚠️ Context7 documentation injection failed:', error);
      }
    }

    // Execute fallback chain
    for (const agentType of this.fallbackChain) {
      attempts++;
      
      if (attempts > this.config.maxRetryAttempts) {
        break;
      }

      try {
        console.log(`🎯 Attempting execution with ${agentType} (attempt ${attempts})...`);
        
        const agent = this.agents.get(agentType);
        if (!agent || !agent.available) {
          console.log(`⏭️ ${agentType} not available, skipping...`);
          continue;
        }

        // Execute task based on agent type
        const result = await this.executeTaskWithAgent(agentType, task, taskType);
        
        if (result) {
          // Success - update stats and return
          this.updateAgentStats(agentType, true);
          
          return {
            success: true,
            agent: agentType,
            result,
            attemptsUsed: attempts,
            context7Used,
            executionTime: Date.now() - startTime
          };
        }

      } catch (error) {
        console.error(`❌ ${agentType} execution failed:`, error);
        this.updateAgentStats(agentType, false);
        
        // Add delay before next fallback attempt
        if (attempts < this.config.maxRetryAttempts) {
          await this.delay(this.config.fallbackDelayMs);
        }
      }
    }

    // All agents failed
    return {
      success: false,
      agent: 'none',
      error: `All agents in fallback chain failed after ${attempts} attempts`,
      attemptsUsed: attempts,
      context7Used,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Execute task with specific agent
   */
  private async executeTaskWithAgent(
    agentType: Agent,
    task: Task,
    taskType: TaskType
  ): Promise<any> {
    switch (agentType) {
      case 'claude':
        return await this.executeWithClaude(task, taskType);
        
      case 'codex':
        return await this.executeWithCodex(task, taskType);
        
      case 'gemini':
        return await this.executeWithGemini(task, taskType);
        
      case 'qwen3':
        return await this.executeWithQwen3(task, taskType);
        
      default:
        throw new Error(`Unknown agent type: ${agentType}`);
    }
  }

  /**
   * Execute with Claude Code (primary agent)
   */
  private async executeWithClaude(task: Task, taskType: TaskType): Promise<any> {
    // This would integrate with actual Claude Code API/session
    // For now, return mock implementation
    console.log('🧠 Executing with Claude Code...');
    
    // Simulate Claude Code execution
    return {
      agent: 'claude',
      result: `Claude execution result for task: ${task.description}`,
      taskType,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute with Codex (structured coding)
   */
  private async executeWithCodex(task: Task, taskType: TaskType): Promise<any> {
    console.log('⚙️ Executing with Codex...');
    
    // This would integrate with OpenAI Codex API
    return {
      agent: 'codex',
      result: `Codex execution result for task: ${task.description}`,
      taskType,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute with Gemini (integration testing)
   */
  private async executeWithGemini(task: Task, taskType: TaskType): Promise<any> {
    console.log('🔄 Executing with Gemini...');
    
    // This would integrate with Google Gemini API
    return {
      agent: 'gemini',
      result: `Gemini execution result for task: ${task.description}`,
      taskType,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Execute with Qwen3-Coder (architecture review)
   */
  private async executeWithQwen3(task: Task, taskType: TaskType): Promise<any> {
    console.log('🏗️ Executing with Qwen3-Coder...');
    
    if (!this.config.enableQwen3) {
      throw new Error('Qwen3 integration is disabled');
    }

    try {
      // Ensure Qwen CLI is set up
      const status = qwenIntegration.getStatus();
      if (!status.configured) {
        await qwenIntegration.setup();
      }

      // Execute based on task type
      let result;
      if (taskType === 'code-review' || taskType === 'architecture-analysis') {
        result = await qwenIntegration.reviewCodeArchitecture(
          task.context || task.description,
          task.filePath
        );
      } else {
        result = await qwenIntegration.analyzeCode(
          task.context || task.description,
          'patterns'
        );
      }

      return {
        agent: 'qwen3',
        result,
        model: status.model,
        taskType,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Qwen3 execution failed:', error);
      throw error;
    }
  }

  /**
   * Inject Context7 documentation for specified libraries
   */
  private async injectContext7Documentation(libraries: string[]): Promise<void> {
    if (!this.config.documentationInjection) {
      return;
    }

    try {
      // Ensure Context7 server is running
      const isHealthy = await context7Integration.healthCheck();
      if (!isHealthy) {
        await context7Integration.startServer();
      }

      // Use Context7 to get documentation
      const documentation = await context7Integration.useContext7(libraries);
      
      // Mark agents as enhanced with Context7
      this.agents.forEach((agent, agentType) => {
        agent.context7Enhanced = true;
      });

      console.log(`✅ Context7 documentation enhanced for ${Object.keys(documentation).length} libraries`);

    } catch (error) {
      console.warn('⚠️ Context7 documentation injection failed:', error);
      throw error;
    }
  }

  /**
   * Update agent usage statistics
   */
  private updateAgentStats(agent: Agent, success: boolean): void {
    const currentUsage = this.usageStats.get(agent) || 0;
    this.usageStats.set(agent, currentUsage + 1);
    
    const agentInfo = this.agents.get(agent);
    if (agentInfo) {
      agentInfo.lastUsed = Date.now();
    }

    console.log(`📊 ${agent} usage: ${this.usageStats.get(agent)} (${success ? 'success' : 'failed'})`);
  }

  /**
   * Get current fallback system status
   */
  public getStatus(): {
    agents: { [key: string]: AgentWithContext };
    usageStats: { [key: string]: number };
    config: AgentFallbackConfig;
    context7Status: any;
    qwen3Status: any;
  } {
    const agentsObj: { [key: string]: AgentWithContext } = {};
    const usageObj: { [key: string]: number } = {};

    this.agents.forEach((agent, key) => {
      agentsObj[key] = agent;
    });

    this.usageStats.forEach((usage, key) => {
      usageObj[key] = usage;
    });

    return {
      agents: agentsObj,
      usageStats: usageObj,
      config: this.config,
      context7Status: context7Integration.getStatus(),
      qwen3Status: qwenIntegration.getStatus()
    };
  }

  /**
   * Health check for all agents
   */
  public async healthCheck(): Promise<{ [key: string]: boolean }> {
    const health: { [key: string]: boolean } = {};

    // Check Claude (assume always available if DevFlow is running)
    health.claude = true;

    // Check Codex (would need actual API check)
    health.codex = true; // Mock for now

    // Check Gemini (would need actual API check)
    health.gemini = true; // Mock for now

    // Check Qwen3
    health.qwen3 = await qwenIntegration.healthCheck();

    // Check Context7
    health.context7 = await context7Integration.healthCheck();

    return health;
  }

  /**
   * Setup all integrations
   */
  public async setup(): Promise<void> {
    try {
      console.log('🚀 Setting up complete agent fallback system...');

      // Setup Context7 if enabled
      if (this.config.enableContext7) {
        await context7Integration.install();
        console.log('✅ Context7 MCP integration ready');
      }

      // Setup Qwen3 if enabled
      if (this.config.enableQwen3) {
        await qwenIntegration.setup();
        console.log('✅ Qwen3 CLI integration ready');
      }

      console.log('🎉 Complete agent fallback system setup finished');
      console.log(`   Fallback chain: ${this.fallbackChain.join(' → ')}`);
      console.log(`   Context7 enhanced: ${this.config.enableContext7 ? 'Yes' : 'No'}`);
      console.log(`   Qwen3 integrated: ${this.config.enableQwen3 ? 'Yes' : 'No'}`);

    } catch (error) {
      console.error('❌ Agent fallback system setup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up all resources
   */
  public async cleanup(): Promise<void> {
    try {
      await context7Integration.cleanup();
      await qwenIntegration.cleanup();
      console.log('✅ Agent fallback system cleaned up');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * Utility: Add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default configuration
export const DEFAULT_FALLBACK_CONFIG: AgentFallbackConfig = {
  enableContext7: true,
  enableQwen3: true,
  maxRetryAttempts: 4, // One attempt per agent in chain
  fallbackDelayMs: 2000, // 2 second delay between attempts
  documentationInjection: true
};

// Singleton instance for global access
export const agentFallbackSystem = new AgentFallbackSystem(DEFAULT_FALLBACK_CONFIG);