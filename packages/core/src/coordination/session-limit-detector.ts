/**
 * Session Limit Detector - Proactive Session Monitoring
 * 
 * Monitors session utilization and triggers CCR fallback before limits are reached.
 * Provides intelligent threshold management and early warning system.
 */

import { EventEmitter } from 'events';
import { SQLiteMemoryManager } from '../memory/manager.js';
import type { CoordinationSession } from '@devflow/shared';

export interface SessionMetrics {
  sessionId: string;
  taskId: string;
  platform: string;
  // Overall utilization used to derive warningLevel (max of dimensions)
  utilization: number;
  // Context/tokens utilization basis
  contextSize: number;
  maxContextSize: number;
  tokensUsed: number;
  estimatedTokensRemaining: number;
  // Time-based session limit (e.g., Sonnet 5h)
  sessionStart: Date;
  timeElapsedMs: number;
  timeRemainingMs: number;
  timeUtilization: number;
  lastActivity: Date;
  warningLevel: 'normal' | 'warning' | 'critical' | 'emergency';
}

export interface LimitThresholds {
  warning: number;    // 70% - Start proactive compression
  critical: number;   // 85% - Aggressive compression
  emergency: number;  // 95% - Emergency handoff
}

export interface DetectionConfig {
  monitoringInterval: number;  // milliseconds
  thresholds: LimitThresholds;
  platforms: {
    [platform: string]: {
      maxContextSize: number;
      maxTokens: number;
      maxSessionDurationMs?: number; // Time limit per session, if applicable
    };
  };
}

export class SessionLimitDetector extends EventEmitter {
  private memory: SQLiteMemoryManager;
  private config: DetectionConfig;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private sessionMetrics: Map<string, SessionMetrics> = new Map();

  constructor(memory: SQLiteMemoryManager, config?: Partial<DetectionConfig>) {
    super();
    this.memory = memory;
    this.config = this.getDefaultConfig(config);
  }

  /**
   * Start monitoring all active sessions
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('[SessionDetector] Monitoring already active');
      return;
    }

    console.log('[SessionDetector] Starting session limit monitoring...');
    this.isMonitoring = true;

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllSessions();
      } catch (error) {
        console.error('[SessionDetector] Monitoring error:', error);
        this.emit('error', error);
      }
    }, this.config.monitoringInterval);

    console.log('[SessionDetector] Monitoring started successfully');
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) return;

    console.log('[SessionDetector] Stopping session limit monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.sessionMetrics.clear();
    console.log('[SessionDetector] Monitoring stopped');
  }

  /**
   * Check all active sessions for limits
   */
  private async checkAllSessions(): Promise<void> {
    const activeSessions = await this.memory.getActiveSessions();
    
    for (const session of activeSessions) {
      await this.checkSession(session);
    }
  }

  /**
   * Check individual session for limits
   */
  private async checkSession(session: CoordinationSession): Promise<void> {
    try {
      const metrics = await this.calculateSessionMetrics(session);
      this.sessionMetrics.set(session.id, metrics);

      // Check thresholds and emit events
      await this.checkThresholds(metrics);

    } catch (error) {
      console.error(`[SessionDetector] Error checking session ${session.id}:`, error);
    }
  }

  /**
   * Calculate comprehensive session metrics
   */
  private async calculateSessionMetrics(session: CoordinationSession): Promise<SessionMetrics> {
    const platform = (session as any).platform || (session as any).platform_name || 'unknown';
    const platformConfig = this.config.platforms[platform];
    if (!platformConfig) {
      throw new Error(`Unknown platform: ${platform}`);
    }

    // Pull values from DB row (snake_case) or object (camelCase)
    const contextSize =
      (session as any).context_size_end ??
      (session as any).contextSizeEnd ??
      (session as any).context_size_start ??
      (session as any).contextSizeStart ??
      0;

    const tokensUsed =
      (session as any).tokens_used ??
      (session as any).final_tokens_used ??
      (session as any).tokensUsed ??
      0;

    const sessionStart = new Date(
      (session as any).start_time ?? (session as any).startTime ?? new Date().toISOString()
    );

    // Calculate context utilization
    const contextUtilization = platformConfig.maxContextSize > 0
      ? Math.min(contextSize / platformConfig.maxContextSize, 1)
      : 0;

    // Calculate token utilization (if a max is defined)
    const tokenUtilization = platformConfig.maxTokens > 0
      ? Math.min(tokensUsed / platformConfig.maxTokens, 1)
      : 0;

    // Time-based utilization (e.g., Sonnet 5h)
    const maxDurationMs = platformConfig.maxSessionDurationMs ?? 0;
    const now = Date.now();
    const timeElapsedMs = Math.max(0, now - sessionStart.getTime());
    const timeUtilization = maxDurationMs > 0
      ? Math.min(timeElapsedMs / maxDurationMs, 1)
      : 0;
    const timeRemainingMs = maxDurationMs > 0 ? Math.max(0, maxDurationMs - timeElapsedMs) : 0;

    // Overall utilization uses the highest pressure dimension
    const utilization = Math.max(contextUtilization, tokenUtilization, timeUtilization);

    const estimatedTokensRemaining = Math.max(0, platformConfig.maxTokens - tokensUsed);

    // Determine warning level based on overall utilization
    const warningLevel = this.determineWarningLevel(utilization);

    const metrics: SessionMetrics = {
      sessionId: (session as any).id,
      taskId: (session as any).task_id ?? (session as any).taskId,
      platform,
      utilization,
      contextSize,
      maxContextSize: platformConfig.maxContextSize,
      tokensUsed,
      estimatedTokensRemaining,
      sessionStart,
      timeElapsedMs,
      timeRemainingMs,
      timeUtilization,
      lastActivity: sessionStart,
      warningLevel
    };

    return metrics;
  }

