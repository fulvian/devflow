/**
 * Task Authority System - COMETA-BRAIN-AUTHORITY-002
 * 
 * This module handles task management with proper SQL schema compliance,
 * immediate state synchronization, and enhanced error handling.
 */

const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Database configuration
const DB_PATH = process.env.DB_PATH || './.cometa/cometa.db';
const STATE_DIR = './.claude/state';
const DEVFLOW_DIR = './.devflow';

/**
 * Initialize database connection
 */
function initializeDatabase() {
    return new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Database connection error:', err);
        }
    });
}

/**
 * Execute a database query with error handling
 * @param {sqlite3.Database} db - Database instance
 * @param {string} query - SQL query to execute
 * @param {Array} params - Query parameters
 * @returns {Promise<Array|Object>} Query results
 */
function executeQuery(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(new Error(`Database query failed: ${err.message}`));
                return;
            }
            resolve(rows);
        });
    });
}

/**
 * Get active tasks from database
 * @param {sqlite3.Database} db - Database instance
 * @returns {Promise<Array>} Active tasks
 */
async function getActiveTasks(db) {
    try {
        const query = `
            SELECT id, title, description, status, created_at
            FROM task_contexts 
            WHERE status IN ('planning', 'active', 'blocked')
            ORDER BY created_at DESC
        `;
        return await executeQuery(db, query);
    } catch (error) {
        throw new Error(`Failed to fetch active tasks: ${error.message}`);
    }
}

/**
 * Get completed tasks from database
 * @param {sqlite3.Database} db - Database instance
 * @returns {Promise<Array>} Completed tasks
 */
async function getCompletedTasks(db) {
    try {
        const query = `
            SELECT id, title, description, status, created_at
            FROM task_contexts 
            WHERE status = 'completed'
            ORDER BY created_at DESC
        `;
        return await executeQuery(db, query);
    } catch (error) {
        throw new Error(`Failed to fetch completed tasks: ${error.message}`);
    }
}

/**
 * Calculate progress percentage
 * @param {number} completed - Number of completed tasks
 * @param {number} total - Total number of tasks
 * @returns {number} Progress percentage
 */
function calculateProgress(completed, total) {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
async function ensureDirectory(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

/**
 * Write state to file with immediate overwrite
 * @param {string} filePath - File path
 * @param {Object} data - Data to write
 */
async function writeStateFile(filePath, data) {
    try {
        await ensureDirectory(path.dirname(filePath));
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        throw new Error(`Failed to write state file ${filePath}: ${error.message}`);
    }
}

/**
 * Update Claude state file
 * @param {Object} taskData - Current task data
 */
async function updateClaudeState(taskData) {
    const statePath = path.join(STATE_DIR, 'current_task.json');
    await writeStateFile(statePath, taskData);
}

/**
 * Update DevFlow footer state
 * @param {Object} progressData - Progress information
 */
async function updateDevFlowState(progressData) {
    const statePath = path.join(DEVFLOW_DIR, 'footer-state.json');
    await writeStateFile(statePath, progressData);
}

/**
 * Main synchronization function
 */
async function syncTaskStates() {
    let db;
    
    try {
        // Initialize database
        db = initializeDatabase();
        
        // Fetch tasks
        const activeTasks = await getActiveTasks(db);
        const completedTasks = await getCompletedTasks(db);
        const totalTasks = activeTasks.length + completedTasks.length;
        
        // Calculate progress
        const progress = calculateProgress(completedTasks.length, totalTasks);
        
        // Prepare state data
        const currentTask = activeTasks.length > 0 ? activeTasks[0] : null;
        const progressData = {
            progress: `${progress}%`,
            completed: completedTasks.length,
            total: totalTasks,
            timestamp: new Date().toISOString()
        };
        
        // Update state files immediately
        await updateClaudeState(currentTask || {});
        await updateDevFlowState(progressData);
        
        console.log(`Task sync completed: ${completedTasks.length}/${totalTasks} tasks completed (${progress}%)`);
        
    } catch (error) {
        console.error('Task synchronization failed:', error.message);
        throw error;
    } finally {
        if (db) {
            db.close();
        }
    }
}

/**
 * Run single synchronization cycle
 */
async function runSync() {
    try {
        await syncTaskStates();
        console.log('State synchronization completed successfully');
    } catch (error) {
        console.error('Synchronization error:', error.message);
        process.exit(1);
    }
}

// Export for module usage
module.exports = {
    syncTaskStates,
    runSync,
    getActiveTasks,
    getCompletedTasks,
    calculateProgress
};

// Run if called directly
if (require.main === module) {
    runSync();
}