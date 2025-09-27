import { EventEmitter } from 'events';
import { ProcessInfo } from './process-monitor';

/**
 * Extended interface for zombie process information
 */
export interface ZombieProcessInfo extends ProcessInfo {
  // Confidence and detection information
  zombieConfidence: number; // 0.0 - 1.0 confidence score
  zombieDetectionMethods: string[]; // Methods that identified this as zombie
  zombieDetectionDetails: ZombieDetectionDetails;
  
  // Temporal information
  firstDetected: Date;
  lastConfirmed: Date;
  zombieLifetime: number; // seconds since first detected
  
  // Cleanup information
  cleanupAttempts: number;
  lastCleanupAttempt?: Date;
  cleanupStatus: 'pending' | 'in_progress' | 'success' | 'failed' | 'ignored';
  
  // Impact assessment
  resourceImpact: 'low' | 'medium' | 'high';
  systemImpact: 'low' | 'medium' | 'high';
}

/**
 * Detailed detection results
 */
export interface ZombieDetectionDetails {
  statusCheck?: StatusCheckResult;
  parentValidation?: ParentValidationResult;
  resourceAnalysis?: ResourceAnalysisResult;
  behavioralAnalysis?: BehavioralAnalysisResult;
  signatureMatching?: SignatureMatchingResult;
}

export interface StatusCheckResult {
  confidence: number;
  status: string;
  isDefunct: boolean;
}

export interface ParentValidationResult {
  confidence: number;
  parentExists: boolean;
  parentPid: number;
  validationMethod: string;
}

export interface ResourceAnalysisResult {
  confidence: number;
  openFileDescriptors: number;
  memoryUsage: number;
  resourceLeaks: ResourceLeak[];
}

export interface ResourceLeak {
  type: 'file' | 'memory' | 'network' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface BehavioralAnalysisResult {
  confidence: number;
  cpuActivity: number;
  ioActivity: number;
  stateDuration: number; // seconds in same state
}

export interface SignatureMatchingResult {
  confidence: number;
  matchedSignatures: string[];
}

/**
 * Configuration for ZombieDetector
 */
export interface ZombieDetectionConfig {
  confidenceThreshold: number; // minimum confidence to report (0.0 - 1.0)
  detectionMethods: ZombieDetectionMethod[];
  scanInterval: number; // milliseconds
  maxCleanupAttempts: number;
  cleanupRetryDelay: number; // milliseconds
}

export type ZombieDetectionMethod = 
  | 'status_check'
  | 'parent_validation'
  | 'resource_leak_analysis'
  | 'behavioral_analysis'
  | 'signature_matching';

/**
 * Zombie Detector for DevFlow Zombie Process Resolution System
 * Identifies defunct processes using advanced detection algorithms
 */
export class ZombieDetector extends EventEmitter {
  private config: ZombieDetectionConfig;
  private isAnalyzing: boolean = false;
  private analysisIntervalId: NodeJS.Timeout | null = null;
  private zombieProcesses: Map<number, ZombieProcessInfo> = new Map();
  private detectionHistory: Map<number, ZombieDetectionDetails[]> = new Map();

  constructor(config?: Partial<ZombieDetectionConfig>) {
    super();
    this.config = {
      confidenceThreshold: config?.confidenceThreshold || 0.7,
      detectionMethods: config?.detectionMethods || [
        'status_check',
        'parent_validation',
        'resource_leak_analysis',
        'behavioral_analysis'
      ],
      scanInterval: config?.scanInterval || 10000, // 10 seconds
      maxCleanupAttempts: config?.maxCleanupAttempts || 3,
      cleanupRetryDelay: config?.cleanupRetryDelay || 5000 // 5 seconds
    };
    
    this.log('info', 'ZombieDetector initialized');
  }

  /**
   * Start the zombie detection
   */
  public start(): void {
    if (this.analysisIntervalId) {
      this.log('warn', 'ZombieDetector already running');
      return;
    }

    this.log('info', `Starting ZombieDetector with ${this.config.scanInterval}ms interval`);
    this.analysisIntervalId = setInterval(() => {
      this.analyzeProcesses().catch(error => {
        this.log('error', `Error during zombie analysis: ${error.message}`);
        this.emit('error', error);
      });
    }, this.config.scanInterval);
    
    // Initial analysis
    this.analyzeProcesses().catch(error => {
      this.log('error', `Error during initial zombie analysis: ${error.message}`);
      this.emit('error', error);
    });
  }

  /**
   * Stop the zombie detection
   */
  public stop(): void {
    if (this.analysisIntervalId) {
      clearInterval(this.analysisIntervalId);
      this.analysisIntervalId = null;
      this.log('info', 'ZombieDetector stopped');
    }
  }

