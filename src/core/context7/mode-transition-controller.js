/**
 * Context7 Full Mode Progression Controller
 *
 * Implements progressive rollout deployment patterns for Context7 mode transitions
 * Based on deploy-rs safety mechanisms with production-ready validation
 *
 * Supported Modes:
 * - Shadow Mode: Context7 observes but doesn't affect operations (0-25% quality)
 * - Hybrid Mode: Selective Context7 integration (25-75% quality)
 * - Full Mode: Complete Context7 control (75%+ quality)
 */

const { performance } = require('perf_hooks');
const Database = require('better-sqlite3');
const EventEmitter = require('events');

class Context7ModeTransitionController extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      dbPath: options.dbPath || './data/devflow_unified.sqlite',
      metricsUrl: options.metricsUrl || 'http://localhost:9091',
      orchestratorUrl: options.orchestratorUrl || 'http://localhost:3005',
      transitionThresholds: {
        shadowToHybrid: 0.25,    // 25% quality threshold
        hybridToFull: 0.75,      // 75% quality threshold
        stabilityPeriod: 300000, // 5 minutes stability required
        rollbackThreshold: 0.10  // 10% quality drop triggers rollback
      },
      safetyChecks: {
        enabled: true,
        maxTransitionAttempts: 3,
        healthCheckTimeout: 30000,
        rollbackTimeout: 60000,
        confirmationRequired: true
      }
    };

    // Initialize database connection
    this.db = new Database(this.config.dbPath, { readonly: false });

    // Current mode state
    this.currentMode = 'shadow'; // shadow, hybrid, full
    this.transitionState = 'stable'; // stable, transitioning, rolling_back
    this.lastTransitionAttempt = null;
    this.transitionAttempts = 0;
    this.stabilityTimer = null;

    // Initialize mode transition tracking table
    this.initializeDatabase();

    // Load current mode from database
    this.loadCurrentModeFromDatabase();
  }

  /**
   * Initialize database tables for mode transition tracking
   */
  initializeDatabase() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS context7_mode_transitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_mode TEXT NOT NULL,
        to_mode TEXT NOT NULL,
        transition_type TEXT NOT NULL, -- 'forward', 'rollback'
        trigger_reason TEXT NOT NULL,
        quality_score REAL,
        orchestrator_success_rate REAL,
        transition_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        completion_timestamp DATETIME,
        status TEXT NOT NULL DEFAULT 'initiated', -- 'initiated', 'validating', 'applying', 'completed', 'failed', 'rolled_back'
        validation_results TEXT, -- JSON with validation details
        rollback_reason TEXT,
        attempt_number INTEGER DEFAULT 1
      )
    `;

    this.db.exec(createTableQuery);

    // Create mode state table
    const createStateTableQuery = `
      CREATE TABLE IF NOT EXISTS context7_mode_state (
        id INTEGER PRIMARY KEY,
        current_mode TEXT NOT NULL,
        transition_state TEXT NOT NULL,
        last_quality_check DATETIME,
        stability_start DATETIME,
        configuration_snapshot TEXT, -- JSON snapshot
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.exec(createStateTableQuery);

    // Initialize default state if not exists
    const initStateQuery = `
      INSERT OR IGNORE INTO context7_mode_state (id, current_mode, transition_state)
      VALUES (1, 'shadow', 'stable')
    `;

    this.db.exec(initStateQuery);
  }

  /**
   * Load current mode from database
   */
  loadCurrentModeFromDatabase() {
    const query = 'SELECT current_mode, transition_state FROM context7_mode_state WHERE id = 1';
    const result = this.db.prepare(query).get();

    if (result) {
      this.currentMode = result.current_mode;
      this.transitionState = result.transition_state;
    }
  }

  /**
   * Update mode state in database
   */
  updateModeStateInDatabase() {
    const query = `
      UPDATE context7_mode_state
      SET current_mode = ?, transition_state = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `;

    this.db.prepare(query).run(this.currentMode, this.transitionState);
  }

  /**
   * Get current system metrics for mode transition evaluation
   */
  async getCurrentMetrics() {
    try {
      const response = await fetch(`${this.config.metricsUrl}/json`);
      if (!response.ok) {
        throw new Error(`Metrics API returned ${response.status}`);
      }

      const data = await response.json();
      return {
        context7Quality: data.metrics?.context7?.qualityScore || 0,
        coherenceScore: data.metrics?.context7?.coherenceScore || 0,
        precisionScore: data.metrics?.context7?.precisionScore || 0,
        orchestratorSuccessRate: data.metrics?.orchestrator?.successRate || 0,
        totalTasks: data.metrics?.tasks?.total || 0,
        completedTasks: data.metrics?.tasks?.completed || 0,
        failedTasks: data.metrics?.tasks?.failed || 0,
        databaseHealth: data.metrics?.database?.errorCount === 0,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }
  }

  /**
   * Evaluate if system is ready for mode transition
   */
  evaluateTransitionReadiness(metrics, targetMode) {
    const readiness = {
      ready: false,
      blockers: [],
      requirements: [],
      recommendations: []
    };

    // Define requirements per mode
    const requirements = {
      hybrid: {
        minQuality: this.config.transitionThresholds.shadowToHybrid,
        minOrchestratorSuccess: 0.80, // 80% success rate
        minCompletedTasks: 10,
        maxFailureRate: 0.10 // Max 10% failure rate
      },
      full: {
        minQuality: this.config.transitionThresholds.hybridToFull,
        minOrchestratorSuccess: 0.95, // 95% success rate
        minCompletedTasks: 25,
        maxFailureRate: 0.05 // Max 5% failure rate
      }
    };

    const req = requirements[targetMode];
    if (!req) {
      readiness.blockers.push(`Unknown target mode: ${targetMode}`);
      return readiness;
    }

    // Check Context7 quality threshold
    if (metrics.context7Quality < req.minQuality) {
      readiness.blockers.push(
        `Context7 quality ${(metrics.context7Quality * 100).toFixed(1)}% below required ${(req.minQuality * 100)}%`
      );
    }

    // Check orchestrator success rate
    if (metrics.orchestratorSuccessRate < req.minOrchestratorSuccess) {
      readiness.blockers.push(
        `Orchestrator success rate ${(metrics.orchestratorSuccessRate * 100).toFixed(1)}% below required ${(req.minOrchestratorSuccess * 100)}%`
      );
    }

    // Check minimum completed tasks
    if (metrics.completedTasks < req.minCompletedTasks) {
      readiness.blockers.push(
        `Only ${metrics.completedTasks} completed tasks, minimum ${req.minCompletedTasks} required`
      );
    }

    // Check failure rate
    const failureRate = metrics.totalTasks > 0 ? metrics.failedTasks / metrics.totalTasks : 0;
    if (failureRate > req.maxFailureRate) {
      readiness.blockers.push(
        `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds maximum ${(req.maxFailureRate * 100)}%`
      );
    }

    // Check database health
    if (!metrics.databaseHealth) {
      readiness.blockers.push('Database health check failed');
    }

    // Check previous transition attempts
    if (this.transitionAttempts >= this.config.safetyChecks.maxTransitionAttempts) {
      readiness.blockers.push(`Maximum transition attempts (${this.config.safetyChecks.maxTransitionAttempts}) exceeded`);
    }

    // If no blockers, system is ready
    readiness.ready = readiness.blockers.length === 0;

    // Add requirements summary
    readiness.requirements = [
      `Context7 quality ≥ ${(req.minQuality * 100)}%`,
      `Orchestrator success ≥ ${(req.minOrchestratorSuccess * 100)}%`,
      `Completed tasks ≥ ${req.minCompletedTasks}`,
      `Failure rate ≤ ${(req.maxFailureRate * 100)}%`,
      'Database health: OK'
    ];

    return readiness;
  }

  /**
   * Execute mode transition with safety checks
   */
  async executeTransition(targetMode, reason = 'manual') {
    if (this.transitionState !== 'stable') {
      throw new Error(`Cannot transition while in state: ${this.transitionState}`);
    }

    if (this.currentMode === targetMode) {
      throw new Error(`Already in target mode: ${targetMode}`);
    }

    this.transitionState = 'transitioning';
    this.transitionAttempts++;
    this.updateModeStateInDatabase();

    // Record transition initiation
    const transitionId = this.recordTransitionStart(this.currentMode, targetMode, reason);

    try {
      // Step 1: Get current metrics
      const metrics = await this.getCurrentMetrics();

      // Step 2: Evaluate readiness
      const readiness = this.evaluateTransitionReadiness(metrics, targetMode);

      if (!readiness.ready) {
        throw new Error(`Transition blocked: ${readiness.blockers.join(', ')}`);
      }

      // Step 3: Perform pre-transition validation
      await this.performPreTransitionValidation(targetMode, metrics);

      // Step 4: Apply transition
      const result = await this.applyModeTransition(targetMode);

      // Step 5: Post-transition validation
      await this.performPostTransitionValidation(targetMode);

      // Step 6: Complete transition
      this.currentMode = targetMode;
      this.transitionState = 'stable';
      this.transitionAttempts = 0; // Reset on successful transition
      this.updateModeStateInDatabase();

      this.recordTransitionCompletion(transitionId, 'completed', result);

      this.emit('transitionCompleted', {
        fromMode: this.currentMode,
        toMode: targetMode,
        reason,
        metrics,
        result
      });

      return {
        success: true,
        fromMode: this.currentMode,
        toMode: targetMode,
        transitionId,
        metrics,
        result
      };

    } catch (error) {
      // Rollback on failure
      await this.performRollback(transitionId, error.message);
      throw error;
    }
  }

  /**
   * Perform pre-transition validation
   */
  async performPreTransitionValidation(targetMode, metrics) {
    // Validate system components are healthy
    const healthChecks = await Promise.allSettled([
      this.checkOrchestratorHealth(),
      this.checkDatabaseHealth(),
      this.checkContextBridgeHealth()
    ]);

    const failures = healthChecks
      .map((result, index) => ({ index, result }))
      .filter(({ result }) => result.status === 'rejected')
      .map(({ index, result }) => {
        const components = ['orchestrator', 'database', 'context-bridge'];
        return `${components[index]}: ${result.reason}`;
      });

    if (failures.length > 0) {
      throw new Error(`Health check failures: ${failures.join(', ')}`);
    }

    // Additional mode-specific validations
    if (targetMode === 'full') {
      await this.validateFullModePrerequisites(metrics);
    }
  }

  /**
   * Apply the actual mode transition
   */
  async applyModeTransition(targetMode) {
    // This would integrate with actual Context7 mode switching
    // For now, we simulate the transition

    console.log(`🔄 Applying Context7 mode transition to: ${targetMode}`);

    // Simulate transition time
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      applied: true,
      targetMode,
      timestamp: new Date().toISOString(),
      configurationChanges: [
        `Mode switched to ${targetMode}`,
        'Context7 routing updated',
        'Quality thresholds adjusted'
      ]
    };
  }

  /**
   * Perform post-transition validation
   */
  async performPostTransitionValidation(targetMode) {
    // Wait for system to stabilize
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Re-check metrics after transition
    const postMetrics = await this.getCurrentMetrics();

    // Validate metrics haven't degraded significantly
    const qualityDrop = this.lastKnownQuality - postMetrics.context7Quality;
    if (qualityDrop > this.config.transitionThresholds.rollbackThreshold) {
      throw new Error(`Quality dropped by ${(qualityDrop * 100).toFixed(1)}% after transition`);
    }
  }

  /**
   * Perform rollback on transition failure
   */
  async performRollback(transitionId, reason) {
    console.log(`🔙 Rolling back transition due to: ${reason}`);

    this.transitionState = 'rolling_back';
    this.updateModeStateInDatabase();

    try {
      // Restore previous mode configuration
      await this.restorePreviousConfiguration();

      this.transitionState = 'stable';
      this.updateModeStateInDatabase();

      this.recordTransitionCompletion(transitionId, 'rolled_back', { reason });

      this.emit('transitionRolledBack', {
        transitionId,
        reason,
        currentMode: this.currentMode
      });

    } catch (rollbackError) {
      this.recordTransitionCompletion(transitionId, 'failed', {
        originalError: reason,
        rollbackError: rollbackError.message
      });
      throw new Error(`Rollback failed: ${rollbackError.message}`);
    }
  }

  /**
   * Get current mode status
   */
  getCurrentStatus() {
    return {
      currentMode: this.currentMode,
      transitionState: this.transitionState,
      transitionAttempts: this.transitionAttempts,
      lastTransitionAttempt: this.lastTransitionAttempt,
      config: this.config.transitionThresholds
    };
  }

  // Helper methods for health checks
  async checkOrchestratorHealth() {
    const response = await fetch(`${this.config.orchestratorUrl}/health`);
    if (!response.ok) throw new Error(`Orchestrator unhealthy: ${response.status}`);
  }

  async checkDatabaseHealth() {
    const result = this.db.prepare('SELECT 1 as test').get();
    if (!result) throw new Error('Database query failed');
  }

  async checkContextBridgeHealth() {
    // Context bridge health check would go here
    return true;
  }

  async validateFullModePrerequisites(metrics) {
    // Additional validations specific to full mode
    if (metrics.coherenceScore < 0.70) {
      throw new Error(`Coherence score ${metrics.coherenceScore} too low for full mode`);
    }
  }

  async restorePreviousConfiguration() {
    // Restore previous Context7 configuration
    console.log('📥 Restoring previous configuration');
  }

  // Database helper methods
  recordTransitionStart(fromMode, toMode, reason) {
    const query = `
      INSERT INTO context7_mode_transitions
      (from_mode, to_mode, transition_type, trigger_reason, attempt_number)
      VALUES (?, ?, 'forward', ?, ?)
    `;

    const result = this.db.prepare(query).run(fromMode, toMode, reason, this.transitionAttempts);
    return result.lastInsertRowid;
  }

  recordTransitionCompletion(transitionId, status, details) {
    const query = `
      UPDATE context7_mode_transitions
      SET status = ?, completion_timestamp = CURRENT_TIMESTAMP, validation_results = ?
      WHERE id = ?
    `;

    this.db.prepare(query).run(status, JSON.stringify(details), transitionId);
  }
}

module.exports = { Context7ModeTransitionController };