/**
 * Codex MCP Server - Main Entry Point
 * 
 * This module serves as the primary entry point for the Codex MCP Server,
 * handling server initialization, OpenAI client setup, MCP protocol handling,
 * and integration with the DevFlow memory system.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
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
// Use a dedicated default port to avoid conflicts with other services
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3101;

// Global variables
let app: Application;
let server: http.Server;

// In-memory session store (no external deps, no credentials)
type SessionMessage = { role: 'user' | 'assistant'; content: string; timestamp: number };
interface SessionState {
  id: string;
  currentModel: 'codex';
  conversationHistory: SessionMessage[];
  createdAt: number;
}

const sessions = new Map<string, SessionState>();

/**
 * Generate a simple ID
 */
function genId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

    // Minimal MCP protocol handling for Codex server
    switch (mcpRequest.method) {
      case 'ping':
        response.result = { message: 'pong' };
        break;
      case 'list_tools':
        response.result = { tools: ['codex_query', 'memory_store', 'memory_retrieve'] };
        break;
      case 'session.initialize': {
        const sessionId = genId('sess');
        const session: SessionState = {
          id: sessionId,
          currentModel: 'codex',
          conversationHistory: [],
          createdAt: Date.now(),
        };
        sessions.set(sessionId, session);
        response.result = {
          sessionId,
          currentModel: session.currentModel,
          conversationHistory: session.conversationHistory,
        };
        break;
      }
      case 'session.state': {
        const sessionId: string | undefined = mcpRequest.params?.sessionId;
        if (!sessionId || !sessions.has(sessionId)) {
          response.error = { code: 404, message: 'Session not found' };
          break;
        }
        const session = sessions.get(sessionId)!;
        response.result = {
          sessionId: session.id,
          currentModel: session.currentModel,
          conversationHistory: session.conversationHistory,
        };
        break;
      }
      case 'session.close': {
        const sessionId: string | undefined = mcpRequest.params?.sessionId;
        if (sessionId && sessions.has(sessionId)) {
          sessions.delete(sessionId);
        }
        response.result = { closed: true };
        break;
      }
      case 'model.message': {
        const content: string = mcpRequest.params?.content || '';
        const model: string = mcpRequest.params?.model || 'codex';
        let sessionId: string | undefined = mcpRequest.params?.sessionId;

        if (model !== 'codex') {
          response.error = { code: 400, message: 'Unsupported model for Codex MCP' };
          break;
        }

        // Use/ensure a session
        let session: SessionState | undefined = undefined;
        if (sessionId && sessions.has(sessionId)) {
          session = sessions.get(sessionId);
        } else {
          sessionId = genId('sess');
          session = {
            id: sessionId,
            currentModel: 'codex',
            conversationHistory: [],
            createdAt: Date.now(),
          } as SessionState;
          sessions.set(sessionId, session);
        }

        // Append user message
        session!.conversationHistory.push({ role: 'user', content, timestamp: Date.now() });

        // Simple local processing (no external APIs, no credentials)
        const processed = `Codex response to: ${content.substring(0, 200)}...`;

        // Append assistant response
        session!.conversationHistory.push({ role: 'assistant', content: processed, timestamp: Date.now() });

        response.result = {
          content: processed,
          sessionId: sessionId,
          currentModel: 'codex',
        };
        break;
      }
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
      server: 'codex-mcp',
      sessions: sessions.size,
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
