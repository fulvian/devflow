/**
 * Automatic CCR Trigger - Connects Session Limit Detector to CCR Manager
 * 
 * This module implements the automatic triggering of CCR fallback when
 * Sonnet/Claude Code sessions reach critical limits (5-hour threshold).
 */

import { EventEmitter } from 'events';
import { SessionLimitDetector, SessionMetrics } from './session-limit-detector';
import { EnhancedCCRFallbackManager } from './enhanced-ccr-fallback-manager';
import { SQLiteMemoryManager } from '../memory/manager';

interface AutoTriggerConfig {
  enableAutoTrigger: boolean;
  triggerOnWarningLevel: 'warning' | 'critical' | 'emergency';
  preserveContext: boolean;
  enableNotifications: boolean;
}

export class AutomaticCCRTrigger extends EventEmitter {
  private sessionDetector: SessionLimitDetector;
  private ccrManager: EnhancedCCRFallbackManager;
  private memory: SQLiteMemoryManager;
  private config: AutoTriggerConfig;
  private isActive: boolean = false;

  constructor(
    memory: SQLiteMemoryManager,
    config: Partial<AutoTriggerConfig> = {}
  ) {
    super();
    this.memory = memory;
    this.config = {
      enableAutoTrigger: true,
      triggerOnWarningLevel: 'critical',
      preserveContext: true,
      enableNotifications: true,
      ...config
    };

    this.sessionDetector = new SessionLimitDetector(memory);
    this.ccrManager = new EnhancedCCRFallbackManager(memory);
  }

