/**
 * Emergency CCR Activator - Handles automatic CCR activation when Claude Code freezes
 * 
 * Detects Claude Code session limits and seamlessly activates CCR Emergency Proxy
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SQLiteMemoryManager } from '../memory/manager.js';
import { CCSessionsManager } from '../memory/cc-sessions-manager.js';

export interface EmergencyActivationConfig {
  /** CCR binary path */
  ccrPath: string;
  /** CCR config file path */
  configPath: string;
  /** DevFlow memory database path */
  memoryDbPath: string;
  /** Emergency activation timeout */
  activationTimeout: number;
}

export interface ClaudeCodeSessionState {
  /** Whether Claude Code is currently accessible */
  isAccessible: boolean;
  /** Last successful interaction timestamp */
  lastInteraction: Date;
  /** Session limit reached */
  sessionLimitReached: boolean;
  /** Error message if any */
  errorMessage?: string;
}

export class EmergencyCCRActivator {
  private config: EmergencyActivationConfig;
  private memoryManager: SQLiteMemoryManager;
  private ccSessionsManager: CCSessionsManager;
  private ccrProcess: ChildProcess | null = null;
  private monitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<EmergencyActivationConfig> = {}) {
    this.config = {
      ccrPath: 'npx @musistudio/claude-code-router',
      configPath: join(process.env.HOME!, '.claude-code-router', 'config.json'),
      memoryDbPath: './packages/core/devflow.sqlite',
      activationTimeout: 30000,
      ...config
    };

    this.memoryManager = new SQLiteMemoryManager(this.config.memoryDbPath);
    this.ccSessionsManager = new CCSessionsManager(
      this.memoryManager.getDatabase(),
      { enabled: true, apiMode: true }
    );
  }

  /**
   * Initialize emergency activation monitoring
   */
  async initialize(): Promise<void> {
    console.log('[EmergencyCCR] Initializing emergency activation monitoring...');
    
    await this.memoryManager.initialize();
    
    // Start monitoring Claude Code accessibility
    await this.startMonitoring();
    
    console.log('[EmergencyCCR] Emergency activation monitoring active');
  }

  /**
   * Check if Claude Code is accessible
   */
  async checkClaudeCodeAccessibility(): Promise<ClaudeCodeSessionState> {
    try {
      // Try to access DevFlow memory to test Claude Code connectivity
      const testQuery = { text: 'accessibility_test', limit: 1 };
      const blocks = await this.memoryManager.queryBlocks(testQuery);
      
      return {
        isAccessible: true,
        lastInteraction: new Date(),
        sessionLimitReached: false
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if error indicates session limits
      const isSessionLimit = this.isSessionLimitError(errorMsg);
      
      return {
        isAccessible: false,
        lastInteraction: new Date(),
        sessionLimitReached: isSessionLimit,
        errorMessage: errorMsg
      };
    }
  }

  /**
   * Detect if error indicates Claude Code session limits
   */
  private isSessionLimitError(errorMessage: string): boolean {
    const sessionLimitIndicators = [
      'session limit',
      'rate limit',
      'too many requests',
      'quota exceeded',
      'usage limit',
      'session expired',
      'timeout',
      'connection refused'
    ];

    const lowerError = errorMessage.toLowerCase();
    return sessionLimitIndicators.some(indicator => lowerError.includes(indicator));
  }

  /**
   * Activate CCR Emergency Proxy
   */
  async activateEmergencyProxy(): Promise<boolean> {
    console.log('[EmergencyCCR] 🚨 CLAUDE CODE SESSION LIMIT DETECTED');
    console.log('[EmergencyCCR] 🔄 Activating CCR Emergency Proxy...');

    try {
      // 1. Preserve current context
      await this.preserveCurrentContext();

      // 2. Ensure CCR is configured correctly
      await this.ensureCCRConfiguration();

      // 3. Start CCR if not running
      const ccrStarted = await this.startCCRProcess();
      
      if (ccrStarted) {
        console.log('[EmergencyCCR] ✅ CCR Emergency Proxy ACTIVATED');
        console.log('[EmergencyCCR] 🎯 DevFlow can continue with Qwen3-Coder-480B');
        console.log('[EmergencyCCR] 💡 Use: npx @musistudio/claude-code-router code');
        return true;
      } else {
        throw new Error('CCR process failed to start');
      }

    } catch (error) {
      console.error('[EmergencyCCR] ❌ Emergency activation failed:', error);
      return false;
    }
  }

  /**
   * Preserve current DevFlow context for CCR handoff
   */
  private async preserveCurrentContext(): Promise<void> {
    console.log('[EmergencyCCR] 💾 Preserving current context...');

    try {
      // Get current session context
      const currentContext = await this.ccSessionsManager.getCurrentContext();
      
      // Save emergency context snapshot
      const emergencyContext = {
        timestamp: new Date().toISOString(),
        sessionContext: currentContext,
        memorySnapshot: await this.memoryManager.getAllBlocks(),
        platform: 'claude_code',
        emergencyHandoff: true
      };

      // Store in emergency context file
      const emergencyPath = join(process.cwd(), '.claude', 'state', 'emergency-context.json');
      writeFileSync(emergencyPath, JSON.stringify(emergencyContext, null, 2));
      
      console.log('[EmergencyCCR] ✅ Context preserved to emergency-context.json');
      
    } catch (error) {
      console.warn('[EmergencyCCR] ⚠️ Context preservation warning:', error);
      // Continue anyway - emergency activation is more important
    }
  }

  /**
   * Ensure CCR is configured for DevFlow integration
   */
  private async ensureCCRConfiguration(): Promise<void> {
    console.log('[EmergencyCCR] ⚙️ Ensuring CCR configuration...');

    const devflowCCRConfig = {
      "log": true,
      "NON_INTERACTIVE_MODE": true,
      "Providers": [
        {
          "name": "synthetic_provider",
          "api_base_url": "https://api.synthetic.new/v1/chat/completions",
          "api_key": process.env.SYNTHETIC_API_KEY || "syn_4f04a1a3108cfbb64ac973367542d361",
          "models": [
            "hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
            "hf:Qwen/Qwen2.5-Coder-32B-Instruct",
            "hf:deepseek-ai/DeepSeek-V3"
          ]
        }
      ],
      "Router": {
        "default": "synthetic_provider,hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
        "codex": "synthetic_provider,hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
        "synthetic": "synthetic_provider,hf:Qwen/Qwen3-Coder-480B-A35B-Instruct",
        "longContext": "synthetic_provider,hf:deepseek-ai/DeepSeek-V3",
        "fallback": "synthetic_provider,hf:Qwen/Qwen2.5-Coder-32B-Instruct"
      },
      "transformers": [
        {
          "path": "./packages/core/src/coordination/ccr-transformers/devflow-context-transformer.js",
          "options": {
            "preserveMemoryBlocks": true,
            "compressContext": true,
            "maxContextSize": 1024
          }
        }
      ],
      "fallback": {
        "enabled": true,
        "chain": ["default", "codex", "fallback"],
        "timeout": 30000,
        "retryAttempts": 3
      },
      "devflow": {
        "emergencyMode": true,
        "memoryManager": {
          "databasePath": this.config.memoryDbPath,
          "enableCompression": true,
          "maxMemoryBlocks": 1000
        }
      }
    };

    // Write emergency CCR configuration
    writeFileSync(this.config.configPath, JSON.stringify(devflowCCRConfig, null, 2));
    console.log('[EmergencyCCR] ✅ CCR emergency configuration applied');
  }

  /**
   * Start CCR process if not already running
   */
  private async startCCRProcess(): Promise<boolean> {
    console.log('[EmergencyCCR] 🚀 Starting CCR process...');

    try {
      // Check if CCR is already running
      const statusCheck = spawn('npx', ['@musistudio/claude-code-router', 'status'], {
        stdio: 'pipe'
      });

      const isRunning = await new Promise<boolean>((resolve) => {
        statusCheck.stdout.on('data', (data) => {
          const output = data.toString();
          resolve(output.includes('Status: Running'));
        });
        statusCheck.on('error', () => resolve(false));
        statusCheck.on('exit', () => resolve(false));
      });

      if (isRunning) {
        console.log('[EmergencyCCR] ✅ CCR already running');
        return true;
      }

      // Start CCR process
      this.ccrProcess = spawn('npx', ['@musistudio/claude-code-router', 'start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      // Wait for startup
      const startupSuccess = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), this.config.activationTimeout);
        
        this.ccrProcess!.stdout?.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Loaded JSON config') || output.includes('listening')) {
            clearTimeout(timeout);
            resolve(true);
          }
        });

        this.ccrProcess!.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });

      if (startupSuccess) {
        console.log('[EmergencyCCR] ✅ CCR process started successfully');
        return true;
      } else {
        throw new Error('CCR startup timeout');
      }

    } catch (error) {
      console.error('[EmergencyCCR] ❌ CCR process start failed:', error);
      return false;
    }
  }

  /**
   * Start monitoring Claude Code accessibility
   */
  private async startMonitoring(): Promise<void> {
    if (this.monitoring) return;

    this.monitoring = true;
    console.log('[EmergencyCCR] 👁️ Starting Claude Code accessibility monitoring...');

    this.monitoringInterval = setInterval(async () => {
      try {
        const state = await this.checkClaudeCodeAccessibility();
        
        if (!state.isAccessible && state.sessionLimitReached) {
          console.log('[EmergencyCCR] 🚨 Claude Code session limit detected!');
          await this.activateEmergencyProxy();
          
          // Stop monitoring after activation (manual intervention needed to resume)
          this.stopMonitoring();
        }
      } catch (error) {
        console.error('[EmergencyCCR] Monitoring error:', error);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.monitoring = false;
    console.log('[EmergencyCCR] Monitoring stopped');
  }

  /**
   * Shutdown emergency activator
   */
  async shutdown(): Promise<void> {
    console.log('[EmergencyCCR] Shutting down emergency activator...');
    
    this.stopMonitoring();
    
    if (this.ccrProcess) {
      this.ccrProcess.kill();
      this.ccrProcess = null;
    }
    
    await this.memoryManager.cleanup();
    console.log('[EmergencyCCR] Shutdown complete');
  }

  /**
   * Manual emergency activation (for testing or manual intervention)
   */
  async manualActivation(): Promise<boolean> {
    console.log('[EmergencyCCR] 🔧 Manual emergency activation requested...');
    return await this.activateEmergencyProxy();
  }

  /**
   * Get current monitoring status
   */
  getStatus(): { monitoring: boolean; ccrRunning: boolean } {
    const ccrRunning = this.ccrProcess !== null && !this.ccrProcess.killed;
    return {
      monitoring: this.monitoring,
      ccrRunning
    };
  }
}

export default EmergencyCCRActivator;