/**
 * Enhanced File Operations for Synthetic MCP Server
 * Provides full autonomous file system control for DevFlow project
 */

import { promises as fs } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { existsSync } from 'fs';

export interface FileOperation {
  type: 'create' | 'write' | 'read' | 'delete' | 'move' | 'copy' | 'mkdir' | 'rmdir';
  path: string;
  content?: string;
  targetPath?: string; // for move/copy operations
  recursive?: boolean; // for directory operations
  backup?: boolean;
}

export interface FileOperationResult {
  operation: string;
  path: string;
  status: 'SUCCESS' | 'ERROR' | 'SKIPPED';
  message?: string;
  backupPath?: string;
}

export class AutonomousFileManager {
  private projectRoot: string;
  private allowedPaths: string[];
  private allowedExtensions: string[];
  private createBackups: boolean;
  private deleteEnabled: boolean;

  constructor(
    projectRoot: string,
    allowedPaths: string[],
    allowedExtensions: string[],
    createBackups: boolean = true,
    deleteEnabled: boolean = false
  ) {
    this.projectRoot = projectRoot;
    this.allowedPaths = allowedPaths;
    this.allowedExtensions = allowedExtensions;
    this.createBackups = createBackups;
    this.deleteEnabled = deleteEnabled;
  }

