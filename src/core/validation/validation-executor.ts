import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { ProjectInfo, ValidationResult, ValidationConfig, ValidationError } from './validation-types';

export class ValidationExecutor extends EventEmitter {
  private runningProcesses: Map<string, ChildProcess[]>;
  
  constructor(private config: ValidationConfig = {}) {
    super();
    this.runningProcesses = new Map();
  }

  async executeValidations(
    projectPath: string, 
    commands: string[], 
    projectInfo: ProjectInfo
  ): Promise<ValidationResult[]> {
    this.emit('validation-start', projectPath);
    
    const results: ValidationResult[] = [];
    const processes: ChildProcess[] = [];
    this.runningProcesses.set(projectPath, processes);
    
    try {
      // Execute commands in parallel
      const commandPromises = commands.map(command => 
        this.executeCommand(projectPath, command, projectInfo.type)
      );
      
      const commandResults = await Promise.all(commandPromises);
      results.push(...commandResults);
      
      this.emit('validation-complete', results);
      return results;
    } catch (error) {
      const validationError: ValidationError = {
        projectPath,
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      };
      this.emit('validation-error', validationError);
      throw error;
    } finally {
      // Cleanup processes
      const projectProcesses = this.runningProcesses.get(projectPath) || [];
      for (const proc of projectProcesses) {
        if (!proc.killed) {
          proc.kill();
        }
      }
      this.runningProcesses.delete(projectPath);
    }
  }

  private async executeCommand(
    projectPath: string, 
    command: string, 
    projectType: ProjectType
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const timeout = this.config.timeout || 300000; // 5 minutes default
      let timedOut = false;
      
      const [cmd, ...args] = command.split(' ');
      const proc = spawn(cmd, args, {
        cwd: projectPath,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      // Track process
      const processes = this.runningProcesses.get(projectPath) || [];
      processes.push(proc);
      this.runningProcesses.set(projectPath, processes);
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Setup timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill();
        
        resolve({
          projectPath,
          projectType,
          command,
          success: false,
          exitCode: -1,
          stdout,
          stderr: `Command timed out after ${timeout}ms`,
          duration: timeout,
          timestamp: Date.now()
        });
      }, timeout);
      
      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (timedOut) return; // Already handled by timeout
        
        const duration = Date.now() - startTime;
        
        resolve({
          projectPath,
          projectType,
          command,
          success: code === 0,
          exitCode: code || 0,
          stdout,
          stderr,
          duration,
          timestamp: Date.now()
        });
      });
      
      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        
        if (timedOut) return;
        
        const duration = Date.now() - startTime;
        
        resolve({
          projectPath,
          projectType,
          command,
          success: false,
          exitCode: -1,
          stdout,
          stderr: error.message,
          duration,
          timestamp: Date.now()
        });
      });
    });
  }

  terminateAll(): void {
    for (const [projectPath, processes] of this.runningProcesses.entries()) {
      for (const proc of processes) {
        if (!proc.killed) {
          proc.kill();
        }
      }
      this.runningProcesses.delete(projectPath);
    }
  }

  getRunningProcesses(): number {
    let count = 0;
    for (const processes of this.runningProcesses.values()) {
      count += processes.length;
    }
    return count;
  }
}
