/**
 * Database Manager Daemon
 * 
 * A robust daemon service that manages SQLite database connections,
 * provides health monitoring endpoints, and maintains system heartbeat.
 * 
 * This daemon is designed to be started by devflow-start.sh and provides
 * critical database management services for the DevFlow ecosystem.
 */

import express, { Application, Request, Response } from 'express';
import { DatabaseManager } from './devflow-database';
import { createLogger, format, transports } from 'winston';

// Environment configuration
const DB_MANAGER_PORT = process.env.DB_MANAGER_PORT ? parseInt(process.env.DB_MANAGER_PORT, 10) : 3001;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Create logger instance
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'database-manager' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

/**
 * Database Manager Daemon Class
 * 
 * Manages the Express server, database connections, and heartbeat monitoring
 */
class DatabaseManagerDaemon {
  private app: Application;
  private databaseManager: DatabaseManager;
  private server: any;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.app = express();
    this.databaseManager = new DatabaseManager();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      try {
        // Check database connection
        const isDatabaseHealthy = this.databaseManager.isHealthy();
        
        if (isDatabaseHealthy) {
          res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected'
          });
        } else {
          res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected'
          });
        }
      } catch (error) {
        logger.error('Health check failed', { error });
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed'
        });
      }
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'DevFlow Database Manager Daemon',
        version: '1.0.0',
        status: 'running'
      });
    });
  }

  /**
   * Initialize the database
   */
  private async initializeDatabase(): Promise<void> {
    try {
      logger.info('Initializing database...');
      await this.databaseManager.initialize();
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database', { error });
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  /**
   * Start the Express server
   */
  private startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(DB_MANAGER_PORT, () => {
        logger.info(`Database Manager Daemon listening on port ${DB_MANAGER_PORT}`);
        resolve();
      });

      this.server.on('error', (error: Error) => {
        logger.error('Server failed to start', { error });
        reject(error);
      });
    });
  }

  /**
   * Start the heartbeat logging
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      logger.info('Heartbeat: Database Manager Daemon is alive', {
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage()
      });
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop the heartbeat logging
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Gracefully shutdown the daemon
   */
  private async shutdown(): Promise<void> {
    logger.info('Shutting down Database Manager Daemon...');

    // Stop heartbeat
    this.stopHeartbeat();

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          logger.info('Server closed');
          resolve();
        });
      });
    }

    // Close database connections
    try {
      await this.databaseManager.close();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections', { error });
    }

    logger.info('Database Manager Daemon shutdown complete');
  }

  /**
   * Start the daemon
   */
  public async start(): Promise<void> {
    try {
      // Handle graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('SIGTERM signal received');
        await this.shutdown();
        process.exit(0);
      });

      process.on('SIGINT', async () => {
        logger.info('SIGINT signal received');
        await this.shutdown();
        process.exit(0);
      });

      // Initialize database
      await this.initializeDatabase();

      // Start server
      await this.startServer();

      // Start heartbeat
      this.startHeartbeat();

      logger.info('Database Manager Daemon started successfully');
    } catch (error) {
      logger.error('Failed to start Database Manager Daemon', { error });
      process.exit(1);
    }
  }
}

// Only start the daemon if this file is executed directly
if (require.main === module) {
  const daemon = new DatabaseManagerDaemon();
  daemon.start().catch((error) => {
    logger.error('Failed to start daemon', { error });
    process.exit(1);
  });
}

export default DatabaseManagerDaemon;