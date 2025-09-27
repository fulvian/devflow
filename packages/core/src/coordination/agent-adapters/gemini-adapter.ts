/**
 * Gemini CLI Adapter for Fallback Chain
 * 
 * This module provides a standardized interface for executing Gemini CLI commands
 * as part of a fallback chain, with proper error handling, output parsing,
 * and performance monitoring.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Interface representing the standardized agent for CLI execution
 */
export interface CliAgent {
  execute(command: string, args: string[], options?: CliExecutionOptions): Promise<CliExecutionResult>;
  kill(): void;
}

/**
 * Options for CLI execution
 */
export interface CliExecutionOptions {
  /** Working directory for the command */
  cwd?: string;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum buffer size in bytes */
  maxBuffer?: number;
  /** Input to send to stdin */
  input?: string;
}

/**
 * Result of CLI execution
 */
export interface CliExecutionResult {
  /** Exit code of the process */
  exitCode: number | null;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Whether the process timed out */
  timedOut: boolean;
}

/**
 * Error class for CLI execution failures
 */
export class CliExecutionError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stdout: string,
    public readonly stderr: string,
    public readonly timedOut: boolean
  ) {
    super(message);
    this.name = 'CliExecutionError';
  }
}

/**
 * Gemini CLI Adapter implementing the standardized agent interface
 */
export class GeminiCliAdapter extends EventEmitter implements CliAgent {
  private process: ChildProcess | null = null;
  private executionStartTime: number = 0;

  /**
   * Execute a Gemini CLI command
   * @param command The command to execute
   * @param args Command arguments
   * @param options Execution options
   * @returns Promise resolving to execution result
   */
  async execute(
    command: string,
    args: string[] = [],
    options: CliExecutionOptions = {}
  ): Promise<CliExecutionResult> {
    // Validate inputs
    if (!command || typeof command !== 'string') {
      throw new TypeError('Command must be a non-empty string');
    }

    if (!Array.isArray(args)) {
      throw new TypeError('Args must be an array of strings');
    }

    // Set default options
    const execOptions: Required<CliExecutionOptions> = {
      cwd: options.cwd || process.cwd(),
      env: options.env || process.env,
      timeout: options.timeout || 30000,
      maxBuffer: options.maxBuffer || 1024 * 1024, // 1MB
      input: options.input || ''
    };

    return new Promise((resolve, reject) => {
      try {
        this.executionStartTime = Date.now();
        
        // Spawn the child process
        this.process = spawn(command, args, {
          cwd: execOptions.cwd,
          env: execOptions.env
        });

        let stdout = '';
        let stderr = '';
        let timedOut = false;
        let timeoutId: NodeJS.Timeout | null = null;

        // Set up timeout if specified
        if (execOptions.timeout > 0) {
          timeoutId = setTimeout(() => {
            timedOut = true;
            this.kill();
          }, execOptions.timeout);
        }

        // Handle stdout data
        this.process.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stdout += chunk;
          
          // Emit data event for streaming
          this.emit('data', chunk);
        });

        // Handle stderr data
        this.process.stderr?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          stderr += chunk;
          
          // Emit error data event
          this.emit('errorData', chunk);
        });

        // Handle process close
        this.process.on('close', (code) => {
          const executionTime = Date.now() - this.executionStartTime;
          
          // Clear timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          const result: CliExecutionResult = {
            exitCode: code,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            executionTime,
            timedOut
          };

          // Reset process reference
          this.process = null;

          // Resolve or reject based on exit code and timeout
          if (timedOut) {
            reject(new CliExecutionError(
              `Command timed out after ${execOptions.timeout}ms`,
              code,
              stdout,
              stderr,
              true
            ));
          } else if (code !== 0) {
            reject(new CliExecutionError(
              `Command failed with exit code ${code}`,
              code,
              stdout,
              stderr,
              false
            ));
          } else {
            resolve(result);
          }
        });

        // Handle process error
        this.process.on('error', (error) => {
          const executionTime = Date.now() - this.executionStartTime;
          
          // Clear timeout
          if (timeoutId) {
            clearTimeout(timeoutId);
          }

          // Reset process reference
          this.process = null;

          reject(new CliExecutionError(
            `Failed to spawn process: ${error.message}`,
            null,
            stdout,
            stderr,
            false
          ));
        });

        // Write input to stdin if provided
        if (execOptions.input && this.process.stdin) {
          this.process.stdin.write(execOptions.input);
          this.process.stdin.end();
        }

      } catch (error) {
        reject(new CliExecutionError(
          `Unexpected error during execution: ${error instanceof Error ? error.message : String(error)}`,
          null,
          '',
          '',
          false
        ));
      }
    });
  }

  /**
   * Kill the currently running process
   */
  kill(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      
      // Force kill if process doesn't terminate gracefully
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  /**
   * Parse and format CLI output
   * @param output Raw CLI output
   * @returns Formatted output
   */
  parseOutput(output: string): any {
    try {
      // Try to parse as JSON first
      return JSON.parse(output);
    } catch (error) {
      // If not JSON, return as string
      return output.trim();
    }
  }

  /**
   * Get performance metrics for the last execution
   * @returns Performance metrics
   */
  getPerformanceMetrics(): { executionTime: number } | null {
    if (this.executionStartTime > 0) {
      return {
        executionTime: Date.now() - this.executionStartTime
      };
    }
    return null;
  }
}

/**
 * Factory function to create a Gemini CLI adapter
 * @returns New instance of GeminiCliAdapter
 */
export function createGeminiCliAdapter(): GeminiCliAdapter {
  return new GeminiCliAdapter();
}

// Export types for external use
export default GeminiCliAdapter;