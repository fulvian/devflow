#!/usr/bin/env node
// Minimal Codex MCP Server for DevFlow Real Dream Team Orchestrator
// Simple HTTP server implementing minimal MCP endpoints

const http = require('http');
const { authMiddleware } = require('../auth/middleware');

const PORT = process.env.PORT || 3101;

// Session storage
const sessions = new Map();
let sessionCounter = 0;

// Request handler
function handleRequest(req, res) {
  const url = req.url || '';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health endpoint
  if (url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      server: 'codex-mcp',
      sessions: sessions.size,
      port: PORT
    }));
    return;
  }

  // MCP endpoint with authentication
  if (url === '/mcp' && req.method === 'POST') {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] || process.env.MCP_AUTH_TOKEN || 'devflow-mcp-2025';

    try {
      // Simple auth check
      if (!authHeader && !apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
      }

      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const request = JSON.parse(body || '{}');
          const response = handleMCPRequest(request);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: null,
            error: { code: -32700, message: 'Parse error', data: error.message }
          }));
        }
      });
    } catch (error) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication failed' }));
    }
    return;
  }

  // 404 for other endpoints
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

// MCP request handler
function handleMCPRequest(request) {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'session.initialize':
        const sessionId = `session-${++sessionCounter}`;
        sessions.set(sessionId, {
          id: sessionId,
          created: new Date().toISOString(),
          active: true
        });
        return {
          id,
          result: {
            sessionId,
            capabilities: ['message', 'completion'],
            server: 'codex-mcp-minimal'
          }
        };

      case 'session.state':
        const stateSessionId = params?.sessionId || 'default';
        const session = sessions.get(stateSessionId);
        return {
          id,
          result: {
            sessionId: stateSessionId,
            active: session?.active || false,
            messages: session?.messages || 0
          }
        };

      case 'session.close':
        const closeSessionId = params?.sessionId || 'default';
        if (sessions.has(closeSessionId)) {
          sessions.delete(closeSessionId);
        }
        return {
          id,
          result: { success: true, sessionId: closeSessionId }
        };

      case 'model.message':
        // Simple echo response for testing
        const content = params?.content || '';
        const model = params?.model || 'codex';

        return {
          id,
          result: {
            content: `Codex MCP Response: ${content} (processed by ${model})`,
            model,
            usage: { tokens: content.length }
          }
        };

      default:
        return {
          id,
          error: {
            code: -32601,
            message: `Method '${method}' not found`
          }
        };
    }
  } catch (error) {
    return {
      id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error.message
      }
    };
  }
}

// Start server
const server = http.createServer(handleRequest);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Codex MCP Minimal Server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔧 MCP: POST http://localhost:${PORT}/mcp`);
  console.log(`📝 PID: ${process.pid}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Codex MCP Server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Codex MCP Server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});