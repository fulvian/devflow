/**
 * Codex MCP Server - Main Entry Point
 * 
 * This module serves as the primary entry point for the Codex MCP Server,
 * handling server initialization, OpenAI client setup, MCP protocol handling,
 * and integration with the DevFlow memory system.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import http from 'http';

// Load environment variables
dotenv.config();

// Type definitions
interface MCPRequest {
  method: string;
  params: any;
  id: string;
}

interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: string;
}

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Global variables
let app: Application;
let server: http.Server;
let openaiClient: OpenAI | null = null;

/**
 * Initialize OpenAI client
 */
function initializeOpenAIClient(): void {
  if (!OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not found in environment variables. OpenAI features will be disabled.');
    return;
  }

  try {
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
    console.log('OpenAI client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OpenAI client:', error);
  }
}

/**
 * Initialize DevFlow memory system
 * This is a stub for future implementation
 */
async function initializeDevFlowMemory(): Promise<void> {
  try {
    // TODO: Implement actual DevFlow memory system initialization
    console.log('DevFlow memory system initialized (stub)');
  } catch (error) {
    console.error('Failed to initialize DevFlow memory system:', error);
  }
}

/**
 * Handle MCP protocol requests
 */
async function handleMCPRequest(req: Request, res: Response): Promise<void> {
  try {
    const mcpRequest: MCPRequest = req.body;
    const response: MCPResponse = {
      id: mcpRequest.id,
    };

    // TODO: Implement actual MCP protocol handling
    switch (mcpRequest.method) {
      case 'ping':
        response.result = { message: 'pong' };
        break;
      case 'list_tools':
        response.result = { tools: ['codex_query', 'memory_store', 'memory_retrieve'] };
        break;
      default:
        response.error = {
          code: -32601,
          message: 'Method not found',
        };
    }

    res.json(response);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    res.status(500).json({
      error: {
        code: -32603,
        message: 'Internal server error',
      },
      id: req.body.id || null,
    });
  }
}

/**
 * Global error handler middleware
 */
function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('Unhandled error:', err);
  
  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: {
      code: -32603,
      message: 'Internal server error',
    },
  });
}

/**
 * Initialize Express server
 */
function initializeServer(): void {
  app = express();
  
  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  
  // Routes
  app.get('/', (req: Request, res: Response) => {
    res.json({ 
      status: 'Codex MCP Server is running',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/mcp', handleMCPRequest);
  
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });
  
  // Error handling middleware (must be last)
  app.use(errorHandler);
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = app.listen(PORT, () => {
      console.log(`Codex MCP Server listening on port ${PORT}`);
      resolve();
    });

    server.on('error', (error) => {
      console.error('Server failed to start:', error);
      reject(error);
    });
  });
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(): void {
  const shutdown = async (): Promise<void> => {
    console.log('Shutting down Codex MCP Server...');
    
    try {
      // Close HTTP server
      if (server) {
        server.close(() => {
          console.log('HTTP server closed');
        });
      }

      // TODO: Add any additional cleanup logic here
      // e.g., close database connections, flush logs, etc.
      
      console.log('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Handle SIGTERM and SIGINT signals
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Main initialization function
 */
async function main(): Promise<void> {
  try {
    console.log('Initializing Codex MCP Server...');
    
    // Initialize components
    initializeServer();
    initializeOpenAIClient();
    await initializeDevFlowMemory();
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Start server
    await startServer();
    
    console.log('Codex MCP Server initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Codex MCP Server:', error);
    process.exit(1);
  }
}

// Run the server if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error in main execution:', error);
    process.exit(1);
  });
}

// Export for testing purposes
export {
  app,
  server,
  openaiClient,
  initializeServer,
  startServer,
  setupGracefulShutdown,
  main,
};