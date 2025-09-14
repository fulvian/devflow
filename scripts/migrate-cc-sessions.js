// task-migrator.js
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const { createHash } = require('crypto');

/**
 * Migrates cc-sessions task files into DevFlow cognitive memory system
 */
class TaskMigrator {
  /**
   * @param {Object} db - Database connection instance
   * @param {Object} embeddingService - Service for generating embeddings
   */
  constructor(db, embeddingService) {
    this.db = db;
    this.embeddingService = embeddingService;
    this.taskMap = new Map(); // Maps file paths to task IDs
  }

  /**
   * Main migration process
   * @param {string} tasksDirectory - Path to the tasks directory
   */
  async migrate(tasksDirectory) {
    try {
      console.log('Starting task migration process...');
      
      // Read all task files
      const taskFiles = await this.getTaskFiles(tasksDirectory);
      
      // Process each file
      for (const filePath of taskFiles) {
        await this.processTaskFile(filePath);
      }
      
      // Update task relationships
      await this.updateTaskRelationships();
      
      console.log(`Successfully migrated ${taskFiles.length} tasks`);
    } catch (error) {
      console.error('Task migration failed:', error);
      throw error;
    }
  }

  /**
   * Gets all markdown task files from directory
   * @param {string} directory - Directory path
   * @returns {Promise<string[]>} Array of file paths
   */
  async getTaskFiles(directory) {
    try {
      const files = await fs.readdir(directory);
      return files
        .filter(file => path.extname(file).toLowerCase() === '.md')
        .map(file => path.join(directory, file));
    } catch (error) {
      throw new Error(`Failed to read task directory: ${error.message}`);
    }
  }

  /**
   * Processes a single task file
   * @param {string} filePath - Path to the task file
   */
  async processTaskFile(filePath) {
    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf8');
      
      // Parse frontmatter
      const { data: frontmatter, content: body } = matter(content);
      
      // Extract task data
      const taskData = this.extractTaskData(frontmatter, body, filePath);
      
      // Generate embedding
      const embedding = await this.embeddingService.generate(
        `${taskData.title} ${taskData.description}`
      );
      
      // Insert into database
      const taskId = await this.insertTask(taskData, embedding);
      
      // Store mapping for relationship updates
      this.taskMap.set(filePath, taskId);
      
      console.log(`Processed task: ${taskData.title}`);
    } catch (error) {
      console.error(`Failed to process task file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extracts task data from frontmatter and content
   * @param {Object} frontmatter - Parsed frontmatter data
   * @param {string} content - Task content/body
   * @param {string} filePath - Path to the file
   * @returns {Object} Extracted task data
   */
  extractTaskData(frontmatter, content, filePath) {
    // Extract metadata with defaults
    const title = frontmatter.title || path.basename(filePath, '.md');
    const description = frontmatter.description || content.trim() || '';
    const status = this.mapStatus(frontmatter.status || 'active');
    const priority = frontmatter.priority || 'medium';
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    const parentId = frontmatter.parent || null;
    
    // Generate consistent ID based on file path
    const id = this.generateTaskId(filePath);
    
    return {
      id,
      title,
      description,
      status,
      priority,
      tags,
      parentId,
      filePath
    };
  }

  /**
   * Maps cc-sessions status to DevFlow status
   * @param {string} status - Original status
   * @returns {string} Mapped status
   */
  mapStatus(status) {
    const statusMap = {
      'done': 'completed',
      'completed': 'completed',
      'active': 'in_progress',
      'in_progress': 'in_progress',
      'pending': 'todo',
      'todo': 'todo'
    };
    
    return statusMap[status.toLowerCase()] || 'todo';
  }

  /**
   * Generates a consistent task ID from file path
   * @param {string} filePath - Path to the task file
   * @returns {string} Generated task ID
   */
  generateTaskId(filePath) {
    return createHash('sha256')
      .update(filePath)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Inserts task into the database
   * @param {Object} taskData - Task data to insert
   * @param {Array<number>} embedding - Embedding vector
   * @returns {Promise<string>} Inserted task ID
   */
  async insertTask(taskData, embedding) {
    const query = `
      INSERT INTO task_contexts (
        id, title, description, status, priority, tags, 
        parent_id, file_path, embedding, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `;
    
    const params = [
      taskData.id,
      taskData.title,
      taskData.description,
      taskData.status,
      taskData.priority,
      JSON.stringify(taskData.tags),
      taskData.parentId,
      taskData.filePath,
      JSON.stringify(embedding),
    ];
    
    try {
      await this.db.run(query, params);
      return taskData.id;
    } catch (error) {
      throw new Error(`Failed to insert task ${taskData.title}: ${error.message}`);
    }
  }

  /**
   * Updates task relationships after all tasks are inserted
   */
  async updateTaskRelationships() {
    console.log('Updating task relationships...');
    
    for (const [filePath, taskId] of this.taskMap.entries()) {
      try {
        // Read file again to get parent reference
        const content = await fs.readFile(filePath, 'utf8');
        const { data: frontmatter } = matter(content);
        
        if (frontmatter.parent) {
          const parentFilePath = path.join(
            path.dirname(filePath), 
            `${frontmatter.parent}.md`
          );
          
          const parentTaskId = this.taskMap.get(parentFilePath);
          
          if (parentTaskId) {
            await this.updateParentRelationship(taskId, parentTaskId);
          }
        }
      } catch (error) {
        console.warn(`Failed to update relationships for ${filePath}:`, error.message);
      }
    }
  }

  /**
   * Updates parent-child relationship in database
   * @param {string} taskId - Child task ID
   * @param {string} parentTaskId - Parent task ID
   */
  async updateParentRelationship(taskId, parentTaskId) {
    const query = `
      UPDATE task_contexts 
      SET parent_id = ? 
      WHERE id = ?
    `;
    
    try {
      await this.db.run(query, [parentTaskId, taskId]);
    } catch (error) {
      throw new Error(`Failed to update parent relationship: ${error.message}`);
    }
  }
}

module.exports = TaskMigrator;