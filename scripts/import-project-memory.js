/**
 * DevFlow Documentation Importer
 * 
 * This module imports project documentation and session files into the cognitive memory system.
 * It processes markdown files, creates embeddings, and populates the semantic memory database.
 * 
 * @module devflow/docs-import
 */

const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

/**
 * @typedef {Object} ImportStats
 * @property {number} filesProcessed - Number of files processed
 * @property {number} filesSkipped - Number of files skipped
 * @property {number} memoryBlocksCreated - Number of memory blocks created
 * @property {number} totalTimeMs - Total import time in milliseconds
 * @property {Array<string>} errors - List of errors encountered
 */

/**
 * @typedef {Object} MemoryBlock
 * @property {string} id - Unique identifier for the memory block
 * @property {string} content - Content of the memory block
 * @property {Array<number>} embedding - Vector embedding of the content
 * @property {Object} metadata - Metadata about the source
 * @property {string} metadata.sourcePath - Path to the source file
 * @property {string} metadata.fileName - Name of the source file
 * @property {Date} metadata.importedAt - Import timestamp
 * @property {string} metadata.type - Type of document (readme, task, session, etc.)
 */

class DocumentationImporter {
  /**
   * Create a DocumentationImporter instance
   * @param {Object} options - Configuration options
   * @param {string} options.docsPath - Path to documentation directory
   * @param {string} options.sessionsPath - Path to sessions directory
   * @param {Object} options.memoryDb - Semantic memory database instance
   * @param {Function} options.embeddingFunction - Function to generate embeddings
   */
  constructor(options = {}) {
    this.docsPath = options.docsPath || './docs';
    this.sessionsPath = options.sessionsPath || './sessions';
    this.memoryDb = options.memoryDb;
    this.embeddingFunction = options.embeddingFunction || this.defaultEmbeddingFunction;
    this.stats = {
      filesProcessed: 0,
      filesSkipped: 0,
      memoryBlocksCreated: 0,
      totalTimeMs: 0,
      errors: []
    };
    this.startTime = null;
  }

  /**
   * Default embedding function (placeholder)
   * In a real implementation, this would use an actual embedding model
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} - Embedding vector
   */
  async defaultEmbeddingFunction(text) {
    // This is a placeholder - in production, use a real embedding model
    // like OpenAI embeddings, Sentence Transformers, etc.
    const words = text.split(' ').slice(0, 100); // Limit to first 100 words
    return words.map((_, index) => Math.random() * 2 - 1); // Random vector for demo
  }

  /**
   * Import all documentation and session files
   * @returns {Promise<ImportStats>} Import statistics
   */
  async importAll() {
    this.startTime = performance.now();
    this.stats = {
      filesProcessed: 0,
      filesSkipped: 0,
      memoryBlocksCreated: 0,
      totalTimeMs: 0,
      errors: []
    };

    console.log('Starting documentation import process...');
    
    try {
      // Import README files
      await this.importReadmeFiles();
      
      // Import documentation files
      await this.importDocumentationFiles();
      
      // Import session files
      await this.importSessionFiles();
      
      // Import task files
      await this.importTaskFiles();
    } catch (error) {
      this.stats.errors.push(`Import process failed: ${error.message}`);
      console.error('Import process failed:', error);
    }

    this.stats.totalTimeMs = performance.now() - this.startTime;
    this.showImportSummary();
    return this.stats;
  }

  /**
   * Import README files
   */
  async importReadmeFiles() {
    console.log('Importing README files...');
    const readmePatterns = ['README.md', 'readme.md', 'Readme.md'];
    
    for (const pattern of readmePatterns) {
      try {
        const readmePath = path.join(this.docsPath, pattern);
        const exists = await this.fileExists(readmePath);
        
        if (exists) {
          await this.processFile(readmePath, 'readme');
          break; // Only process the first matching README
        }
      } catch (error) {
        this.stats.errors.push(`Error processing README pattern ${pattern}: ${error.message}`);
      }
    }
  }

  /**
   * Import documentation files
   */
  async importDocumentationFiles() {
    console.log('Importing documentation files...');
    try {
      const docFiles = await this.getMarkdownFiles(this.docsPath);
      for (const filePath of docFiles) {
        // Skip README files as they're handled separately
        if (!filePath.toLowerCase().includes('readme')) {
          await this.processFile(filePath, 'documentation');
        }
      }
    } catch (error) {
      this.stats.errors.push(`Error importing documentation files: ${error.message}`);
    }
  }

