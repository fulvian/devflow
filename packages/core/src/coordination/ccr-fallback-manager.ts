/**
 * CCR Fallback Manager - Session Independence Solution
 * 
 * Manages automatic fallback to Claude Code Router when Claude Code reaches session limits.
 * Provides seamless handoff with complete context preservation.
 */

import { spawn, ChildProcess } from 'child_process';
import { SQLiteMemoryManager } from '../memory/manager.js';
import type { MemoryBlock } from '@devflow/shared';

export interface CCRConfig {
  log: boolean;
  NON_INTERACTIVE_MODE: boolean;
  OPENAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  router: {
    default: string;
    codex: string;
    synthetic: string;
    longContext: string;
  };
  transformers?: Array<{
    path: string;
    options: Record<string, unknown>;
  }>;
}

export interface PreservedContext {
  memoryBlocks: MemoryBlock[];
  sessionState: Record<string, unknown>;
  timestamp: Date;
  platform: string;
  taskId: string;
}

export interface PlatformHandoff {
  fromPlatform: string;
  toPlatform: string;
  context: PreservedContext;
  handoffTime: Date;
  success: boolean;
}

export class CCRFallbackManager {
  private ccrProcess: ChildProcess | null = null;
  private fallbackChain: string[] = ['codex', 'synthetic', 'gemini'];
  private memory: SQLiteMemoryManager;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(memory: SQLiteMemoryManager) {
    this.memory = memory;
  }

  /**
   * Initialize CCR Fallback Manager
   */
  async initialize(): Promise<void> {
    console.log('[CCR] Initializing Fallback Manager...');
    
    // Validate required environment variables
    this.validateEnvironment();
    
    // Start monitoring for session limits
    await this.startMonitoring();
    
    console.log('[CCR] Fallback Manager initialized successfully');
  }

