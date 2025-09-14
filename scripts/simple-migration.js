/**
 * Simple Migration Script for cc-sessions to Cognitive Memory System
 * Task ID: DEVFLOW-MIGRATE-SIMPLE-001
 * 
 * This script migrates cc-sessions task files into the cognitive memory database
 * using direct SQLite operations and built-in Node.js modules.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Configuration
const SESSIONS_DIR = './sessions/tasks'; // Directory containing session files
const DB_PATH = './devflow.sqlite'; // Database path

/**
 * Simple embedding generator
 * Creates a basic vector representation of text content
 * @param {string} text - Input text to embed
 * @returns {number[]} - Simple embedding vector
 */
function generateSimpleEmbedding(text) {
  // Normalize text
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/).filter(word => word.length > 0);
  
  // Simple bag-of-words approach with position weighting
  const embedding = new Array(128).fill(0);
  words.forEach((word, index) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) & 0xFFFFFFFF;
    }
    const position = Math.abs(hash) % 128;
    embedding[position] += 1 / (index + 1); // Position weighting
  });
  
  return embedding;
}

/**
 * Parse task information from session file content
 * @param {string} content - File content
 * @returns {object} - Parsed task information
 */
function parseTaskInfo(content) {
  try {
    const data = JSON.parse(content);
    return {
      taskId: data.taskId || 'unknown',
      title: data.title || 'Untitled Task',
      description: data.description || '',
      status: data.status || 'unknown',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      metadata: data.metadata || {}
    };
  } catch (error) {
    console.warn('Failed to parse task info, using defaults:', error.message);
    return {
      taskId: 'unknown',
      title: 'Untitled Task',
      description: '',
      status: 'unknown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {}
    };
  }
}

/**
 * Process a single session file
 * @param {sqlite3.Database} db - Database connection
 * @param {string} filePath - Path to session file
 * @returns {Promise<void>}
 */
async function processSessionFile(db, filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, content) => {
      if (err) {
        console.error(`Error reading file ${filePath}:`, err.message);
        return resolve();
      }

      try {
        // Parse task information
        const taskInfo = parseTaskInfo(content);
        
        // Generate embeddings
        const titleEmbedding = generateSimpleEmbedding(taskInfo.title);
        const descriptionEmbedding = generateSimpleEmbedding(taskInfo.description);
        
        // Insert into task_contexts table
        const stmt = db.prepare(`
          INSERT INTO task_contexts 
          (task_id, title, description, status, created_at, updated_at, title_embedding, description_embedding, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
          taskInfo.taskId,
          taskInfo.title,
          taskInfo.description,
          taskInfo.status,
          taskInfo.createdAt,
          taskInfo.updatedAt,
          JSON.stringify(titleEmbedding),
          JSON.stringify(descriptionEmbedding),
          JSON.stringify(taskInfo.metadata)
        ], function(err) {
          if (err) {
            console.error(`Error inserting task ${taskInfo.taskId}:`, err.message);
            reject(err);
          } else {
            console.log(`Successfully migrated task: ${taskInfo.taskId}`);
            resolve();
          }
        });
        
        stmt.finalize();
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
        resolve();
      }
    });
  });
}

/**
 * Initialize database schema
 * @param {sqlite3.Database} db - Database connection
 * @returns {Promise<void>}
 */
function initializeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create task_contexts table if it doesn't exist
      db.run(`
        CREATE TABLE IF NOT EXISTS task_contexts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT,
          created_at TEXT,
          updated_at TEXT,
          title_embedding TEXT,
          description_embedding TEXT,
          metadata TEXT
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

/**
 * Get all session files from directory
 * @returns {Promise<string[]>} - Array of file paths
 */
function getSessionFiles() {
  return new Promise((resolve, reject) => {
    fs.readdir(SESSIONS_DIR, (err, files) => {
      if (err) {
        reject(err);
      } else {
        // Filter for JSON files
        const sessionFiles = files
          .filter(file => path.extname(file) === '.json')
          .map(file => path.join(SESSIONS_DIR, file));
        resolve(sessionFiles);
      }
    });
  });
}

/**
 * Main migration function
 */
async function migrateSessions() {
  console.log('Starting cc-sessions migration...');
  
  // Check if sessions directory exists
  if (!fs.existsSync(SESSIONS_DIR)) {
    console.error(`Sessions directory not found: ${SESSIONS_DIR}`);
    process.exit(1);
  }
  
  try {
    // Open database connection
    const db = new sqlite3.Database(DB_PATH);
    
    // Initialize database schema
    await initializeDatabase(db);
    console.log('Database initialized successfully');
    
    // Get session files
    const sessionFiles = await getSessionFiles();
    console.log(`Found ${sessionFiles.length} session files to migrate`);
    
    if (sessionFiles.length === 0) {
      console.log('No session files to process');
      db.close();
      return;
    }
    
    // Process each session file
    let processed = 0;
    for (const filePath of sessionFiles) {
      try {
        await processSessionFile(db, filePath);
        processed++;
        console.log(`Progress: ${processed}/${sessionFiles.length} files processed`);
      } catch (error) {
        console.error(`Failed to process file ${filePath}:`, error.message);
      }
    }
    
    // Close database connection
    db.close();
    
    console.log(`Migration completed. Successfully processed ${processed} files.`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  migrateSessions();
}

module.exports = {
  migrateSessions,
  processSessionFile,
  parseTaskInfo,
  generateSimpleEmbedding
};