/**
 * Project Lifecycle Management API Server
 * Standalone Express.js server with SQLite database
 */

// Import required modules
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Database setup
const DB_PATH = path.join(__dirname, 'data', 'devflow.sqlite');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Create tables if they don't exist
function initializeDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating projects table:', err.message);
    } else {
      console.log('Projects table ready');
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// API Routes

// Get all projects
app.get('/api/projects', (req, res) => {
  const sql = 'SELECT * FROM projects ORDER BY created_at DESC';
  
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: 'success',
      data: rows,
      count: rows.length
    });
  });
});

// Get project by ID
app.get('/api/projects/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'SELECT * FROM projects WHERE id = ?';
  
  db.get(sql, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (row) {
      res.json({
        message: 'success',
        data: row
      });
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  });
});

// Create new project
app.post('/api/projects', (req, res) => {
  const { name, description, status = 'active' } = req.body;
  
  // Validation
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  
  const sql = 'INSERT INTO projects (name, description, status) VALUES (?, ?, ?)';
  const params = [name, description, status];
  
  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(201).json({
      message: 'Project created successfully',
      data: {
        id: this.lastID,
        name,
        description,
        status
      }
    });
  });
});

// Update project
app.put('/api/projects/:id', (req, res) => {
  const id = req.params.id;
  const { name, description, status } = req.body;
  
  // Validation
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  
  const sql = 'UPDATE projects SET name = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  const params = [name, description, status, id];
  
  db.run(sql, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({
      message: 'Project updated successfully',
      data: {
        id,
        name,
        description,
        status
      }
    });
  });
});

// Delete project
app.delete('/api/projects/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'DELETE FROM projects WHERE id = ?';
  
  db.run(sql, [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({
      message: 'Project deleted successfully'
    });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Project Lifecycle Management API'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Project Lifecycle API server running on port ${PORT}`);
  console.log(`Database path: ${DB_PATH}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});

module.exports = app;