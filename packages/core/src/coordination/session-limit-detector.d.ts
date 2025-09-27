/**
 * Session Limit Detector - Proactive Session Monitoring
 *
 * Monitors session utilization and triggers CCR fallback before limits are reached.
 * Provides intelligent threshold management and early warning system.
 */
import { EventEmitter } from 'events';
import { SQLiteMemoryManager } from '../memory/manager.js';
export interface SessionMetrics {
    sessionId: string;
    taskId: string;
    platform: string;
    utilization: number;
    contextSize: number;
    maxContextSize: number;
    tokensUsed: number;
    estimatedTokensRemaining: number;
    lastActivity: Date;
    warningLevel: 'normal' | 'warning' | 'critical' | 'emergency';
}
export interface LimitThresholds {
    warning: number;
    critical: number;
    emergency: number;
}
export interface DetectionConfig {
    monitoringInterval: number;
    thresholds: LimitThresholds;
    platforms: {
        [platform: string]: {
            maxContextSize: number;
            maxTokens: number;
        };
    };
}
export declare class SessionLimitDetector extends EventEmitter {
    private memory;
    private config;
    private isMonitoring;
    private monitoringInterval;
    private sessionMetrics;
    constructor(memory: SQLiteMemoryManager, config?: Partial<DetectionConfig>);
    /**
     * Start monitoring all active sessions
     */
    startMonitoring(): Promise<void>;
    /**
     * Stop monitoring
     */
    stopMonitoring(): Promise<void>;
    /**
     * Check all active sessions for limits
     */
    private checkAllSessions;
    /**
     * Check individual session for limits
     */
    private checkSession;
    /**
     * Calculate comprehensive session metrics
     */
    private calculateSessionMetrics;
    /**
     * Determine warning level based on utilization
     */
    private determineWarningLevel;
    /**
     * Check thresholds and emit appropriate events
     */
    private checkThresholds;
    /**
     * Trigger emergency handoff
     */
    private triggerEmergencyHandoff;
    /**
     * Trigger aggressive compression
     */
    private triggerAggressiveCompression;
    /**
     * Trigger proactive compression
     */
    private triggerProactiveCompression;
    /**
     * Get current metrics for a session
     */
    getSessionMetrics(sessionId: string): SessionMetrics | undefined;
    /**
     * Get all current session metrics
     */
    getAllSessionMetrics(): SessionMetrics[];
    /**
     * Get sessions by warning level
     */
    getSessionsByWarningLevel(level: SessionMetrics['warningLevel']): SessionMetrics[];
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<DetectionConfig>): void;
    /**
     * Get default configuration
     */
    private getDefaultConfig;
    /**
     * Calculate utilization from context size
     */
    calculateUtilization(contextSize: number, platform: string): number;
    /**
     * Estimate remaining capacity
     */
    estimateRemainingCapacity(sessionId: string): number;
    /**
     * Check if session is approaching limits
     */
    isSessionApproachingLimit(sessionId: string): boolean;
    /**
     * Get monitoring status
     */
    isMonitoringActive(): boolean;
    /**
     * Get configuration
     */
    getConfig(): DetectionConfig;
}
//# sourceMappingURL=session-limit-detector.d.ts.map