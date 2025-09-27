/**
 * DevFlow Monitoring System - Main Entry Point
 * Native implementation perfectly aligned with DevFlow architecture
 *
 * Features:
 * - Context7 quality progression monitoring
 * - Real-time task lifecycle tracking
 * - Database performance metrics
 * - Orchestrator health monitoring
 * - Prometheus-compatible endpoints
 * - Native better-sqlite3 integration
 */

const { DevFlowMetricsServer } = require('./metrics-server');
const { DevFlowMetricsCollector } = require('./devflow-metrics-collector');

// Global server instance
let metricsServer = null;

/**
 * Start the DevFlow monitoring system
 */
async function startMonitoring(options = {}) {
  try {
    const config = {
      port: options.port || process.env.DEVFLOW_METRICS_PORT || 9091,
      host: options.host || process.env.DEVFLOW_METRICS_HOST || '0.0.0.0',
      collector: {
        dbPath: options.dbPath || process.env.DEVFLOW_DB_PATH || './data/devflow_unified.sqlite',
        collectionInterval: options.collectionInterval || 30000,
        orchestratorUrl: options.orchestratorUrl || process.env.ORCHESTRATOR_URL || 'http://localhost:3005',
        enableRealTimeUpdates: options.enableRealTimeUpdates !== false
      },
      enableCors: options.enableCors !== false,
      ...options
    };

    console.log('🚀 Starting DevFlow Monitoring System...');
    console.log('📊 Configuration:', {
      port: config.port,
      host: config.host,
      dbPath: config.collector.dbPath,
      orchestratorUrl: config.collector.orchestratorUrl,
      collectionInterval: `${config.collector.collectionInterval}ms`
    });

    // Create and start metrics server
    metricsServer = new DevFlowMetricsServer(config);
    const startResult = await metricsServer.start();

    // Setup graceful shutdown
    setupGracefulShutdown();

    console.log('✅ DevFlow Monitoring System started successfully');
    console.log(`🌐 Metrics available at: http://${startResult.host}:${startResult.port}`);

    return {
      server: metricsServer,
      ...startResult
    };

  } catch (error) {
    console.error('❌ Failed to start monitoring system:', error);
    throw error;
  }
}

/**
 * Stop the monitoring system
 */
async function stopMonitoring() {
  try {
    if (metricsServer) {
      console.log('🛑 Stopping DevFlow Monitoring System...');
      await metricsServer.stop();
      metricsServer = null;
      console.log('✅ Monitoring system stopped');
    }
  } catch (error) {
    console.error('❌ Error stopping monitoring system:', error);
    throw error;
  }
}

/**
 * Get current monitoring status
 */
function getMonitoringStatus() {
  if (!metricsServer) {
    return { status: 'stopped' };
  }

  return {
    status: 'running',
    server: metricsServer.getStatus(),
    health: metricsServer.metricsCollector.getHealth()
  };
}

/**
 * Get current metrics
 */
function getCurrentMetrics() {
  if (!metricsServer) {
    throw new Error('Monitoring system not started');
  }

  return metricsServer.metricsCollector.getMetrics();
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
    try {
      await stopMonitoring();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * CLI interface
 */
async function runCLI() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'start':
      try {
        await startMonitoring();

        // Keep the process running
        console.log('📡 Monitoring system running... Press Ctrl+C to stop');

      } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
      }
      break;

    case 'test':
      try {
        console.log('🧪 Testing monitoring system...');

        const result = await startMonitoring({
          port: 9092,
          collectionInterval: 5000
        });

        console.log('✅ Test server started:', result);

        // Collect metrics once and show results
        setTimeout(async () => {
          const metrics = getCurrentMetrics();
          console.log('📊 Sample metrics:', JSON.stringify(metrics, null, 2));

          console.log('🛑 Stopping test server...');
          await stopMonitoring();
          process.exit(0);
        }, 10000);

      } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
      }
      break;

    case 'status':
      try {
        const collector = new DevFlowMetricsCollector();
        await collector.start();

        const metrics = collector.getMetrics();
        const health = collector.getHealth();

        console.log('📊 DevFlow Monitoring Status:');
        console.log('  Context7 Quality:', `${(metrics.context7.qualityScore * 100).toFixed(1)}%`);
        console.log('  Full Mode Ready:', metrics.context7.fullModeReady ? '✅' : '❌');
        console.log('  Total Tasks:', metrics.tasks.total);
        console.log('  Database Size:', `${metrics.database.sizeMB || 0} MB`);
        console.log('  Health Status:', health.status);

        collector.stop();
        process.exit(0);

      } catch (error) {
        console.error('Status check failed:', error);
        process.exit(1);
      }
      break;

    default:
      console.log('🔧 DevFlow Monitoring System');
      console.log('');
      console.log('Usage:');
      console.log('  node index.js start     # Start monitoring server');
      console.log('  node index.js test      # Run test instance');
      console.log('  node index.js status    # Show current metrics');
      console.log('');
      console.log('Environment Variables:');
      console.log('  DEVFLOW_METRICS_PORT=9091               # Server port');
      console.log('  DEVFLOW_METRICS_HOST=0.0.0.0           # Server host');
      console.log('  DEVFLOW_DB_PATH=./data/devflow_unified.sqlite # Database path');
      console.log('  ORCHESTRATOR_URL=http://localhost:3005  # Orchestrator URL');
      console.log('');
      console.log('Endpoints (when running):');
      console.log('  GET  /metrics    - Prometheus metrics');
      console.log('  GET  /health     - Health check');
      console.log('  GET  /json       - JSON metrics');
      console.log('  GET  /           - Status dashboard');
      break;
  }
}

// Export for programmatic usage
module.exports = {
  startMonitoring,
  stopMonitoring,
  getMonitoringStatus,
  getCurrentMetrics,
  DevFlowMetricsServer,
  DevFlowMetricsCollector
};

// CLI execution
if (require.main === module) {
  runCLI().catch(console.error);
}