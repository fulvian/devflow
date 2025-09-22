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
import { MCPFallbackSystem, MCPToolCall, MCPResponse } from './fallback/mcp-fallback-system.js';

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

// MCP Fallback System with proper CLI → Synthetic mapping
const mcpFallbackSystem = new MCPFallbackSystem();

// Middleware base
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware semplice
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// REAL MCP call function using Bridge Executor - Architecture v1.0 Compliant
async function callMCPTool(call: MCPToolCall): Promise<MCPResponse> {
  const startTime = Date.now();

  try {
    // Validate tool name
    if (!call.tool) {
      return {
        success: false,
        error: 'Tool name is undefined or empty',
        executionTime: Date.now() - startTime
      };
    }

    console.log(`[MCP-REAL] Executing real tool: ${call.tool}`);
    console.log(`[MCP-REAL] Parameters:`, JSON.stringify(call.parameters, null, 2));

    // Path to the MCP Bridge Executor
    const bridgeExecutorPath = process.env.DEVFLOW_PROJECT_ROOT
      ? `${process.env.DEVFLOW_PROJECT_ROOT}/tools/mcp-bridge-executor.js`
      : '../../../tools/mcp-bridge-executor.js'; // Fix relative path from packages/orchestrator/unified

    // Import required modules dynamically
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const fs = await import('fs');

    // Prepare parameters for bridge executor
    const parametersJson = JSON.stringify(call.parameters);

    // Execute bridge with timeout
    const executeWithTimeout = async (timeout: number = 30000): Promise<MCPResponse> => {
      return new Promise((resolve, reject) => {
        const bridgeProcess = spawn('node', [bridgeExecutorPath, call.tool, parametersJson], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: timeout
        });

        let stdout = '';
        let stderr = '';

        bridgeProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        bridgeProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        bridgeProcess.on('close', (code) => {
          try {
            if (code === 0 && stdout.trim()) {
              // Parse the JSON response from bridge executor
              const result = JSON.parse(stdout.trim());
              resolve({
                success: result.success || false,
                result: result.result || result.error || 'No result',
                error: result.success ? undefined : (result.error || 'Unknown error'),
                executionTime: Date.now() - startTime,
                metadata: {
                  bridgeExecutor: true,
                  toolType: result.toolType || 'unknown',
                  taskId: result.taskId || undefined,
                  authRequired: result.authRequired || false
                }
              });
            } else {
              resolve({
                success: false,
                error: `Bridge executor failed with code ${code}. stderr: ${stderr}`,
                executionTime: Date.now() - startTime
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse bridge response: ${parseError.message}. Raw output: ${stdout}`,
              executionTime: Date.now() - startTime
            });
          }
        });

        bridgeProcess.on('error', (error) => {
          reject(new Error(`Bridge executor spawn error: ${error.message}`));
        });

        // Handle timeout
        setTimeout(() => {
          bridgeProcess.kill('SIGTERM');
          resolve({
            success: false,
            error: `Tool execution timeout after ${timeout}ms`,
            executionTime: Date.now() - startTime
          });
        }, timeout);
      });
    };

    // Execute with dynamic timeout based on tool type
    const timeout = (call.tool && call.tool.includes('synthetic')) ? 45000 : 30000; // Synthetic tools get more time
    const result = await executeWithTimeout(timeout);

    console.log(`[MCP-REAL] Tool ${call.tool} completed:`, {
      success: result.success,
      executionTime: result.executionTime,
      hasError: !!result.error
    });

    return result;

  } catch (error) {
    console.error(`[MCP-REAL] Error executing ${call.tool}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime
    };
  }
}

// Initialize MCP Fallback System and agents
function initializeMCPFallbackSystem() {
  // Configure MCP fallback system with MCP call function
  mcpFallbackSystem.setMCPCallFunction(callMCPTool);

  // Set initial operational mode (sync with modes manager)
  mcpFallbackSystem.setOperationalMode(modeInterface.getCurrentMode());

  // Register CLI and Synthetic agents in the modes manager
  // CLI Agents
  modesManager.registerAgent({
    id: 'codex-cli',
    name: 'Codex CLI',
    capabilities: ['code', 'reasoning', 'tools', 'heavy-computation'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 2000,
      errorRate: 0.3
    },
    isActive: true
  });

  modesManager.registerAgent({
    id: 'gemini-cli',
    name: 'Gemini CLI',
    capabilities: ['frontend', 'refactoring', 'analysis', 'creative'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 1500,
      errorRate: 0.2
    },
    isActive: true
  });

  modesManager.registerAgent({
    id: 'qwen-cli',
    name: 'Qwen CLI',
    capabilities: ['backend', 'automation', 'fast-patching', 'generation'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 1000,
      errorRate: 0.1
    },
    isActive: true
  });

  // Synthetic Fallback Agents
  modesManager.registerAgent({
    id: 'qwen3-coder',
    name: 'Qwen3 Coder (Synthetic)',
    capabilities: ['code', 'reasoning', 'tools', 'heavy-computation'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 3000,
      errorRate: 0.05
    },
    isActive: true
  });

  modesManager.registerAgent({
    id: 'kimi-k2',
    name: 'Kimi K2 (Synthetic)',
    capabilities: ['frontend', 'refactoring', 'robust-processing'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 2500,
      errorRate: 0.05
    },
    isActive: true
  });

  modesManager.registerAgent({
    id: 'glm-4.5',
    name: 'GLM 4.5 (Synthetic)',
    capabilities: ['backend', 'automation', 'fast-patching'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 2000,
      errorRate: 0.05
    },
    isActive: true
  });

  // Claude as supreme orchestrator and emergency fallback
  modesManager.registerAgent({
    id: 'claude-sonnet',
    name: 'Claude Sonnet (Supreme Orchestrator)',
    capabilities: ['reasoning', 'analysis', 'code', 'creative', 'emergency', 'orchestration'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 1200,
      errorRate: 0.01
    },
    isActive: true
  });

  console.log('✅ MCP Fallback System initialized with CLI → Synthetic mapping');
  console.log('✅ Agents registered:', {
    cli: ['codex-cli', 'gemini-cli', 'qwen-cli'],
    synthetic: ['qwen3-coder', 'kimi-k2', 'glm-4.5'],
    orchestrator: ['claude-sonnet']
  });
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

    // Sync operational mode with MCP fallback system
    if (result.success) {
      mcpFallbackSystem.setOperationalMode(mode as any);
      console.log(`[MCP] Fallback system mode synchronized to: ${mode}`);
    }

    // Log mode change per audit trail
    console.log(`[AUDIT] Mode switched from ${previousMode} to ${mode} at ${new Date().toISOString()}`);

    // Get fallback configuration for the new mode
    const fallbackConfig = mcpFallbackSystem.getConfiguration();

    // Emit WebSocket event per modeChange
    io.emit('modeChange', {
      from: previousMode,
      to: mode,
      timestamp: new Date().toISOString(),
      success: result.success,
      fallbackChains: fallbackConfig.fallbackChains[mode as keyof typeof fallbackConfig.fallbackChains]
    });

    res.json({
      success: result.success,
      message: result.message,
      previousMode,
      newMode: mode,
      timestamp: new Date().toISOString(),
      fallbackConfiguration: {
        operationalMode: mode,
        fallbackChain: fallbackConfig.fallbackChains[mode as keyof typeof fallbackConfig.fallbackChains],
        cliToSyntheticMapping: fallbackConfig.cliToSyntheticMapping
      }
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

// Task submission endpoint - uses MCP Fallback System
app.post('/api/tasks', async (req, res) => {
  try {
    const { id, type, payload, priority, description, preferredAgent } = req.body;

    const taskId = id || `task-${Date.now()}`;
    const taskType = type || 'general';
    const taskDescription = description || payload?.description || `Execute ${taskType} task`;

    console.log(`[TASK] Submitting task ${taskId} (${taskType}): ${taskDescription}`);
    console.log(`[TASK] Current mode: ${modeInterface.getCurrentMode()}, Preferred agent: ${preferredAgent || 'auto'}`);

    // Execute task using MCP fallback system with proper CLI → Synthetic fallback chains
    const fallbackResult = await mcpFallbackSystem.executeWithFallback(
      taskDescription,
      taskType,
      preferredAgent
    );

    // Update agent performance metrics if task was successful
    if (fallbackResult.success && fallbackResult.agentUsed !== 'claude-emergency') {
      modesManager.updatePerformanceMetrics(1, 0, fallbackResult.totalExecutionTime);
    } else if (!fallbackResult.success) {
      modesManager.updatePerformanceMetrics(0, 1, fallbackResult.totalExecutionTime);
    }

    // Emit WebSocket event for real-time task monitoring
    io.emit('taskCompleted', {
      taskId,
      success: fallbackResult.success,
      agentUsed: fallbackResult.agentUsed,
      fallbacksUsed: fallbackResult.fallbacksUsed,
      executionTime: fallbackResult.totalExecutionTime,
      timestamp: new Date().toISOString(),
      mode: modeInterface.getCurrentMode()
    });

    // Return result in unified orchestrator format for compatibility
    res.json({
      taskId,
      platformId: fallbackResult.agentUsed,
      success: fallbackResult.success,
      result: fallbackResult.result,
      error: fallbackResult.error,
      executionTime: fallbackResult.totalExecutionTime,
      metadata: {
        type: taskType,
        operationalMode: modeInterface.getCurrentMode(),
        fallbacksUsed: fallbackResult.fallbacksUsed,
        fallbackChainActivated: fallbackResult.fallbacksUsed.length > 0
      }
    });

  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({
      error: 'Task submission failed',
      message: error instanceof Error ? error.message : String(error),
      taskId: req.body.id || `task-${Date.now()}`,
      success: false
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

// Platforms endpoint - shows MCP agents and fallback configuration
app.get('/api/platforms', (req, res) => {
  try {
    const fallbackConfig = mcpFallbackSystem.getConfiguration();
    const agentsStatus = modesManager.getSystemStatus();

    res.json({
      operationalMode: fallbackConfig.operationalMode,
      fallbackChains: fallbackConfig.fallbackChains,
      cliToSyntheticMapping: fallbackConfig.cliToSyntheticMapping,
      agentsStatus: {
        currentMode: agentsStatus.currentMode,
        activeAgents: agentsStatus.activeAgents,
        queuedTasks: agentsStatus.queuedTasks,
        performance: agentsStatus.performance
      },
      mcpTools: {
        cli: {
          codex: 'mcp__codex-cli__codex',
          gemini: 'mcp__gemini-cli__ask-gemini',
          qwen: 'mcp__qwen-code__ask-qwen'
        },
        synthetic: {
          'qwen3-coder': 'mcp__devflow-synthetic-cc-sessions__synthetic_auto',
          'kimi-k2': 'mcp__devflow-synthetic-cc-sessions__synthetic_auto',
          'glm-4.5': 'mcp__devflow-synthetic-cc-sessions__synthetic_auto'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Fallback system test endpoint
app.post('/api/test-fallback', async (req, res) => {
  try {
    const { taskDescription, preferredAgent } = req.body;

    const testTask = taskDescription || "Generate a simple hello world function in TypeScript";
    console.log(`[TEST] Testing fallback system with task: ${testTask}`);
    console.log(`[TEST] Current mode: ${modeInterface.getCurrentMode()}, Preferred agent: ${preferredAgent || 'auto'}`);

    const testResult = await mcpFallbackSystem.executeWithFallback(
      testTask,
      'code-generation',
      preferredAgent
    );

    res.json({
      testTask,
      mode: modeInterface.getCurrentMode(),
      preferredAgent: preferredAgent || 'auto',
      result: testResult,
      fallbackConfiguration: mcpFallbackSystem.getConfiguration(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Fallback test failed',
      message: error instanceof Error ? error.message : String(error)
    });
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

    // Initialize MCP Fallback System with CLI → Synthetic mapping
    initializeMCPFallbackSystem();

    // Start unified orchestrator for compatibility
    await unifiedOrchestrator.start();
    console.log('✅ Unified Orchestrator started');

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`🌐 DevFlow Unified Orchestrator listening on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🎛️  Mode management: http://localhost:${PORT}/mode/switch/:mode`);
      console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics`);
      console.log(`🔧 Platforms: http://localhost:${PORT}/api/platforms`);
      console.log(`🧪 Test fallback: http://localhost:${PORT}/api/test-fallback`);
      console.log(`🔄 Current mode: ${modeInterface.getCurrentMode()}`);
      console.log(`⚡ MCP Fallback System: ACTIVE with CLI → Synthetic mapping`);

      // Log current fallback configuration
      const fallbackConfig = mcpFallbackSystem.getConfiguration();
      console.log(`📋 Fallback chains:`, JSON.stringify(fallbackConfig.fallbackChains, null, 2));
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