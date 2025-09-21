/**
 * Model Registry Daemon
 * 
 * This service manages machine learning model metadata and versions.
 * It follows the same pattern as the Database Manager daemon.
 */

import express, { Application, Request, Response } from 'express';
import { createLogger, format, transports } from 'winston';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

// Environment configuration
const MODEL_REGISTRY_PORT = process.env.MODEL_REGISTRY_PORT ? parseInt(process.env.MODEL_REGISTRY_PORT, 10) : 3004;
const SERVICE_NAME = 'model-registry';

// Create logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: SERVICE_NAME },
  transports: [
    new transports.Console({
      format: format.simple()
    })
  ]
});

// Global database reference
let db: Database | null = null;

// Initialize SQLite database
async function initializeDatabase(): Promise<void> {
  try {
    db = await open({
      filename: path.join(__dirname, 'model-registry.db'),
      driver: sqlite3.Database
    });

    // Create models table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, version)
      )
    `);

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database', { error });
    throw error;
  }
}

// Create Express app
function createApp(): Application {
  const app = express();
  
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'ok', 
      service: SERVICE_NAME,
      timestamp: new Date().toISOString()
    });
  });

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ 
      message: `${SERVICE_NAME} is running`,
      service: SERVICE_NAME
    });
  });

  return app;
}

// Graceful shutdown handler
async function shutdown(server: any): Promise<void> {
  logger.info('Shutting down model registry service...');
  
  if (db) {
    try {
      await db.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection', { error });
    }
  }

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

// Main function
async function main(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Create and configure Express app
    const app = createApp();
    
    // Start server
    const server = app.listen(MODEL_REGISTRY_PORT, () => {
      logger.info(`${SERVICE_NAME} service listening on port ${MODEL_REGISTRY_PORT}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => shutdown(server));
    process.on('SIGINT', () => shutdown(server));
    
  } catch (error) {
    logger.error('Failed to start model registry service', { error });
    process.exit(1);
  }
}

// Start the service
main().catch(error => {
  logger.error('Unhandled error in main execution', { error });
  process.exit(1);
});

export { logger, db };