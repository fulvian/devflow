/**
 * DevFlow Unified Orchestrator Server
 * Entry point che integra tutti i componenti dell'orchestratore unificato
 *
 * MODALITÀ: claude-only (no synthetic agents)
 * FASE: Deployment Fase 1 - Sistema unificato base
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Import dei componenti core
import { UnifiedOrchestrator } from './core/unified-orchestrator.js';
import { IntelligentRoutingSystem, Platform, TaskType, TaskComplexity } from './routing/intelligent-router.js';
import { CrossPlatformHandoffSystem, PlatformType } from './handoff/cross-platform-handoff.js';
import { OperationalModesManager, ModeCommandInterface } from './modes/operational-modes-manager.js';

// Configurazione server
const PORT = process.env.ORCHESTRATOR_PORT || 3005;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Inizializzazione componenti
const app = express();
const server = createServer(app);

// Inizializzazione Socket.IO per eventi real-time
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Core orchestrator instances
const unifiedOrchestrator = new UnifiedOrchestrator();
const intelligentRouter = new IntelligentRoutingSystem();
const handoffSystem = new CrossPlatformHandoffSystem();
const modesManager = new OperationalModesManager();
const modeInterface = new ModeCommandInterface(modesManager);

// Middleware base
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware semplice
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Registrazione piattaforme di default
function initializePlatforms() {
  // Registrazione piattaforme nell'orchestratore unificato
  unifiedOrchestrator.registerPlatform({
    id: 'gemini',
    name: 'Gemini',
    endpoint: process.env.GEMINI_ENDPOINT || 'http://localhost:3001',
    apiKey: process.env.GEMINI_API_KEY,
    enabled: true,
    weight: 1.0,
    capabilities: ['analysis', 'reasoning', 'creative']
  });

  unifiedOrchestrator.registerPlatform({
    id: 'codex',
    name: 'Codex',
    endpoint: process.env.CODEX_ENDPOINT || 'http://localhost:3002',
    apiKey: process.env.CODEX_API_KEY,
    enabled: true,
    weight: 1.0,
    capabilities: ['code', 'generation']
  });

  unifiedOrchestrator.registerPlatform({
    id: 'qwen',
    name: 'Qwen',
    endpoint: process.env.QWEN_ENDPOINT || 'http://localhost:3003',
    apiKey: process.env.QWEN_API_KEY,
    enabled: true,
    weight: 1.0,
    capabilities: ['generation', 'creative', 'analysis']
  });

  // Registrazione agenti per modes manager
  modesManager.registerAgent({
    id: 'claude-agent-1',
    name: 'Claude Sonnet',
    capabilities: ['reasoning', 'analysis', 'code', 'creative'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 1000,
      errorRate: 0.01
    },
    isActive: true
  });

  console.log('✅ Platforms and agents initialized');
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const systemHealth = unifiedOrchestrator.getSystemHealth();
    const taskStats = unifiedOrchestrator.getTaskStats();
    const modeStatus = modeInterface.getStatus();

    res.json({
      status: systemHealth.overallStatus,
      timestamp: Date.now(),
      system: systemHealth,
      tasks: taskStats,
      mode: modeStatus,
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: 'Health check failed'
    });
  }
});

// Mode management endpoints
app.get('/api/mode', (req, res) => {
  try {
    const status = modeInterface.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/mode/:modeName', (req, res) => {
  try {
    const { modeName } = req.params;
    const result = modeInterface.changeMode(modeName as any);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Endpoint specifico dell'architettura: /mode/switch/:mode
app.post('/mode/switch/:mode', (req, res) => {
  try {
    const { mode } = req.params;
    const previousMode = modeInterface.getCurrentMode();
    const result = modeInterface.changeMode(mode as any);

    // Log mode change per audit trail
    console.log(`[AUDIT] Mode switched from ${previousMode} to ${mode} at ${new Date().toISOString()}`);

    // Emit WebSocket event per modeChange
    io.emit('modeChange', {
      from: previousMode,
      to: mode,
      timestamp: new Date().toISOString(),
      success: result.success
    });

    res.json({
      success: result.success,
      message: result.message,
      previousMode,
      newMode: mode,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint performance agenti specifico dell'architettura
app.get('/agents/performance', (req, res) => {
  try {
    // Ottieni performance da sistemi disponibili
    const orchestratorMetrics = unifiedOrchestrator.getMetrics();
    const systemHealth = unifiedOrchestrator.getSystemHealth();
    const modesManagerPerf = modeInterface.getStatus();

    const agentsPerformance = {
      timestamp: Date.now(),
      currentMode: modeInterface.getCurrentMode(),
      agents: {
        claude: {
          type: 'supreme_orchestrator',
          tasks_completed: modesManagerPerf.performance?.tasksProcessed || 0,
          avg_response_time: modesManagerPerf.performance?.avgProcessingTime || 0,
          success_rate: modesManagerPerf.performance?.successRate || 1.0,
          error_rate: 1 - (modesManagerPerf.performance?.successRate || 1.0)
        }
      },
      orchestratorMetrics,
      systemHealth
    };

    res.json(agentsPerformance);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve agents performance',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Task submission endpoint
app.post('/api/tasks', async (req, res) => {
  try {
    const { id, type, payload, priority } = req.body;

    const task = {
      id: id || `task-${Date.now()}`,
      type: type || 'general',
      payload: payload || {},
      priority: priority || 'medium'
    };

    const result = await unifiedOrchestrator.submitTask(task);
    res.json(result);
  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({
      error: 'Task submission failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Metrics endpoint
app.get('/api/metrics', (req, res) => {
  try {
    const metrics = unifiedOrchestrator.getMetrics();
    const systemHealth = unifiedOrchestrator.getSystemHealth();

    res.json({
      performance: metrics,
      health: systemHealth,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Platforms endpoint
app.get('/api/platforms', (req, res) => {
  try {
    const platforms = unifiedOrchestrator.listPlatforms();
    res.json(platforms);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Routing intelligence endpoint
app.post('/api/route', async (req, res) => {
  try {
    const { taskCharacteristics } = req.body;

    if (!taskCharacteristics) {
      return res.status(400).json({ error: 'taskCharacteristics required' });
    }

    const routingDecision = await intelligentRouter.routeTask(taskCharacteristics);
    res.json(routingDecision);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// WebSocket event handling per architettura v1.0
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  // Invia stato iniziale agenti
  socket.emit('agentStatus', {
    timestamp: Date.now(),
    currentMode: modeInterface.getCurrentMode(),
    systemHealth: unifiedOrchestrator.getSystemHealth(),
    agents: {
      orchestrator: 'online',
      claudeSonnet: 'active',
      unifiedSystem: 'operational'
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
});

// Emissione periodica eventi agentStatus ogni 30 secondi
setInterval(() => {
  const agentStatusUpdate = {
    timestamp: Date.now(),
    currentMode: modeInterface.getCurrentMode(),
    systemHealth: unifiedOrchestrator.getSystemHealth(),
    metrics: unifiedOrchestrator.getMetrics(),
    agents: {
      orchestrator: 'online',
      claudeSonnet: 'active',
      unifiedSystem: 'operational',
      modesManager: modeInterface.getStatus()
    }
  };

  io.emit('agentStatus', agentStatusUpdate);
}, 30000);

// Server startup
async function startServer() {
  try {
    console.log('🚀 Starting DevFlow Unified Orchestrator...');

    // Inizializza piattaforme
    initializePlatforms();

    // Avvia orchestratore unificato
    await unifiedOrchestrator.start();
    console.log('✅ Unified Orchestrator started');

    // Avvia server HTTP
    server.listen(PORT, () => {
      console.log(`🌐 DevFlow Unified Orchestrator listening on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🎛️  Mode management: http://localhost:${PORT}/api/mode`);
      console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics`);
      console.log(`🔄 Current mode: ${modeInterface.getCurrentMode()}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('🛑 Graceful shutdown initiated...');

  try {
    await unifiedOrchestrator.stop();
    console.log('✅ Unified Orchestrator stopped');

    server.close(() => {
      console.log('✅ HTTP Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Signal handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

export default app;