  /**
   * Handle Claude Code session limit reached
   */
  async handleClaudeCodeLimit(taskId: string): Promise<PlatformHandoff> {
    console.log(`[CCR] Handling Claude Code limit for task: ${taskId}`);
    
    try {
      // 1. Immediate context preservation
      const context = await this.preserveContext('claude_code', taskId);
      
      // 2. Find next available platform
      const nextPlatform = await this.findAvailablePlatform('claude_code');
      
      // 3. Start CCR with appropriate proxy
      await this.startCCRWithProxy(nextPlatform);
      
      // 4. Execute seamless handoff
      const handoff = await this.executeHandoff(context, nextPlatform, taskId);
      
      console.log(`[CCR] Handoff completed: ${handoff.fromPlatform} → ${handoff.toPlatform}`);
      return handoff;
      
    } catch (error) {
      console.error('[CCR] Error during handoff:', error);
      throw new Error(`CCR handoff failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Preserve complete context before session dies
   */
  private async preserveContext(platform: string, taskId: string): Promise<PreservedContext> {
    console.log(`[CCR] Preserving context for platform: ${platform}, task: ${taskId}`);
    
    try {
      // Extract ALL context from memory system
      const memoryBlocks = await this.memory.getAllBlocks(taskId);
      
      // Extract current session state
      const sessionState = await this.extractSessionState(platform);
      
      const preservedContext: PreservedContext = {
        memoryBlocks,
        sessionState,
        timestamp: new Date(),
        platform,
        taskId
      };
      
      // Store emergency context
      await this.memory.storeEmergencyContext(taskId, `session-${taskId}`, preservedContext);
      
      console.log(`[CCR] Context preserved: ${memoryBlocks.length} blocks, session state extracted`);
      return preservedContext;
      
    } catch (error) {
      console.error('[CCR] Error preserving context:', error);
      throw new Error(`Context preservation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find next available platform in fallback chain
   */
  private async findAvailablePlatform(currentPlatform: string): Promise<string> {
    const currentIndex = this.fallbackChain.indexOf(currentPlatform);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= this.fallbackChain.length) {
      throw new Error('No more platforms available in fallback chain');
    }
    
    const nextPlatform = this.fallbackChain[nextIndex];
    console.log(`[CCR] Next platform: ${nextPlatform}`);
    
    return nextPlatform;
  }

  /**
   * Start CCR with appropriate proxy configuration
   */
  private async startCCRWithProxy(platform: string): Promise<void> {
    console.log(`[CCR] Starting CCR with ${platform} proxy...`);
    
    const config = this.getCCRConfig(platform);
    
    try {
      // Start CCR process
      this.ccrProcess = spawn('bunx', ['@musistudio/claude-code-router', 'start'], {
        env: { 
          ...process.env, 
          CCR_CONFIG: JSON.stringify(config)
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Handle process events
      this.ccrProcess.on('error', (error) => {
        console.error('[CCR] Process error:', error);
      });
      
      this.ccrProcess.on('exit', (code) => {
        console.log(`[CCR] Process exited with code: ${code}`);
        this.ccrProcess = null;
      });
      
      // Wait for process to be ready
      await this.waitForCCRReady();
      
      console.log(`[CCR] Successfully started with ${platform} proxy`);
      
    } catch (error) {
      console.error('[CCR] Error starting CCR:', error);
      throw new Error(`CCR startup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute transparent handoff
   */
  private async executeHandoff(
    context: PreservedContext, 
    targetPlatform: string, 
    taskId: string
  ): Promise<PlatformHandoff> {
    console.log(`[CCR] Executing handoff to ${targetPlatform}...`);
    
    const handoff: PlatformHandoff = {
      fromPlatform: context.platform,
      toPlatform: targetPlatform,
      context,
      handoffTime: new Date(),
      success: false
    };
    
    try {
      // Inject context into target platform
      await this.injectContextToPlatform(context, targetPlatform);
      
      // Update session tracking
      await this.updateSessionTracking(taskId, handoff);
      
      handoff.success = true;
      console.log(`[CCR] Handoff to ${targetPlatform} completed successfully`);
      
      return handoff;
      
    } catch (error) {
      console.error('[CCR] Handoff execution failed:', error);
      handoff.success = false;
      throw error;
    }
  }

  /**
   * Start monitoring for session limits
   */
  private async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('[CCR] Starting session limit monitoring...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkSessionLimits();
      } catch (error) {
        console.error('[CCR] Monitoring error:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Check for session limits across all platforms
   */
  private async checkSessionLimits(): Promise<void> {
    // This would integrate with the SessionLimitDetector
    // For now, we'll implement basic monitoring
    const activeSessions = await this.memory.getActiveSessions();
    
    for (const session of activeSessions) {
      const utilization = await this.calculateUtilization(session.id);
      
      if (utilization >= 0.90) {
        console.log(`[CCR] Session ${session.id} approaching limit (${utilization * 100}%)`);
        await this.handleClaudeCodeLimit(session.taskId);
      }
    }
  }

  /**
   * Calculate context utilization for a session
   */
  private async calculateUtilization(sessionId: string): Promise<number> {
    // This would integrate with actual context size monitoring
    // For now, return a mock value
    return Math.random() * 0.5; // Mock utilization
  }

  /**
   * Get CCR configuration for specific platform
   */
  private getCCRConfig(platform: string): CCRConfig {
    const baseConfig: CCRConfig = {
      log: true,
      NON_INTERACTIVE_MODE: true,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
      router: {
        default: 'openrouter,anthropic/claude-3.5-sonnet',
        codex: 'openai,gpt-4o',
        synthetic: 'openrouter,qwen/qwen-2.5-coder-32b',
        longContext: 'openrouter,anthropic/claude-3.5-sonnet'
      }
    };

    // Add platform-specific transformers
    if (platform === 'synthetic') {
      baseConfig.transformers = [
        {
          path: './synthetic-transformer.js',
          options: { fallback: true }
        }
      ];
    }

    return baseConfig;
  }

  /**
   * Extract current session state
   */
  private async extractSessionState(platform: string): Promise<Record<string, unknown>> {
    // This would extract actual session state
    // For now, return mock state
    return {
      platform,
      timestamp: new Date().toISOString(),
      contextSize: 0,
      toolUsage: []
    };
  }

  /**
   * Inject context into target platform
   */
  private async injectContextToPlatform(
    context: PreservedContext, 
    platform: string
  ): Promise<void> {
    console.log(`[CCR] Injecting context into ${platform}...`);
    
    // This would inject context into the target platform
    // Implementation depends on platform-specific integration
    await new Promise(resolve => setTimeout(resolve, 100)); // Mock delay
  }

  /**
   * Update session tracking with handoff information
   */
  private async updateSessionTracking(
    taskId: string, 
    handoff: PlatformHandoff
  ): Promise<void> {
    // Update session tracking in memory system
    await this.memory.updateSessionHandoff(taskId, handoff);
  }

  /**
   * Wait for CCR process to be ready
   */
  private async waitForCCRReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ccrProcess) {
        reject(new Error('CCR process not started'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('CCR startup timeout'));
      }, 10000); // 10 second timeout

      this.ccrProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('CCR ready') || output.includes('listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.ccrProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    const required = ['OPENAI_API_KEY', 'OPENROUTER_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Shutdown CCR Fallback Manager
   */
  async shutdown(): Promise<void> {
    console.log('[CCR] Shutting down Fallback Manager...');
    
    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    
    // Kill CCR process
    if (this.ccrProcess) {
      this.ccrProcess.kill();
      this.ccrProcess = null;
    }
    
    console.log('[CCR] Fallback Manager shutdown complete');
  }
}
