// devflow-metrics-service.js
const client = require('prom-client');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { performance } = require('perf_hooks');

/**
 * DevFlow Metrics Service
 * Comprehensive monitoring for Context7-based DevFlow system
 * Tracks quality metrics, orchestrator performance, and task lifecycle
 */

class DevFlowMetricsService {
  /**
   * Initialize DevFlow metrics service
   * @param {Object} options - Configuration options
   * @param {string} options.serviceName - Name of the service
   * @param {string} options.version - Service version
   * @param {number} options.port - Port for metrics server
   * @param {string} options.dbPath - Path to SQLite database
   * @param {string} options.prefix - Custom metric prefix
   */
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'devflow-unified';
    this.version = options.version || '1.0.0';
    this.port = options.port || 9090;
    this.dbPath = options.dbPath || './devflow_unified.sqlite';
    this.prefix = options.prefix || 'devflow';

    // Initialize registries
    this.defaultRegistry = new client.Registry();
    this.orchestratorRegistry = new client.Registry();
    this.qualityRegistry = new client.Registry();
    this.databaseRegistry = new client.Registry();
    this.taskRegistry = new client.Registry();

    // Set default labels for all registries
    this.setDefaultLabels();

    // Initialize metrics
    this.initializeMetrics();

    // Initialize database connection
    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err.message);
      } else {
        console.log('Connected to SQLite database');
      }
    });

    // Initialize Express app for metrics endpoint
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Set default labels for service identification
   */
  setDefaultLabels() {
    const defaultLabels = {
      service: this.serviceName,
      version: this.version
    };

    this.defaultRegistry.setDefaultLabels(defaultLabels);
    this.orchestratorRegistry.setDefaultLabels(defaultLabels);
    this.qualityRegistry.setDefaultLabels(defaultLabels);
    this.databaseRegistry.setDefaultLabels(defaultLabels);
    this.taskRegistry.setDefaultLabels(defaultLabels);
  }

  /**
   * Initialize all metrics with appropriate registries
   */
  initializeMetrics() {
    // Context7 Quality Metrics
    this.context7QualityScore = new client.Gauge({
      name: `${this.prefix}_context7_quality_score`,
      help: 'Current Context7 quality score (0-100)',
      registers: [this.qualityRegistry]
    });

    this.context7OptimizationCount = new client.Counter({
      name: `${this.prefix}_context7_optimizations_total`,
      help: 'Total number of Context7 optimizations performed',
      registers: [this.qualityRegistry]
    });

    this.context7QualityImprovement = new client.Histogram({
      name: `${this.prefix}_context7_quality_improvement_seconds`,
      help: 'Time taken for Context7 quality improvements',
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.qualityRegistry]
    });

    // Orchestrator Performance Metrics
    this.orchestratorTaskDuration = new client.Histogram({
      name: `${this.prefix}_orchestrator_task_duration_seconds`,
      help: 'Duration of orchestrator task execution',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.orchestratorRegistry]
    });

    this.orchestratorTasksTotal = new client.Counter({
      name: `${this.prefix}_orchestrator_tasks_total`,
      help: 'Total number of orchestrator tasks',
      labelNames: ['status'],
      registers: [this.orchestratorRegistry]
    });

    this.orchestratorActiveTasks = new client.Gauge({
      name: `${this.prefix}_orchestrator_active_tasks`,
      help: 'Number of currently active orchestrator tasks',
      registers: [this.orchestratorRegistry]
    });

    // Database Performance Metrics
    this.dbQueryDuration = new client.Histogram({
      name: `${this.prefix}_database_query_duration_seconds`,
      help: 'Duration of database queries',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.databaseRegistry]
    });

    this.dbConnectionsActive = new client.Gauge({
      name: `${this.prefix}_database_connections_active`,
      help: 'Number of active database connections',
      registers: [this.databaseRegistry]
    });

    this.dbErrorsTotal = new client.Counter({
      name: `${this.prefix}_database_errors_total`,
      help: 'Total number of database errors',
      labelNames: ['operation'],
      registers: [this.databaseRegistry]
    });

    // Task Lifecycle Metrics
    this.taskStateTransitions = new client.Counter({
      name: `${this.prefix}_task_state_transitions_total`,
      help: 'Total number of task state transitions',
      labelNames: ['from_state', 'to_state'],
      registers: [this.taskRegistry]
    });

    this.taskExecutionTime = new client.Histogram({
      name: `${this.prefix}_task_execution_time_seconds`,
      help: 'Execution time of tasks from creation to completion',
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
      registers: [this.taskRegistry]
    });

    this.taskQueueLength = new client.Gauge({
      name: `${this.prefix}_task_queue_length`,
      help: 'Current number of tasks in queue',
      registers: [this.taskRegistry]
    });
  }

  /**
   * Setup Express routes for metrics endpoints
   */
  setupRoutes() {
    // Main metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', this.defaultRegistry.contentType);
        res.end(await this.defaultRegistry.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });

    // Component-specific endpoints
    this.app.get('/metrics/orchestrator', async (req, res) => {
      try {
        res.set('Content-Type', this.orchestratorRegistry.contentType);
        res.end(await this.orchestratorRegistry.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });

    this.app.get('/metrics/quality', async (req, res) => {
      try {
        res.set('Content-Type', this.qualityRegistry.contentType);
        res.end(await this.qualityRegistry.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });

    this.app.get('/metrics/database', async (req, res) => {
      try {
        res.set('Content-Type', this.databaseRegistry.contentType);
        res.end(await this.databaseRegistry.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });

    this.app.get('/metrics/tasks', async (req, res) => {
      try {
        res.set('Content-Type', this.taskRegistry.contentType);
        res.end(await this.taskRegistry.metrics());
      } catch (error) {
        res.status(500).end(error);
      }
    });
  }

  /**
   * Start the metrics server
   */
  start() {
    this.app.listen(this.port, () => {
      console.log(`${this.serviceName} metrics server listening on port ${this.port}`);
    });

    // Start periodic metric collection
    this.startPeriodicCollection();
  }

  /**
   * Start periodic collection of database and system metrics
   */
  startPeriodicCollection() {
    // Collect database metrics every 30 seconds
    setInterval(() => {
      this.collectDatabaseMetrics();
    }, 30000);

    // Collect task queue metrics every 10 seconds
    setInterval(() => {
      this.collectTaskQueueMetrics();
    }, 10000);
  }

  /**
   * Record Context7 quality metrics
   * @param {number} score - Quality score (0-100)
   * @param {number} improvementTime - Time taken for improvement in seconds
   */
  recordContext7Quality(score, improvementTime) {
    this.context7QualityScore.set(score);
    this.context7OptimizationCount.inc();
    if (improvementTime) {
      this.context7QualityImprovement.observe(improvementTime);
    }
  }

  /**
   * Record orchestrator task execution
   * @param {string} status - Task status (success, failure, timeout)
   * @param {number} duration - Task duration in seconds
   */
  recordOrchestratorTask(status, duration) {
    this.orchestratorTasksTotal.inc({ status });
    if (duration) {
      this.orchestratorTaskDuration.observe(duration);
    }
  }

  /**
   * Update active orchestrator tasks count
   * @param {number} count - Number of active tasks
   */
  updateActiveOrchestratorTasks(count) {
    this.orchestratorActiveTasks.set(count);
  }

  /**
   * Record database query performance
   * @param {number} duration - Query duration in seconds
   * @param {boolean} error - Whether the query resulted in an error
   * @param {string} operation - Type of database operation
   */
  recordDatabaseQuery(duration, error = false, operation = 'unknown') {
    this.dbQueryDuration.observe(duration);
    if (error) {
      this.dbErrorsTotal.inc({ operation });
    }
  }

  /**
   * Update active database connections count
   * @param {number} count - Number of active connections
   */
  updateActiveDatabaseConnections(count) {
    this.dbConnectionsActive.set(count);
  }

  /**
   * Record task state transition
   * @param {string} fromState - Previous state
   * @param {string} toState - New state
   */
  recordTaskStateTransition(fromState, toState) {
    this.taskStateTransitions.inc({ from_state: fromState, to_state: toState });
  }

  /**
   * Record task execution time
   * @param {number} duration - Execution time in seconds
   */
  recordTaskExecutionTime(duration) {
    this.taskExecutionTime.observe(duration);
  }

  /**
   * Update task queue length
   * @param {number} length - Current queue length
   */
  updateTaskQueueLength(length) {
    this.taskQueueLength.set(length);
  }

  /**
   * Collect database metrics from SQLite
   */
  collectDatabaseMetrics() {
    const startTime = performance.now();
    
    this.db.get("SELECT count(*) as connections FROM pragma_database_list", (err, row) => {
      const duration = (performance.now() - startTime) / 1000;
      
      if (err) {
        console.error('Error collecting database metrics:', err.message);
        this.recordDatabaseQuery(duration, true, 'connection_count');
        return;
      }
      
      this.updateActiveDatabaseConnections(row.connections);
      this.recordDatabaseQuery(duration, false, 'connection_count');
    });
  }

  /**
   * Collect task queue metrics from database
   */
  collectTaskQueueMetrics() {
    const startTime = performance.now();
    
    this.db.get("SELECT COUNT(*) as queue_length FROM tasks WHERE status = 'pending'", (err, row) => {
      const duration = (performance.now() - startTime) / 1000;
      
      if (err) {
        console.error('Error collecting task queue metrics:', err.message);
        this.recordDatabaseQuery(duration, true, 'queue_count');
        return;
      }
      
      this.updateTaskQueueLength(row.queue_length);
      this.recordDatabaseQuery(duration);
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = DevFlowMetricsService;

// Example usage:
// const metricsService = new DevFlowMetricsService({
//   serviceName: 'devflow-unified',
//   version: '1.2.0',
//   port: 9090,
//   dbPath: './devflow_unified.sqlite',
//   prefix: 'devflow'
// });
// 
// metricsService.start();
// 
// // Example metric recordings
// metricsService.recordContext7Quality(85.5, 2.3);
// metricsService.recordOrchestratorTask('success', 1.2);
// metricsService.updateActiveOrchestratorTasks(5);
// metricsService.recordTaskStateTransition('pending', 'processing');