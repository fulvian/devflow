import { spawn, ChildProcess } from 'child_process';
import { QwenAuthManager } from '../auth/qwen-auth-manager.js';
import { QwenTask, QwenTaskResult } from './qwen-orchestrator.js';

export interface WorkerResult {
  output: string;
  provider: string;
  model: string;
  exitCode: number;
}

/**
 * Qwen Worker
 * Handles individual task execution for a specific provider
 */
export class QwenWorker {
  private provider: string;
  private authManager: QwenAuthManager;
  private isInitialized = false;
  private currentProcess: ChildProcess | null = null;

  constructor(provider: string, authManager: QwenAuthManager) {
    this.provider = provider;
    this.authManager = authManager;
  }

  /**
   * Initialize the worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log(`[Qwen Worker ${this.provider}] Initializing...`);

    // Validate authentication for this provider
    const isValid = await this.authManager.validateProvider(this.provider);
    if (!isValid) {
      throw new Error(`Authentication not valid for provider: ${this.provider}`);
    }

    this.isInitialized = true;
    console.log(`[Qwen Worker ${this.provider}] Initialized successfully`);
  }

  /**
   * Execute a task
   */
  async executeTask(task: QwenTask): Promise<WorkerResult> {
    if (!this.isInitialized) {
      throw new Error('Worker not initialized');
    }

    const timeout = task.timeout || 120000; // 2 minutes default
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Task execution timeout')), timeout);
    });

    try {
      const executionPromise = this.executeTaskInternal(task);
      return await Promise.race([executionPromise, timeoutPromise]);
    } finally {
      if (this.currentProcess) {
        this.currentProcess.kill('SIGTERM');
        this.currentProcess = null;
      }
    }
  }

  /**
   * Internal task execution
   */
  private async executeTaskInternal(task: QwenTask): Promise<WorkerResult> {
    const config = await this.authManager.getProviderConfig(this.provider);
    const model = task.model || config.defaultModel;

    // Build command arguments
    const args = await this.buildCommandArgs(task, config, model);
    
    console.log(`[Qwen Worker ${this.provider}] Executing: qwen ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      // Set environment variables for this provider
      const env = {
        ...process.env,
        ...config.env,
      };

      this.currentProcess = spawn('qwen', args, {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      this.currentProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      this.currentProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;

        if (code === 0) {
          resolve({
            output: stdout.trim(),
            provider: this.provider,
            model: model,
            exitCode: code,
          });
        } else {
          reject(new Error(`Qwen CLI failed with code ${code}: ${stderr.trim()}`));
        }
      });

      this.currentProcess.on('error', (error) => {
        this.currentProcess = null;
        reject(new Error(`Failed to spawn qwen process: ${error.message}`));
      });

      // Send input if it's an interactive command
      if (task.prompt && this.currentProcess.stdin) {
        this.currentProcess.stdin.write(task.prompt);
        this.currentProcess.stdin.end();
      }
    });
  }

  /**
   * Build command arguments based on task and provider
   */
  private async buildCommandArgs(task: QwenTask, config: any, model: string): Promise<string[]> {
    const args: string[] = [];

    // Add provider-specific authentication
    if (config.apiKey) {
      args.push('--openai-api-key', config.apiKey);
    }
    
    if (config.baseUrl) {
      args.push('--openai-base-url', config.baseUrl);
    }

    if (model) {
      args.push('--model', model);
    }

    // Add sandbox flag if requested
    if (task.sandbox) {
      args.push('--sandbox');
    }

    // Add task-specific arguments
    switch (task.type) {
      case 'general':
        args.push('-p', task.prompt);
        break;

      case 'code_generation':
        args.push('-p', `Generate ${task.language || ''} code: ${task.prompt}`);
        if (task.framework) {
          args.push('--context', `Framework: ${task.framework}`);
        }
        break;

      case 'code_analysis':
        args.push('-p', `Analyze this code: ${task.prompt}`);
        if (task.language) {
          args.push('--language', task.language);
        }
        break;

      default:
        args.push('-p', task.prompt);
    }

    return args;
  }

  /**
   * Check if worker is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) return false;

      const config = await this.authManager.getProviderConfig(this.provider);
      if (!config) return false;

      // Simple health check - verify auth and basic connectivity
      const result = await this.executeTask({
        type: 'general',
        prompt: 'ping',
        priority: 'low',
        timeout: 10000, // 10 seconds for health check
      });

      return result.exitCode === 0;
    } catch (error) {
      console.warn(`[Qwen Worker ${this.provider}] Health check failed:`, error);
      return false;
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): Record<string, any> {
    return {
      provider: this.provider,
      initialized: this.isInitialized,
      currentlyExecuting: this.currentProcess !== null,
    };
  }

  /**
   * Shutdown the worker
   */
  async shutdown(): Promise<void> {
    console.log(`[Qwen Worker ${this.provider}] Shutting down...`);

    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (this.currentProcess && !this.currentProcess.killed) {
        this.currentProcess.kill('SIGKILL');
      }
      
      this.currentProcess = null;
    }

    this.isInitialized = false;
    console.log(`[Qwen Worker ${this.provider}] Shutdown complete`);
  }
}