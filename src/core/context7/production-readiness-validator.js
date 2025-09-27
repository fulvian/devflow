/**
 * Context7 Production Readiness Validator
 *
 * Comprehensive validation system for Context7 Full Mode readiness
 * Implements multi-stage validation with detailed reporting and safety mechanisms
 */

const { performance } = require('perf_hooks');
const Database = require('better-sqlite3');

class ProductionReadinessValidator {
  constructor(options = {}) {
    this.config = {
      dbPath: options.dbPath || './data/devflow_unified.sqlite',
      metricsUrl: options.metricsUrl || 'http://localhost:9091',
      orchestratorUrl: options.orchestratorUrl || 'http://localhost:3005',
      validationTimeout: options.validationTimeout || 120000, // 2 minutes
      criticalThresholds: {
        context7Quality: 0.75,        // 75% minimum quality
        coherenceScore: 0.70,         // 70% minimum coherence
        precisionScore: 0.80,         // 80% minimum precision
        orchestratorSuccess: 0.95,    // 95% orchestrator success
        databasePerformance: 100,     // Max 100ms average query time
        systemUptime: 0.99,           // 99% uptime requirement
        taskThroughput: 10            // Min 10 completed tasks
      }
    };

    this.db = new Database(this.config.dbPath, { readonly: true });
    this.validationResults = null;
  }

  /**
   * Execute comprehensive production readiness validation
   */
  async validateProductionReadiness() {
    const validationStart = performance.now();

    console.log('🔍 Starting Context7 Production Readiness Validation...');

    const results = {
      timestamp: new Date().toISOString(),
      overallStatus: 'unknown',
      readinessScore: 0,
      criticalIssues: [],
      warnings: [],
      recommendations: [],
      validationStages: {}
    };

    try {
      // Stage 1: Context7 Quality Validation
      console.log('📊 Stage 1: Context7 Quality Assessment');
      results.validationStages.context7Quality = await this.validateContext7Quality();

      // Stage 2: System Performance Validation
      console.log('⚡ Stage 2: System Performance Assessment');
      results.validationStages.systemPerformance = await this.validateSystemPerformance();

      // Stage 3: Data Integrity Validation
      console.log('🗃️ Stage 3: Data Integrity Assessment');
      results.validationStages.dataIntegrity = await this.validateDataIntegrity();

      // Stage 4: Service Health Validation
      console.log('🏥 Stage 4: Service Health Assessment');
      results.validationStages.serviceHealth = await this.validateServiceHealth();

      // Stage 5: Task Processing Validation
      console.log('📋 Stage 5: Task Processing Assessment');
      results.validationStages.taskProcessing = await this.validateTaskProcessing();

      // Stage 6: Security & Compliance Validation
      console.log('🔒 Stage 6: Security & Compliance Assessment');
      results.validationStages.securityCompliance = await this.validateSecurityCompliance();

      // Calculate overall readiness
      this.calculateOverallReadiness(results);

      const validationDuration = performance.now() - validationStart;
      results.validationDuration = Math.round(validationDuration);

      console.log(`✅ Production readiness validation completed in ${results.validationDuration}ms`);
      console.log(`📊 Overall readiness score: ${results.readinessScore}%`);
      console.log(`🎯 Status: ${results.overallStatus}`);

      this.validationResults = results;
      return results;

    } catch (error) {
      results.overallStatus = 'error';
      results.criticalIssues.push(`Validation failed: ${error.message}`);
      console.error('❌ Production readiness validation failed:', error);
      return results;
    }
  }

