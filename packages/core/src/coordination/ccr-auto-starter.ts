// CCRAutoStarter.ts
import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import { setTimeout } from 'timers';
import * as http from 'http';

const setTimeoutPromise = promisify(setTimeout);

/**
 * CCR (Claude Code Router) Auto-Starter Module
 * Automatically starts Claude Code Router when Claude Pro usage limits are detected
 */
export class CCRAutoStarter extends EventEmitter {
  private ccrProcess: ChildProcess | null = null;
  private isStarting: boolean = false;
  private isRunning: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly CCR_PORT: number = 3456;
  private readonly STARTUP_TIMEOUT: number = 30000; // 30 seconds
  private readonly HEALTH_CHECK_INTERVAL: number = 10000; // 10 seconds
  private readonly MAX_RESTART_ATTEMPTS: number = 3;
  private restartAttempts: number = 0;

  constructor() {
    super();
  }

  /**
   * Starts the CCR process if not already running
   * @returns Promise that resolves when CCR is successfully started
   */
  async start(): Promise<boolean> {
    if (this.isStarting) {
      this.log('CCR start already in progress');
      return false;
    }

    if (this.isRunning) {
      this.log('CCR is already running');
      return true;
    }

    this.isStarting = true;
    this.log('Starting CCR process...');

    try {
      // Check if port is available
      if (!(await this.isPortAvailable(this.CCR_PORT))) {
        this.log(`Port ${this.CCR_PORT} is not available. Attempting to find existing CCR process.`);
        // Try to connect to existing CCR instance
        if (await this.isCCRRuntimeAvailable()) {
          this.log('Found existing CCR instance');
          this.isRunning = true;
          this.isStarting = false;
          this.emit('started');
          this.startHealthMonitoring();
          return true;
        } else {
          this.log(`Port ${this.CCR_PORT} is occupied but not responding as CCR. Cannot start.`);
          this.isStarting = false;
          return false;
        }
      }

      // Spawn the CCR process
      this.ccrProcess = spawn('npx', [
        '@musistudio/claude-code-router',
        'start'
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
      });

      // Handle process events
      this.setupProcessHandlers();

      // Wait for server to be ready
      const isReady = await this.waitForServerReady();
      
      if (isReady) {
        this.isRunning = true;
        this.isStarting = false;
        this.restartAttempts = 0;
        this.log('CCR started successfully');
        this.emit('started');
        this.startHealthMonitoring();
        return true;
      } else {
        throw new Error('CCR failed to start within timeout period');
      }
    } catch (error) {
      this.isStarting = false;
      this.log(`Failed to start CCR: ${error instanceof Error ? error.message : String(error)}`);
      
      // Attempt restart if within limits
      if (this.restartAttempts < this.MAX_RESTART_ATTEMPTS) {
        this.restartAttempts++;
        this.log(`Attempting restart (${this.restartAttempts}/${this.MAX_RESTART_ATTEMPTS})`);
        return this.start();
      }
      
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Stops the CCR process if running
   */
  async stop(): Promise<void> {
    this.log('Stopping CCR process...');
    
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Reset state
    this.isRunning = false;
    this.isStarting = false;
    this.restartAttempts = 0;

    if (this.ccrProcess) {
      try {
        // Try graceful shutdown first
        this.ccrProcess.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        await setTimeoutPromise(2000);
        
        // Force kill if still running
        if (this.ccrProcess.kill(0)) {
          this.ccrProcess.kill('SIGKILL');
        }
      } catch (error) {
        this.log(`Error during CCR shutdown: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        this.ccrProcess = null;
      }
    }
    
    this.log('CCR stopped');
    this.emit('stopped');
  }

  /**
   * Returns the current status of the CCR process
   */
  getStatus(): {
    isRunning: boolean;
    isStarting: boolean;
    pid: number | null;
    port: number;
  } {
    return {
      isRunning: this.isRunning,
      isStarting: this.isStarting,
      pid: this.ccrProcess?.pid || null,
      port: this.CCR_PORT
    };
  }

  /**
   * Checks if CCR is responding to health checks
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isRunning) return false;
    return this.isCCRRuntimeAvailable();
  }

  /**
   * Waits for the CCR server to be ready by polling health endpoint
   */
  private async waitForServerReady(): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.STARTUP_TIMEOUT) {
      if (await this.isCCRRuntimeAvailable()) {
        return true;
      }
      await setTimeoutPromise(1000); // Wait 1 second between checks
    }
    
    return false;
  }

  /**
   * Checks if the CCR server is responding at the expected port
   */
  private async isCCRRuntimeAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${this.CCR_PORT}/health`, (res) => {
        resolve(res.statusCode === 200);
      });
      
      req.on('error', () => resolve(false));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Checks if a port is available
   */
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = http.createServer();
      
      server.listen(port, () => {
        server.close();
        resolve(true);
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Sets up event handlers for the CCR process
   */
  private setupProcessHandlers(): void {
    if (!this.ccrProcess) return;

    // Handle stdout
    this.ccrProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      this.log(`CCR stdout: ${output}`);
    });

    // Handle stderr
    this.ccrProcess.stderr?.on('data', (data) => {
      const error = data.toString().trim();
      this.log(`CCR stderr: ${error}`);
      this.emit('process-error', error);
    });

    // Handle process exit
    this.ccrProcess.on('exit', (code, signal) => {
      this.log(`CCR process exited with code ${code} and signal ${signal}`);
      
      // Clear health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      this.isRunning = false;
      this.isStarting = false;
      
      // If the process exited unexpectedly, emit an event
      if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
        this.emit('crashed', { code, signal });
      }
    });

    // Handle process errors
    this.ccrProcess.on('error', (error) => {
      this.log(`CCR process error: ${error.message}`);
      this.emit('error', error);
    });
  }

  /**
   * Starts health monitoring interval
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const isHealthy = await this.isHealthy();
        if (!isHealthy) {
          this.log('CCR health check failed');
          this.emit('health-check-failed');
          
          // Try to restart if not already restarting
          if (!this.isStarting) {
            this.log('Attempting to restart CCR due to health check failure');
            await this.stop();
            await this.start();
          }
        }
      } catch (error) {
        this.log(`Health check error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Simple logging utility
   */
  private log(message: string): void {
    console.log(`[CCRAutoStarter] ${new Date().toISOString()} - ${message}`);
  }
}

// Export types for external use
export interface CCRAutoStarterStatus {
  isRunning: boolean;
  isStarting: boolean;
  pid: number | null;
  port: number;
}

export interface CCRErrorEvent {
  error: Error;
}

export interface CCRCrashEvent {
  code: number | null;
  signal: string | null;
}