/**
 * SmartSessionRetryHub - Central coordination hub for session retry system
 * Manages session tracking, auto-resumption, and integration with DevFlow monitoring
 */

import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { ClaudeSessionTracker } from '../core/session/ClaudeSessionTracker';
import { AutoResumeManager } from '../core/session/AutoResumeManager';

interface HubConfig {
  enabled: boolean;
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  monitoringInterval: number; // seconds
  healthCheckPort: number;
  claudeCodeIntegration: boolean;
}

interface SessionRetrySystemStatus {
  status: 'running' | 'stopped' | 'error';
  activeSessions: number;
  scheduledResumes: number;
  uptime: number;
  lastActivity: string;
  errors: number;
}

export class SmartSessionRetryHub {
  private config: HubConfig;
  private sessionTracker: ClaudeSessionTracker;
  private autoResumeManager: AutoResumeManager;
  private server?: http.Server;
  private isRunning: boolean = false;
  private startTime: number = 0;
  private errorCount: number = 0;
  private monitoringTimer?: NodeJS.Timeout;
  private pidFile: string;

  constructor() {
    // Load configuration from environment
    this.config = this.loadConfiguration();

    // Initialize components
    this.sessionTracker = new ClaudeSessionTracker();
    this.autoResumeManager = new AutoResumeManager();

    // Set PID file path
    this.pidFile = path.join(process.cwd(), '.session-retry-hub.pid');

    console.log('🔧 SmartSessionRetryHub initialized');
  }

  async start(): Promise<void> {
    try {
      if (this.isRunning) {
        console.log('⚠️ SmartSessionRetryHub is already running');
        return;
      }

      console.log('🚀 Starting SmartSessionRetryHub...');

      // Initialize core components
      await this.sessionTracker.initialize();
      this.autoResumeManager.initialize();
      this.autoResumeManager.setSessionTracker(this.sessionTracker);

      // Start health check server
      await this.startHealthCheckServer();

      // Start monitoring
      this.startMonitoring();

      // Set up process handlers
      this.setupProcessHandlers();

      // Write PID file
      await this.writePidFile();

      this.isRunning = true;
      this.startTime = Date.now();

      console.log('✅ SmartSessionRetryHub started successfully');
      console.log(`🌐 Health check server running on port ${this.config.healthCheckPort}`);
      console.log(`📊 Monitoring interval: ${this.config.monitoringInterval}s`);

      await this.logEvent('SYSTEM', 'SmartSessionRetryHub started successfully');

    } catch (error) {
      console.error('❌ Failed to start SmartSessionRetryHub:', error);
      this.errorCount++;
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      console.log('🛑 Stopping SmartSessionRetryHub...');

      this.isRunning = false;

      // Stop monitoring
      if (this.monitoringTimer) {
        clearInterval(this.monitoringTimer);
      }

      // Stop health check server
      if (this.server) {
        this.server.close();
      }

      // Remove PID file
      await this.removePidFile();

      await this.logEvent('SYSTEM', 'SmartSessionRetryHub stopped');
      console.log('✅ SmartSessionRetryHub stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping SmartSessionRetryHub:', error);
      this.errorCount++;
    }
  }

  async getStatus(): Promise<SessionRetrySystemStatus> {
    const activeSessions = await this.sessionTracker.getActiveSessions();
    const schedules = await this.getResumeSchedules();

    return {
      status: this.isRunning ? 'running' : 'stopped',
      activeSessions: activeSessions.length,
      scheduledResumes: schedules.filter(s => s.status === 'scheduled').length,
      uptime: this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      lastActivity: new Date().toISOString(),
      errors: this.errorCount
    };
  }

