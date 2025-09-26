/**
 * Footer Auto-Refresh Daemon - Context7 Chokidar Implementation
 * Real-time footer updates when token data changes
 * Based on Context7 best practices: /paulmillr/chokidar
 */

import chokidar from 'chokidar';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface DaemonConfig {
  watchFiles: string[];
  footerScript: string;
  stabilityThreshold: number;
  pollInterval: number;
  logEnabled: boolean;
}

export class FooterAutoRefreshDaemon {
  private watcher?: ReturnType<typeof chokidar.watch>;
  private config: DaemonConfig;
  private refreshCount = 0;
  private lastRefresh: Date | null = null;

  constructor(config: Partial<DaemonConfig> = {}) {
    this.config = {
      watchFiles: [
        '.devflow/token-usage-state.json',
        '.claude/state/current_task.json',
        '.devflow/footer-state.json'
      ],
      footerScript: '.claude/cometa-footer.sh',
      stabilityThreshold: 200, // ms - wait for file write completion
      pollInterval: 100,      // ms - polling interval if needed
      logEnabled: true,
      ...config
    };
  }

  /**
   * Start the auto-refresh daemon
   */
  async start(): Promise<void> {
    try {
      await this.validatePaths();

      // Context7 Chokidar best practice configuration
      this.watcher = chokidar.watch(this.config.watchFiles, {
        persistent: true,
        ignoreInitial: true,
        ignorePermissionErrors: false,
        atomic: true,
        awaitWriteFinish: {
          stabilityThreshold: this.config.stabilityThreshold,
          pollInterval: this.config.pollInterval
        },
        usePolling: false, // Use native file system events for best performance
        alwaysStat: false,
        depth: 0 // Watch only specified files, not subdirectories
      });

      // Context7 pattern: comprehensive event handling
      this.watcher
        .on('change', this.handleFileChange.bind(this))
        .on('error', this.handleError.bind(this))
        .on('ready', this.handleReady.bind(this));

      this.log('Footer Auto-Refresh Daemon started successfully');

      // Graceful shutdown handlers
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());

    } catch (error) {
      console.error('Failed to start Footer Auto-Refresh Daemon:', error);
      throw error;
    }
  }

  /**
   * Handle file change events - Context7 optimized
   */
  private async handleFileChange(filePath: string): Promise<void> {
    try {
      const relativePath = path.relative(process.cwd(), filePath);
      this.log(`Token data updated: ${relativePath}`);

      // Execute footer refresh with timeout protection
      const { stdout, stderr } = await execAsync(this.config.footerScript, {
        timeout: 5000, // 5 second timeout
        cwd: process.cwd()
      });

      this.refreshCount++;
      this.lastRefresh = new Date();

      this.log(`Footer refreshed successfully (#${this.refreshCount})`);

      // Log footer output for debugging (first 200 chars)
      if (stdout && this.config.logEnabled) {
        const preview = stdout.substring(0, 200).replace(/\n/g, ' ');
        this.log(`Footer: ${preview}${stdout.length > 200 ? '...' : ''}`);
      }

      if (stderr) {
        console.warn('Footer script stderr:', stderr);
      }

    } catch (error) {
      console.error('Failed to refresh footer:', error);
      // Continue running despite errors
    }
  }

  /**
   * Handle watcher errors - Context7 resilience pattern
   */
  private handleError(error: Error): void {
    console.error('Footer Auto-Refresh Daemon error:', error);

    // Attempt to recover by restarting watcher
    if (this.watcher) {
      this.log('Attempting to recover watcher...');
      this.watcher.close().then(() => {
        setTimeout(() => this.start(), 2000);
      }).catch(console.error);
    }
  }

  /**
   * Handle watcher ready event
   */
  private handleReady(): void {
    const watchedPaths = this.watcher?.getWatched();
    const pathCount = Object.keys(watchedPaths || {}).length;
    this.log(`Watching ${pathCount} paths for token data changes`);
  }

  /**
   * Validate required paths exist
   */
  private async validatePaths(): Promise<void> {
    // Check if footer script exists and is executable
    try {
      await fs.access(this.config.footerScript, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`Footer script not found or not readable: ${this.config.footerScript}`);
    }

    // Ensure watch directories exist
    for (const watchPath of this.config.watchFiles) {
      const dir = path.dirname(watchPath);
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist, ignore
      }
    }
  }

  /**
   * Stop the daemon gracefully
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      this.log('Stopping Footer Auto-Refresh Daemon...');
      await this.watcher.close();
      this.watcher = undefined;
      this.log(`Daemon stopped. Total refreshes: ${this.refreshCount}`);
    }
  }

  /**
   * Get daemon statistics
   */
  getStats(): { refreshCount: number; lastRefresh: Date | null; isRunning: boolean } {
    return {
      refreshCount: this.refreshCount,
      lastRefresh: this.lastRefresh,
      isRunning: !!this.watcher
    };
  }

  /**
   * Logging utility
   */
  private log(message: string): void {
    if (this.config.logEnabled) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [FooterDaemon] ${message}`);
    }
  }
}

// CLI execution
if (require.main === module) {
  const daemon = new FooterAutoRefreshDaemon({
    logEnabled: !process.argv.includes('--quiet')
  });

  daemon.start().catch(error => {
    console.error('Daemon startup failed:', error);
    process.exit(1);
  });
}