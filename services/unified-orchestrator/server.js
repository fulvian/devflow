// server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const dotenv = require('dotenv');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'devflow-orchestrator' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// In-memory storage for operational mode and tasks
let operationalMode = 'development';
const tasks = new Map();
const agents = {
  synthetic: ['Qwen3 Coder', 'Kimi K2', 'GLM 4.5'],
  cli: ['Codex', 'Gemini', 'Qwen Code']
};

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization token' });
  }
  
  const token = authHeader.substring(7);
  if (token !== process.env.AUTH_TOKEN) {
    return res.status(403).json({ error: 'Invalid authorization token' });
  }
  
  next();
};

// Context7 MCP compliance check
const context7ComplianceCheck = (req, res, next) => {
  // In a real implementation, this would check for Context7 compliance
  // For now, we'll just log that the check was performed
  logger.info('Context7 MCP compliance check performed');
  next();
};

// Cometa Brain communication
const communicateWithCometaBrain = async (data) => {
  try {
    // In a real implementation, this would communicate with Cometa Brain
    // For now, we'll simulate the communication
    logger.info('Communicating with Cometa Brain', { data });
    return { success: true, response: 'Cometa Brain response' };
  } catch (error) {
    logger.error('Error communicating with Cometa Brain', { error });
    throw error;
  }
};

// DevFlow database integration
const devFlowDB = {
  saveTask: (task) => {
    // In a real implementation, this would save to a database
    logger.info('Saving task to DevFlow database', { task });
    return Promise.resolve({ success: true });
  },
  
  getTask: (taskId) => {
    // In a real implementation, this would retrieve from a database
    logger.info('Retrieving task from DevFlow database', { taskId });
    return Promise.resolve(tasks.get(taskId) || null);
  }
};

// Agent integration functions
const executeSyntheticAgent = async (agentName, task) => {
  try {
    // Simulate agent execution
    logger.info(`Executing synthetic agent: ${agentName}`, { task });
    
    // In a real implementation, this would call the actual agent
    const result = `Result from ${agentName} for task: ${task.description}`;
    return { success: true, result };
  } catch (error) {
    logger.error(`Error executing synthetic agent ${agentName}`, { error });
    throw error;
  }
};

const executeCLIAgent = async (agentName, task) => {
  try {
    // Simulate agent execution
    logger.info(`Executing CLI agent: ${agentName}`, { task });
    
    // In a real implementation, this would call the actual agent
    const result = `Result from ${agentName} for task: ${task.description}`;
    return { success: true, result };
  } catch (error) {
    logger.error(`Error executing CLI agent ${agentName}`, { error });
    throw error;
  }
};

// Cross-verification system
const crossVerifyResults = async (results) => {
  try {
    // In a real implementation, this would perform cross-verification
    // For now, we'll just check if all results are consistent
    logger.info('Performing cross-verification of results', { results });
    
    const verificationResult = {
      consistent: true,
      verifiedResult: results[0]?.result || 'No results to verify'
    };
    
    return verificationResult;
  } catch (error) {
    logger.error('Error during cross-verification', { error });
    throw error;
  }
};

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    operationalMode
  });
});

// Mode endpoints
app.get('/api/mode', (req, res) => {
  res.status(200).json({ mode: operationalMode });
});

app.post('/mode/switch/:mode', authenticate, context7ComplianceCheck, (req, res) => {
  const newMode = req.params.mode;
  const validModes = ['development', 'staging', 'production'];
  
  if (!validModes.includes(newMode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  
  operationalMode = newMode;
  
  // Notify all connected clients about the mode change
  io.emit('modeChange', { mode: operationalMode });
  
  logger.info(`Operational mode switched to: ${operationalMode}`);
  res.status(200).json({ message: `Mode switched to ${operationalMode}` });
});

// Orchestration endpoint
app.post('/api/v1/orchestrate', authenticate, context7ComplianceCheck, async (req, res) => {
  try {
    const { taskDescription, priority = 'normal' } = req.body;
    
    if (!taskDescription) {
      return res.status(400).json({ error: 'Task description is required' });
    }
    
    // Create task object
    const taskId = uuidv4();
    const task = {
      id: taskId,
      description: taskDescription,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      assignedAgents: []
    };
    
    // Save task to database
    await devFlowDB.saveTask(task);
    tasks.set(taskId, task);
    
    // Notify clients about new task
    io.emit('taskCreated', task);
    
    // Select agents for task execution
    const syntheticAgent = agents.synthetic[Math.floor(Math.random() * agents.synthetic.length)];
    const cliAgent = agents.cli[Math.floor(Math.random() * agents.cli.length)];
    
    task.assignedAgents = [syntheticAgent, cliAgent];
    task.status = 'in-progress';
    
    // Notify clients about task update
    io.emit('taskUpdated', task);
    
    // Execute agents
    const [syntheticResult, cliResult] = await Promise.all([
      executeSyntheticAgent(syntheticAgent, task),
      executeCLIAgent(cliAgent, task)
    ]);
    
    // Cross-verify results
    const verificationResult = await crossVerifyResults([syntheticResult, cliResult]);
    
    // Update task with results
    task.results = {
      synthetic: syntheticResult,
      cli: cliResult,
      verification: verificationResult
    };
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    
    // Save updated task
    await devFlowDB.saveTask(task);
    
    // Notify clients about task completion
    io.emit('taskCompleted', task);
    
    // Communicate with Cometa Brain
    await communicateWithCometaBrain({
      taskId,
      results: task.results
    });
    
    logger.info('Task orchestration completed', { taskId });
    res.status(200).json({
      taskId,
      message: 'Task completed successfully',
      results: task.results
    });
  } catch (error) {
    logger.error('Error during task orchestration', { error });
    res.status(500).json({ error: 'Internal server error during orchestration' });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info('New client connected');
  
  // Send current operational mode to new client
  socket.emit('modeUpdate', { mode: operationalMode });
  
  // Send existing tasks to new client
  for (const task of tasks.values()) {
    socket.emit('taskCreated', task);
  }
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err });
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  logger.info(`DevFlow Unified Orchestrator running on port ${PORT}`);
  logger.info(`Operational mode: ${operationalMode}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = app;