  async handleClaudeCodeLimitEvent(limitMessage: string): Promise<void> {
    try {
      console.log('⚠️ Claude Code limit event detected:', limitMessage);

      // Extract session info from current session
      const currentSessionFile = path.join(process.cwd(), '.devflow', 'sessions', 'current_session.json');

      if (!existsSync(currentSessionFile)) {
        console.warn('⚠️ No current session file found');
        // Create a default session for testing
        const sessionId = `session_${Date.now()}`;
        await this.sessionTracker.startSession(Date.now());
        await this.autoResumeManager.handleSessionLimitReached(sessionId);
        await this.logEvent('LIMIT_EVENT', `Session ${sessionId}: ${limitMessage}`);
        return;
      }

      const currentSession = JSON.parse(await fs.readFile(currentSessionFile, 'utf-8'));
      const sessionId = currentSession.task || `session_${Date.now()}`;

      // Record the limit event
      await this.sessionTracker.recordLimitEvent(sessionId, limitMessage);

      // Trigger auto-resume handling
      await this.autoResumeManager.handleSessionLimitReached(sessionId);

      await this.logEvent('LIMIT_EVENT', `Session ${sessionId}: ${limitMessage}`);

    } catch (error) {
      console.error('❌ Failed to handle Claude Code limit event:', error);
      this.errorCount++;
      await this.logEvent('ERROR', `Failed to handle limit event: ${error}`);
    }
  }

  private loadConfiguration(): HubConfig {
    const defaultConfig: HubConfig = {
      enabled: true,
      port: 8889,
      logLevel: 'info',
      monitoringInterval: 30, // 30 seconds
      healthCheckPort: 8889,
      claudeCodeIntegration: true
    };

    // Override with environment variables
    return {
      enabled: process.env.SESSION_RETRY_ENABLED !== 'false',
      port: parseInt(process.env.SESSION_RETRY_PORT || '8889'),
      logLevel: (process.env.SESSION_RETRY_LOG_LEVEL as any) || 'info',
      monitoringInterval: parseInt(process.env.SESSION_RETRY_MONITOR_INTERVAL || '30'),
      healthCheckPort: parseInt(process.env.SESSION_RETRY_HEALTH_PORT || '8889'),
      claudeCodeIntegration: process.env.SESSION_RETRY_CLAUDE_INTEGRATION !== 'false'
    };
  }

  private async startHealthCheckServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        const url = req.url || '';
        let body = '';

        // Collect request body for POST requests
        if (req.method === 'POST') {
          req.on('data', chunk => {
            body += chunk.toString();
          });
        }

