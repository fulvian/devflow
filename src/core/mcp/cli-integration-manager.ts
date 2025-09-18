import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { PlatformSelector } from '../orchestration/platform-selector';

export interface CLIExecutionResult {
  output: string;
  error: string;
  exitCode: number | null;
  executionTime: number;
}

export interface CLIExecutionOptions {
  timeout?: number;
  envVars?: Record<string, string>;
  cwd?: string;
}

export class CLIIntegrationManager extends EventEmitter {
  private platformSelector: PlatformSelector;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private defaultTimeout: number = 300000; // 5 minutes

  constructor() {
    super();
    this.platformSelector = new PlatformSelector();
  }

  public async executeCommand(
    command: string, 
    args: string[] = [], 
    options: CLIExecutionOptions = {}
  ): Promise<CLIExecutionResult> {
    const timeout = options.timeout || this.defaultTimeout;
    const envVars = options.envVars || {};
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      // Create a unique identifier for this process
      const processId = `${command}-${Date.now()}`;
      
      // Merge provided environment variables with process env
      const env = { ...process.env, ...envVars };
      
      // Spawn the child process
      const childProcess = spawn(command, args, { 
        env,
        cwd: options.cwd
      });
      
      // Store reference to active process
      this.activeProcesses.set(processId, childProcess);
      
      let stdoutData = '';
      let stderrData = '';
      let timedOut = false;
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        childProcess.kill('SIGTERM');
        
        const result: CLIExecutionResult = {
          output: stdoutData,
          error: `Command timed out after ${timeout}ms`,
          exitCode: null,
          executionTime: Date.now() - startTime
        };
        
        this.activeProcesses.delete(processId);
        reject(new Error(`CLI command timeout: ${result.error}`));
      }, timeout);
      
      // Capture stdout
      childProcess.stdout?.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      // Capture stderr
      childProcess.stderr?.on('data', (data) => {
        stderrData += data.toString();
      });
      
      // Handle process close
      childProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        // Remove from active processes
        this.activeProcesses.delete(processId);
        
        const executionTime = Date.now() - startTime;
        
        if (timedOut) {
          return; // Already handled by timeout
        }
        
        const result: CLIExecutionResult = {
          output: stdoutData,
          error: stderrData,
          exitCode: code,
          executionTime
        };
        
        // Emit event for monitoring
        this.emit('commandExecuted', { command, args, result });
        
        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderrData}`));
        }
      });
      
      // Handle process error
      childProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        this.activeProcesses.delete(processId);
        
        const executionTime = Date.now() - startTime;
        
        const result: CLIExecutionResult = {
          output: stdoutData,
          error: error.message,
          exitCode: null,
          executionTime
        };
        
        this.emit('commandError', { command, args, error: result.error });
        reject(new Error(`Failed to spawn process: ${error.message}`));
      });
    });
  }

  public async executePlatformCommand(
    platform: string, 
    command: string, 
    args: string[] = [], 
    options: CLIExecutionOptions = {}
  ): Promise<CLIExecutionResult> {
    // Validate platform is selected
    const selectedPlatforms = this.platformSelector.getSelectedPlatforms();
    if (!selectedPlatforms.includes(platform)) {
      throw new Error(`Platform ${platform} is not currently selected`);
    }
    
    // Add platform-specific environment variables
    const platformEnv = {
      [`PLATFORM_${platform.toUpperCase()}`]: 'enabled',
      CURRENT_PLATFORM: platform,
      ...options.envVars
    };
    
    const executionOptions: CLIExecutionOptions = {
      ...options,
      envVars: platformEnv
    };
    
    return this.executeCommand(command, args, executionOptions);
  }

  public getActiveProcesses(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  public terminateProcess(processId: string): boolean {
    const process = this.activeProcesses.get(processId);
    if (process && !process.killed) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(processId);
      return true;
    }
    return false;
  }

  public terminateAllProcesses(): void {
    for (const [processId, process] of this.activeProcesses.entries()) {
      if (!process.killed) {
        process.kill('SIGTERM');
      }
    }
    this.activeProcesses.clear();
    
    this.emit('allProcessesTerminated');
  }

  public validateCommandOutput(output: string): boolean {
    // Basic validation - check if output is not empty and doesn't contain error indicators
    if (!output || output.trim().length === 0) {
      return false;
    }
    
    // Check for common error patterns
    const errorPatterns = [
      /error/i,
      /exception/i,
      /failed/i,
      /fatal/i
    ];
    
    return !errorPatterns.some(pattern => pattern.test(output));
  }
}

export default CLIIntegrationManager;