  /**
   * Validate Context7 quality metrics
   */
  async validateContext7Quality() {
    const stage = {
      name: 'Context7 Quality Assessment',
      status: 'unknown',
      score: 0,
      issues: [],
      metrics: {}
    };

    try {
      // Get current Context7 metrics
      const metricsResponse = await fetch(`${this.config.metricsUrl}/json`);
      const metricsData = await metricsResponse.json();

      const context7Metrics = metricsData.metrics?.context7 || {};
      stage.metrics = context7Metrics;

      // Check quality score
      const qualityScore = context7Metrics.qualityScore || 0;
      if (qualityScore < this.config.criticalThresholds.context7Quality) {
        stage.issues.push({
          type: 'critical',
          message: `Context7 quality ${(qualityScore * 100).toFixed(1)}% below required ${(this.config.criticalThresholds.context7Quality * 100)}%`,
          current: qualityScore,
          required: this.config.criticalThresholds.context7Quality
        });
      }

      // Check coherence score
      const coherenceScore = context7Metrics.coherenceScore || 0;
      if (coherenceScore < this.config.criticalThresholds.coherenceScore) {
        stage.issues.push({
          type: 'warning',
          message: `Coherence score ${(coherenceScore * 100).toFixed(1)}% below optimal ${(this.config.criticalThresholds.coherenceScore * 100)}%`,
          current: coherenceScore,
          required: this.config.criticalThresholds.coherenceScore
        });
      }

      // Check precision score
      const precisionScore = context7Metrics.precisionScore || 0;
      if (precisionScore < this.config.criticalThresholds.precisionScore) {
        stage.issues.push({
          type: 'warning',
          message: `Precision score ${(precisionScore * 100).toFixed(1)}% below optimal ${(this.config.criticalThresholds.precisionScore * 100)}%`,
          current: precisionScore,
          required: this.config.criticalThresholds.precisionScore
        });
      }

      // Calculate stage score
      const qualityWeight = 0.6;
      const coherenceWeight = 0.2;
      const precisionWeight = 0.2;

      stage.score = Math.round(
        (qualityScore / this.config.criticalThresholds.context7Quality * qualityWeight +
         coherenceScore / this.config.criticalThresholds.coherenceScore * coherenceWeight +
         precisionScore / this.config.criticalThresholds.precisionScore * precisionWeight) * 100
      );

      stage.status = stage.score >= 75 ? 'pass' : (stage.score >= 50 ? 'warning' : 'fail');

    } catch (error) {
      stage.status = 'error';
      stage.issues.push({
        type: 'critical',
        message: `Context7 metrics unavailable: ${error.message}`
      });
    }

    return stage;
  }

  /**
   * Validate system performance metrics
   */
  async validateSystemPerformance() {
    const stage = {
      name: 'System Performance Assessment',
      status: 'unknown',
      score: 0,
      issues: [],
      metrics: {}
    };

    try {
      const metricsResponse = await fetch(`${this.config.metricsUrl}/json`);
      const metricsData = await metricsResponse.json();

      // Database performance
      const dbMetrics = metricsData.metrics?.database || {};
      stage.metrics.database = dbMetrics;

      const avgQueryTime = dbMetrics.averageQueryTime || 0;
      if (avgQueryTime > this.config.criticalThresholds.databasePerformance) {
        stage.issues.push({
          type: 'critical',
          message: `Database query time ${avgQueryTime.toFixed(2)}ms exceeds limit ${this.config.criticalThresholds.databasePerformance}ms`,
          current: avgQueryTime,
          required: this.config.criticalThresholds.databasePerformance
        });
      }

      // Orchestrator performance
      const orchestratorMetrics = metricsData.metrics?.orchestrator || {};
      stage.metrics.orchestrator = orchestratorMetrics;

      const successRate = orchestratorMetrics.successRate || 0;
      if (successRate < this.config.criticalThresholds.orchestratorSuccess * 100) {
        stage.issues.push({
          type: 'critical',
          message: `Orchestrator success rate ${successRate.toFixed(1)}% below required ${(this.config.criticalThresholds.orchestratorSuccess * 100)}%`,
          current: successRate / 100,
          required: this.config.criticalThresholds.orchestratorSuccess
        });
      }

      // Calculate performance score
      const dbScore = Math.min(100, (this.config.criticalThresholds.databasePerformance / Math.max(avgQueryTime, 1)) * 100);
      const orchestratorScore = Math.min(100, (successRate / (this.config.criticalThresholds.orchestratorSuccess * 100)) * 100);

      stage.score = Math.round((dbScore + orchestratorScore) / 2);
      stage.status = stage.score >= 75 ? 'pass' : (stage.score >= 50 ? 'warning' : 'fail');

    } catch (error) {
      stage.status = 'error';
      stage.issues.push({
        type: 'critical',
        message: `Performance metrics unavailable: ${error.message}`
      });
    }

    return stage;
  }

