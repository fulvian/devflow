#!/usr/bin/env node

/**
 * DevFlow Branch Manager Production Daemon
 *
 * Replaces dysfunctional branch governance with intelligent branch automation
 * Integrates with DevFlow v3.1 and provides smart branch management without blocking commits
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { DevFlowBranchManager } from './devflow-branch-manager.js';
import { DevFlowIntegrationService } from './devflow-integration-service.js';

const BRANCH_PORT = parseInt(process.env.BRANCH_PORT || '3206', 10);
const PID_FILE = path.join(process.cwd(), '.branch-daemon.pid');

class BranchProductionDaemon {
    private server: http.Server;
    private branchManager: DevFlowBranchManager;
    private integrationService: DevFlowIntegrationService;

    constructor() {
        this.branchManager = new DevFlowBranchManager();
        this.integrationService = new DevFlowIntegrationService();
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

            const url = new URL(req.url!, `http://localhost:${BRANCH_PORT}`);

            try {
                switch (url.pathname) {
                    case '/health':
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            status: 'healthy',
                            service: 'branch-manager',
                            port: BRANCH_PORT,
                            timestamp: new Date().toISOString()
                        }));
                        break;

                    case '/create-branch':
                        await this.handleBranchCreation(req, res);
                        break;

                    case '/validate-commit':
                        await this.handleCommitValidation(req, res);
                        break;

                    case '/auto-manage':
                        await this.handleAutoManagement(req, res);
                        break;

                    case '/governance':
                        await this.handleGovernanceRequest(req, res);
                        break;

                    case '/stats':
                        await this.handleStatsRequest(req, res);
                        break;

                    default:
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Endpoint not found' }));
                }
            } catch (error) {
                console.error('Branch Daemon error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
            }
        });
    }

    private async handleBranchCreation(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        const body = await this.readRequestBody(req);
        const { taskName, taskType, baseBranch } = JSON.parse(body);

        const result = await this.branchManager.createTaskBranch(taskName, taskType, baseBranch);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }

    private async handleCommitValidation(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        const body = await this.readRequestBody(req);
        const { branch, message, files } = JSON.parse(body);

        const validation = await this.branchManager.validateCommit(branch, message, files);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(validation));
    }

    private async handleAutoManagement(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        const body = await this.readRequestBody(req);
        const { action, context } = JSON.parse(body);

        const result = await this.branchManager.handleAutomaticManagement(action, context);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    }

    private async handleGovernanceRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method === 'GET') {
            const rules = await this.branchManager.getGovernanceRules();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ rules }));
        } else if (req.method === 'POST') {
            const body = await this.readRequestBody(req);
            const { rule, action } = JSON.parse(body);

            const result = await this.branchManager.updateGovernanceRule(rule, action);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } else {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
        }
    }

    private async handleStatsRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const stats = await this.branchManager.getBranchStats();

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            stats,
            daemon: {
                pid: process.pid,
                uptime: process.uptime(),
                port: BRANCH_PORT,
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
        // Initialize managers
        await this.branchManager.initialize();
        await this.integrationService.initialize();

        // Start server
        this.server.listen(BRANCH_PORT, () => {
            console.log(`🌿 DevFlow Branch Manager running on port ${BRANCH_PORT}`);
            console.log(`📊 Health: http://localhost:${BRANCH_PORT}/health`);
            console.log(`🔀 Create: POST http://localhost:${BRANCH_PORT}/create-branch`);
            console.log(`🔧 PID: ${process.pid}`);

            // Write PID file
            fs.writeFileSync(PID_FILE, process.pid.toString());
        });

        // Setup graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());

        // Heartbeat logging every 30 seconds
        setInterval(() => {
            console.log(`[${new Date().toISOString()}] Branch daemon heartbeat - PID ${process.pid}`);
        }, 30000);
    }

    private shutdown(): void {
        console.log('🛑 DevFlow Branch Manager shutting down...');

        if (fs.existsSync(PID_FILE)) {
            fs.unlinkSync(PID_FILE);
        }

        this.server.close(() => {
            console.log('✅ DevFlow Branch Manager stopped');
            process.exit(0);
        });
    }
}

// Start daemon if run directly
if (require.main === module) {
    const daemon = new BranchProductionDaemon();
    daemon.start().catch(error => {
        console.error('❌ Failed to start Branch daemon:', error);
        process.exit(1);
    });
}

export { BranchProductionDaemon };