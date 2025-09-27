/**
 * DevFlow Metrics Collector
 * Native implementation aligned with DevFlow architecture
 *
 * Collects and exposes metrics for:
 * - Context7 quality progression
 * - Task lifecycle monitoring
 * - Database performance
 * - Orchestrator health
 */

const Database = require('better-sqlite3');
const { performance } = require('perf_hooks');
const EventEmitter = require('events');

class DevFlowMetricsCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      dbPath: options.dbPath || './data/devflow_unified.sqlite',
      collectionInterval: options.collectionInterval || 30000, // 30 seconds
      enableRealTimeUpdates: options.enableRealTimeUpdates || true,
      orchestratorUrl: options.orchestratorUrl || 'http://localhost:3005'
    };

    // Initialize database connection using better-sqlite3 (DevFlow standard)
    this.db = new Database(this.config.dbPath, {
      readonly: true,
      timeout: 5000
    });

    // Metrics storage
    this.metrics = {
      context7: {
        qualityScore: 0,
        coherenceScore: 0,
        precisionScore: 0,
        lastUpdate: null
      },
      tasks: {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
        averageExecutionTime: 0
      },
      database: {
        queryCount: 0,
        averageQueryTime: 0,
        connectionCount: 0,
        errorCount: 0
      },
      orchestrator: {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        averageResponseTime: 0,
        healthStatus: 'unknown'
      }
    };

    this.lastCollectionTime = Date.now();
    this.isCollecting = false;
  }

  /**
   * Start metrics collection
   */
  async start() {
    console.log('🚀 Starting DevFlow Metrics Collector...');

    try {
      // Initial collection
      await this.collectAllMetrics();

      // Setup periodic collection
      this.collectionInterval = setInterval(async () => {
        if (!this.isCollecting) {
          await this.collectAllMetrics();
        }
      }, this.config.collectionInterval);

      console.log(`✅ Metrics collection started (interval: ${this.config.collectionInterval}ms)`);
      this.emit('started');

    } catch (error) {
      console.error('❌ Failed to start metrics collector:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop metrics collection
   */
  stop() {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    if (this.db) {
      this.db.close();
    }

    console.log('🛑 DevFlow Metrics Collector stopped');
    this.emit('stopped');
  }

  /**
   * Collect all metrics from various sources
   */
  async collectAllMetrics() {
    if (this.isCollecting) return;

    this.isCollecting = true;
    const startTime = performance.now();

    try {
      // Collect in parallel for better performance
      await Promise.allSettled([
        this.collectContext7Metrics(),
        this.collectTaskMetrics(),
        this.collectDatabaseMetrics(),
        this.collectOrchestratorMetrics()
      ]);

      const collectionTime = performance.now() - startTime;
      this.lastCollectionTime = Date.now();

      this.emit('metrics_collected', {
        timestamp: this.lastCollectionTime,
        collectionTime: collectionTime,
        metrics: this.metrics
      });

    } catch (error) {
      console.error('Error collecting metrics:', error);
      this.emit('collection_error', error);
    } finally {
      this.isCollecting = false;
    }
  }

  /**
   * Collect Context7 quality metrics from database
   */
  async collectContext7Metrics() {
    try {
      // Get latest quality score
      const qualityQuery = `
        SELECT quality_score, coherence_score, precision_score, timestamp
        FROM context7_quality_metrics
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const qualityResult = this.db.prepare(qualityQuery).get();

      if (qualityResult) {
        this.metrics.context7 = {
          qualityScore: qualityResult.quality_score || 0,
          coherenceScore: qualityResult.coherence_score || 0,
          precisionScore: qualityResult.precision_score || 0,
          lastUpdate: qualityResult.timestamp
        };
      }

      // Check if we're in Full Mode readiness (quality > 0.75)
      const isFullModeReady = this.metrics.context7.qualityScore > 0.75;
      this.metrics.context7.fullModeReady = isFullModeReady;

    } catch (error) {
      console.error('Error collecting Context7 metrics:', error);
      this.metrics.context7.error = error.message;
    }
  }

  /**
   * Collect task lifecycle metrics
   */
  async collectTaskMetrics() {
    try {
      // Task status distribution
      const statusQuery = `
        SELECT
          status,
          COUNT(*) as count,
          AVG(
            CASE
              WHEN completed_at IS NOT NULL AND created_at IS NOT NULL
              THEN (julianday(completed_at) - julianday(created_at)) * 86400
              ELSE NULL
            END
          ) as avg_execution_seconds
        FROM tasks
        GROUP BY status
      `;

      const statusResults = this.db.prepare(statusQuery).all();

      // Reset counters
      Object.keys(this.metrics.tasks).forEach(key => {
        if (typeof this.metrics.tasks[key] === 'number') {
          this.metrics.tasks[key] = 0;
        }
      });

      let totalExecutionTime = 0;
      let completedTasks = 0;

      statusResults.forEach(row => {
        const status = row.status;
        const count = row.count;

        this.metrics.tasks.total += count;

        switch (status) {
          case 'pending':
            this.metrics.tasks.pending = count;
            break;
          case 'in_progress':
            this.metrics.tasks.inProgress = count;
            break;
          case 'completed':
            this.metrics.tasks.completed = count;
            if (row.avg_execution_seconds) {
              totalExecutionTime += row.avg_execution_seconds * count;
              completedTasks += count;
            }
            break;
          case 'failed':
            this.metrics.tasks.failed = count;
            break;
        }
      });

      // Calculate average execution time
      if (completedTasks > 0) {
        this.metrics.tasks.averageExecutionTime = totalExecutionTime / completedTasks;
      }

      // Task creation rate (tasks created in last hour)
      const recentTasksQuery = `
        SELECT COUNT(*) as recent_count
        FROM tasks
        WHERE datetime(created_at) > datetime('now', '-1 hour')
      `;

      const recentResult = this.db.prepare(recentTasksQuery).get();
      this.metrics.tasks.createdLastHour = recentResult.recent_count || 0;

    } catch (error) {
      console.error('Error collecting task metrics:', error);
      this.metrics.tasks.error = error.message;
    }
  }

  /**
   * Collect database performance metrics
   */
  async collectDatabaseMetrics() {
    try {
      const startTime = performance.now();

      // Test query performance
      const testQuery = 'SELECT COUNT(*) as total FROM sqlite_master WHERE type="table"';
      const result = this.db.prepare(testQuery).get();

      const queryTime = performance.now() - startTime;

      // Update rolling average
      if (this.metrics.database.averageQueryTime === 0) {
        this.metrics.database.averageQueryTime = queryTime;
      } else {
        // Simple exponential moving average
        this.metrics.database.averageQueryTime =
          (this.metrics.database.averageQueryTime * 0.9) + (queryTime * 0.1);
      }

      this.metrics.database.queryCount++;
      this.metrics.database.connectionCount = 1; // better-sqlite3 uses single connection
      this.metrics.database.tableCount = result.total;

      // Database size
      const sizeQuery = `
        SELECT
          page_count * page_size as size_bytes
        FROM pragma_page_count(), pragma_page_size()
      `;

      const sizeResult = this.db.prepare(sizeQuery).get();
      this.metrics.database.sizeBytes = sizeResult.size_bytes;
      this.metrics.database.sizeMB = Math.round(sizeResult.size_bytes / (1024 * 1024) * 100) / 100;

    } catch (error) {
      console.error('Error collecting database metrics:', error);
      this.metrics.database.errorCount++;
      this.metrics.database.error = error.message;
    }
  }

  /**
   * Collect orchestrator metrics via API
   */
  async collectOrchestratorMetrics() {
    try {
      const response = await fetch(`${this.config.orchestratorUrl}/api/metrics`);

      if (response.ok) {
        const data = await response.json();

        this.metrics.orchestrator = {
          totalTasks: data.performance?.totalTasks || 0,
          successfulTasks: data.performance?.successfulTasks || 0,
          failedTasks: data.performance?.failedTasks || 0,
          averageResponseTime: data.performance?.averageResponseTime || 0,
          healthStatus: data.health?.overallStatus || 'unknown',
          healthyPlatforms: data.health?.healthyPlatforms || 0,
          totalPlatforms: data.health?.totalPlatforms || 0,
          platformDistribution: data.performance?.platformDistribution || {},
          lastUpdate: new Date().toISOString()
        };

        this.metrics.orchestrator.successRate =
          this.metrics.orchestrator.totalTasks > 0
            ? (this.metrics.orchestrator.successfulTasks / this.metrics.orchestrator.totalTasks) * 100
            : 0;

      } else {
        throw new Error(`Orchestrator API returned ${response.status}`);
      }

    } catch (error) {
      console.error('Error collecting orchestrator metrics:', error);
      this.metrics.orchestrator.healthStatus = 'error';
      this.metrics.orchestrator.error = error.message;
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics() {
    return {
      timestamp: this.lastCollectionTime,
      uptime: Date.now() - this.startTime,
      ...this.metrics
    };
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics() {
    const metrics = this.getMetrics();
    const lines = [];

    // Context7 metrics
    lines.push(`# HELP devflow_context7_quality_score Current Context7 quality score`);
    lines.push(`# TYPE devflow_context7_quality_score gauge`);
    lines.push(`devflow_context7_quality_score ${metrics.context7.qualityScore}`);

    lines.push(`# HELP devflow_context7_coherence_score Current Context7 coherence score`);
    lines.push(`# TYPE devflow_context7_coherence_score gauge`);
    lines.push(`devflow_context7_coherence_score ${metrics.context7.coherenceScore}`);

    lines.push(`# HELP devflow_context7_precision_score Current Context7 precision score`);
    lines.push(`# TYPE devflow_context7_precision_score gauge`);
    lines.push(`devflow_context7_precision_score ${metrics.context7.precisionScore}`);

    // Task metrics
    lines.push(`# HELP devflow_tasks_total Total number of tasks by status`);
    lines.push(`# TYPE devflow_tasks_total gauge`);
    lines.push(`devflow_tasks_total{status="pending"} ${metrics.tasks.pending}`);
    lines.push(`devflow_tasks_total{status="in_progress"} ${metrics.tasks.inProgress}`);
    lines.push(`devflow_tasks_total{status="completed"} ${metrics.tasks.completed}`);
    lines.push(`devflow_tasks_total{status="failed"} ${metrics.tasks.failed}`);

    lines.push(`# HELP devflow_task_execution_time_seconds Average task execution time`);
    lines.push(`# TYPE devflow_task_execution_time_seconds gauge`);
    lines.push(`devflow_task_execution_time_seconds ${metrics.tasks.averageExecutionTime}`);

    // Database metrics
    lines.push(`# HELP devflow_database_query_time_ms Average database query time`);
    lines.push(`# TYPE devflow_database_query_time_ms gauge`);
    lines.push(`devflow_database_query_time_ms ${metrics.database.averageQueryTime}`);

    lines.push(`# HELP devflow_database_size_bytes Database size in bytes`);
    lines.push(`# TYPE devflow_database_size_bytes gauge`);
    lines.push(`devflow_database_size_bytes ${metrics.database.sizeBytes || 0}`);

    // Orchestrator metrics
    lines.push(`# HELP devflow_orchestrator_success_rate Orchestrator success rate percentage`);
    lines.push(`# TYPE devflow_orchestrator_success_rate gauge`);
    lines.push(`devflow_orchestrator_success_rate ${metrics.orchestrator.successRate || 0}`);

    lines.push(`# HELP devflow_orchestrator_response_time_ms Average orchestrator response time`);
    lines.push(`# TYPE devflow_orchestrator_response_time_ms gauge`);
    lines.push(`devflow_orchestrator_response_time_ms ${metrics.orchestrator.averageResponseTime}`);

    return lines.join('\n') + '\n';
  }

  /**
   * Get health status
   */
  getHealth() {
    const now = Date.now();
    const timeSinceLastCollection = now - this.lastCollectionTime;
    const isHealthy = timeSinceLastCollection < (this.config.collectionInterval * 2);

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: now,
      lastCollection: this.lastCollectionTime,
      timeSinceLastCollection,
      database: {
        connected: !!this.db,
        errorCount: this.metrics.database.errorCount
      },
      context7: {
        qualityScore: this.metrics.context7.qualityScore,
        fullModeReady: this.metrics.context7.fullModeReady
      }
    };
  }
}

module.exports = { DevFlowMetricsCollector };