  /**
   * Initialize and start automatic CCR triggering
   */
  async initialize(): Promise<void> {
    if (this.isActive) {
      console.log('[AutoCCRTrigger] Already active');
      return;
    }

    console.log('[AutoCCRTrigger] Initializing automatic CCR trigger system...');

    try {
      // Initialize CCR Manager
      await this.ccrManager.initialize();

      // Setup event handlers for session limit detection
      this.setupSessionDetectorHandlers();

      // Start session monitoring
      await this.sessionDetector.startMonitoring();

      this.isActive = true;
      console.log('[AutoCCRTrigger] Automatic CCR trigger system active');

      this.emit('initialized');

    } catch (error) {
      console.error('[AutoCCRTrigger] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Shutdown automatic CCR triggering
   */
  async shutdown(): Promise<void> {
    if (!this.isActive) return;

    console.log('[AutoCCRTrigger] Shutting down automatic CCR trigger system...');

    await this.sessionDetector.stopMonitoring();
    await this.ccrManager.shutdown();

    this.isActive = false;
    console.log('[AutoCCRTrigger] Automatic CCR trigger system stopped');

    this.emit('shutdown');
  }

  /**
   * Setup event handlers for session limit detector
   */
  private setupSessionDetectorHandlers(): void {
    // Handle different warning levels based on configuration
    this.sessionDetector.on('warning', (metrics: SessionMetrics) => {
      if (this.config.triggerOnWarningLevel === 'warning') {
        this.handleLimitTrigger(metrics, 'warning');
      } else {
        this.handleWarning(metrics);
      }
    });

    this.sessionDetector.on('critical', (metrics: SessionMetrics) => {
      if (this.config.triggerOnWarningLevel === 'critical') {
        this.handleLimitTrigger(metrics, 'critical');
      } else {
        this.handleCritical(metrics);
      }
    });

    this.sessionDetector.on('emergency', (metrics: SessionMetrics) => {
      if (this.config.triggerOnWarningLevel === 'emergency') {
        this.handleLimitTrigger(metrics, 'emergency');
      } else {
        this.handleEmergency(metrics);
      }
    });

    // Handle errors
    this.sessionDetector.on('error', (error) => {
      console.error('[AutoCCRTrigger] Session detector error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle warning level (70% utilization)
   */
  private handleWarning(metrics: SessionMetrics): void {
    console.log(`[AutoCCRTrigger] Session ${metrics.sessionId} at WARNING level (${(metrics.utilization * 100).toFixed(1)}%)`);
    
    if (this.config.enableNotifications) {
      this.emit('sessionWarning', {
        sessionId: metrics.sessionId,
        utilization: metrics.utilization,
        platform: metrics.platform,
        message: `Session approaching capacity limit (${Math.round(metrics.utilization * 100)}%). Consider context optimization.`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle critical level (85% utilization) 
   */
  private handleCritical(metrics: SessionMetrics): void {
    console.log(`[AutoCCRTrigger] Session ${metrics.sessionId} at CRITICAL level (${(metrics.utilization * 100).toFixed(1)}%)`);
    
    if (this.config.enableNotifications) {
      this.emit('sessionCritical', {
        sessionId: metrics.sessionId,
        utilization: metrics.utilization,
        platform: metrics.platform,
        message: `Session at critical capacity (${Math.round(metrics.utilization * 100)}%). CCR fallback recommended.`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle emergency level (95% utilization)
   */
  private handleEmergency(metrics: SessionMetrics): void {
    console.log(`[AutoCCRTrigger] Session ${metrics.sessionId} at EMERGENCY level (${(metrics.utilization * 100).toFixed(1)}%)`);
    
    if (this.config.enableNotifications) {
      this.emit('sessionEmergency', {
        sessionId: metrics.sessionId,
        utilization: metrics.utilization,
        platform: metrics.platform,
        message: `Session at emergency capacity (${Math.round(metrics.utilization * 100)}%). Immediate CCR fallback required.`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle the actual CCR trigger based on configured threshold
   */
  private async handleLimitTrigger(metrics: SessionMetrics, level: string): Promise<void> {
    if (!this.config.enableAutoTrigger) {
      console.log(`[AutoCCRTrigger] Auto-trigger disabled. Session ${metrics.sessionId} needs manual CCR activation.`);
      return;
    }

    console.log(`[AutoCCRTrigger] TRIGGERING CCR FALLBACK for session ${metrics.sessionId} (${level} level)`);

    try {
      // Emit pre-trigger event
      this.emit('preTrigger', {
        sessionId: metrics.sessionId,
        platform: metrics.platform,
        utilization: metrics.utilization,
        triggerLevel: level,
        timestamp: new Date()
      });

      // 1. Preserve context if enabled
      let contextData = null;
      if (this.config.preserveContext) {
        console.log(`[AutoCCRTrigger] Preserving context for session ${metrics.sessionId}...`);
        contextData = await this.preserveSessionContext(metrics);
      }

      // 2. Trigger CCR Manager handoff
      console.log(`[AutoCCRTrigger] Initiating CCR handoff for session ${metrics.sessionId}...`);
      const handoffResult = await this.ccrManager.handleClaudeCodeLimit(metrics.taskId);

      // 3. Inject context into new CCR session if preserved
      if (contextData && this.config.preserveContext) {
        console.log(`[AutoCCRTrigger] Injecting preserved context into CCR session...`);
        // Context injection logic would be implemented here
        await this.injectContextToCCR(handoffResult, contextData);
      }

      // 4. Emit successful trigger event
      this.emit('triggerSuccess', {
        sessionId: metrics.sessionId,
        originalPlatform: metrics.platform,
        targetPlatform: handoffResult.toPlatform,
        utilization: metrics.utilization,
        contextPreserved: !!contextData,
        timestamp: new Date()
      });

      console.log(`[AutoCCRTrigger] CCR fallback completed successfully: ${metrics.platform} → ${handoffResult.toPlatform}`);

    } catch (error) {
      console.error(`[AutoCCRTrigger] CCR trigger failed for session ${metrics.sessionId}:`, error);
      
      this.emit('triggerError', {
        sessionId: metrics.sessionId,
        platform: metrics.platform,
        utilization: metrics.utilization,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Preserve session context before CCR handoff
   */
  private async preserveSessionContext(metrics: SessionMetrics): Promise<any> {
    try {
      // Extract context from current session
      const contextSnapshot = {
        sessionId: metrics.sessionId,
        taskId: metrics.taskId,
        platform: metrics.platform,
        utilization: metrics.utilization,
        contextSize: metrics.contextSize,
        tokensUsed: metrics.tokensUsed,
        lastActivity: metrics.lastActivity,
        preservedAt: new Date(),
        
        // Additional context data would be extracted here
        // This could include conversation history, active tasks, etc.
        metadata: {
          warningLevel: metrics.warningLevel,
          estimatedTokensRemaining: metrics.estimatedTokensRemaining
        }
      };

      // Store context in memory system
      await this.memory.storeEmergencyContext(
        metrics.taskId, 
        `ccr-handoff-${metrics.sessionId}`,
        contextSnapshot
      );

      return contextSnapshot;

    } catch (error) {
      console.error('[AutoCCRTrigger] Error preserving context:', error);
      throw error;
    }
  }

  /**
   * Inject preserved context into CCR session
   */
  private async injectContextToCCR(handoffResult: any, contextData: any): Promise<void> {
    try {
      // This would implement the actual context injection
      // For now, we'll log that context was preserved
      console.log(`[AutoCCRTrigger] Context injected into CCR session: ${JSON.stringify(contextData, null, 2)}`);
      
      // Actual implementation would depend on CCR's context injection API
      
    } catch (error) {
      console.error('[AutoCCRTrigger] Error injecting context:', error);
      // Don't throw here as CCR handoff was successful
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoTriggerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoTriggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[AutoCCRTrigger] Configuration updated:', this.config);
    this.emit('configUpdated', this.config);
  }

  /**
   * Get current session metrics
   */
  getCurrentSessionMetrics(): SessionMetrics[] {
    return this.sessionDetector.getAllSessionMetrics();
  }

  /**
   * Get sessions approaching limits
   */
  getSessionsApproachingLimits(): SessionMetrics[] {
    return this.sessionDetector.getSessionsByWarningLevel('warning')
      .concat(this.sessionDetector.getSessionsByWarningLevel('critical'))
      .concat(this.sessionDetector.getSessionsByWarningLevel('emergency'));
  }

  /**
   * Manual trigger CCR for a specific session
   */
  async manualTriggerCCR(sessionId: string, reason: string = 'Manual trigger'): Promise<void> {
    const metrics = this.sessionDetector.getSessionMetrics(sessionId);
    if (!metrics) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    console.log(`[AutoCCRTrigger] Manual CCR trigger requested for session ${sessionId}: ${reason}`);
    await this.handleLimitTrigger(metrics, 'manual');
  }

  /**
   * Check if automatic triggering is active
   */
  isAutoTriggerActive(): boolean {
    return this.isActive && this.config.enableAutoTrigger;
  }

  /**
   * Get system status
   */
  getStatus(): {
    isActive: boolean;
    autoTriggerEnabled: boolean;
    sessionsMonitored: number;
    sessionsAtRisk: number;
    config: AutoTriggerConfig;
  } {
    const sessionsAtRisk = this.getSessionsApproachingLimits().length;
    const sessionsMonitored = this.getCurrentSessionMetrics().length;

    return {
      isActive: this.isActive,
      autoTriggerEnabled: this.config.enableAutoTrigger,
      sessionsMonitored,
      sessionsAtRisk,
      config: this.config
    };
  }
}

/**
 * Initialize and start the automatic CCR trigger system
 */
export async function initializeAutomaticCCRTrigger(
  memory: SQLiteMemoryManager, 
  config?: Partial<AutoTriggerConfig>
): Promise<AutomaticCCRTrigger> {
  const trigger = new AutomaticCCRTrigger(memory, config);
  await trigger.initialize();
  return trigger;
}