  /**
   * Execute multiple file operations atomically
   */
  async executeOperations(operations: FileOperation[]): Promise<FileOperationResult[]> {
    const results: FileOperationResult[] = [];
    
    // Validate all operations first
    for (const op of operations) {
      const validation = this.validateOperation(op);
      if (!validation.valid) {
        results.push({
          operation: op.type,
          path: op.path,
          status: 'ERROR',
          message: validation.reason
        });
        continue;
      }
    }

    // Execute operations
    for (const op of operations) {
      try {
        const result = await this.executeSingleOperation(op);
        results.push(result);
      } catch (error) {
        results.push({
          operation: op.type,
          path: op.path,
          status: 'ERROR',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Create a new file with content
   */
  async createFile(filePath: string, content: string, backup: boolean = true): Promise<FileOperationResult> {
    const fullPath = resolve(this.projectRoot, filePath);
    
    if (!this.isPathAllowed(fullPath)) {
      return {
        operation: 'create',
        path: filePath,
        status: 'ERROR',
        message: 'Path not allowed'
      };
    }

    // Ensure directory exists
    const dir = dirname(fullPath);
    await this.ensureDirectoryExists(dir);

    // Create backup if file exists and backup is enabled
    let backupPath: string | undefined;
    if (existsSync(fullPath) && backup && this.createBackups) {
      backupPath = await this.createBackupFile(fullPath);
    }

    // Write file
    await fs.writeFile(fullPath, content, 'utf8');

    return {
      operation: 'create',
      path: filePath,
      status: 'SUCCESS',
      message: existsSync(fullPath) ? 'File created successfully' : 'File overwritten',
      backupPath
    };
  }

  /**
   * Write content to an existing file or create new one
   */
  async writeFile(filePath: string, content: string, backup: boolean = true): Promise<FileOperationResult> {
    return this.createFile(filePath, content, backup);
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<{ content: string; status: 'SUCCESS' | 'ERROR'; message?: string }> {
    const fullPath = resolve(this.projectRoot, filePath);
    
    if (!this.isPathAllowed(fullPath)) {
      return {
        content: '',
        status: 'ERROR',
        message: 'Path not allowed'
      };
    }

    if (!existsSync(fullPath)) {
      return {
        content: '',
        status: 'ERROR',
        message: 'File not found'
      };
    }

    try {
      const content = await fs.readFile(fullPath, 'utf8');
      return {
        content,
        status: 'SUCCESS'
      };
    } catch (error) {
      return {
        content: '',
        status: 'ERROR',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string, backup: boolean = true): Promise<FileOperationResult> {
    if (!this.deleteEnabled) {
      return {
        operation: 'delete',
        path: filePath,
        status: 'ERROR',
        message: 'Delete operations disabled'
      };
    }

    const fullPath = resolve(this.projectRoot, filePath);
    
    if (!this.isPathAllowed(fullPath)) {
      return {
        operation: 'delete',
        path: filePath,
        status: 'ERROR',
        message: 'Path not allowed'
      };
    }

    if (!existsSync(fullPath)) {
      return {
        operation: 'delete',
        path: filePath,
        status: 'SKIPPED',
        message: 'File does not exist'
      };
    }

    // Create backup if enabled
    let backupPath: string | undefined;
    if (backup && this.createBackups) {
      backupPath = await this.createBackupFile(fullPath);
    }

    // Delete file
    await fs.unlink(fullPath);

    return {
      operation: 'delete',
      path: filePath,
      status: 'SUCCESS',
      message: 'File deleted successfully',
      backupPath
    };
  }

  /**
   * Move/rename a file
   */
  async moveFile(sourcePath: string, targetPath: string, backup: boolean = true): Promise<FileOperationResult> {
    const sourceFullPath = resolve(this.projectRoot, sourcePath);
    const targetFullPath = resolve(this.projectRoot, targetPath);
    
    if (!this.isPathAllowed(sourceFullPath) || !this.isPathAllowed(targetFullPath)) {
      return {
        operation: 'move',
        path: sourcePath,
        status: 'ERROR',
        message: 'Path not allowed'
      };
    }

    if (!existsSync(sourceFullPath)) {
      return {
        operation: 'move',
        path: sourcePath,
        status: 'ERROR',
        message: 'Source file does not exist'
      };
    }

    // Ensure target directory exists
    const targetDir = dirname(targetFullPath);
    await this.ensureDirectoryExists(targetDir);

    // Create backup if target exists and backup is enabled
    let backupPath: string | undefined;
    if (existsSync(targetFullPath) && backup && this.createBackups) {
      backupPath = await this.createBackupFile(targetFullPath);
    }

    // Move file
    await fs.rename(sourceFullPath, targetFullPath);

    return {
      operation: 'move',
      path: sourcePath,
      status: 'SUCCESS',
      message: `File moved to ${targetPath}`,
      backupPath
    };
  }

  /**
   * Copy a file
   */
  async copyFile(sourcePath: string, targetPath: string, backup: boolean = true): Promise<FileOperationResult> {
    const sourceFullPath = resolve(this.projectRoot, sourcePath);
    const targetFullPath = resolve(this.projectRoot, targetPath);
    
    if (!this.isPathAllowed(sourceFullPath) || !this.isPathAllowed(targetFullPath)) {
      return {
        operation: 'copy',
        path: sourcePath,
        status: 'ERROR',
        message: 'Path not allowed'
      };
    }

    if (!existsSync(sourceFullPath)) {
      return {
        operation: 'copy',
        path: sourcePath,
        status: 'ERROR',
        message: 'Source file does not exist'
      };
    }

    // Ensure target directory exists
    const targetDir = dirname(targetFullPath);
    await this.ensureDirectoryExists(targetDir);

    // Create backup if target exists and backup is enabled
    let backupPath: string | undefined;
    if (existsSync(targetFullPath) && backup && this.createBackups) {
      backupPath = await this.createBackupFile(targetFullPath);
    }

    // Copy file
    await fs.copyFile(sourceFullPath, targetFullPath);

    return {
      operation: 'copy',
      path: sourcePath,
      status: 'SUCCESS',
      message: `File copied to ${targetPath}`,
      backupPath
    };
  }

  /**
   * Create a directory
   */
  async createDirectory(dirPath: string, recursive: boolean = true): Promise<FileOperationResult> {
    const fullPath = resolve(this.projectRoot, dirPath);
    
    if (!this.isPathAllowed(fullPath)) {
      return {
        operation: 'mkdir',
        path: dirPath,
        status: 'ERROR',
        message: 'Path not allowed'
      };
    }

    if (existsSync(fullPath)) {
      return {
        operation: 'mkdir',
        path: dirPath,
        status: 'SKIPPED',
        message: 'Directory already exists'
      };
    }

    await fs.mkdir(fullPath, { recursive });

    return {
      operation: 'mkdir',
      path: dirPath,
      status: 'SUCCESS',
      message: 'Directory created successfully'
    };
  }

  /**
   * Remove a directory
   */
  async removeDirectory(dirPath: string, recursive: boolean = false): Promise<FileOperationResult> {
    if (!this.deleteEnabled) {
      return {
        operation: 'rmdir',
        path: dirPath,
        status: 'ERROR',
        message: 'Delete operations disabled'
      };
    }

    const fullPath = resolve(this.projectRoot, dirPath);
    
    if (!this.isPathAllowed(fullPath)) {
      return {
        operation: 'rmdir',
        path: dirPath,
        status: 'ERROR',
        message: 'Path not allowed'
      };
    }

    if (!existsSync(fullPath)) {
      return {
        operation: 'rmdir',
        path: dirPath,
        status: 'SKIPPED',
        message: 'Directory does not exist'
      };
    }

    await fs.rmdir(fullPath, { recursive });

    return {
      operation: 'rmdir',
      path: dirPath,
      status: 'SUCCESS',
      message: 'Directory removed successfully'
    };
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string): Promise<{
    files: string[];
    directories: string[];
    status: 'SUCCESS' | 'ERROR';
    message?: string;
  }> {
    const fullPath = resolve(this.projectRoot, dirPath);
    
    if (!this.isPathAllowed(fullPath)) {
      return {
        files: [],
        directories: [],
        status: 'ERROR',
        message: 'Path not allowed'
      };
    }

    if (!existsSync(fullPath)) {
      return {
        files: [],
        directories: [],
        status: 'ERROR',
        message: 'Directory does not exist'
      };
    }

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      const files = entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name);
      
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      return {
        files,
        directories,
        status: 'SUCCESS'
      };
    } catch (error) {
      return {
        files: [],
        directories: [],
        status: 'ERROR',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get file/directory information
   */
  async getPathInfo(path: string): Promise<{
    exists: boolean;
    isFile: boolean;
    isDirectory: boolean;
    size?: number;
    modified?: Date;
    status: 'SUCCESS' | 'ERROR';
    message?: string;
  }> {
    const fullPath = resolve(this.projectRoot, path);
    
    if (!this.isPathAllowed(fullPath)) {
      return {
        exists: false,
        isFile: false,
        isDirectory: false,
        status: 'ERROR',
        message: 'Path not allowed'
      };
    }

    try {
      if (!existsSync(fullPath)) {
        return {
          exists: false,
          isFile: false,
          isDirectory: false,
          status: 'SUCCESS'
        };
      }

      const stats = await fs.stat(fullPath);
      
      return {
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime,
        status: 'SUCCESS'
      };
    } catch (error) {
      return {
        exists: false,
        isFile: false,
        isDirectory: false,
        status: 'ERROR',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Private helper methods

  private async executeSingleOperation(op: FileOperation): Promise<FileOperationResult> {
    switch (op.type) {
      case 'create':
      case 'write':
        return this.createFile(op.path, op.content || '', op.backup);
      
      case 'delete':
        return this.deleteFile(op.path, op.backup);
      
      case 'move':
        if (!op.targetPath) throw new Error('Target path required for move operation');
        return this.moveFile(op.path, op.targetPath, op.backup);
      
      case 'copy':
        if (!op.targetPath) throw new Error('Target path required for copy operation');
        return this.copyFile(op.path, op.targetPath, op.backup);
      
      case 'mkdir':
        return this.createDirectory(op.path, op.recursive);
      
      case 'rmdir':
        return this.removeDirectory(op.path, op.recursive);
      
      default:
        throw new Error(`Unknown operation type: ${op.type}`);
    }
  }

  private validateOperation(op: FileOperation): { valid: boolean; reason?: string } {
    // Check if path is allowed
    const fullPath = resolve(this.projectRoot, op.path);
    if (!this.isPathAllowed(fullPath)) {
      return { valid: false, reason: 'Path not allowed' };
    }

    // Check file extension for file operations
    if ((op.type === 'create' || op.type === 'write') && this.allowedExtensions.length > 0) {
      const ext = extname(op.path);
      if (ext && !this.allowedExtensions.includes(ext)) {
        return { valid: false, reason: `File extension ${ext} not allowed` };
      }
    }

    // Check if delete operations are enabled
    if ((op.type === 'delete' || op.type === 'rmdir') && !this.deleteEnabled) {
      return { valid: false, reason: 'Delete operations are disabled' };
    }

    // Validate target path for move/copy operations
    if ((op.type === 'move' || op.type === 'copy') && op.targetPath) {
      const targetFullPath = resolve(this.projectRoot, op.targetPath);
      if (!this.isPathAllowed(targetFullPath)) {
        return { valid: false, reason: 'Target path not allowed' };
      }
    }

    return { valid: true };
  }

  private isPathAllowed(fullPath: string): boolean {
    return this.allowedPaths.some(allowedPath => fullPath.startsWith(allowedPath));
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async createBackupFile(originalPath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${originalPath}.backup-${timestamp}`;
    
    await fs.copyFile(originalPath, backupPath);
    
    console.log(`[Synthetic MCP] Backup created: ${backupPath}`);
    return backupPath;
  }
}

export default AutonomousFileManager;