  /**
   * Validate data integrity
   */
  async validateDataIntegrity() {
    const stage = {
      name: 'Data Integrity Assessment',
      status: 'unknown',
      score: 0,
      issues: [],
      metrics: {}
    };

    try {
      // Check database consistency
      const tableCountQuery = "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'";
      const tableCount = this.db.prepare(tableCountQuery).get();
      stage.metrics.tableCount = tableCount.count;

      if (tableCount.count < 10) {
        stage.issues.push({
          type: 'critical',
          message: `Only ${tableCount.count} tables found, database may be corrupted`
        });
      }

      // Check Context7 data integrity
      const context7DataQuery = "SELECT COUNT(*) as count FROM context7_quality_metrics";
      try {
        const context7Count = this.db.prepare(context7DataQuery).get();
        stage.metrics.context7Records = context7Count.count;

        if (context7Count.count === 0) {
          stage.issues.push({
            type: 'critical',
            message: 'No Context7 quality metrics found in database'
          });
        }
      } catch (dbError) {
        stage.issues.push({
          type: 'critical',
          message: 'Context7 quality metrics table missing or corrupted'
        });
      }

      // Check task data integrity
      const taskDataQuery = "SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed FROM tasks";
      try {
        const taskStats = this.db.prepare(taskDataQuery).get();
        stage.metrics.taskStats = taskStats;

        if (taskStats.total === 0) {
          stage.issues.push({
            type: 'warning',
            message: 'No task data found in database'
          });
        }
      } catch (dbError) {
        stage.issues.push({
          type: 'critical',
          message: 'Task table missing or corrupted'
        });
      }

      // Calculate integrity score
      let integrityScore = 100;
      stage.issues.forEach(issue => {
        if (issue.type === 'critical') integrityScore -= 30;
        if (issue.type === 'warning') integrityScore -= 10;
      });

      stage.score = Math.max(0, integrityScore);
      stage.status = stage.score >= 75 ? 'pass' : (stage.score >= 50 ? 'warning' : 'fail');

    } catch (error) {
      stage.status = 'error';
      stage.issues.push({
        type: 'critical',
        message: `Data integrity check failed: ${error.message}`
      });
    }

    return stage;
  }

