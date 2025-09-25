#!/usr/bin/env node
// Real Dream Team Orchestrator Daemon
// Keeps the orchestrator alive and provides HTTP endpoint for testing

import http from 'http';
import RealDreamTeamOrchestrator from './real-dream-team-orchestrator';

const PORT = parseInt(process.env.REAL_DREAM_TEAM_ORCHESTRATOR_PORT || '3200', 10);

class OrchestratorDaemon {
  private orchestrator: RealDreamTeamOrchestrator;
  private server: http.Server;

  constructor() {
    this.orchestrator = new RealDreamTeamOrchestrator();
    this.server = http.createServer(this.handleRequest.bind(this));

    // Setup signal handlers for graceful shutdown
    process.on('SIGTERM', this.shutdown.bind(this));
    process.on('SIGINT', this.shutdown.bind(this));
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.shutdown();
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = req.url || '';

    // Health check endpoint
    if (url === '/health') {
      const health = this.orchestrator.getHealthStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', orchestrator: health }));
      return;
    }

    // Status endpoint
    if (url === '/status') {
      const statusTracker = this.orchestrator.getStatusTracker();
      const allStatuses = statusTracker.getAllStatuses();
      const systemHealth = statusTracker.getOverallSystemHealth();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ platforms: allStatuses, system: systemHealth }));
      return;
    }

    // Execute endpoint
    if (url.startsWith('/execute') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body);
          const input = payload.input || payload.prompt || '';
          const result = await this.orchestrator.executeDreamTeam(input);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  }

  async start() {
    return new Promise<void>((resolve, reject) => {
      this.server.listen(PORT, '0.0.0.0', () => {
        console.log(`🎯 Real Dream Team Orchestrator Daemon running on port ${PORT}`);
        console.log(`📊 Health: http://localhost:${PORT}/health`);
        console.log(`📈 Status: http://localhost:${PORT}/status`);
        console.log(`🚀 Execute: POST http://localhost:${PORT}/execute`);
        console.log(`🔧 PID: ${process.pid}`);
        resolve();
      });

      this.server.on('error', reject);

      // Start heartbeat logging
      setInterval(() => {
        console.log(`[${new Date().toISOString()}] Orchestrator daemon heartbeat - PID ${process.pid}`);
      }, 30000);
    });
  }

  async shutdown() {
    console.log('🛑 Shutting down Real Dream Team Orchestrator Daemon...');
    this.server.close();
    process.exit(0);
  }
}

async function main() {
  const daemon = new OrchestratorDaemon();
  await daemon.start();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Failed to start daemon:', error);
    process.exit(1);
  });
}

export default OrchestratorDaemon;