#!/usr/bin/env node
// DevFlow Monitoring Dashboard with WebSocket and Prometheus integration
// Real-time monitoring for Real Dream Team Orchestrator

import http from 'http';
import { WebSocketServer } from 'ws';
import { PlatformStatusTracker } from './platform-status-tracker';

const PORT = parseInt(process.env.DASHBOARD_PORT || '3202', 10);
const WS_PORT = parseInt(process.env.WS_PORT || '3203', 10);

class MonitoringDashboard {
  private server: http.Server;
  private wsServer: WebSocketServer;
  private statusTracker: PlatformStatusTracker;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.statusTracker = new PlatformStatusTracker();
    this.server = http.createServer(this.handleRequest.bind(this));
    this.wsServer = new WebSocketServer({ port: WS_PORT });

    this.setupWebSocket();
    this.setupSignalHandlers();
  }

  private setupWebSocket(): void {
    this.wsServer.on('connection', (ws) => {
      console.log('WebSocket client connected');

      // Send initial status
      const initialData = {
        type: 'status_update',
        platforms: this.statusTracker.getAllStatuses(),
        system: this.statusTracker.getOverallSystemHealth(),
        timestamp: new Date().toISOString()
      };
      ws.send(JSON.stringify(initialData));

      // Setup periodic updates
      const interval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          const data = {
            type: 'status_update',
            platforms: this.statusTracker.getAllStatuses(),
            system: this.statusTracker.getOverallSystemHealth(),
            timestamp: new Date().toISOString()
          };
          ws.send(JSON.stringify(data));
        }
      }, 2000); // Update every 2 seconds

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        clearInterval(interval);
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '';

    // Health endpoint
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', service: 'monitoring-dashboard' }));
      return;
    }

    // Metrics endpoint (Prometheus format)
    if (url === '/metrics') {
      const metrics = this.generatePrometheusMetrics();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(metrics);
      return;
    }

    // Status API endpoint
    if (url === '/api/status') {
      const data = {
        platforms: this.statusTracker.getAllStatuses(),
        system: this.statusTracker.getOverallSystemHealth(),
        timestamp: new Date().toISOString()
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // HTML Dashboard
    if (url === '/' || url === '/dashboard') {
      const html = this.generateDashboardHTML();
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private generatePrometheusMetrics(): string {
    const platforms = this.statusTracker.getAllStatuses();
    const systemHealth = this.statusTracker.getOverallSystemHealth();

    let metrics = '';

    // System health metric
    metrics += `# HELP devflow_system_healthy System health status\n`;
    metrics += `# TYPE devflow_system_healthy gauge\n`;
    metrics += `devflow_system_healthy ${systemHealth.healthy ? 1 : 0}\n\n`;

    // Platform metrics
    for (const platform of platforms) {
      // Active status
      metrics += `# HELP devflow_platform_active Platform active status\n`;
      metrics += `# TYPE devflow_platform_active gauge\n`;
      metrics += `devflow_platform_active{platform="${platform.name}"} ${platform.active ? 1 : 0}\n\n`;

      // Execution count
      metrics += `# HELP devflow_platform_executions_total Total executions per platform\n`;
      metrics += `# TYPE devflow_platform_executions_total counter\n`;
      metrics += `devflow_platform_executions_total{platform="${platform.name}"} ${platform.executionCount}\n\n`;

      // Success rate
      metrics += `# HELP devflow_platform_success_rate Success rate percentage\n`;
      metrics += `# TYPE devflow_platform_success_rate gauge\n`;
      metrics += `devflow_platform_success_rate{platform="${platform.name}"} ${platform.successRate}\n\n`;

      // Average response time
      metrics += `# HELP devflow_platform_response_time_ms Average response time in milliseconds\n`;
      metrics += `# TYPE devflow_platform_response_time_ms gauge\n`;
      metrics += `devflow_platform_response_time_ms{platform="${platform.name}"} ${platform.averageResponseTime}\n\n`;

      // Current load
      metrics += `# HELP devflow_platform_load Current load percentage\n`;
      metrics += `# TYPE devflow_platform_load gauge\n`;
      metrics += `devflow_platform_load{platform="${platform.name}"} ${platform.currentLoad}\n\n`;
    }

    return metrics;
  }

  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>DevFlow Real Dream Team Monitor</title>
    <style>
        body { font-family: monospace; background: #1a1a1a; color: #00ff00; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #00ff00; padding-bottom: 10px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .card { border: 1px solid #00ff00; padding: 15px; background: #0a0a0a; }
        .metric { display: flex; justify-content: space-between; margin: 5px 0; }
        .status { padding: 2px 6px; border-radius: 3px; }
        .healthy { background: #004400; }
        .unhealthy { background: #440000; }
        .active { color: #00ff00; }
        .inactive { color: #ff4444; }
        #timestamp { text-align: center; margin-top: 20px; color: #888; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎯 DevFlow Real Dream Team Orchestrator</h1>
        <h2>📊 Real-time Monitoring Dashboard</h2>
    </div>

    <div id="system-status"></div>
    <div id="platforms" class="grid"></div>
    <div id="timestamp"></div>

    <script>
        const ws = new WebSocket('ws://localhost:${WS_PORT}');

        ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'status_update') {
                updateDashboard(data);
            }
        };

        function updateDashboard(data) {
            // Update system status
            const systemDiv = document.getElementById('system-status');
            systemDiv.innerHTML = \`
                <div class="card">
                    <h3>🖥️ System Health</h3>
                    <div class="metric">
                        <span>Status:</span>
                        <span class="status \${data.system.healthy ? 'healthy' : 'unhealthy'}">
                            \${data.system.healthy ? '✅ HEALTHY' : '❌ DEGRADED'}
                        </span>
                    </div>
                    <div class="metric">
                        <span>Message:</span>
                        <span>\${data.system.message}</span>
                    </div>
                </div>
            \`;

            // Update platforms
            const platformsDiv = document.getElementById('platforms');
            platformsDiv.innerHTML = data.platforms.map(platform => \`
                <div class="card">
                    <h3>🤖 \${platform.name.toUpperCase()}</h3>
                    <div class="metric">
                        <span>Status:</span>
                        <span class="\${platform.active ? 'active' : 'inactive'}">
                            \${platform.active ? '🟢 ACTIVE' : '🔴 INACTIVE'}
                        </span>
                    </div>
                    <div class="metric">
                        <span>Executions:</span>
                        <span>\${platform.executionCount}</span>
                    </div>
                    <div class="metric">
                        <span>Success Rate:</span>
                        <span>\${platform.successRate.toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <span>Avg Response:</span>
                        <span>\${platform.averageResponseTime.toFixed(0)}ms</span>
                    </div>
                    <div class="metric">
                        <span>Current Load:</span>
                        <span>\${platform.currentLoad}%</span>
                    </div>
                </div>
            \`).join('');

            // Update timestamp
            document.getElementById('timestamp').innerHTML =
                \`Last updated: \${new Date(data.timestamp).toLocaleString()}\`;
        }

        ws.onopen = function() {
            console.log('Connected to monitoring WebSocket');
        };

        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
        };
    </script>
</body>
</html>`;
  }

  public start(): void {
    this.server.listen(PORT, '0.0.0.0', () => {
      console.log(`📊 DevFlow Monitoring Dashboard running on port ${PORT}`);
      console.log(`🌐 Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
      console.log(`🔌 WebSocket: ws://localhost:${WS_PORT}`);
      console.log(`📝 PID: ${process.pid}`);
    });

    // Start metrics collection interval
    this.metricsInterval = setInterval(() => {
      console.log(`[${new Date().toISOString()}] Monitoring dashboard heartbeat - PID ${process.pid}`);
    }, 30000);
  }

  private setupSignalHandlers(): void {
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
  }

  private async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Monitoring Dashboard...');

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    if (this.server) {
      this.server.close();
    }

    if (this.wsServer) {
      this.wsServer.close();
    }

    process.exit(0);
  }
}

// Start dashboard
const dashboard = new MonitoringDashboard();
dashboard.start();