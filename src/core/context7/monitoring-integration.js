/**
 * Context7 Monitoring Integration
 *
 * Integrates Context7 mode transition system with DevFlow monitoring
 * for real-time quality tracking and automatic transition triggers
 */

const EventEmitter = require('events');
const { Context7ModeTransitionController } = require('./mode-transition-controller');
const { ProductionReadinessValidator } = require('./production-readiness-validator');

class Context7MonitoringIntegration extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      metricsUrl: options.metricsUrl || 'http://localhost:9091',
      monitoringInterval: options.monitoringInterval || 60000, // 1 minute
      autoTransitionEnabled: options.autoTransitionEnabled || false,
      qualityStabilityPeriod: options.qualityStabilityPeriod || 300000, // 5 minutes
      maxAutoTransitionsPerHour: options.maxAutoTransitionsPerHour || 2
    };

    this.controller = new Context7ModeTransitionController();
    this.validator = new ProductionReadinessValidator();

    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.lastQualityCheck = null;
    this.qualityHistory = [];
    this.autoTransitionsThisHour = 0;
    this.lastHourReset = Date.now();

    // Quality trend tracking
    this.qualityTrend = {
      improving: false,
      stable: false,
      degrading: false,
      samples: []
    };
  }

  /**
   * Start monitoring Context7 quality and auto-transitions
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('📊 Context7 monitoring already active');
      return;
    }

    console.log('🚀 Starting Context7 monitoring integration...');

    this.isMonitoring = true;

    // Initial metrics collection
    this.collectMetrics();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.monitoringInterval);

    // Reset auto-transition counter every hour
    setInterval(() => {
      this.autoTransitionsThisHour = 0;
      this.lastHourReset = Date.now();
    }, 3600000); // 1 hour

    console.log(`✅ Context7 monitoring started (interval: ${this.config.monitoringInterval}ms)`);
    this.emit('monitoring_started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('🛑 Stopping Context7 monitoring...');

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('✅ Context7 monitoring stopped');
    this.emit('monitoring_stopped');
  }

  /**
   * Collect current metrics and evaluate transitions
   */
  async collectMetrics() {
    try {
      const metrics = await this.controller.getCurrentMetrics();
      const currentStatus = this.controller.getCurrentStatus();

      // Update quality history
      this.updateQualityHistory(metrics);

      // Analyze quality trend
      this.analyzeQualityTrend();

      // Check for auto-transition opportunities
      if (this.config.autoTransitionEnabled) {
        await this.checkAutoTransitionOpportunities(metrics, currentStatus);
      }

      // Update monitoring metrics
      await this.updateMonitoringMetrics(metrics, currentStatus);

      this.lastQualityCheck = Date.now();

      this.emit('metrics_collected', {
        metrics,
        currentStatus,
        qualityTrend: this.qualityTrend
      });

    } catch (error) {
      console.error('❌ Failed to collect Context7 metrics:', error.message);
      this.emit('metrics_error', error);
    }
  }

  /**
   * Update quality history for trend analysis
   */
  updateQualityHistory(metrics) {
    const qualityPoint = {
      timestamp: Date.now(),
      quality: metrics.context7Quality,
      coherence: metrics.coherenceScore,
      precision: metrics.precisionScore,
      orchestratorSuccess: metrics.orchestratorSuccessRate
    };

    this.qualityHistory.push(qualityPoint);

    // Keep only last 24 hours of data
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    this.qualityHistory = this.qualityHistory.filter(point => point.timestamp > cutoff);
  }

  /**
   * Analyze quality trend over time
   */
  analyzeQualityTrend() {
    if (this.qualityHistory.length < 5) {
      this.qualityTrend = { improving: false, stable: false, degrading: false, samples: this.qualityHistory.length };
      return;
    }

    const recent = this.qualityHistory.slice(-5); // Last 5 samples
    const older = this.qualityHistory.slice(-10, -5); // Previous 5 samples

    if (older.length === 0) {
      this.qualityTrend = { improving: false, stable: true, degrading: false, samples: recent.length };
      return;
    }

    const recentAvg = recent.reduce((sum, point) => sum + point.quality, 0) / recent.length;
    const olderAvg = older.reduce((sum, point) => sum + point.quality, 0) / older.length;

    const improvement = recentAvg - olderAvg;
    const threshold = 0.02; // 2% threshold

    this.qualityTrend = {
      improving: improvement > threshold,
      stable: Math.abs(improvement) <= threshold,
      degrading: improvement < -threshold,
      samples: this.qualityHistory.length,
      improvement: improvement,
      recentAverage: recentAvg,
      previousAverage: olderAvg
    };
  }

  /**
   * Check for automatic transition opportunities
   */
  async checkAutoTransitionOpportunities(metrics, currentStatus) {
    // Don't auto-transition if already transitioning
    if (currentStatus.transitionState !== 'stable') {
      return;
    }

    // Check auto-transition rate limit
    if (this.autoTransitionsThisHour >= this.config.maxAutoTransitionsPerHour) {
      return;
    }

    const nextMode = this.getNextMode(currentStatus.currentMode);
    if (!nextMode) {
      return; // Already at highest mode
    }

    // Evaluate readiness for next mode
    const readiness = this.controller.evaluateTransitionReadiness(metrics, nextMode);

    if (!readiness.ready) {
      return; // Not ready for transition
    }

    // Check quality stability
    if (!this.isQualityStable(nextMode)) {
      console.log(`⏳ Quality not stable enough for auto-transition to ${nextMode}`);
      return;
    }

    // Check quality trend - must be improving or stable
    if (this.qualityTrend.degrading) {
      console.log(`📉 Quality trend degrading, delaying auto-transition to ${nextMode}`);
      return;
    }

    // All checks passed - initiate auto-transition
    console.log(`🤖 Auto-transitioning from ${currentStatus.currentMode} to ${nextMode}`);

    try {
      const result = await this.controller.executeTransition(nextMode, 'auto_quality_threshold');

      this.autoTransitionsThisHour++;

      console.log(`✅ Auto-transition to ${nextMode} completed successfully`);

      this.emit('auto_transition_completed', {
        fromMode: result.fromMode,
        toMode: result.toMode,
        metrics,
        qualityTrend: this.qualityTrend
      });

    } catch (error) {
      console.error(`❌ Auto-transition to ${nextMode} failed:`, error.message);

      this.emit('auto_transition_failed', {
        targetMode: nextMode,
        error: error.message,
        metrics
      });
    }
  }

  /**
   * Check if quality is stable enough for transition
   */
  isQualityStable(targetMode) {
    const requiredStabilityPeriod = this.config.qualityStabilityPeriod;

    // Get quality threshold for target mode
    const thresholds = {
      'hybrid': 0.25,
      'full': 0.75
    };

    const requiredQuality = thresholds[targetMode];
    if (!requiredQuality) return false;

    // Check if quality has been above threshold for required period
    const cutoff = Date.now() - requiredStabilityPeriod;
    const stablePeriodSamples = this.qualityHistory.filter(point =>
      point.timestamp > cutoff && point.quality >= requiredQuality
    );

    // Need at least 3 samples in stability period
    return stablePeriodSamples.length >= 3;
  }

  /**
   * Update monitoring metrics in the database/system
   */
  async updateMonitoringMetrics(metrics, currentStatus) {
    // This would update the monitoring system with Context7-specific metrics
    // For now, we'll emit an event that the monitoring system can listen to

    this.emit('monitoring_update', {
      timestamp: Date.now(),
      context7: {
        currentMode: currentStatus.currentMode,
        transitionState: currentStatus.transitionState,
        qualityScore: metrics.context7Quality,
        coherenceScore: metrics.coherenceScore,
        precisionScore: metrics.precisionScore,
        qualityTrend: this.qualityTrend,
        autoTransitionsThisHour: this.autoTransitionsThisHour,
        nextModeReadiness: this.getNextModeReadiness(metrics, currentStatus)
      }
    });
  }

  /**
   * Get readiness status for next mode
   */
  getNextModeReadiness(metrics, currentStatus) {
    const nextMode = this.getNextMode(currentStatus.currentMode);
    if (!nextMode) return null;

    const readiness = this.controller.evaluateTransitionReadiness(metrics, nextMode);

    return {
      targetMode: nextMode,
      ready: readiness.ready,
      blockers: readiness.blockers,
      qualityStable: this.isQualityStable(nextMode)
    };
  }

  /**
   * Generate monitoring report
   */
  generateMonitoringReport() {
    const report = {
      timestamp: new Date().toISOString(),
      monitoring: {
        active: this.isMonitoring,
        interval: this.config.monitoringInterval,
        autoTransitionEnabled: this.config.autoTransitionEnabled,
        lastCheck: this.lastQualityCheck ? new Date(this.lastQualityCheck).toISOString() : null
      },
      qualityHistory: {
        totalSamples: this.qualityHistory.length,
        period: this.qualityHistory.length > 0 ?
          new Date(this.qualityHistory[0].timestamp).toISOString() + ' - ' +
          new Date(this.qualityHistory[this.qualityHistory.length - 1].timestamp).toISOString() :
          'No samples'
      },
      qualityTrend: this.qualityTrend,
      autoTransitions: {
        thisHour: this.autoTransitionsThisHour,
        maxPerHour: this.config.maxAutoTransitionsPerHour,
        lastHourReset: new Date(this.lastHourReset).toISOString()
      }
    };

    return report;
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus() {
    return {
      isMonitoring: this.isMonitoring,
      lastQualityCheck: this.lastQualityCheck,
      qualityHistorySize: this.qualityHistory.length,
      qualityTrend: this.qualityTrend,
      autoTransitionsThisHour: this.autoTransitionsThisHour,
      config: this.config
    };
  }

  /**
   * Helper methods
   */
  getNextMode(currentMode) {
    const progression = {
      'shadow': 'hybrid',
      'hybrid': 'full',
      'full': null
    };
    return progression[currentMode];
  }

  /**
   * Enable auto-transitions
   */
  enableAutoTransitions() {
    this.config.autoTransitionEnabled = true;
    console.log('🤖 Auto-transitions enabled');
    this.emit('auto_transitions_enabled');
  }

  /**
   * Disable auto-transitions
   */
  disableAutoTransitions() {
    this.config.autoTransitionEnabled = false;
    console.log('🚫 Auto-transitions disabled');
    this.emit('auto_transitions_disabled');
  }
}

module.exports = { Context7MonitoringIntegration };