import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ZombieProcessInfo } from './zombie-detector';

const execAsync = promisify(exec);

/**
 * Interface for cleanup operations
 */
export interface CleanupOperation {
  // Identification
  operationId: string; // UUID for tracking
  pid: number;
  processName: string;
  
  // Timing
  startTime: Date;
  endTime?: Date;
  timeTaken?: number; // milliseconds
  
  // Status and progress
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'retry';
  attempts: number;
  currentAttemptStartTime?: Date;
  
  // Method and execution
  cleanupMethod: CleanupMethod;
  methodHistory: CleanupMethodAttempt[];
  
  // Results
  success: boolean;
  resourcesFreed: ResourceInfo;
  errorMessage?: string;
  
  // Context
  source: 'zombie_detector' | 'manual' | 'scheduled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  initiatedBy: string; // User, system, or component name
}

/**
 * Interface for resource information
 */
export interface ResourceInfo {
  memoryFreed: number; // bytes
  fileDescriptorsFreed: number;
  networkConnectionsFreed: number;
  otherResourcesFreed: {[key: string]: number};
}

/**
 * Interface for cleanup method attempts
 */
export interface CleanupMethodAttempt {
  method: CleanupMethod;
  startTime: Date;
  endTime: Date;
  success: boolean;
  errorMessage?: string;
  resourcesFreed: ResourceInfo;
}

/**
 * Configuration for ProcessCleaner
 */
export interface ProcessCleanerConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  cleanupTimeout: number; // milliseconds
  cleanupMethods: CleanupMethod[];
  parallelCleanupLimit: number;
  safetyChecks: boolean;
}

/**
 * Cleanup methods
 */
export type CleanupMethod = 
  | 'sigterm'
  | 'sigkill'
  | 'waitpid'
  | 'parent_notification'
  | 'force_cleanup';

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  success: boolean;
  pid: number;
  methodUsed: CleanupMethod;
  resourcesRecovered: ResourceInfo;
  timeTaken: number; // milliseconds
  errorMessage?: string;
}

/**
 * Process Cleaner for DevFlow Zombie Process Resolution System
 * Automatically reaps zombie processes identified by the ZombieDetector
 */
export class ProcessCleaner extends EventEmitter {
  private config: ProcessCleanerConfig;
  private isCleaning: boolean = false;
  private cleanupQueue: CleanupOperation[] = [];
  private activeCleanups: Map<string, CleanupOperation> = new Map();
  private completedCleanups: Map<string, CleanupOperation> = new Map();

  constructor(config?: Partial<ProcessCleanerConfig>) {
    super();
    this.config = {
      maxRetries: config?.maxRetries || 3,
      retryDelay: config?.retryDelay || 5000, // 5 seconds
      cleanupTimeout: config?.cleanupTimeout || 30000, // 30 seconds
      cleanupMethods: config?.cleanupMethods || [
        'waitpid',
        'sigterm',
        'sigkill'
      ],
      parallelCleanupLimit: config?.parallelCleanupLimit || 5,
      safetyChecks: config?.safetyChecks !== undefined ? config.safetyChecks : true
    };
    
    this.log('info', 'ProcessCleaner initialized');
  }

  /**
   * Start the process cleaning
   */
  public start(): void {
    this.log('info', 'ProcessCleaner started');
    // In a real implementation, this would subscribe to ZombieDetector events
    // For now, we'll just log that it's ready
  }

  /**
   * Stop the process cleaning
   */
  public stop(): void {
    this.log('info', 'ProcessCleaner stopped');
    // Cancel any pending cleanup operations
    this.cleanupQueue = [];
    this.activeCleanups.clear();
  }

  /**
   * Queue a zombie process for cleanup
   */
  public queueZombieForCleanup(zombie: ZombieProcessInfo, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const operation: CleanupOperation = {
      operationId: this.generateOperationId(),
      pid: zombie.pid,
      processName: zombie.name,
      startTime: new Date(),
      status: 'pending',
      attempts: 0,
      cleanupMethod: 'waitpid', // Default method
      methodHistory: [],
      success: false,
      resourcesFreed: {
        memoryFreed: 0,
        fileDescriptorsFreed: 0,
        networkConnectionsFreed: 0,
        otherResourcesFreed: {}
      },
      source: 'zombie_detector',
      priority,
      initiatedBy: 'ProcessCleaner'
    };
    
    this.cleanupQueue.push(operation);
    this.log('info', `Queued zombie process ${zombie.pid} (${zombie.name}) for cleanup with priority ${priority}`);
    
    // Start processing if not already cleaning
    if (!this.isCleaning) {
      this.processCleanupQueue().catch(error => {
        this.log('error', `Error processing cleanup queue: ${error.message}`);
        this.emit('error', error);
      });
    }
  }

