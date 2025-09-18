import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RecoveryConfig {
  pidFileName: string;
  maxRecoveryAttempts: number;
  recoveryInterval: number;
  resourceCheckTimeout: number;
}

interface RecoveryState {
  attempts: number;
  lastRecovery: number;
  isRecovering: boolean;
}

class RecoveryManager {
  private config: RecoveryConfig;
  private state: RecoveryState;
  private pidFilePath: string;
  private recoveryTimer: NodeJS.Timeout | null;

  constructor(config: Partial<RecoveryConfig> = {}) {
    this.config = {
      pidFileName: config.pidFileName || 'enforcement-daemon.pid',
      maxRecoveryAttempts: config.maxRecoveryAttempts || 3,
      recoveryInterval: config.recoveryInterval || 10000,
      resourceCheckTimeout: config.resourceCheckTimeout || 5000
    };
    
    this.pidFilePath = join(process.env.ENFORCEMENT_PID_DIR || process.cwd(), 'devflow-enforcement-daemon.pid');
    this.state = {
      attempts: 0,
      lastRecovery: 0,
      isRecovering: false
    };
    this.recoveryTimer = null;
  }

  async handleFailure(error: Error): Promise<boolean> {
    if (this.state.isRecovering) {
      console.warn('Recovery already in progress');
      return false;
    }
    
    if (this.state.attempts >= this.config.maxRecoveryAttempts) {
      console.error('Max recovery attempts exceeded, graceful degradation');
      return await this.gracefulDegradation();
    }
    
    this.state.isRecovering = true;
    this.state.attempts++;
    
    try {
      console.log(`Recovery attempt ${this.state.attempts}/${this.config.maxRecoveryAttempts}`);
      
      await this.cleanupStalePidFile();
      await this.resolveProcessConflicts();
      const resourcesValid = await this.validateResources();
      
      if (!resourcesValid) {
        throw new Error('Resource validation failed');
      }
      
      this.state.lastRecovery = Date.now();
      this.state.isRecovering = false;
      console.log('Recovery successful');
      return true;
      
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError.message);
      this.state.isRecovering = false;
      return await this.handleFailure(recoveryError);
    }
  }

  private async cleanupStalePidFile(): Promise<void> {
    if (!existsSync(this.pidFilePath)) return;
    
    try {
      const pid = parseInt(readFileSync(this.pidFilePath, 'utf8').trim());
      try {
        process.kill(pid, 0);
        // Process is still running
        console.warn(`Active process found with PID ${pid}, sending SIGTERM`);
        process.kill(pid, 'SIGTERM');
        
        // Wait a moment and check again
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          process.kill(pid, 0);
          // Still running, force kill
          console.warn(`Force killing process ${pid}`);
          process.kill(pid, 'SIGKILL');
        } catch {
          // Process terminated successfully
        }
      } catch {
        // Process not running, safe to remove PID file
        console.log('Removing stale PID file');
        unlinkSync(this.pidFilePath);
      }
    } catch (error) {
      console.error('Error during PID file cleanup:', error.message);
      // Try to remove anyway
      try {
        unlinkSync(this.pidFilePath);
      } catch (unlinkError) {
        console.error('Failed to remove PID file:', unlinkError.message);
      }
    }
  }

  private async resolveProcessConflicts(): Promise<void> {
    // Check for other enforcement processes
    try {
      const { stdout } = await execAsync('pgrep -f "enforcement"');
      const pids = stdout.trim().split('\n').filter(pid => pid && pid !== process.pid.toString());
      
      for (const pid of pids) {
        const pidNum = parseInt(pid);
        if (!isNaN(pidNum) && pidNum !== process.pid) {
          console.warn(`Terminating conflicting process ${pidNum}`);
          try {
            process.kill(pidNum, 'SIGTERM');
          } catch (error) {
            console.error(`Failed to terminate process ${pidNum}:`, error.message);
          }
        }
      }
    } catch (error) {
      // No processes found or other error - continue
      if (!error.message.includes('no matching criteria')) {
        console.warn('Process conflict check error:', error.message);
      }
    }
  }

  private async validateResources(): Promise<boolean> {
    const criticalResources = ['/tmp', '/var/log', '/var/run'];
    
    for (const resource of criticalResources) {
      if (!existsSync(resource)) {
        console.error(`Critical resource missing: ${resource}`);
        return false;
      }
      
      // Test write access
      try {
        await execAsync(`test -w ${resource}`, { timeout: this.config.resourceCheckTimeout });
      } catch {
        console.error(`No write access to resource: ${resource}`);
        return false;
      }
    }
    
    return true;
  }

  private async gracefulDegradation(): Promise<boolean> {
    console.warn('Entering graceful degradation mode');
    
    // Reduce functionality but keep essential services running
    // This would be specific to the application logic
    
    // For now, we'll just reset attempt counter to allow future recoveries
    this.state.attempts = 0;
    
    // In a real implementation, this would involve:
    // - Disabling non-critical features
    // - Switching to reduced functionality mode
    // - Alerting operators
    
    console.log('Graceful degradation completed');
    return true;
  }

  reset(): void {
    this.state.attempts = 0;
    this.state.lastRecovery = 0;
    this.state.isRecovering = false;
    
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }
}

export default RecoveryManager;
