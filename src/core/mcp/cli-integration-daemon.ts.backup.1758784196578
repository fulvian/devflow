#!/usr/bin/env node
// CLI Integration Manager Daemon
// Provides HTTP interface for CLI command execution

import http from 'http';
import { CLIIntegrationManager } from './cli-integration-manager';

const PORT = parseInt(process.env.CLI_MANAGER_PORT || '3201', 10);

class CLIIntegrationDaemon {
  private cliManager: CLIIntegrationManager;
  private server: http.Server;

  constructor() {
    this.cliManager = new CLIIntegrationManager();
    this.server = http.createServer(this.handleRequest.bind(this));

    // Setup signal handlers
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '';

    // Health check
    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', service: 'cli-integration-manager' }));
      return;
    }

    // Execute command endpoint
    if (url.startsWith('/execute') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { command, args, envVars } = JSON.parse(body || '{}');

          if (!command) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing command parameter' }));
            return;
          }

          const result = await this.cliManager.executeCommand(command, args || [], envVars || {});

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      });
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  public start(): void {
    this.server.listen(PORT, '0.0.0.0', () => {
      console.log(`⚡ CLI Integration Manager Daemon running on port ${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log(`🔧 Execute: POST http://localhost:${PORT}/execute`);
      console.log(`📝 PID: ${process.pid}`);
    });

    // Heartbeat
    setInterval(() => {
      console.log(`[${new Date().toISOString()}] CLI Integration Manager heartbeat - PID ${process.pid}`);
    }, 30000);
  }

  private async shutdown(): Promise<void> {
    console.log('🛑 Shutting down CLI Integration Manager Daemon...');

    if (this.server) {
      this.server.close();
    }

    process.exit(0);
  }
}

// Start daemon
const daemon = new CLIIntegrationDaemon();
daemon.start();