  /**
   * Process the cleanup queue
   */
  private async processCleanupQueue(): Promise<void> {
    if (this.isCleaning) {
      return;
    }

    this.isCleaning = true;
    this.log('debug', 'Starting cleanup queue processing');

    try {
      // Sort queue by priority (critical first, then high, etc.)
      this.cleanupQueue.sort((a, b) => {
        const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // Process cleanup operations up to the parallel limit
      while (this.cleanupQueue.length > 0 && this.activeCleanups.size < this.config.parallelCleanupLimit) {
        const operation = this.cleanupQueue.shift();
        if (operation) {
          this.activeCleanups.set(operation.operationId, operation);
          operation.status = 'in_progress';
          operation.currentAttemptStartTime = new Date();
          
          // Process the cleanup operation asynchronously
          this.processCleanupOperation(operation).catch(error => {
            this.log('error', `Error processing cleanup operation ${operation.operationId}: ${error.message}`);
            this.emit('error', error);
          });
        }
      }
    } catch (error) {
      this.log('error', `Failed to process cleanup queue: ${error.message}`);
      this.emit('error', error);
    } finally {
      this.isCleaning = false;
    }
  }

  /**
   * Process a single cleanup operation
   */
  private async processCleanupOperation(operation: CleanupOperation): Promise<void> {
    try {
      this.log('info', `Starting cleanup of process ${operation.pid} (${operation.processName})`);
      
      // Apply safety checks if enabled
      if (this.config.safetyChecks) {
        const isSafe = await this.performSafetyChecks(operation);
        if (!isSafe) {
          this.completeOperation(operation, false, 'Safety checks failed');
          return;
        }
      }
      
      // Try each cleanup method in order
      for (const method of this.config.cleanupMethods) {
        operation.attempts++;
        const attemptStartTime = Date.now();
        
        try {
          const result = await this.executeCleanupMethod(operation.pid, method);
          
          // Record the method attempt
          const attempt: CleanupMethodAttempt = {
            method,
            startTime: new Date(attemptStartTime),
            endTime: new Date(),
            success: result.success,
            errorMessage: result.errorMessage,
            resourcesFreed: result.resourcesRecovered
          };
          operation.methodHistory.push(attempt);
          
          if (result.success) {
            this.completeOperation(operation, true, undefined, result);
            return;
          } else {
            this.log('warn', `Cleanup method ${method} failed for process ${operation.pid}: ${result.errorMessage}`);
            
            // If this isn't the last method, wait before trying the next one
            if (method !== this.config.cleanupMethods[this.config.cleanupMethods.length - 1]) {
              await this.delay(this.config.retryDelay);
            }
          }
        } catch (error) {
          this.log('error', `Error executing cleanup method ${method} for process ${operation.pid}: ${error.message}`);
          
          // Record the failed attempt
          const attempt: CleanupMethodAttempt = {
            method,
            startTime: new Date(attemptStartTime),
            endTime: new Date(),
            success: false,
            errorMessage: error.message,
            resourcesFreed: {
              memoryFreed: 0,
              fileDescriptorsFreed: 0,
              networkConnectionsFreed: 0,
              otherResourcesFreed: {}
            }
          };
          operation.methodHistory.push(attempt);
        }
      }
      
      // If we get here, all methods failed
      this.completeOperation(operation, false, 'All cleanup methods failed');
      
    } catch (error) {
      this.log('error', `Failed to process cleanup operation for process ${operation.pid}: ${error.message}`);
      this.completeOperation(operation, false, error.message);
    }
  }

  /**
   * Execute a specific cleanup method
   */
  private async executeCleanupMethod(pid: number, method: CleanupMethod): Promise<CleanupResult> {
    const startTime = Date.now();
    
    try {
      let success = false;
      let errorMessage: string | undefined;
      let resourcesRecovered: ResourceInfo = {
        memoryFreed: 0,
        fileDescriptorsFreed: 0,
        networkConnectionsFreed: 0,
        otherResourcesFreed: {}
      };
      
      switch (method) {
        case 'waitpid':
          success = await this.executeWaitpid(pid);
          break;
          
        case 'sigterm':
          success = await this.sendSignal(pid, 'SIGTERM');
          break;
          
        case 'sigkill':
          success = await this.sendSignal(pid, 'SIGKILL');
          break;
          
        case 'parent_notification':
          success = await this.notifyParent(pid);
          break;
          
        case 'force_cleanup':
          success = await this.forceCleanup(pid);
          break;
          
        default:
          errorMessage = `Unknown cleanup method: ${method}`;
      }
      
      const timeTaken = Date.now() - startTime;
      
      return {
        success,
        pid,
        methodUsed: method,
        resourcesRecovered,
        timeTaken,
        errorMessage
      };
    } catch (error) {
      const timeTaken = Date.now() - startTime;
      
      return {
        success: false,
        pid,
        methodUsed: method,
        resourcesRecovered: {
          memoryFreed: 0,
          fileDescriptorsFreed: 0,
          networkConnectionsFreed: 0,
          otherResourcesFreed: {}
        },
        timeTaken,
        errorMessage: error.message
      };
    }
  }

  /**
   * Execute waitpid system call (simulated)
   */
  private async executeWaitpid(pid: number): Promise<boolean> {
    try {
      // In a real implementation, this would use a native addon or FFI to call waitpid
      // For now, we'll simulate with a simple check
      const { stdout } = await execAsync(`ps -p ${pid} -o pid= 2>/dev/null || echo ""`);
      const result = stdout.trim();
      
      // If the process doesn't exist, it's been reaped
      return result === "";
    } catch {
      // If there's an error, assume the process doesn't exist
      return true;
    }
  }

  /**
   * Send a signal to a process
   */
  private async sendSignal(pid: number, signal: string): Promise<boolean> {
    try {
      await execAsync(`kill -${signal} ${pid} 2>/dev/null`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Notify parent process to reap child (simulated)
   */
  private async notifyParent(pid: number): Promise<boolean> {
    // In a real implementation, this would communicate with the parent process
    // For now, we'll just simulate success
    this.log('debug', `Notified parent of process ${pid} to reap child`);
    return true;
  }

  /**
   * Force cleanup of a process (simulated)
   */
  private async forceCleanup(pid: number): Promise<boolean> {
    // In a real implementation, this would use more aggressive system calls
    // For now, we'll simulate with SIGKILL
    return await this.sendSignal(pid, 'SIGKILL');
  }

  /**
   * Perform safety checks before cleanup
   */
  private async performSafetyChecks(operation: CleanupOperation): Promise<boolean> {
    try {
      // Check if process still exists
      const { stdout } = await execAsync(`ps -p ${operation.pid} -o pid= 2>/dev/null || echo ""`);
      const result = stdout.trim();
      
      if (result === "") {
        this.log('debug', `Process ${operation.pid} no longer exists, skipping cleanup`);
        return false;
      }
      
      // Additional safety checks could be added here
      // For example, checking if it's a critical system process
      
      return true;
    } catch (error) {
      this.log('error', `Error performing safety checks for process ${operation.pid}: ${error.message}`);
      return false;
    }
  }

  /**
   * Complete a cleanup operation
   */
  private completeOperation(
    operation: CleanupOperation, 
    success: boolean, 
    errorMessage?: string,
    result?: CleanupResult
  ): void {
    operation.endTime = new Date();
    operation.timeTaken = operation.endTime.getTime() - operation.startTime.getTime();
    operation.status = success ? 'success' : 'failed';
    operation.success = success;
    operation.errorMessage = errorMessage;
    
    if (result) {
      operation.resourcesFreed = result.resourcesRecovered;
    }
    
    // Remove from active cleanups
    this.activeCleanups.delete(operation.operationId);
    
    // Add to completed cleanups
    this.completedCleanups.set(operation.operationId, operation);
    
    // Emit appropriate event
    if (success) {
      this.log('info', `Successfully cleaned up process ${operation.pid} (${operation.processName})`);
      this.emit('cleanupSuccess', operation);
    } else {
      this.log('error', `Failed to clean up process ${operation.pid} (${operation.processName}): ${errorMessage}`);
      this.emit('cleanupFailed', operation);
    }
    
    // Process next item in queue if available
    if (this.cleanupQueue.length > 0) {
      this.processCleanupQueue().catch(error => {
        this.log('error', `Error processing cleanup queue: ${error.message}`);
        this.emit('error', error);
      });
    }
  }

  /**
   * Generate a unique operation ID
   */
  private generateOperationId(): string {
    return 'op_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  /**
   * Delay execution
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all pending cleanup operations
   */
  public getPendingCleanups(): CleanupOperation[] {
    return [...this.cleanupQueue];
  }

  /**
   * Get all active cleanup operations
   */
  public getActiveCleanups(): CleanupOperation[] {
    return Array.from(this.activeCleanups.values());
  }

  /**
   * Get completed cleanup operations
   */
  public getCompletedCleanups(limit: number = 100): CleanupOperation[] {
    return Array.from(this.completedCleanups.values()).slice(-limit);
  }

  /**
   * Internal logging method
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    // In a real implementation, this would use a configurable log level
    const currentLevel = 1; // info level
    const messageLevel = levels[level];

    if (messageLevel >= currentLevel) {
      console.log(`[ProcessCleaner] ${level.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stop();
    this.cleanupQueue = [];
    this.activeCleanups.clear();
    this.completedCleanups.clear();
    this.log('info', 'ProcessCleaner destroyed');
  }
}

export default ProcessCleaner;