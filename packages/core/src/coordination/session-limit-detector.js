/**
 * Session Limit Detector - Proactive Session Monitoring
 *
 * Monitors session utilization and triggers CCR fallback before limits are reached.
 * Provides intelligent threshold management and early warning system.
 */
import { EventEmitter } from 'events';
import { SQLiteMemoryManager } from '../memory/manager.js';
export class SessionLimitDetector extends EventEmitter {
    memory;
    config;
    isMonitoring = false;
    monitoringInterval = null;
    sessionMetrics = new Map();
    constructor(memory, config) {
        super();
        this.memory = memory;
        this.config = this.getDefaultConfig(config);
    }
    /**
     * Start monitoring all active sessions
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            console.log('[SessionDetector] Monitoring already active');
            return;
        }
        console.log('[SessionDetector] Starting session limit monitoring...');
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.checkAllSessions();
            }
            catch (error) {
                console.error('[SessionDetector] Monitoring error:', error);
                this.emit('error', error);
            }
        }, this.config.monitoringInterval);
        console.log('[SessionDetector] Monitoring started successfully');
    }
    /**
     * Stop monitoring
     */
    async stopMonitoring() {
        if (!this.isMonitoring)
            return;
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
    async checkAllSessions() {
        const activeSessions = await this.memory.getActiveSessions();
        for (const session of activeSessions) {
            await this.checkSession(session);
        }
    }
    /**
     * Check individual session for limits
     */
    async checkSession(session) {
        try {
            const metrics = await this.calculateSessionMetrics(session);
            this.sessionMetrics.set(session.id, metrics);
            // Check thresholds and emit events
            await this.checkThresholds(metrics);
        }
        catch (error) {
            console.error(`[SessionDetector] Error checking session ${session.id}:`, error);
        }
    }
    /**
     * Calculate comprehensive session metrics
     */
    async calculateSessionMetrics(session) {
        const platformConfig = this.config.platforms[session.platform];
        if (!platformConfig) {
            throw new Error(`Unknown platform: ${session.platform}`);
        }
        // Calculate context utilization
        const contextSize = session.contextSizeEnd || session.contextSizeStart || 0;
        const utilization = contextSize / platformConfig.maxContextSize;
        // Calculate token utilization
        const tokensUsed = session.tokensUsed || 0;
        const estimatedTokensRemaining = Math.max(0, platformConfig.maxTokens - tokensUsed);
        // Determine warning level
        const warningLevel = this.determineWarningLevel(utilization);
        const metrics = {
            sessionId: session.id,
            taskId: session.taskId,
            platform: session.platform,
            utilization,
            contextSize,
            maxContextSize: platformConfig.maxContextSize,
            tokensUsed,
            estimatedTokensRemaining,
            lastActivity: new Date(session.startTime),
            warningLevel
        };
        return metrics;
    }
    /**
     * Determine warning level based on utilization
     */
    determineWarningLevel(utilization) {
        if (utilization >= this.config.thresholds.emergency) {
            return 'emergency';
        }
        else if (utilization >= this.config.thresholds.critical) {
            return 'critical';
        }
        else if (utilization >= this.config.thresholds.warning) {
            return 'warning';
        }
        else {
            return 'normal';
        }
    }
    /**
     * Check thresholds and emit appropriate events
     */
    async checkThresholds(metrics) {
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
    async triggerEmergencyHandoff(metrics) {
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
    async triggerAggressiveCompression(metrics) {
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
    async triggerProactiveCompression(metrics) {
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
    getSessionMetrics(sessionId) {
        return this.sessionMetrics.get(sessionId);
    }
    /**
     * Get all current session metrics
     */
    getAllSessionMetrics() {
        return Array.from(this.sessionMetrics.values());
    }
    /**
     * Get sessions by warning level
     */
    getSessionsByWarningLevel(level) {
        return this.getAllSessionMetrics().filter(metrics => metrics.warningLevel === level);
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[SessionDetector] Configuration updated');
    }
    /**
     * Get default configuration
     */
    getDefaultConfig(overrides) {
        const defaultConfig = {
            monitoringInterval: 5000, // 5 seconds
            thresholds: {
                warning: 0.70, // 70%
                critical: 0.85, // 85%
                emergency: 0.95 // 95%
            },
            platforms: {
                claude_code: {
                    maxContextSize: 200000, // 200k tokens
                    maxTokens: 200000
                },
                openai_codex: {
                    maxContextSize: 128000, // 128k tokens
                    maxTokens: 128000
                },
                synthetic: {
                    maxContextSize: 32000, // 32k tokens
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
    calculateUtilization(contextSize, platform) {
        const platformConfig = this.config.platforms[platform];
        if (!platformConfig) {
            throw new Error(`Unknown platform: ${platform}`);
        }
        return Math.min(contextSize / platformConfig.maxContextSize, 1.0);
    }
    /**
     * Estimate remaining capacity
     */
    estimateRemainingCapacity(sessionId) {
        const metrics = this.sessionMetrics.get(sessionId);
        if (!metrics)
            return 0;
        return Math.max(0, metrics.maxContextSize - metrics.contextSize);
    }
    /**
     * Check if session is approaching limits
     */
    isSessionApproachingLimit(sessionId) {
        const metrics = this.sessionMetrics.get(sessionId);
        if (!metrics)
            return false;
        return metrics.warningLevel !== 'normal';
    }
    /**
     * Get monitoring status
     */
    isMonitoringActive() {
        return this.isMonitoring;
    }
    /**
     * Get configuration
     */
    getConfig() {
        return { ...this.config };
    }
}
//# sourceMappingURL=session-limit-detector.js.map