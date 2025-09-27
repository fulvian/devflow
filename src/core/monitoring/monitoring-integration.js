/**
 * DevFlow Prometheus Integration Layer
 * 
 * This module provides automatic lifecycle tracking and metrics collection
 * for DevFlow services, integrating with Prometheus for monitoring.
 * 
 * Features:
 * - Auto-connect to DevFlow orchestrator
 * - Context7 quality updates monitoring
 * - Database operations tracking
 * - Task state changes monitoring
 * - Health endpoint exports
 * - Service discovery handling
 * - Graceful error handling
 */

const express = require('express');
const promClient = require('prom-client');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

// Create Express app for health endpoints
const app = express();

// Configure Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const context7QualityGauge = new promClient.Gauge({
  name: 'devflow_context7_quality_score',
  help: 'Current Context7 quality score',
  registers: [register]
});

const dbOperationCounter = new promClient.Counter({
  name: 'devflow_database_operations_total',
  help: 'Total number of database operations',
  labelNames: ['operation', 'table', 'status'],
  registers: [register]
});

const taskStateGauge = new promClient.Gauge({
  name: 'devflow_task_states',
  help: 'Current task states',
  labelNames: ['state'],
  registers: [register]
});

const serviceHealthGauge = new promClient.Gauge({
  name: 'devflow_service_health',
  help: 'Health status of DevFlow services',
  labelNames: ['service'],
  registers: [register]
});

// Database connection
let db;
try {
  db = new sqlite3.Database('./devflow.db', (err) => {
    if (err) {
      console.error('Database connection error:', err);
      serviceHealthGauge.set({ service: 'database' }, 0);
    } else {
      console.log('Connected to SQLite database');
      serviceHealthGauge.set({ service: 'database' }, 1);
    }
  });
} catch (error) {
  console.error('Failed to initialize database:', error);
  serviceHealthGauge.set({ service: 'database' }, 0);
}

// WebSocket connection to DevFlow orchestrator
let orchestratorWs;
let reconnectTimeout = 5000; // 5 seconds
let maxReconnectTimeout = 60000; // 1 minute

/**
 * Connect to DevFlow orchestrator
 */
function connectToOrchestrator() {
  try {
    orchestratorWs = new WebSocket('ws://localhost:3005');
    
    orchestratorWs.on('open', () => {
      console.log('Connected to DevFlow orchestrator');
      serviceHealthGauge.set({ service: 'orchestrator' }, 1);
      reconnectTimeout = 5000; // Reset reconnect timeout on successful connection
    });
    
    orchestratorWs.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleOrchestratorMessage(message);
      } catch (error) {
        console.error('Error parsing orchestrator message:', error);
      }
    });
    
    orchestratorWs.on('error', (error) => {
      console.error('Orchestrator WebSocket error:', error);
      serviceHealthGauge.set({ service: 'orchestrator' }, 0);
    });
    
    orchestratorWs.on('close', () => {
      console.log('Orchestrator connection closed. Attempting reconnect...');
      serviceHealthGauge.set({ service: 'orchestrator' }, 0);
      
      // Implement exponential backoff for reconnection
      setTimeout(() => {
        connectToOrchestrator();
        reconnectTimeout = Math.min(reconnectTimeout * 1.5, maxReconnectTimeout);
      }, reconnectTimeout);
    });
  } catch (error) {
    console.error('Failed to connect to orchestrator:', error);
    serviceHealthGauge.set({ service: 'orchestrator' }, 0);
  }
}

/**
 * Handle messages from orchestrator
 * @param {Object} message - Message from orchestrator
 */
function handleOrchestratorMessage(message) {
  try {
    switch (message.type) {
      case 'context7.quality.update':
        context7QualityGauge.set(message.payload.quality);
        break;
        
      case 'task.state.change':
        taskStateGauge.set({ state: message.payload.state }, message.payload.count);
        break;
        
      case 'service.discovery':
        handleServiceDiscovery(message.payload);
        break;
        
      default:
        console.debug('Unhandled message type:', message.type);
    }
  } catch (error) {
    console.error('Error handling orchestrator message:', error);
  }
}

/**
 * Handle service discovery messages
 * @param {Object} payload - Service discovery payload
 */
function handleServiceDiscovery(payload) {
  try {
    if (Array.isArray(payload.services)) {
      payload.services.forEach(service => {
        serviceHealthGauge.set(
          { service: service.name }, 
          service.healthy ? 1 : 0
        );
      });
    }
  } catch (error) {
    console.error('Error handling service discovery:', error);
  }
}

/**
 * Track database operations
 * @param {string} operation - Type of operation (SELECT, INSERT, UPDATE, DELETE)
 * @param {string} table - Table name
 * @param {boolean} success - Whether operation succeeded
 */
function trackDbOperation(operation, table, success) {
  try {
    dbOperationCounter.inc({
      operation: operation,
      table: table,
      status: success ? 'success' : 'error'
    });
  } catch (error) {
    console.error('Error tracking database operation:', error);
  }
}

/**
 * Execute database query with metrics tracking
 * @param {string} query - SQL query to execute
 * @param {Array} params - Query parameters
 * @returns {Promise} - Query result
 */
function executeDbQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    const operation = query.trim().split(' ')[0].toUpperCase();
    const tableMatch = query.match(/FROM\s+(\w+)/i) || query.match(/INTO\s+(\w+)/i) || 
                      query.match(/UPDATE\s+(\w+)/i) || query.match(/DELETE\s+FROM\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : 'unknown';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        trackDbOperation(operation, table, false);
        reject(err);
      } else {
        trackDbOperation(operation, table, true);
        resolve(rows);
      }
    });
  });
}

/**
 * Initialize health endpoints
 */
function initializeHealthEndpoints() {
  // Health check endpoint
  app.get('/health', (req, res) => {
    const isHealthy = orchestratorWs && orchestratorWs.readyState === WebSocket.OPEN;
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        orchestrator: orchestratorWs ? (orchestratorWs.readyState === WebSocket.OPEN ? 'connected' : 'disconnected') : 'not_initialized',
        database: db ? 'connected' : 'disconnected'
      }
    });
  });
  
  // Prometheus metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      console.error('Error generating metrics:', error);
      res.status(500).end('');
    }
  });
  
  // Start server
  const port = process.env.METRICS_PORT || 9090;
  app.listen(port, () => {
    console.log(`DevFlow metrics server listening on port ${port}`);
  });
}

/**
 * Graceful shutdown handler
 */
function gracefulShutdown() {
  console.log('Shutting down DevFlow metrics integration...');
  
  // Close WebSocket connection
  if (orchestratorWs) {
    orchestratorWs.close();
  }
  
  // Close database connection
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      } else {
        console.log('Database connection closed');
      }
    });
  }
  
  // Clear any pending reconnection attempts
  process.exit(0);
}

// Initialize components
connectToOrchestrator();
initializeHealthEndpoints();

// Handle graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export functions for external use
module.exports = {
  executeDbQuery,
  trackDbOperation,
  register
};