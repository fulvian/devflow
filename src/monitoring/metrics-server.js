/**
 * DevFlow Metrics Server
 * HTTP server for exposing metrics endpoints
 *
 * Provides Prometheus-compatible metrics endpoints and health checks
 * Fully aligned with DevFlow architecture and existing patterns
 */

const http = require('http');
const url = require('url');
const { DevFlowMetricsCollector } = require('./devflow-metrics-collector');

class DevFlowMetricsServer {
  constructor(options = {}) {
    this.config = {
      port: options.port || process.env.DEVFLOW_METRICS_PORT || 9091,
      host: options.host || '0.0.0.0',
      enableCors: options.enableCors !== false,
      ...options
    };

    this.metricsCollector = new DevFlowMetricsCollector(options.collector || {});
    this.server = null;
    this.isRunning = false;
  }

  /**
   * Start the metrics server
   */
  async start() {
    try {
      // Start metrics collection
      await this.metricsCollector.start();

      // Create HTTP server
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      // Start listening
      return new Promise((resolve, reject) => {
        this.server.listen(this.config.port, this.config.host, (error) => {
          if (error) {
            reject(error);
            return;
          }

          this.isRunning = true;
          console.log(`📊 DevFlow Metrics Server running on http://${this.config.host}:${this.config.port}`);
          console.log('📈 Available endpoints:');
          console.log(`   GET  /metrics     - Prometheus metrics`);
          console.log(`   GET  /health      - Health check`);
          console.log(`   GET  /json        - JSON metrics`);
          console.log(`   GET  /            - Status page`);

          resolve({
            port: this.config.port,
            host: this.config.host,
            status: 'running'
          });
        });
      });

    } catch (error) {
      console.error('❌ Failed to start metrics server:', error);
      throw error;
    }
  }

  /**
   * Stop the metrics server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 DevFlow Metrics Server stopped');
          resolve();
        });
      }

      if (this.metricsCollector) {
        this.metricsCollector.stop();
      }

      this.isRunning = false;
    });
  }

  /**
   * Handle HTTP requests
   */
  handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Enable CORS if configured
    if (this.config.enableCors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
      this.sendError(res, 405, 'Method Not Allowed');
      return;
    }

    try {
      switch (pathname) {
        case '/metrics':
          this.handleMetrics(req, res);
          break;
        case '/health':
          this.handleHealth(req, res);
          break;
        case '/json':
          this.handleJsonMetrics(req, res);
          break;
        case '/':
          this.handleStatus(req, res);
          break;
        default:
          this.sendError(res, 404, 'Not Found');
      }
    } catch (error) {
      console.error('Error handling request:', error);
      this.sendError(res, 500, 'Internal Server Error');
    }
  }

  /**
   * Handle /metrics endpoint (Prometheus format)
   */
  handleMetrics(req, res) {
    try {
      const prometheusMetrics = this.metricsCollector.getPrometheusMetrics();

      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache'
      });

      res.end(prometheusMetrics);

    } catch (error) {
      console.error('Error generating Prometheus metrics:', error);
      this.sendError(res, 500, 'Error generating metrics');
    }
  }

  /**
   * Handle /health endpoint
   */
  handleHealth(req, res) {
    try {
      const health = this.metricsCollector.getHealth();

      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      });

      res.end(JSON.stringify({
        service: 'devflow-metrics-server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        ...health
      }, null, 2));

    } catch (error) {
      console.error('Error generating health check:', error);
      this.sendError(res, 500, 'Error generating health check');
    }
  }

  /**
   * Handle /json endpoint (JSON format metrics)
   */
  handleJsonMetrics(req, res) {
    try {
      const metrics = this.metricsCollector.getMetrics();

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      });

      res.end(JSON.stringify({
        service: 'devflow-metrics',
        timestamp: new Date().toISOString(),
        metrics
      }, null, 2));

    } catch (error) {
      console.error('Error generating JSON metrics:', error);
      this.sendError(res, 500, 'Error generating metrics');
    }
  }

  /**
   * Handle / endpoint (status page)
   */
  handleStatus(req, res) {
    try {
      const health = this.metricsCollector.getHealth();
      const metrics = this.metricsCollector.getMetrics();

      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>DevFlow Metrics Server</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: bold;
            color: white;
        }
        .healthy { background: #28a745; }
        .unhealthy { background: #dc3545; }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .metric-card {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 15px;
        }
        .metric-card h3 {
            margin: 0 0 10px 0;
            color: #495057;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .endpoint {
            background: #e9ecef;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: monospace;
            margin: 5px 0;
        }
        .endpoint a {
            color: #007bff;
            text-decoration: none;
        }
        .endpoint a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 DevFlow Metrics Server</h1>

        <p>
            Status: <span class="status ${health.status === 'healthy' ? 'healthy' : 'unhealthy'}">${health.status.toUpperCase()}</span>
        </p>

        <p>Last metrics collection: ${new Date(health.lastCollection).toLocaleString()}</p>

        <h2>📈 Available Endpoints</h2>
        <div class="endpoint"><a href="/metrics">/metrics</a> - Prometheus format</div>
        <div class="endpoint"><a href="/json">/json</a> - JSON format</div>
        <div class="endpoint"><a href="/health">/health</a> - Health check</div>

        <h2>🎯 Current Metrics</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <h3>Context7 Quality</h3>
                <div class="metric-value">${(metrics.context7.qualityScore * 100).toFixed(1)}%</div>
                <small>Full Mode Ready: ${metrics.context7.fullModeReady ? '✅' : '❌'}</small>
            </div>

            <div class="metric-card">
                <h3>Total Tasks</h3>
                <div class="metric-value">${metrics.tasks.total}</div>
                <small>Pending: ${metrics.tasks.pending}, Completed: ${metrics.tasks.completed}</small>
            </div>

            <div class="metric-card">
                <h3>Database Size</h3>
                <div class="metric-value">${metrics.database.sizeMB || 0} MB</div>
                <small>Query time: ${(metrics.database.averageQueryTime || 0).toFixed(2)}ms</small>
            </div>

            <div class="metric-card">
                <h3>Orchestrator</h3>
                <div class="metric-value">${(metrics.orchestrator.successRate || 0).toFixed(1)}%</div>
                <small>Status: ${metrics.orchestrator.healthStatus}</small>
            </div>
        </div>

        <p style="margin-top: 40px; color: #6c757d; font-size: 14px;">
            DevFlow Metrics Server v1.0.0 |
            Uptime: ${Math.floor(process.uptime() / 60)} minutes |
            Node.js ${process.version}
        </p>
    </div>

    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            window.location.reload();
        }, 30000);
    </script>
</body>
</html>`;

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      });

      res.end(html);

    } catch (error) {
      console.error('Error generating status page:', error);
      this.sendError(res, 500, 'Error generating status page');
    }
  }

  /**
   * Send error response
   */
  sendError(res, statusCode, message) {
    res.writeHead(statusCode, {
      'Content-Type': 'application/json'
    });

    res.end(JSON.stringify({
      error: message,
      timestamp: new Date().toISOString()
    }));
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
      host: this.config.host,
      uptime: process.uptime()
    };
  }
}

module.exports = { DevFlowMetricsServer };