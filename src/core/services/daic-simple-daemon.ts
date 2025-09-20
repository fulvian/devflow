#!/usr/bin/env node

/**
 * DAIC Simple Production Daemon
 *
 * Simplified version for immediate production deployment
 * Replaces invasive legacy DAIC hooks with minimal, non-intrusive suggestions
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const DAIC_PORT = parseInt(process.env.DAIC_PORT || '3205', 10);
const PID_FILE = path.join(process.cwd(), '.daic-daemon.pid');

class DAICSimpleDaemon {
    private server!: http.Server;

    constructor() {
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
                            service: 'daic-simple-daemon',
                            port: DAIC_PORT,
                            timestamp: new Date().toISOString(),
                            mode: 'production'
                        }));
                        break;

                    case '/suggest':
                        await this.handleContextSuggestion(req, res);
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
                console.error('DAIC Simple Daemon error:', error);
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

        // Simple suggestion logic
        const suggestion = {
            message: 'Consider running: daic for workflow optimization',
            confidence: 0.7,
            type: 'workflow_optimization',
            context: taskType || 'general',
            timestamp: new Date().toISOString()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(suggestion));
    }

    private async handleSmartIntervention(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
        }

        const body = await this.readRequestBody(req);
        const interventionData = JSON.parse(body);

        // Simple intervention logic - be less invasive than legacy system
        const shouldIntervene = Math.random() < 0.3; // Only intervene 30% of the time

        const suggestion = {
            shouldIntervene,
            message: shouldIntervene ? 'Optional: Consider running workflow optimization' : null,
            confidence: shouldIntervene ? 0.6 : 0.2,
            timestamp: new Date().toISOString()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(suggestion));
    }

    private async handleStatsRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            stats: {
                mode: 'simple',
                interventions: 'low_frequency',
                status: 'non_invasive'
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
        // Start server
        this.server.listen(DAIC_PORT, () => {
            console.log(`🤖 DAIC Simple Daemon running on port ${DAIC_PORT}`);
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
            console.log(`[${new Date().toISOString()}] DAIC simple daemon heartbeat - PID ${process.pid}`);
        }, 30000);
    }

    private shutdown(): void {
        console.log('🛑 DAIC Simple Daemon shutting down...');

        if (fs.existsSync(PID_FILE)) {
            fs.unlinkSync(PID_FILE);
        }

        this.server.close(() => {
            console.log('✅ DAIC Simple Daemon stopped');
            process.exit(0);
        });
    }
}

// Start daemon if run directly
if (require.main === module) {
    const daemon = new DAICSimpleDaemon();
    daemon.start().catch(error => {
        console.error('❌ Failed to start DAIC simple daemon:', error);
        process.exit(1);
    });
}

export { DAICSimpleDaemon };