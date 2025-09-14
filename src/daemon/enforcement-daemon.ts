#!/usr/bin/env node

/**
 * DevFlow Enforcement Daemon Bootstrap
 * 
 * Persistent daemon service for DevFlow lifecycle integration
 * Provides health checks, signal handling, and process management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as process from 'process';

// Constants
const PID_FILE = path.join(process.cwd(), 'devflow-enforcement-daemon.pid');
const HEALTH_CHECK_PORT = process.env.HEALTH_CHECK_PORT ? parseInt(process.env.HEALTH_CHECK_PORT, 10) : 8787;
const HEALTH_CHECK_PATH = '/health';
const KEEP_ALIVE_INTERVAL = 5000; // 5 seconds

/**
 * Daemon state management
 */
class DaemonState {
  private static instance: DaemonState;
  private isRunning: boolean = false;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private server: http.Server | null = null;

  private constructor() {}

  static getInstance(): DaemonState {
    if (!DaemonState.instance) {
      DaemonState.instance = new DaemonState();
    }
    return DaemonState.instance;
  }

  setIsRunning(running: boolean): void {
    this.isRunning = running;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  setKeepAliveInterval(interval: NodeJS.Timeout): void {
    this.keepAliveInterval = interval;
  }

  getKeepAliveInterval(): NodeJS.Timeout | null {
    return this.keepAliveInterval;
  }

  setServer(server: http.Server): void {
    this.server = server;
  }

  getServer(): http.Server | null {
    return this.server;
  }
}

/**
 * PID file management utilities
 */
class PidFileManager {
  static writePidFile(): void {
    try {
      fs.writeFileSync(PID_FILE, process.pid.toString(), { encoding: 'utf8' });
      console.log(`PID file written: ${PID_FILE}`);
    } catch (error) {
      console.error(`Failed to write PID file: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  static removePidFile(): void {
    try {
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
        console.log(`PID file removed: ${PID_FILE}`);
      }
    } catch (error) {
      console.error(`Failed to remove PID file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static isProcessRunning(): boolean {
    try {
      if (!fs.existsSync(PID_FILE)) {
        return false;
      }

      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
      if (isNaN(pid)) {
        return false;
      }

      // Try to signal the process (0 doesn't actually send a signal)
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // ESRCH means process doesn't exist
      // EPERM means process exists but we don't have permission to signal it
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ESRCH') {
        return false;
      }
      return true; // Assume running if we can't determine
    }
  }
}

/**
 * Health check server
 */
class HealthCheckServer {
  static start(): http.Server {
    const server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === HEALTH_CHECK_PATH) {
        const state = DaemonState.getInstance();
        const status = state.getIsRunning() ? 'OK' : 'ERROR';
        const statusCode = state.getIsRunning() ? 200 : 503;
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status,
          timestamp: new Date().toISOString(),
          pid: process.pid,
          uptime: process.uptime()
        }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    });

    server.listen(HEALTH_CHECK_PORT, () => {
      console.log(`Health check server running on port ${HEALTH_CHECK_PORT}`);
      console.log(`Health check endpoint: http://localhost:${HEALTH_CHECK_PORT}${HEALTH_CHECK_PATH}`);
    });

    server.on('error', (error) => {
      console.error(`Health check server error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });

    return server;
  }
}

/**
 * Signal handling for graceful shutdown
 */
class SignalHandler {
  static setup(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'SIGQUIT'];
    
    signals.forEach((signal) => {
      process.on(signal as NodeJS.Signals, () => {
        console.log(`Received ${signal}, initiating graceful shutdown...`);
        this.shutdown();
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown(1);
    });
  }

  private static shutdown(exitCode: number = 0): void {
    const state = DaemonState.getInstance();
    
    // Stop keep alive interval
    if (state.getKeepAliveInterval()) {
      clearInterval(state.getKeepAliveInterval()!);
    }

    // Close server
    const server = state.getServer();
    if (server) {
      server.close(() => {
        console.log('Health check server closed');
      });
    }

    // Remove PID file
    PidFileManager.removePidFile();

    // Set running state to false
    state.setIsRunning(false);

    console.log('DevFlow Enforcement Daemon shutdown complete');
    process.exit(exitCode);
  }
}

/**
 * Main daemon logic
 */
class EnforcementDaemon {
  private state: DaemonState;

  constructor() {
    this.state = DaemonState.getInstance();
  }

  async start(): Promise<void> {
    try {
      // Check if already running
      if (PidFileManager.isProcessRunning()) {
        console.error('DevFlow Enforcement Daemon is already running');
        process.exit(1);
      }

      // Write PID file
      PidFileManager.writePidFile();

      // Set up signal handling
      SignalHandler.setup();

      // Start health check server
      const server = HealthCheckServer.start();
      this.state.setServer(server);

      // Set running state
      this.state.setIsRunning(true);

      // Start keep alive loop
      this.startKeepAlive();

      console.log('DevFlow Enforcement Daemon started successfully');
      console.log(`PID: ${process.pid}`);
      console.log(`Health check port: ${HEALTH_CHECK_PORT}`);

    } catch (error) {
      console.error(`Failed to start daemon: ${error instanceof Error ? error.message : String(error)}`);
      PidFileManager.removePidFile();
      process.exit(1);
    }
  }

  private startKeepAlive(): void {
    const interval = setInterval(() => {
      if (!this.state.getIsRunning()) {
        console.log('Daemon stopped, clearing keep alive interval');
        clearInterval(interval);
        return;
      }

      // Perform periodic enforcement tasks here
      try {
        this.performEnforcementTasks();
      } catch (error) {
        console.error(`Error in enforcement tasks: ${error instanceof Error ? error.message : String(error)}`);
        // Continue running despite errors
      }
    }, KEEP_ALIVE_INTERVAL);

    this.state.setKeepAliveInterval(interval);
  }

  private performEnforcementTasks(): void {
    // Placeholder for actual enforcement logic
    // This would integrate with DevFlow lifecycle management
    console.log(`[${new Date().toISOString()}] Performing enforcement tasks...`);
    
    // Example enforcement actions:
    // - Check policy compliance
    // - Validate configurations
    // - Monitor resource usage
    // - Enforce security rules
    
    // For now, we'll just log that we're alive
    console.log(`[${new Date().toISOString()}] Enforcement cycle completed`);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  // Check if we're in daemon mode
  const args = process.argv.slice(2);
  const isDaemonMode = args.includes('--daemon') || args.includes('-d');
  
  if (!isDaemonMode) {
    console.log('Usage: devflow-enforcement-daemon [--daemon|-d]');
    console.log('Start the DevFlow Enforcement Daemon in persistent mode');
    process.exit(1);
  }

  const daemon = new EnforcementDaemon();
  await daemon.start();

  // Keep the process alive
  setInterval(() => {
    // This prevents the event loop from exiting
  }, 60000);
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

// Export for testing
export { EnforcementDaemon, PidFileManager, HealthCheckServer, SignalHandler, DaemonState };