  /**
   * Determine warning level based on utilization
   */
  private determineWarningLevel(utilization: number): SessionMetrics['warningLevel'] {
    if (utilization >= this.config.thresholds.emergency) {
      return 'emergency';
    } else if (utilization >= this.config.thresholds.critical) {
      return 'critical';
    } else if (utilization >= this.config.thresholds.warning) {
      return 'warning';
    } else {
      return 'normal';
    }
  }

  /**
   * Check thresholds and emit appropriate events
   */
  private async checkThresholds(metrics: SessionMetrics): Promise<void> {
    const { utilization, warningLevel } = metrics;

    switch (warningLevel) {
      case 'emergency':
        if (utilization >= this.config.thresholds.emergency) {
          console.log(`[SessionDetector] EMERGENCY: Session ${metrics.sessionId} at ${(utilization * 100).toFixed(1)}%`);
          this.emit('emergency', metrics);
          await this.triggerEmergencyHandoff(metrics);
        }
        break;

      case 'critical':
        if (utilization >= this.config.thresholds.critical) {
          console.log(`[SessionDetector] CRITICAL: Session ${metrics.sessionId} at ${(utilization * 100).toFixed(1)}%`);
          this.emit('critical', metrics);
          await this.triggerAggressiveCompression(metrics);
        }
        break;

      case 'warning':
        if (utilization >= this.config.thresholds.warning) {
          console.log(`[SessionDetector] WARNING: Session ${metrics.sessionId} at ${(utilization * 100).toFixed(1)}%`);
          this.emit('warning', metrics);
          await this.triggerProactiveCompression(metrics);
        }
        break;

      case 'normal':
        // Session is healthy, no action needed
        break;
    }
  }

  /**
   * Trigger emergency handoff
   */
  private async triggerEmergencyHandoff(metrics: SessionMetrics): Promise<void> {
    console.log(`[SessionDetector] Triggering emergency handoff for session ${metrics.sessionId}`);
    
    this.emit('emergencyHandoff', {
      sessionId: metrics.sessionId,
      taskId: metrics.taskId,
      platform: metrics.platform,
      utilization: metrics.utilization,
      timestamp: new Date()
    });
  }

  /**
   * Trigger aggressive compression
   */
  private async triggerAggressiveCompression(metrics: SessionMetrics): Promise<void> {
    console.log(`[SessionDetector] Triggering aggressive compression for session ${metrics.sessionId}`);
    
    this.emit('aggressiveCompression', {
      sessionId: metrics.sessionId,
      taskId: metrics.taskId,
      platform: metrics.platform,
      utilization: metrics.utilization,
      timestamp: new Date()
    });
  }

  /**
   * Trigger proactive compression
   */
  private async triggerProactiveCompression(metrics: SessionMetrics): Promise<void> {
    console.log(`[SessionDetector] Triggering proactive compression for session ${metrics.sessionId}`);
    
    this.emit('proactiveCompression', {
      sessionId: metrics.sessionId,
      taskId: metrics.taskId,
      platform: metrics.platform,
      utilization: metrics.utilization,
      timestamp: new Date()
    });
  }

  /**
   * Get current metrics for a session
   */
  getSessionMetrics(sessionId: string): SessionMetrics | undefined {
    return this.sessionMetrics.get(sessionId);
  }

  /**
   * Get all current session metrics
   */
  getAllSessionMetrics(): SessionMetrics[] {
    return Array.from(this.sessionMetrics.values());
  }

  /**
   * Get sessions by warning level
   */
  getSessionsByWarningLevel(level: SessionMetrics['warningLevel']): SessionMetrics[] {
    return this.getAllSessionMetrics().filter(metrics => metrics.warningLevel === level);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[SessionDetector] Configuration updated');
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(overrides?: Partial<DetectionConfig>): DetectionConfig {
    const defaultConfig: DetectionConfig = {
      monitoringInterval: 5000, // 5 seconds
      thresholds: {
        warning: 0.70,    // 70%
        critical: 0.85,  // 85%
        emergency: 0.95   // 95%
      },
      platforms: {
        // Claude Code / Sonnet: enforce 5h limit
        claude_code: {
          maxContextSize: 200000,  // 200k tokens
          maxTokens: 200000,
          maxSessionDurationMs: 5 * 60 * 60 * 1000
        },
        openai_codex: {
          maxContextSize: 128000,  // 128k tokens
          maxTokens: 128000
        },
        synthetic: {
          maxContextSize: 32000,   // 32k tokens
          maxTokens: 32000
        },
        gemini_cli: {
          maxContextSize: 1000000, // 1M tokens
          maxTokens: 1000000
        }
      }
    };

    return { ...defaultConfig, ...overrides };
  }

  /**
   * Calculate utilization from context size
   */
  calculateUtilization(contextSize: number, platform: string): number {
    const platformConfig = this.config.platforms[platform];
    if (!platformConfig) {
      throw new Error(`Unknown platform: ${platform}`);
    }

    return Math.min(contextSize / platformConfig.maxContextSize, 1.0);
  }

  /**
   * Estimate remaining capacity
   */
  estimateRemainingCapacity(sessionId: string): number {
    const metrics = this.sessionMetrics.get(sessionId);
    if (!metrics) return 0;

    return Math.max(0, metrics.maxContextSize - metrics.contextSize);
  }

  /**
   * Check if session is approaching limits
   */
  isSessionApproachingLimit(sessionId: string): boolean {
    const metrics = this.sessionMetrics.get(sessionId);
    if (!metrics) return false;

    return metrics.warningLevel !== 'normal';
  }

  /**
   * Get monitoring status
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get configuration
   */
  getConfig(): DetectionConfig {
    return { ...this.config };
  }
}
