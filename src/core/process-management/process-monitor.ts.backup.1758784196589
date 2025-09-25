import { EventEmitter } from 'events';
import { spawn, exec } from 'child_process';
import { platform } from 'process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Interface for process information
 */
export interface ProcessInfo {
  pid: number;
  ppid: number;
  name: string;
  command: string;
  status: 'running' | 'sleeping' | 'zombie' | 'stopped' | 'unknown';
  startTime: Date;
  elapsedTime: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryPercent: number;
  isZombie: boolean;
  parentExists: boolean;
  zombieSince?: Date;
  scanTimestamp: Date;
  platform: NodeJS.Platform;
  userId?: number;
  groupId?: number;
}

/**
 * Configuration for ProcessMonitor
 */
export interface ProcessMonitorConfig {
  scanInterval: number;        // milliseconds
  zombieDetectionThreshold: number; // seconds
  maxConcurrentScans: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Process Monitor for DevFlow Zombie Process Resolution System
 * Continuously scans system processes and identifies potential zombie processes
 */
export class ProcessMonitor extends EventEmitter {
  private config: ProcessMonitorConfig;
  private isScanning: boolean = false;
  private scanIntervalId: NodeJS.Timeout | null = null;
  private processCache: Map<number, ProcessInfo> = new Map();
  private zombieProcesses: Map<number, ProcessInfo> = new Map();

  constructor(config?: Partial<ProcessMonitorConfig>) {
    super();
    this.config = {
      scanInterval: config?.scanInterval || 5000, // 5 seconds
      zombieDetectionThreshold: config?.zombieDetectionThreshold || 60, // 1 minute
      maxConcurrentScans: config?.maxConcurrentScans || 3,
      logLevel: config?.logLevel || 'info'
    };
    
    this.log('info', 'ProcessMonitor initialized');
  }

  /**
   * Start the process monitoring
   */
  public start(): void {
    if (this.scanIntervalId) {
      this.log('warn', 'ProcessMonitor already running');
      return;
    }

    this.log('info', `Starting ProcessMonitor with ${this.config.scanInterval}ms interval`);
    this.scanIntervalId = setInterval(() => {
      this.scanProcesses().catch(error => {
        this.log('error', `Error during process scan: ${error.message}`);
        this.emit('error', error);
      });
    }, this.config.scanInterval);
    
    // Initial scan
    this.scanProcesses().catch(error => {
      this.log('error', `Error during initial process scan: ${error.message}`);
      this.emit('error', error);
    });
  }

  /**
   * Stop the process monitoring
   */
  public stop(): void {
    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
      this.scanIntervalId = null;
      this.log('info', 'ProcessMonitor stopped');
    }
  }

