/**
 * DEVFLOW-API-001: Project Lifecycle Management API
 * Express.js service for managing project lifecycle with SQLite integration
 */

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const winston = require('winston');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Winston logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'devflow-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Database connection
const dbPath = path.resolve(__dirname, '../../data/devflow_unified.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Database connection error:', err);
    process.exit(1);
  }
  logger.info('Connected to SQLite database');
});

// Utility function for database operations
const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

const getQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const allQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error(`${req.method} ${req.path} - Error: ${err.message}`, { 
    stack: err.stack,
    url: req.originalUrl,
    body: req.body
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
};

// API Endpoints

/**
 * Create a new project
 * POST /projects
 * Request body: { name, description, startDate, endDate }
 */
app.post('/projects', async (req, res, next) => {
  try {
    const { name, description, startDate, endDate } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Check if project with same name already exists (case-insensitive)
    const existingProject = await allQuery(
      'SELECT id, name FROM projects WHERE LOWER(name) = LOWER(?)',
      [name]
    );

    if (existingProject.length > 0) {
      return res.status(409).json({
        error: 'Project already exists',
        message: `Un progetto con nome "${existingProject[0].name}" esiste già`,
        existingProject: existingProject[0]
      });
    }

    const query = `
      INSERT INTO projects (name, description, start_date, end_date, status, progress)
      VALUES (?, ?, ?, ?, 'active', 0)
    `;

    const result = await runQuery(query, [name, description, startDate, endDate]);
    
    res.status(201).json({
      id: result.lastID,
      name,
      description,
      startDate,
      endDate,
      status: 'active',
      progress: 0
    });
    
    logger.info(`Project created: ${name}`, { projectId: result.lastID });
  } catch (err) {
    next(err);
  }
});

/**
 * Update project status
 * PUT /projects/:id/status
 * Request body: { status }
 */
app.put('/projects/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const validStatuses = ['active', 'completed', 'on-hold', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }
    
    const query = 'UPDATE projects SET status = ? WHERE id = ?';
    await runQuery(query, [status, id]);
    
    // If project is completed, set progress to 100
    if (status === 'completed') {
      await runQuery('UPDATE projects SET progress = 100 WHERE id = ?', [id]);
    }
    
    const updatedProject = await getQuery('SELECT * FROM projects WHERE id = ?', [id]);
    
    res.json(updatedProject);
    logger.info(`Project status updated: ${id} -> ${status}`);
  } catch (err) {
    next(err);
  }
});

/**
 * Mark task as completed
 * PUT /tasks/:id/complete
 */
app.put('/tasks/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Update task status
    const query = 'UPDATE tasks SET status = "completed", completed_at = datetime("now") WHERE id = ?';
    await runQuery(query, [id]);
    
    // Get task details for logging
    const task = await getQuery('SELECT * FROM tasks WHERE id = ?', [id]);
    
    // Update project progress
    if (task && task.project_id) {
      await updateProjectProgress(task.project_id);
    }
    
    res.json({ message: 'Task marked as completed', taskId: id });
    logger.info(`Task completed: ${id}`);
  } catch (err) {
    next(err);
  }
});

/**
 * Advance plan to next phase
 * PUT /plans/:id/advance
 */
app.put('/plans/:id/advance', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get current plan
    const plan = await getQuery('SELECT * FROM plans WHERE id = ?', [id]);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    // Get next phase (simplified logic - in a real app this would be more complex)
    const phases = ['planning', 'design', 'development', 'testing', 'deployment', 'completed'];
    const currentIndex = phases.indexOf(plan.phase);
    
    if (currentIndex === -1 || currentIndex === phases.length - 1) {
      return res.status(400).json({ error: 'Cannot advance plan further' });
    }
    
    const nextPhase = phases[currentIndex + 1];
    const query = 'UPDATE plans SET phase = ?, updated_at = datetime("now") WHERE id = ?';
    await runQuery(query, [nextPhase, id]);
    
    res.json({ 
      message: `Plan advanced to ${nextPhase} phase`,
      planId: id,
      newPhase: nextPhase
    });
    
    logger.info(`Plan advanced: ${id} -> ${nextPhase}`);
  } catch (err) {
    next(err);
  }
});

/**
 * Update project progress percentage
 * PUT /projects/:id/progress
 * Request body: { progress }
 */
app.put('/projects/:id/progress', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { progress } = req.body;
    
    if (progress === undefined) {
      return res.status(400).json({ error: 'Progress value is required' });
    }
    
    if (isNaN(progress) || progress < 0 || progress > 100) {
      return res.status(400).json({ error: 'Progress must be a number between 0 and 100' });
    }
    
    const query = 'UPDATE projects SET progress = ? WHERE id = ?';
    await runQuery(query, [progress, id]);
    
    // If progress is 100, mark project as completed
    if (progress === 100) {
      await runQuery('UPDATE projects SET status = "completed" WHERE id = ?', [id]);
    }
    
    const updatedProject = await getQuery('SELECT * FROM projects WHERE id = ?', [id]);
    
    res.json(updatedProject);
    logger.info(`Project progress updated: ${id} -> ${progress}%`);
  } catch (err) {
    next(err);
  }
});

/**
 * Helper function to update project progress based on task completion
 */
async function updateProjectProgress(projectId) {
  try {
    // Get total tasks and completed tasks for the project
    const stats = await getQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM tasks 
      WHERE project_id = ?
    `, [projectId]);
    
    if (stats && stats.total > 0) {
      const progress = Math.round((stats.completed / stats.total) * 100);
      await runQuery('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectId]);
      
      // If all tasks are completed, mark project as completed
      if (progress === 100) {
        await runQuery('UPDATE projects SET status = "completed" WHERE id = ?', [projectId]);
      }
    }
  } catch (err) {
    logger.error('Error updating project progress:', err);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      logger.error('Error closing database:', err);
    } else {
      logger.info('Database connection closed');
    }
    process.exit(0);
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`DevFlow API server running on port ${PORT}`);
});

module.exports = app;