import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { CircuitBreaker } from './utils/circuit-breaker';
import { PlatformSelector } from './platform-selector';
import { CLIIntegrationManager } from '../mcp/cli-integration-manager';
import { PlatformStatusTracker } from '../ui/platform-status-tracker';

export interface ModelConfig {
  name: string;
  command: string;
  args: string[];
  envVars?: Record<string, string>;
}

export interface ExecutionResult {
  model: string;
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

export class RealDreamTeamOrchestrator extends EventEmitter {
  private models: Map<string, ModelConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private cliManager: CLIIntegrationManager;
  private platformSelector: PlatformSelector;
  private isHealthy: boolean = true;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private statusTracker: PlatformStatusTracker;

  constructor() {
    super();
    this.cliManager = new CLIIntegrationManager();
    this.platformSelector = new PlatformSelector();
    this.statusTracker = new PlatformStatusTracker();
    this.initializeModels();
    this.initializeCircuitBreakers();
  }

  private initializeModels(): void {
    const projectRoot = process.cwd();
    const cliDir = path.join(projectRoot, 'tools', 'cli');

    // Use the Node executable to run our local CLI wrappers
    const nodeCmd = process.execPath;

    // Codex configuration (calls local Codex MCP via HTTP)
    this.models.set('codex', {
      name: 'codex',
      command: nodeCmd,
      args: [path.join(cliDir, 'devflow-codex.mjs')],
      envVars: {
        MODEL_TYPE: 'codex',
        LOG_LEVEL: 'info',
        // Allow overriding Codex MCP address via env; no credentials stored here
        CODEX_MCP_HOST: process.env.CODEX_MCP_HOST || '127.0.0.1',
        CODEX_MCP_PORT: process.env.CODEX_MCP_PORT || '3101'
      }
    });

    // Gemini configuration (stub for P0)
    this.models.set('gemini', {
      name: 'gemini',
      command: nodeCmd,
      args: [path.join(cliDir, 'devflow-gemini.mjs')],
      envVars: {
        MODEL_TYPE: 'gemini',
        LOG_LEVEL: 'info'
      }
    });

    // Qwen configuration (stub for P0)
    this.models.set('qwen', {
      name: 'qwen',
      command: nodeCmd,
      args: [path.join(cliDir, 'devflow-qwen.mjs')],
      envVars: {
        MODEL_TYPE: 'qwen',
        LOG_LEVEL: 'info'
      }
    });
  }

  private initializeCircuitBreakers(): void {
    for (const modelName of this.models.keys()) {
      this.circuitBreakers.set(
        modelName,
        new CircuitBreaker(modelName, 5, 60000)
      );
    }
  }

  public async executeModel(modelName: string, input: string): Promise<ExecutionResult> {
    const model = this.models.get(modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    const circuitBreaker = this.circuitBreakers.get(modelName);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker for ${modelName} not found`);
    }

    const startTime = Date.now();

    try {
      // Indica carico iniziale
      this.statusTracker.setPlatformLoad(modelName, 20);
      const executionResult = await circuitBreaker.execute(async () => {
        const result = await this.cliManager.executeCommand(
          model.command,
          [...model.args, input],
          model.envVars
        );

        const executionTime = Date.now() - startTime;

        const response: ExecutionResult = {
          model: modelName,
          success: true,
          output: result.output,
          executionTime
        };

        this.statusTracker.recordExecution({
          model: modelName,
          success: true,
          executionTime,
          timestamp: Date.now()
        });
        this.statusTracker.setPlatformLoad(modelName, 0);
        this.emit('modelExecutionComplete', response);
        return response;
      });

      return executionResult;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      const executionResult: ExecutionResult = {
        model: modelName,
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      };

      this.statusTracker.recordExecution({
        model: modelName,
        success: false,
        executionTime,
        timestamp: Date.now()
      });
      this.statusTracker.setPlatformLoad(modelName, 0);
      this.emit('modelExecutionFailed', executionResult);
      return executionResult;
    }
  }

  public async executeDreamTeam(input: string): Promise<ExecutionResult[]> {
    const selectedPlatforms = this.platformSelector.getSelectedPlatforms();
    const results: ExecutionResult[] = [];

    // Execute models in parallel
    const executionPromises = selectedPlatforms.map((platform: string) =>
      this.executeModel(platform, input)
    );

    try {
      const executionResults = await Promise.all(executionPromises);
      results.push(...executionResults);
      
      this.emit('dreamTeamExecutionComplete', results);
      return results;
    } catch (error) {
      this.emit('dreamTeamExecutionError', error);
      throw error;
    }
  }

  public getHealthStatus(): { healthy: boolean; models: Record<string, boolean> } {
    const modelStatuses: Record<string, boolean> = {};
    
    for (const [modelName, circuitBreaker] of this.circuitBreakers.entries()) {
      modelStatuses[modelName] = !circuitBreaker.isOpen();
    }

    return {
      healthy: this.isHealthy,
      models: modelStatuses
    };
  }

  public getStatusTracker(): PlatformStatusTracker {
    return this.statusTracker;
  }

  public async shutdown(): Promise<void> {
    // Terminate all active processes
    for (const [modelName, process] of this.activeProcesses.entries()) {
      if (!process.killed) {
        process.kill('SIGTERM');
      }
      this.activeProcesses.delete(modelName);
    }

    this.emit('shutdown');
  }
}

export default RealDreamTeamOrchestrator;