  /**
   * Analyze processes for zombie characteristics
   */
  private async analyzeProcesses(): Promise<void> {
    if (this.isAnalyzing) {
      this.log('debug', 'Analysis already in progress, skipping');
      return;
    }

    this.isAnalyzing = true;
    this.log('debug', 'Starting zombie analysis');

    try {
      // In a real implementation, this would get processes from ProcessMonitor
      // For now, we'll simulate with an empty array
      const processes: ProcessInfo[] = [];
      
      const zombieCandidates: ZombieProcessInfo[] = [];
      
      for (const process of processes) {
        const zombieInfo = await this.analyzeProcess(process);
        if (zombieInfo && zombieInfo.zombieConfidence >= this.config.confidenceThreshold) {
          zombieCandidates.push(zombieInfo);
          
          // If this is a new zombie, emit event
          if (!this.zombieProcesses.has(process.pid)) {
            this.log('info', `Zombie process confirmed: PID ${process.pid} (${process.name}) with confidence ${zombieInfo.zombieConfidence}`);
            this.emit('zombieConfirmed', zombieInfo);
          }
        }
      }
      
      // Update zombie processes map
      this.updateZombieProcesses(zombieCandidates);
      
      // Emit analysis complete event
      this.emit('analysisComplete', zombieCandidates);

    } catch (error) {
      this.log('error', `Failed to analyze processes: ${error.message}`);
      this.emit('error', error);
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * Analyze a single process for zombie characteristics
   */
  private async analyzeProcess(process: ProcessInfo): Promise<ZombieProcessInfo | null> {
    try {
      const detectionDetails: ZombieDetectionDetails = {};
      let confidence = 0;
      let weightSum = 0;
      
      // Apply configured detection methods
      for (const method of this.config.detectionMethods) {
        switch (method) {
          case 'status_check':
            const statusResult = this.checkStatus(process);
            detectionDetails.statusCheck = statusResult;
            confidence += 0.4 * statusResult.confidence;
            weightSum += 0.4;
            break;
            
          case 'parent_validation':
            const parentResult = await this.validateParent(process);
            detectionDetails.parentValidation = parentResult;
            confidence += 0.3 * parentResult.confidence;
            weightSum += 0.3;
            break;
            
          case 'resource_leak_analysis':
            const resourceResult = await this.analyzeResourceLeaks(process);
            detectionDetails.resourceAnalysis = resourceResult;
            confidence += 0.2 * resourceResult.confidence;
            weightSum += 0.2;
            break;
            
          case 'behavioral_analysis':
            const behavioralResult = this.analyzeBehavior(process);
            detectionDetails.behavioralAnalysis = behavioralResult;
            confidence += 0.1 * behavioralResult.confidence;
            weightSum += 0.1;
            break;
        }
      }
      
      // Normalize confidence score
      const normalizedConfidence = weightSum > 0 ? confidence / weightSum : 0;
      
      // Only return as zombie if confidence meets threshold
      if (normalizedConfidence >= this.config.confidenceThreshold) {
        // Check if we've seen this process before
        const existingZombie = this.zombieProcesses.get(process.pid);
        const now = new Date();
        
        const zombieInfo: ZombieProcessInfo = {
          ...process,
          zombieConfidence: normalizedConfidence,
          zombieDetectionMethods: Object.keys(detectionDetails).filter(key => 
            detectionDetails[key as keyof ZombieDetectionDetails] !== undefined
          ),
          zombieDetectionDetails: detectionDetails,
          firstDetected: existingZombie ? existingZombie.firstDetected : now,
          lastConfirmed: now,
          zombieLifetime: existingZombie ? 
            (now.getTime() - existingZombie.firstDetected.getTime()) / 1000 : 0,
          cleanupAttempts: existingZombie ? existingZombie.cleanupAttempts : 0,
          cleanupStatus: 'pending',
          resourceImpact: this.assessResourceImpact(detectionDetails),
          systemImpact: this.assessSystemImpact(detectionDetails)
        };
        
        return zombieInfo;
      }
      
      return null;
    } catch (error) {
      this.log('error', `Failed to analyze process ${process.pid}: ${error.message}`);
      return null;
    }
  }

  /**
   * Check process status for zombie characteristics
   */
  private checkStatus(process: ProcessInfo): StatusCheckResult {
    const isDefunct = process.status === 'zombie';
    const confidence = isDefunct ? 1.0 : 0.0;
    
    return {
      confidence,
      status: process.status,
      isDefunct
    };
  }

  /**
   * Validate parent process existence
   */
  private async validateParent(process: ProcessInfo): Promise<ParentValidationResult> {
    // In a real implementation, this would check if the parent process exists
    // For now, we'll simulate based on the ProcessMonitor's parentExists property
    const parentExists = process.parentExists;
    const confidence = parentExists ? 0.0 : 0.8; // High confidence if parent doesn't exist
    
    return {
      confidence,
      parentExists,
      parentPid: process.ppid,
      validationMethod: 'process_monitor_check'
    };
  }

  /**
   * Analyze for resource leaks
   */
  private async analyzeResourceLeaks(process: ProcessInfo): Promise<ResourceAnalysisResult> {
    // In a real implementation, this would check for open file descriptors,
    // memory leaks, etc.
    // For now, we'll simulate with basic heuristics
    
    // Simulate resource leak detection
    const openFileDescriptors = 0; // Would need to get actual count
    const memoryUsage = process.memoryUsage;
    
    // Simple heuristic: high memory usage with no CPU activity might indicate a leak
    const hasPotentialLeak = process.memoryPercent > 10 && process.cpuUsage < 0.1;
    const confidence = hasPotentialLeak ? 0.6 : 0.1;
    
    return {
      confidence,
      openFileDescriptors,
      memoryUsage,
      resourceLeaks: []
    };
  }

  /**
   * Analyze process behavior
   */
  private analyzeBehavior(process: ProcessInfo): BehavioralAnalysisResult {
    // In a real implementation, this would analyze CPU activity,
    // I/O operations, state duration, etc.
    // For now, we'll simulate with basic heuristics
    
    const cpuActivity = process.cpuUsage;
    const ioActivity = 0; // Would need to measure actual I/O
    const stateDuration = process.elapsedTime; // Approximation
    
    // Simple heuristic: long duration with no CPU activity might indicate zombie
    const isInactive = cpuActivity < 0.1 && stateDuration > 300; // 5 minutes
    const confidence = isInactive ? 0.7 : 0.2;
    
    return {
      confidence,
      cpuActivity,
      ioActivity,
      stateDuration
    };
  }

  /**
   * Assess resource impact of a zombie process
   */
  private assessResourceImpact(detectionDetails: ZombieDetectionDetails): 'low' | 'medium' | 'high' {
    // Simple assessment based on resource usage
    if (detectionDetails.resourceAnalysis) {
      if (detectionDetails.resourceAnalysis.memoryUsage > 1000000000) { // 1GB
        return 'high';
      } else if (detectionDetails.resourceAnalysis.memoryUsage > 100000000) { // 100MB
        return 'medium';
      }
    }
    
    return 'low';
  }

  /**
   * Assess system impact of a zombie process
   */
  private assessSystemImpact(detectionDetails: ZombieDetectionDetails): 'low' | 'medium' | 'high' {
    // Simple assessment based on confidence and resource impact
    const confidence = Object.values(detectionDetails).reduce(
      (sum, detail) => sum + (detail ? detail.confidence : 0), 0
    ) / Object.keys(detectionDetails).length;
    
    if (confidence > 0.9) {
      return 'high';
    } else if (confidence > 0.7) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Update the zombie processes map
   */
  private updateZombieProcesses(zombies: ZombieProcessInfo[]): void {
    // Clear old zombie entries that are no longer present
    const currentPids = new Set(zombies.map(z => z.pid));
    for (const pid of this.zombieProcesses.keys()) {
      if (!currentPids.has(pid)) {
        this.zombieProcesses.delete(pid);
      }
    }

    // Add/update current zombies
    for (const zombie of zombies) {
      this.zombieProcesses.set(zombie.pid, zombie);
    }
  }

  /**
   * Get all currently identified zombie processes
   */
  public getZombieProcesses(): ZombieProcessInfo[] {
    return Array.from(this.zombieProcesses.values());
  }

  /**
   * Get zombie processes by impact level
   */
  public getZombiesByImpact(impact: 'low' | 'medium' | 'high'): ZombieProcessInfo[] {
    return Array.from(this.zombieProcesses.values()).filter(
      zombie => zombie.systemImpact === impact
    );
  }

  /**
   * Internal logging method
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    // In a real implementation, this would use the ProcessMonitor's log level
    const currentLevel = 1; // info level
    const messageLevel = levels[level];

    if (messageLevel >= currentLevel) {
      console.log(`[ZombieDetector] ${level.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stop();
    this.zombieProcesses.clear();
    this.detectionHistory.clear();
    this.log('info', 'ZombieDetector destroyed');
  }
}

export default ZombieDetector;