/**
 * Unified API Gateway for Multi-Platform CLI Integration
 * Task ID: DEVFLOW-GATEWAY-001
 *
 * This module implements an Express-based API Gateway that provides:
 * - Health monitoring endpoints
 * - Performance metrics collection
 * - Rate limiting
 * - Request routing to appropriate platforms
 * - Real-time monitoring dashboard
 * - Error handling and logging
 * - Authentication middleware
 * - WebSocket support for real-time updates
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import { createClient } from 'redis';
import { createLogger, format, transports } from 'winston';
import jwt from 'jsonwebtoken';
import { performance } from 'perf_hooks';

// Types and interfaces
interface PlatformConfig {
  name: string;
  endpoint: string;
  apiKey: string;
}

interface MetricsData {
  timestamp: number;
  requests: number;
  errors: number;
  avgResponseTime: number;
  activeConnections: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  services: Record<string, 'up' | 'down'>;
}

// Configuration
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devflow-secret-key';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Platform configurations
const PLATFORMS: Record<string, PlatformConfig> = {
  gemini: {
    name: 'Gemini',
    endpoint: process.env.GEMINI_ENDPOINT || 'http://localhost:3001',
    apiKey: process.env.GEMINI_API_KEY || 'gemini-api-key'
  },
  codex: {
    name: 'Codex',
    endpoint: process.env.CODEX_ENDPOINT || 'http://localhost:3002',
    apiKey: process.env.CODEX_API_KEY || 'codex-api-key'
  },
  qwen: {
    name: 'Qwen',
    endpoint: process.env.QWEN_ENDPOINT || 'http://localhost:3003',
    apiKey: process.env.QWEN_API_KEY || 'qwen-api-key'
  }
};

// Initialize Express app
const app: Application = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize Redis client for metrics storage
const redisClient = createClient({ url: REDIS_URL });
redisClient.connect().catch(console.error);

// Initialize logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'gateway-error.log', level: 'error' }),
    new transports.File({ filename: 'gateway-combined.log' })
  ]
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Authentication middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    (req as any).user = user;
    next();
  });
};

// Metrics collection
let metrics: MetricsData = {
  timestamp: Date.now(),
  requests: 0,
  errors: 0,
  avgResponseTime: 0,
  activeConnections: 0
};

// Middleware to track metrics
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = performance.now();
  metrics.requests++;

  res.on('finish', () => {
    const duration = performance.now() - start;
    metrics.avgResponseTime = (metrics.avgResponseTime * (metrics.requests - 1) + duration) / metrics.requests;

    if (res.statusCode >= 400) {
      metrics.errors++;
    }

    // Emit metrics update via WebSocket
    io.emit('metricsUpdate', metrics);
  });

  next();
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: Date.now(),
      services: {}
    };

    // Check each platform service
    for (const [key, platform] of Object.entries(PLATFORMS)) {
      try {
        const response = await fetch(`${platform.endpoint}/health`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${platform.apiKey}`
          }
        });

        healthStatus.services[key] = response.ok ? 'up' : 'down';
        if (!response.ok) {
          healthStatus.status = 'degraded';
        }
      } catch (error) {
        healthStatus.services[key] = 'down';
        healthStatus.status = 'degraded';
        logger.error(`Health check failed for ${platform.name}:`, error);
      }
    }

    res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: 'Health check failed'
    });
  }
});

// Metrics endpoint
app.get('/metrics', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Get historical metrics from Redis if available
    const storedMetrics = await redisClient.get('gateway:metrics');
    const historicalMetrics = storedMetrics ? JSON.parse(storedMetrics) : [];

    res.json({
      current: metrics,
      historical: historicalMetrics
    });
  } catch (error) {
    logger.error('Metrics retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// Route requests to appropriate platforms
app.post('/api/:platform/*', authenticateToken, async (req: Request, res: Response) => {
  const platform = req.params.platform;

  if (!PLATFORMS[platform]) {
    return res.status(404).json({ error: `Platform ${platform} not found` });
  }

  try {
    const targetUrl = `${PLATFORMS[platform].endpoint}/${req.params[0]}`;
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PLATFORMS[platform].apiKey}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    logger.error(`Routing error for ${platform}:`, error);
    res.status(502).json({ error: `Failed to route request to ${platform}` });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  metrics.activeConnections++;
  io.emit('metricsUpdate', metrics);

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    metrics.activeConnections--;
    io.emit('metricsUpdate', metrics);
  });

  // Send initial metrics
  socket.emit('metricsUpdate', metrics);
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  metrics.errors++;

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Periodically store metrics in Redis
setInterval(async () => {
  try {
    metrics.timestamp = Date.now();

    // Store in Redis for historical data
    const storedMetrics = await redisClient.get('gateway:metrics');
    const historicalMetrics = storedMetrics ? JSON.parse(storedMetrics) : [];

    // Keep only last 100 data points
    historicalMetrics.push(metrics);
    if (historicalMetrics.length > 100) {
      historicalMetrics.shift();
    }

    await redisClient.set('gateway:metrics', JSON.stringify(historicalMetrics));
  } catch (error) {
    logger.error('Metrics storage error:', error);
  }
}, 30000); // Every 30 seconds

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  try {
    await redisClient.quit();
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server
server.listen(PORT, () => {
  logger.info(`API Gateway listening on port ${PORT}`);
  metrics.activeConnections = 0; // Initialize active connections count
});

export default app;