  /**
   * Scan system processes and identify potential zombies
   */
  private async scanProcesses(): Promise<void> {
    if (this.isScanning) {
      this.log('debug', 'Scan already in progress, skipping');
      return;
    }

    this.isScanning = true;
    this.log('debug', 'Starting process scan');

    try {
      const processes = await this.getSystemProcesses();
      this.log('debug', `Found ${processes.length} processes`);

      // Update cache
      this.updateProcessCache(processes);

      // Emit scan complete event
      this.emit('scanComplete', processes);

      // Check for new zombies
      const newZombies = processes.filter(p => p.isZombie && !this.zombieProcesses.has(p.pid));
      for (const zombie of newZombies) {
        this.zombieProcesses.set(zombie.pid, zombie);
        this.log('info', `Zombie process detected: PID ${zombie.pid} (${zombie.name})`);
        this.emit('zombieIdentified', zombie);
      }

    } catch (error) {
      this.log('error', `Failed to scan processes: ${error.message}`);
      this.emit('error', error);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Get system processes using platform-appropriate methods
   */
  private async getSystemProcesses(): Promise<ProcessInfo[]> {
    try {
      switch (platform) {
        case 'linux':
        case 'darwin': // macOS
          return await this.getUnixProcesses();
        case 'win32':
          return await this.getWindowsProcesses();
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      this.log('error', `Failed to get system processes: ${error.message}`);
      return [];
    }
  }

  /**
   * Get processes on Unix-like systems (Linux/macOS)
   */
  private async getUnixProcesses(): Promise<ProcessInfo[]> {
    try {
      // Use ps command to get process information
      const { stdout } = await execAsync(
        'ps -eo pid,ppid,comm,pcpu,pmem,time,state,user,group --no-headers'
      );

      const lines = stdout.trim().split('\n');
      const processes: ProcessInfo[] = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 9) continue;

        const pid = parseInt(parts[0], 10);
        const ppid = parseInt(parts[1], 10);
        const name = parts[2];
        const cpuUsage = parseFloat(parts[3]) || 0;
        const memoryPercent = parseFloat(parts[4]) || 0;
        const timeStr = parts[5];
        const statusChar = parts[6];
        const userId = parseInt(parts[7], 10);
        const groupId = parseInt(parts[8], 10);

        // Parse elapsed time (format: [[dd-]hh:]mm:ss)
        const timeParts = timeStr.split(':');
        let elapsedTime = 0;
        if (timeParts.length === 3) {
          // mm:ss
          elapsedTime = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
        } else if (timeParts.length === 4) {
          // hh:mm:ss or dd-hh:mm:ss
          if (timeParts[0].includes('-')) {
            // dd-hh:mm:ss
            const [days, hours] = timeParts[0].split('-');
            elapsedTime = (parseInt(days, 10) * 24 + parseInt(hours, 10)) * 3600 + 
                         parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
          } else {
            // hh:mm:ss
            elapsedTime = parseInt(timeParts[0], 10) * 3600 + 
                         parseInt(timeParts[1], 10) * 60 + parseInt(timeParts[2], 10);
          }
        }

        // Map status character to our enum
        let status: ProcessInfo['status'] = 'unknown';
        switch (statusChar.toLowerCase()) {
          case 'r':
            status = 'running';
            break;
          case 's':
          case 'd': // Uninterruptible sleep
            status = 'sleeping';
            break;
          case 't':
            status = 'stopped';
            break;
          case 'z':
            status = 'zombie';
            break;
        }

        const processInfo: ProcessInfo = {
          pid,
          ppid,
          name,
          command: name,
          status,
          startTime: new Date(Date.now() - elapsedTime * 1000),
          elapsedTime,
          cpuUsage,
          memoryUsage: 0, // Would need to get actual memory usage separately
          memoryPercent,
          isZombie: status === 'zombie',
          parentExists: await this.parentProcessExists(ppid),
          scanTimestamp: new Date(),
          platform: platform as NodeJS.Platform,
          userId,
          groupId
        };

        // Additional zombie detection for processes with non-existent parents
        if (!processInfo.isZombie && !processInfo.parentExists && status !== 'zombie') {
          processInfo.isZombie = true;
          processInfo.zombieSince = new Date();
        }

        processes.push(processInfo);
        this.emit('processDetected', processInfo);
      }

      return processes;
    } catch (error) {
      this.log('error', `Failed to get Unix processes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get processes on Windows systems
   */
  private async getWindowsProcesses(): Promise<ProcessInfo[]> {
    try {
      // Use tasklist command to get process information
      const { stdout } = await execAsync(
        'tasklist /fo csv /v'
      );

      const lines = stdout.trim().split('\n');
      const processes: ProcessInfo[] = [];
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Parse CSV line (handle quoted fields)
        const fields = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) || [];
        
        if (fields.length < 9) continue;
        
        // Clean up quoted fields
        const cleanFields = fields.map(field => {
          return field.replace(/^"(.*)"$/, '$1').trim();
        });
        
        const name = cleanFields[0];
        const pid = parseInt(cleanFields[1], 10);
        const status = cleanFields[4].toLowerCase() as ProcessInfo['status'];
        const userId = cleanFields[6];
        // Memory is in format like "12,345 K" - convert to bytes
        const memoryStr = cleanFields[5].replace(/[^\d,]/g, '').replace(/,/g, '');
        const memoryUsage = parseInt(memoryStr, 10) * 1024 || 0;
        
        const processInfo: ProcessInfo = {
          pid,
          ppid: 0, // Windows doesn't easily provide parent PID with tasklist
          name,
          command: name,
          status: status === 'running' ? 'running' : 
                  status === 'ready' ? 'sleeping' : 
                  status.includes('not') ? 'stopped' : 'unknown',
          startTime: new Date(), // Would need to parse from Windows time format
          elapsedTime: 0,
          cpuUsage: 0, // Would need to get with other tools
          memoryUsage,
          memoryPercent: 0, // Would need total system memory
          isZombie: false, // Windows doesn't have the same zombie concept
          parentExists: true, // Default to true for Windows
          scanTimestamp: new Date(),
          platform: 'win32',
          userId: userId ? parseInt(userId, 10) : undefined
        };

        processes.push(processInfo);
        this.emit('processDetected', processInfo);
      }

      return processes;
    } catch (error) {
      this.log('error', `Failed to get Windows processes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a parent process exists
   */
  private async parentProcessExists(ppid: number): Promise<boolean> {
    if (ppid <= 1) return true; // Init and kernel processes always exist

    try {
      switch (platform) {
        case 'linux':
        case 'darwin':
          // On Unix, check if /proc/{ppid} exists (Linux) or use kill -0 (macOS/Unix)
          if (platform === 'linux') {
            const { stdout } = await execAsync(`test -d /proc/${ppid} && echo "exists" || echo "missing"`);
            return stdout.trim() === 'exists';
          } else {
            // Use kill -0 to check if process exists (doesn't actually send signal)
            await execAsync(`kill -0 ${ppid}`);
            return true;
          }
        case 'win32':
          // On Windows, use tasklist to check if parent exists
          try {
            await execAsync(`tasklist /fi "PID eq ${ppid}" /fo csv | findstr /i "${ppid}"`);
            return true;
          } catch {
            return false;
          }
        default:
          return true; // Default to assuming it exists
      }
    } catch {
      return false; // Process doesn't exist or we can't determine
    }
  }

  /**
   * Update the process cache with new information
   */
  private updateProcessCache(processes: ProcessInfo[]): void {
    // Clear old cache entries that are no longer present
    const currentPids = new Set(processes.map(p => p.pid));
    for (const pid of this.processCache.keys()) {
      if (!currentPids.has(pid)) {
        this.processCache.delete(pid);
      }
    }

    // Add/update current processes
    for (const process of processes) {
      this.processCache.set(process.pid, process);
    }
  }

  /**
   * Get all currently tracked processes
   */
  public getTrackedProcesses(): ProcessInfo[] {
    return Array.from(this.processCache.values());
  }

  /**
   * Get currently identified zombie processes
   */
  public getZombieProcesses(): ProcessInfo[] {
    return Array.from(this.zombieProcesses.values());
  }

  /**
   * Internal logging method
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel >= currentLevel) {
      console.log(`[ProcessMonitor] ${level.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stop();
    this.processCache.clear();
    this.zombieProcesses.clear();
    this.log('info', 'ProcessMonitor destroyed');
  }
}

export default ProcessMonitor;