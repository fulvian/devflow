// auto-commit.js
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const TODOS_FILE = '.claude/state/current_todos.json';
const MAX_BRANCH_NAME_LENGTH = 50;

/**
 * Auto-commit system that monitors todo completion and manages git workflow
 */
class AutoCommitSystem {
  constructor() {
    this.logger = console;
  }

  /**
   * Main execution function
   */
  async run() {
    try {
      this.logger.log('Checking todo completion status...');
      const todos = await this.readTodos();
      
      if (await this.areAllTodosCompleted(todos)) {
        this.logger.log('All todos completed. Initiating auto-commit sequence...');
        await this.executeAutoCommit(todos);
      } else {
        this.logger.log('Pending todos remain. Auto-commit not triggered.');
      }
    } catch (error) {
      this.logger.error('Auto-commit process failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Read todos from file
   */
  async readTodos() {
    try {
      const data = await fs.readFile(TODOS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to read todos file: ${error.message}`);
    }
  }

  /**
   * Check if all todos are completed
   */
  async areAllTodosCompleted(todos) {
    return Array.isArray(todos) && todos.every(todo => todo.completed);
  }

  /**
   * Execute the complete auto-commit workflow
   */
  async executeAutoCommit(todos) {
    try {
      const branchName = this.generateBranchName(todos);
      await this.createAndCheckoutBranch(branchName);
      await this.commitChanges(todos);
      await this.pushChanges(branchName);
      await this.resetTodos();
      this.logger.log('Auto-commit sequence completed successfully!');
    } catch (error) {
      this.logger.error('Auto-commit sequence failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate descriptive branch name from todos
   */
  generateBranchName(todos) {
    const titles = todos.map(todo => 
      todo.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    ).join('-');
    
    const name = `devflow-auto-${titles}`.substring(0, MAX_BRANCH_NAME_LENGTH);
    return name.replace(/-+$/, ''); // Remove trailing dashes
  }

  /**
   * Create and checkout new branch
   */
  async createAndCheckoutBranch(branchName) {
    try {
      await execPromise(`git checkout -b ${branchName}`);
      this.logger.log(`Created and switched to branch: ${branchName}`);
    } catch (error) {
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  /**
   * Commit all changes with descriptive message
   */
  async commitChanges(todos) {
    try {
      await execPromise('git add .');
      const commitMessage = this.generateCommitMessage(todos);
      await execPromise(`git commit -m "${commitMessage}"`);
      this.logger.log('Changes committed successfully');
    } catch (error) {
      throw new Error(`Commit failed: ${error.message}`);
    }
  }

  /**
   * Generate commit message from todos
   */
  generateCommitMessage(todos) {
    const count = todos.length;
    return `DEVFLOW-AUTO-COMMIT-001: Completed ${count} automated task${count > 1 ? 's' : ''}`;
  }

  /**
   * Push changes to remote repository
   */
  async pushChanges(branchName) {
    try {
      await execPromise(`git push origin ${branchName}`);
      this.logger.log('Changes pushed to remote repository');
    } catch (error) {
      throw new Error(`Push failed: ${error.message}`);
    }
  }

  /**
   * Reset todos file after successful commit
   */
  async resetTodos() {
    try {
      await fs.writeFile(TODOS_FILE, '[]', 'utf8');
      this.logger.log('Todos reset successfully');
    } catch (error) {
      throw new Error(`Failed to reset todos: ${error.message}`);
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const system = new AutoCommitSystem();
  system.run().catch(() => process.exit(1));
}

module.exports = AutoCommitSystem;