  /**
   * Import session files
   */
  async importSessionFiles() {
    console.log('Importing session files...');
    try {
      const sessionFiles = await this.getMarkdownFiles(this.sessionsPath);
      for (const filePath of sessionFiles) {
        await this.processFile(filePath, 'session');
      }
    } catch (error) {
      this.stats.errors.push(`Error importing session files: ${error.message}`);
    }
  }

  /**
   * Import task files
   */
  async importTaskFiles() {
    console.log('Importing task files...');
    try {
      const tasksPath = path.join(this.sessionsPath, 'tasks');
      const taskFiles = await this.getMarkdownFiles(tasksPath);
      
      for (const filePath of taskFiles) {
        await this.processFile(filePath, 'task');
      }
    } catch (error) {
      this.stats.errors.push(`Error importing task files: ${error.message}`);
    }
  }

  /**
   * Process a single file
   * @param {string} filePath - Path to the file
   * @param {string} type - Type of document
   */
  async processFile(filePath, type) {
    try {
      // Check if file exists
      const exists = await this.fileExists(filePath);
      if (!exists) {
        this.stats.filesSkipped++;
        return;
      }

      // Read file content
      const content = await fs.readFile(filePath, 'utf8');
      
      // Skip empty files
      if (!content.trim()) {
        this.stats.filesSkipped++;
        return;
      }

      // Create memory block
      const memoryBlock = await this.createMemoryBlock(filePath, content, type);
      
      // Store in memory database
      if (this.memoryDb) {
        await this.memoryDb.store(memoryBlock);
      } else {
        console.warn('No memory database provided, skipping storage');
      }

      this.stats.filesProcessed++;
      this.stats.memoryBlocksCreated++;
      
      // Show progress every 10 files
      if (this.stats.filesProcessed % 10 === 0) {
        this.showProgress();
      }
    } catch (error) {
      this.stats.errors.push(`Error processing file ${filePath}: ${error.message}`);
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  /**
   * Create a memory block from file content
   * @param {string} filePath - Path to the source file
   * @param {string} content - File content
   * @param {string} type - Document type
   * @returns {Promise<MemoryBlock>} Memory block
   */
  async createMemoryBlock(filePath, content, type) {
    // Generate embedding
    const embedding = await this.embeddingFunction(content);
    
    return {
      id: this.generateId(filePath),
      content,
      embedding,
      metadata: {
        sourcePath: filePath,
        fileName: path.basename(filePath),
        importedAt: new Date(),
        type
      }
    };
  }

  /**
   * Generate a unique ID for a memory block
   * @param {string} filePath - Path to the file
   * @returns {string} Unique ID
   */
  generateId(filePath) {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${path.basename(filePath)}`;
  }

  /**
   * Get all markdown files in a directory
   * @param {string} dirPath - Directory path
   * @returns {Promise<Array<string>>} List of markdown file paths
   */
  async getMarkdownFiles(dirPath) {
    try {
      const exists = await this.fileExists(dirPath);
      if (!exists) {
        return [];
      }

      const files = await fs.readdir(dirPath);
      const markdownFiles = [];

      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.getMarkdownFiles(fullPath);
          markdownFiles.push(...subFiles);
        } else if (file.endsWith('.md') || file.endsWith('.markdown')) {
          markdownFiles.push(fullPath);
        }
      }

      return markdownFiles;
    } catch (error) {
      this.stats.errors.push(`Error reading directory ${dirPath}: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if a file exists
   * @param {string} filePath - Path to check
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Show import progress
   */
  showProgress() {
    const elapsed = ((performance.now() - this.startTime) / 1000).toFixed(2);
    console.log(`Progress: ${this.stats.filesProcessed} files processed, ${this.stats.memoryBlocksCreated} memory blocks created (${elapsed}s)`);
  }

  /**
   * Show import summary
   */
  showImportSummary() {
    console.log('\n=== Import Summary ===');
    console.log(`Files processed: ${this.stats.filesProcessed}`);
    console.log(`Files skipped: ${this.stats.filesSkipped}`);
    console.log(`Memory blocks created: ${this.stats.memoryBlocksCreated}`);
    console.log(`Total time: ${(this.stats.totalTimeMs / 1000).toFixed(2)}s`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\nErrors (${this.stats.errors.length}):`);
      this.stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }
    
    console.log('======================\n');
  }
}

module.exports = DocumentationImporter;

// Example usage:
/*
const importer = new DocumentationImporter({
  docsPath: './docs',
  sessionsPath: './sessions',
  memoryDb: yourMemoryDatabaseInstance,
  embeddingFunction: yourEmbeddingFunction
});

importer.importAll().then(stats => {
  console.log('Import completed with stats:', stats);
});
*/