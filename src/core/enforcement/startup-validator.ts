import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

interface ValidationConfig {
  pidFileName: string;
  maxStartupTime: number;
  requiredResources: string[];
}

class StartupValidator {
  private config: ValidationConfig;
  private pidFilePath: string;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = {
      pidFileName: config.pidFileName || 'enforcement-daemon.pid',
      maxStartupTime: config.maxStartupTime || 30000,
      requiredResources: config.requiredResources || ['/tmp', '/var/log']
    };
    
    // Environment-agnostic PID file path - align with existing daemon
    this.pidFilePath = join(
      process.env.ENFORCEMENT_PID_DIR || process.cwd(),
      'devflow-enforcement-daemon.pid'
    );
  }

  async validate(): Promise<boolean> {
    try {
      await this.checkPidFile();
      await this.validateResources();
      await this.validateArchitecture();
      return true;
    } catch (error) {
      console.error('Startup validation failed:', error.message);
      return false;
    }
  }

  private async checkPidFile(): Promise<void> {
    if (existsSync(this.pidFilePath)) {
      const pid = parseInt(readFileSync(this.pidFilePath, 'utf8').trim());
      if (await this.isProcessRunning(pid)) {
        throw new Error(`Daemon already running with PID ${pid}`);
      } else {
        console.warn('Stale PID file found, removing...');
        unlinkSync(this.pidFilePath);
      }
    }
  }

  private async validateResources(): Promise<void> {
    for (const resource of this.config.requiredResources) {
      if (!existsSync(resource)) {
        throw new Error(`Required resource not available: ${resource}`);
      }
    }
  }

  private async validateArchitecture(): Promise<void> {
    const supportedPlatforms = ['linux', 'darwin']; // Support macOS for development
    const requiredArch = process.env.ENFORCEMENT_ARCH || 'x64';
    if (!supportedPlatforms.includes(platform()) || process.arch !== requiredArch) {
      throw new Error(`Unsupported architecture: ${platform()}-${process.arch}`);
    }
  }

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  createPidFile(): void {
    try {
      writeFileSync(this.pidFilePath, process.pid.toString(), 'utf8');
    } catch (error) {
      throw new Error(`Failed to create PID file: ${error.message}`);
    }
  }

  cleanup(): void {
    if (existsSync(this.pidFilePath)) {
      unlinkSync(this.pidFilePath);
    }
  }
}

export default StartupValidator;