        req.on('end', async () => {
          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');

          try {
            if (url === '/health') {
              const status = await this.getStatus();
              res.writeHead(200);
              res.end(JSON.stringify(status, null, 2));

            } else if (url === '/sessions') {
              const sessions = await this.sessionTracker.getActiveSessions();
              res.writeHead(200);
              res.end(JSON.stringify(sessions, null, 2));

            } else if (url === '/schedules') {
              const schedules = await this.getResumeSchedules();
              res.writeHead(200);
              res.end(JSON.stringify(schedules, null, 2));

            } else if (url === '/notify-limit' && req.method === 'POST') {
              // Handle limit notification
              const requestData = JSON.parse(body);
              const limitMessage = requestData.limitMessage;
              
              if (!limitMessage) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Missing limitMessage parameter' }));
                return;
              }
              
              await this.handleClaudeCodeLimitEvent(limitMessage);
              
              res.writeHead(200);
              res.end(JSON.stringify({ success: true, message: 'Limit event processed' }));

            } else if (req.method === 'OPTIONS') {
              // Handle CORS preflight
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.writeHead(200);
              res.end();

            } else {
              res.writeHead(404);
              res.end(JSON.stringify({ error: 'Not found' }));
            }

          } catch (error) {
            console.error('❌ Health check server error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
      });

      this.server.listen(this.config.healthCheckPort, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.performHealthCheck();
        await this.updateCurrentSessionMonitoring();
      } catch (error) {
        console.error('❌ Monitoring error:', error);
        this.errorCount++;
      }
    }, this.config.monitoringInterval * 1000);
  }

  private async performHealthCheck(): Promise<void> {
    // Check if core components are responsive
    try {
      const sessions = await this.sessionTracker.getActiveSessions();
      const status = await this.getStatus();

      if (this.config.logLevel === 'debug') {
        console.log(`🔍 Health check: ${sessions.length} active sessions, ${status.scheduledResumes} scheduled resumes`);
      }

    } catch (error) {
      console.error('❌ Health check failed:', error);
      this.errorCount++;
    }
  }

  private async updateCurrentSessionMonitoring(): Promise<void> {
    try {
      // Update integration with existing session monitoring
      const currentSessionFile = path.join(process.cwd(), '.devflow', 'sessions', 'current_session.json');

      if (existsSync(currentSessionFile)) {
        const currentSession = JSON.parse(await fs.readFile(currentSessionFile, 'utf-8'));

        // Add smart retry system status
        currentSession.smart_retry_system = {
          enabled: true,
          status: this.isRunning ? 'active' : 'inactive',
          last_check: new Date().toISOString()
        };

        await fs.writeFile(currentSessionFile, JSON.stringify(currentSession, null, 2));
      }

    } catch (error) {
      if (this.config.logLevel === 'debug') {
        console.error('❌ Failed to update session monitoring:', error);
      }
    }
  }

  private setupProcessHandlers(): void {
    process.on('SIGINT', async () => {
      console.log('\n📞 Received SIGINT, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n📞 Received SIGTERM, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      console.error('❌ Uncaught exception:', error);
      await this.logEvent('ERROR', `Uncaught exception: ${error.message}`);
      this.errorCount++;
    });

    process.on('unhandledRejection', async (reason) => {
      console.error('❌ Unhandled rejection:', reason);
      await this.logEvent('ERROR', `Unhandled rejection: ${reason}`);
      this.errorCount++;
    });
  }

  private async writePidFile(): Promise<void> {
    try {
      await fs.writeFile(this.pidFile, process.pid.toString());
    } catch (error) {
      console.warn('⚠️ Could not write PID file:', error);
    }
  }

  private async removePidFile(): Promise<void> {
    try {
      if (existsSync(this.pidFile)) {
        await fs.unlink(this.pidFile);
      }
    } catch (error) {
      console.warn('⚠️ Could not remove PID file:', error);
    }
  }

  private async getResumeSchedules(): Promise<any[]> {
    try {
      const scheduleFile = path.join(process.cwd(), '.devflow', 'sessions', 'resume_schedule.json');

      if (existsSync(scheduleFile)) {
        const content = await fs.readFile(scheduleFile, 'utf-8');
        const data = JSON.parse(content);
        return data.schedules || [];
      }
    } catch (error) {
      if (this.config.logLevel === 'debug') {
        console.warn('⚠️ Could not read resume schedules:', error);
      }
    }

    return [];
  }

  private async logEvent(type: string, message: string): Promise<void> {
    try {
      const logFile = path.join(process.cwd(), 'logs', 'session-retry.log');
      const logEntry = `[${new Date().toISOString()}] ${type}: ${message}\n`;

      // Ensure logs directory exists
      const logsDir = path.dirname(logFile);
      if (!existsSync(logsDir)) {
        await fs.mkdir(logsDir, { recursive: true });
      }

      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.error('❌ Failed to write log entry:', error);
    }
  }
}

// Export main service class
export default SmartSessionRetryHub;

// CLI entry point
if (require.main === module) {
  const hub = new SmartSessionRetryHub();

  const command = process.argv[2];

  switch (command) {
    case 'start':
      hub.start().catch((error) => {
        console.error('❌ Failed to start:', error);
        process.exit(1);
      });
      break;

    case 'stop':
      hub.stop().catch((error) => {
        console.error('❌ Failed to stop:', error);
        process.exit(1);
      });
      break;

    case 'status':
      hub.getStatus().then((status) => {
        console.log(JSON.stringify(status, null, 2));
        process.exit(0);
      }).catch((error) => {
        console.error('❌ Failed to get status:', error);
        process.exit(1);
      });
      break;

    default:
      console.log('Usage: node smart-session-retry-hub.js [start|stop|status]');
      process.exit(1);
  }
}