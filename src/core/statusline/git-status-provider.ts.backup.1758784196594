import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { GitStatus } from './statusline-types';

export class GitStatusProvider extends EventEmitter {
  private repositoryRoot: string | null = null;
  private lastCheck: number = 0;
  private cacheDuration: number = 30000; // 30 seconds
  private cachedStatus: GitStatus | null = null;

  constructor() {
    super();
  }

  public async initialize(): Promise<void> {
    try {
      this.repositoryRoot = this.findRepositoryRoot();
      console.log(`Git repository found at: ${this.repositoryRoot}`);
    } catch (error) {
      console.warn('No Git repository found in current path or parents');
    }
  }

  private findRepositoryRoot(): string {
    let currentDir = process.cwd();
    
    while (currentDir !== path.parse(currentDir).root) {
      const gitPath = path.join(currentDir, '.git');
      if (fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // Check root directory as well
    const rootGitPath = path.join(currentDir, '.git');
    if (fs.existsSync(rootGitPath) && fs.statSync(rootGitPath).isDirectory()) {
      return currentDir;
    }
    
    throw new Error('Git repository not found');
  }

  public async getStatus(): Promise<GitStatus> {
    // Return cached status if still valid
    const now = Date.now();
    if (this.cachedStatus && (now - this.lastCheck) < this.cacheDuration) {
      return { ...this.cachedStatus };
    }
    
    // If no repository, return default status
    if (!this.repositoryRoot) {
      return {
        branch: '',
        uncommittedChanges: 0,
        isSynced: true,
        repositoryRoot: ''
      };
    }
    
    try {
      const status = await this.fetchGitStatus();
      this.cachedStatus = status;
      this.lastCheck = now;
      return { ...status };
    } catch (error) {
      console.error('Error fetching Git status:', error);
      // Return cached status if available, otherwise default
      return this.cachedStatus || {
        branch: '',
        uncommittedChanges: 0,
        isSynced: true,
        repositoryRoot: this.repositoryRoot || ''
      };
    }
  }

  private async fetchGitStatus(): Promise<GitStatus> {
    if (!this.repositoryRoot) {
      throw new Error('Repository root not initialized');
    }
    
    try {
      // Get current branch
      const branch = execSync('git symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null', {
        cwd: this.repositoryRoot,
        encoding: 'utf8'
      }).trim();
      
      // Get uncommitted changes count
      const statusOutput = execSync('git status --porcelain 2>/dev/null', {
        cwd: this.repositoryRoot,
        encoding: 'utf8'
      });
      
      const uncommittedChanges = statusOutput ? statusOutput.trim().split('\n').filter(line => line.trim() !== '').length : 0;
      
      // Check if branch is synced with remote
      let isSynced = true;
      try {
        execSync('git fetch --dry-run 2>&1', { cwd: this.repositoryRoot });
        const localCommit = execSync('git rev-parse HEAD', { cwd: this.repositoryRoot, encoding: 'utf8' }).trim();
        const remoteCommit = execSync('git rev-parse @{u} 2>/dev/null || echo ""', { cwd: this.repositoryRoot, encoding: 'utf8' }).trim();
        isSynced = localCommit === remoteCommit;
      } catch (error) {
        // If we can't check remote status, assume synced
        console.warn('Could not check remote sync status:', error);
      }
      
      const status: GitStatus = {
        branch,
        uncommittedChanges,
        isSynced,
        repositoryRoot: this.repositoryRoot
      };
      
      // Emit update event
      this.emit('gitUpdate', status);
      
      return status;
    } catch (error) {
      console.error('Error in fetchGitStatus:', error);
      throw error;
    }
  }

  public watch(): void {
    // Set up file watcher for .git directory
    if (this.repositoryRoot) {
      const gitDir = path.join(this.repositoryRoot, '.git');
      fs.watch(gitDir, { recursive: true }, (eventType, filename) => {
        if (filename && (filename.includes('HEAD') || filename.includes('index'))) {
          // Debounce updates
          setTimeout(() => {
            this.getStatus().then(() => {
              // Status will be emitted from getStatus
            }).catch(console.error);
          }, 100);
        }
      });
    }
  }
}