  /**
   * Validate service health
   */
  async validateServiceHealth() {
    const stage = {
      name: 'Service Health Assessment',
      status: 'unknown',
      score: 0,
      issues: [],
      metrics: {}
    };

    const services = [
      { name: 'Metrics Server', url: `${this.config.metricsUrl}/health` },
      { name: 'Orchestrator', url: `${this.config.orchestratorUrl}/health` },
      { name: 'Database Manager', url: 'http://localhost:3002/health' },
      { name: 'Context Bridge', url: 'http://localhost:3007/health' }
    ];

    let healthyServices = 0;
    stage.metrics.serviceStatus = {};

    for (const service of services) {
      try {
        const response = await fetch(service.url, {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (response.ok) {
          healthyServices++;
          stage.metrics.serviceStatus[service.name] = 'healthy';
        } else {
          stage.issues.push({
            type: 'critical',
            message: `${service.name} health check failed: ${response.status}`
          });
          stage.metrics.serviceStatus[service.name] = `unhealthy (${response.status})`;
        }
      } catch (error) {
        stage.issues.push({
          type: 'critical',
          message: `${service.name} unreachable: ${error.message}`
        });
        stage.metrics.serviceStatus[service.name] = 'unreachable';
      }
    }

    stage.score = Math.round((healthyServices / services.length) * 100);
    stage.status = stage.score >= 75 ? 'pass' : (stage.score >= 50 ? 'warning' : 'fail');

    return stage;
  }

  /**
   * Validate task processing capabilities
   */
  async validateTaskProcessing() {
    const stage = {
      name: 'Task Processing Assessment',
      status: 'unknown',
      score: 0,
      issues: [],
      metrics: {}
    };

    try {
      const metricsResponse = await fetch(`${this.config.metricsUrl}/json`);
      const metricsData = await metricsResponse.json();

      const taskMetrics = metricsData.metrics?.tasks || {};
      stage.metrics = taskMetrics;

      // Check minimum completed tasks
      const completedTasks = taskMetrics.completed || 0;
      if (completedTasks < this.config.criticalThresholds.taskThroughput) {
        stage.issues.push({
          type: 'warning',
          message: `Only ${completedTasks} completed tasks, minimum ${this.config.criticalThresholds.taskThroughput} recommended`,
          current: completedTasks,
          required: this.config.criticalThresholds.taskThroughput
        });
      }

      // Check task failure rate
      const totalTasks = taskMetrics.total || 0;
      const failedTasks = taskMetrics.failed || 0;
      const failureRate = totalTasks > 0 ? failedTasks / totalTasks : 0;

      if (failureRate > 0.05) { // 5% failure rate threshold
        stage.issues.push({
          type: 'critical',
          message: `Task failure rate ${(failureRate * 100).toFixed(1)}% exceeds 5% threshold`,
          current: failureRate,
          required: 0.05
        });
      }

      // Check average execution time
      const avgExecutionTime = taskMetrics.averageExecutionTime || 0;
      if (avgExecutionTime > 60000) { // 1 minute threshold
        stage.issues.push({
          type: 'warning',
          message: `Average task execution time ${(avgExecutionTime / 1000).toFixed(1)}s may indicate performance issues`
        });
      }

      // Calculate processing score
      const completionScore = Math.min(100, (completedTasks / this.config.criticalThresholds.taskThroughput) * 100);
      const reliabilityScore = Math.min(100, (1 - failureRate) * 100);

      stage.score = Math.round((completionScore + reliabilityScore) / 2);
      stage.status = stage.score >= 75 ? 'pass' : (stage.score >= 50 ? 'warning' : 'fail');

    } catch (error) {
      stage.status = 'error';
      stage.issues.push({
        type: 'critical',
        message: `Task processing validation failed: ${error.message}`
      });
    }

    return stage;
  }

  /**
   * Validate security and compliance
   */
  async validateSecurityCompliance() {
    const stage = {
      name: 'Security & Compliance Assessment',
      status: 'unknown',
      score: 0,
      issues: [],
      metrics: {}
    };

    try {
      // Check enforcement daemon status
      try {
        const enforcementResponse = await fetch('http://localhost:8787/health');
        if (enforcementResponse.ok) {
          stage.metrics.enforcementDaemon = 'active';
        } else {
          stage.issues.push({
            type: 'critical',
            message: 'Enforcement daemon not responding - 100-line limit enforcement disabled'
          });
        }
      } catch (error) {
        stage.issues.push({
          type: 'critical',
          message: 'Enforcement daemon unreachable'
        });
      }

      // Check database security
      const foreignKeysQuery = "PRAGMA foreign_keys";
      const foreignKeysResult = this.db.prepare(foreignKeysQuery).get();

      if (!foreignKeysResult || foreignKeysResult.foreign_keys !== 1) {
        stage.issues.push({
          type: 'warning',
          message: 'Database foreign key constraints not enabled'
        });
      }

      // Check audit trail completeness
      try {
        const auditQuery = "SELECT COUNT(*) as count FROM context7_mode_transitions";
        const auditCount = this.db.prepare(auditQuery).get();
        stage.metrics.auditRecords = auditCount.count;
      } catch (error) {
        stage.issues.push({
          type: 'warning',
          message: 'Audit trail table missing'
        });
      }

      // Calculate security score
      let securityScore = 100;
      stage.issues.forEach(issue => {
        if (issue.type === 'critical') securityScore -= 25;
        if (issue.type === 'warning') securityScore -= 10;
      });

      stage.score = Math.max(0, securityScore);
      stage.status = stage.score >= 75 ? 'pass' : (stage.score >= 50 ? 'warning' : 'fail');

    } catch (error) {
      stage.status = 'error';
      stage.issues.push({
        type: 'critical',
        message: `Security validation failed: ${error.message}`
      });
    }

    return stage;
  }

  /**
   * Calculate overall readiness score and status
   */
  calculateOverallReadiness(results) {
    const stages = Object.values(results.validationStages);

    // Calculate weighted average score
    const weights = {
      context7Quality: 0.30,      // 30% - Most critical
      systemPerformance: 0.25,   // 25% - Very important
      serviceHealth: 0.20,       // 20% - Important
      dataIntegrity: 0.15,       // 15% - Important
      taskProcessing: 0.07,      // 7% - Moderate
      securityCompliance: 0.03   // 3% - Baseline
    };

    let weightedScore = 0;
    let totalWeight = 0;

    stages.forEach(stage => {
      const weight = weights[stage.name.toLowerCase().replace(/[^a-z]/g, '')] || 0.1;
      if (stage.status !== 'error') {
        weightedScore += stage.score * weight;
        totalWeight += weight;
      }
    });

    results.readinessScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

    // Collect critical issues and warnings
    stages.forEach(stage => {
      stage.issues.forEach(issue => {
        if (issue.type === 'critical') {
          results.criticalIssues.push(`${stage.name}: ${issue.message}`);
        } else if (issue.type === 'warning') {
          results.warnings.push(`${stage.name}: ${issue.message}`);
        }
      });
    });

    // Determine overall status
    if (results.criticalIssues.length > 0) {
      results.overallStatus = 'not_ready';
    } else if (results.readinessScore >= 75) {
      results.overallStatus = 'ready';
    } else if (results.readinessScore >= 50) {
      results.overallStatus = 'needs_improvement';
    } else {
      results.overallStatus = 'not_ready';
    }

    // Generate recommendations
    this.generateRecommendations(results);
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(results) {
    if (results.readinessScore < 75) {
      results.recommendations.push('Context7 quality score needs improvement to reach 75% threshold');
    }

    if (results.warnings.length > 0) {
      results.recommendations.push('Address warning conditions to improve system reliability');
    }

    if (results.criticalIssues.length > 0) {
      results.recommendations.push('Resolve all critical issues before attempting full mode transition');
    }

    // Add specific recommendations based on failed stages
    Object.values(results.validationStages).forEach(stage => {
      if (stage.status === 'fail' && stage.name.includes('Context7')) {
        results.recommendations.push('Increase Context7 training data and quality metrics');
      }
      if (stage.status === 'fail' && stage.name.includes('Performance')) {
        results.recommendations.push('Optimize database queries and orchestrator performance');
      }
    });
  }

  /**
   * Get last validation results
   */
  getLastValidationResults() {
    return this.validationResults;
  }

  /**
   * Generate detailed report
   */
  generateDetailedReport() {
    if (!this.validationResults) {
      return 'No validation results available. Run validateProductionReadiness() first.';
    }

    const results = this.validationResults;

    let report = `
# Context7 Production Readiness Report
Generated: ${results.timestamp}
Validation Duration: ${results.validationDuration}ms

## Overall Assessment
**Status**: ${results.overallStatus.toUpperCase()}
**Readiness Score**: ${results.readinessScore}/100

`;

    // Add stage details
    Object.entries(results.validationStages).forEach(([key, stage]) => {
      report += `
### ${stage.name}
**Status**: ${stage.status.toUpperCase()}
**Score**: ${stage.score}/100

`;

      if (stage.issues.length > 0) {
        report += '**Issues**:\n';
        stage.issues.forEach(issue => {
          const icon = issue.type === 'critical' ? '🚨' : '⚠️';
          report += `${icon} ${issue.message}\n`;
        });
        report += '\n';
      }
    });

    // Add critical issues
    if (results.criticalIssues.length > 0) {
      report += `
## Critical Issues (${results.criticalIssues.length})
${results.criticalIssues.map(issue => `🚨 ${issue}`).join('\n')}

`;
    }

    // Add warnings
    if (results.warnings.length > 0) {
      report += `
## Warnings (${results.warnings.length})
${results.warnings.map(warning => `⚠️ ${warning}`).join('\n')}

`;
    }

    // Add recommendations
    if (results.recommendations.length > 0) {
      report += `
## Recommendations
${results.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

`;
    }

    return report;
  }
}

module.exports = { ProductionReadinessValidator };