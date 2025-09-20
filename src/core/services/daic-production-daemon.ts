#!/usr/bin/env node

/**
 * DAIC Context Manager Production Daemon
 *
 * Replaces the invasive legacy DAIC hooks with intelligent context-aware suggestions
 * Integrates with DevFlow v3.1 orchestration and provides smart intervention only when needed
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { DAICContextManager } from './daic-context-manager';
import { DevFlowIntegrationService } from './devflow-integration-service';
import { DevFlowBranchManager } from './devflow-branch-manager';

const DAIC_PORT = parseInt(process.env.DAIC_PORT || '3205', 10);
const PID_FILE = path.join(process.cwd(), '.daic-daemon.pid');

class DAICProductionDaemon {
    private server!: http.Server;
    private daicManager: DAICContextManager;
    private integrationService: DevFlowIntegrationService;

    constructor() {
        this.daicManager = new DAICContextManager();
        // Create a minimal branch manager for integration
        const branchManager = new DevFlowBranchManager(this.daicManager);
        this.integrationService = new DevFlowIntegrationService(this.daicManager, branchManager);
        this.setupServer();
    }

    private setupServer(): void {
        this.server = http.createServer(async (req, res) => {
            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            const url = new URL(req.url!, `http://localhost:${DAIC_PORT}`);

            try {
                switch (url.pathname) {
                    case '/health':
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            status: 'healthy',
                            service: 'daic-context-manager',
                            port: DAIC_PORT,
                            timestamp: new Date().toISOString()
                        }));
                        break;

                    case '/suggest':
                        await this.handleContextSuggestion(req, res);
                        break;

                    case '/mode':
                        await this.handleModeRequest(req, res);
                        break;

                    case '/intervention':
                        await this.handleSmartIntervention(req, res);
                        break;

                    case '/stats':
                        await this.handleStatsRequest(req, res);
                        break;

                    default:
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Endpoint not found' }));
                }
            } catch (error) {
                console.error('DAIC Daemon error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error', message: String(error) }));
            }
        });
    }

    private async handleContextSuggestion(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        const body = await this.readRequestBody(req);
        const { context, taskType, urgency } = JSON.parse(body);

        // Use the actual method from DevFlowIntegrationService
        const suggestion = await this.integrationService.suggestDAICAction(context);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(suggestion));
    }

    private async handleModeRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method === 'GET') {
            // Get current task and suggest DAIC mode
            const currentTask = await this.daicManager.getCurrentTask();
            const mode = currentTask ? await this.daicManager.suggestDAICMode(currentTask.id) : 'none';
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ mode }));
        } else if (req.method === 'POST') {
            const body = await this.readRequestBody(req);
            const { taskId, mode, reason } = JSON.parse(body);

            // Record intervention
            await this.daicManager.recordDAICIntervention({
                task_id: taskId,
                intervention_type: 'mode_suggestion',
                context_data: JSON.stringify({ mode, reason }),
                user_accepted: true,
                user_feedback: reason
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, mode, reason }));
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }

    private async handleSmartIntervention(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        const body = await this.readRequestBody(req);
        const interventionData = JSON.parse(body);

        // Use the actual method from DevFlowIntegrationService to get suggestions
        const suggestion = await this.integrationService.suggestDAICAction(interventionData.context);
        const shouldIntervene = suggestion.confidence > 0.6; // Intervene if confidence is high

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ shouldIntervene, suggestion, timestamp: new Date().toISOString() }));
    }

    private async handleStatsRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // Get recent DAIC interventions as stats
        const interventions = await this.daicManager.getDAICInterventionHistory(undefined, 10);
        const healthCheck = await this.daicManager.healthCheck();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            stats: {
                recentInterventions: interventions.length,
                lastIntervention: interventions[0]?.timestamp || null,
                databaseHealth: healthCheck.healthy
            },
            daemon: {
                pid: process.pid,
                uptime: process.uptime(),
                port: DAIC_PORT,
                memory: process.memoryUsage()
            }
        }));
    }

    private async readRequestBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    public async start(): Promise<void> {
        // Initialize integration service (DAIC manager doesn't have initialize method)
        this.integrationService.start();

        // Start server
        this.server.listen(DAIC_PORT, () => {
            console.log(`🤖 DAIC Context Manager running on port ${DAIC_PORT}`);
            console.log(`📊 Health: http://localhost:${DAIC_PORT}/health`);
            console.log(`💡 Suggest: POST http://localhost:${DAIC_PORT}/suggest`);
            console.log(`🔧 PID: ${process.pid}`);

            // Write PID file
            fs.writeFileSync(PID_FILE, process.pid.toString());
        });

        // Setup graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());

        // Heartbeat logging every 30 seconds
        setInterval(() => {
            console.log(`[${new Date().toISOString()}] DAIC daemon heartbeat - PID ${process.pid}`);
        }, 30000);
    }

    private shutdown(): void {
        console.log('🛑 DAIC Context Manager shutting down...');

        if (fs.existsSync(PID_FILE)) {
            fs.unlinkSync(PID_FILE);
        }

        this.server.close(() => {
            console.log('✅ DAIC Context Manager stopped');
            process.exit(0);
        });
    }
}

// Start daemon if run directly
if (require.main === module) {
    const daemon = new DAICProductionDaemon();
    daemon.start().catch(error => {
        console.error('❌ Failed to start DAIC daemon:', error);
        process.exit(1);
    });
}

export { DAICProductionDaemon };