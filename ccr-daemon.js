#!/usr/bin/env node

/**
 * CCR Daemon Wrapper
 * 
 * A daemon wrapper for the CCR (Central Control Room) system that manages
 * background execution, PID file handling, health monitoring, and graceful shutdown.
 * 
 * Features:
 * - Background daemon process management
 * - PID file creation and cleanup
 * - Health monitoring with periodic checks
 * - Graceful shutdown on termination signals
 * - Signal handling for process management
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

class CCRDaemon {
  /**
   * Create a new CCR daemon instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.pidFile = options.pidFile || '/var/run/ccr-daemon.pid';
    this.logFile = options.logFile || '/var/log/ccr-daemon.log';
    this.errorLogFile = options.errorLogFile || '/var/log/ccr-daemon-error.log';
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.process = null;
    this.healthCheckTimer = null;
    this.isShuttingDown = false;
    
    // Ensure log directory exists
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Write message to log file
   * @param {string} message - Message to log
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(this.logFile, logMessage);
    console.log(logMessage.trim());
  }

  /**
   * Write error message to error log file
   * @param {string} message - Error message to log
   */
  logError(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}\n`;
    fs.appendFileSync(this.errorLogFile, logMessage);
    console.error(logMessage.trim());
  }

  /**
   * Write PID to file
   */
  writePidFile() {
    try {
      fs.writeFileSync(this.pidFile, process.pid.toString());
      this.log(`PID file written: ${this.pidFile}`);
    } catch (error) {
      this.logError(`Failed to write PID file: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Remove PID file
   */
  removePidFile() {
    try {
      if (fs.existsSync(this.pidFile)) {
        fs.unlinkSync(this.pidFile);
        this.log(`PID file removed: ${this.pidFile}`);
      }
    } catch (error) {
      this.logError(`Failed to remove PID file: ${error.message}`);
    }
  }

  /**
   * Start the CCR process
   */
  startCCRProcess() {
    return new Promise((resolve, reject) => {
      // Replace this with the actual CCR process command
      const ccrCommand = process.env.CCR_COMMAND || 'node';
      const ccrArgs = process.env.CCR_ARGS ? process.env.CCR_ARGS.split(' ') : ['app.js'];
      
      this.log(`Starting CCR process: ${ccrCommand} ${ccrArgs.join(' ')}`);
      
      this.process = spawn(ccrCommand, ccrArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      });

      // Handle process events
      this.process.on('error', (error) => {
        this.logError(`CCR process error: ${error.message}`);
        reject(error);
      });

      this.process.on('exit', (code, signal) => {
        if (!this.isShuttingDown) {
          this.logError(`CCR process exited unexpectedly with code ${code} and signal ${signal}`);
          // Attempt to restart
          setTimeout(() => {
            if (!this.isShuttingDown) {
              this.startCCRProcess().catch(err => {
                this.logError(`Failed to restart CCR process: ${err.message}`);
              });
            }
          }, 5000);
        } else {
          this.log(`CCR process exited gracefully with code ${code}`);
        }
      });

      // Log process output
      this.process.stdout.on('data', (data) => {
        fs.appendFileSync(this.logFile, data.toString());
      });

      this.process.stderr.on('data', (data) => {
        fs.appendFileSync(this.errorLogFile, data.toString());
      });

      // Give process time to start
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.log(`CCR process started with PID ${this.process.pid}`);
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Check if the CCR process is healthy
   */
  async healthCheck() {
    if (!this.process || this.process.killed) {
      this.logError('CCR process is not running');
      return false;
    }

    try {
      // Check if process is still running
      process.kill(this.process.pid, 0);
      
      // Additional health checks could be implemented here
      // For example, checking a health endpoint or database connection
      
      return true;
    } catch (error) {
      this.logError(`Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(async () => {
      const isHealthy = await this.healthCheck();
      if (!isHealthy && !this.isShuttingDown) {
        this.logError('CCR process is unhealthy, attempting restart');
        this.restart();
      }
    }, this.checkInterval);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Start the daemon
   */
  async start() {
    try {
      this.log('Starting CCR daemon');
      
      // Write PID file
      this.writePidFile();
      
      // Start CCR process
      await this.startCCRProcess();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Setup signal handlers
      this.setupSignalHandlers();
      
      this.log('CCR daemon started successfully');
    } catch (error) {
      this.logError(`Failed to start daemon: ${error.message}`);
      this.removePidFile();
      process.exit(1);
    }
  }

  /**
   * Stop the daemon gracefully
   */
  async stop() {
    this.log('Stopping CCR daemon');
    this.isShuttingDown = true;
    
    // Stop health monitoring
    this.stopHealthMonitoring();
    
    // Stop CCR process
    if (this.process && !this.process.killed) {
      this.log('Stopping CCR process');
      try {
        // Try graceful shutdown first
        this.process.kill('SIGTERM');
        
        // Wait for process to exit
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 10000); // 10 seconds timeout
          
          this.process.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        this.logError(`Error stopping CCR process: ${error.message}`);
      }
    }
    
    // Remove PID file
    this.removePidFile();
    
    this.log('CCR daemon stopped');
    process.exit(0);
  }

  /**
   * Restart the CCR process
   */
  async restart() {
    this.log('Restarting CCR process');
    
    // Stop health monitoring temporarily
    this.stopHealthMonitoring();
    
    // Stop current process
    if (this.process && !this.process.killed) {
      try {
        this.process.kill('SIGTERM');
        
        // Wait for process to exit
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (this.process && !this.process.killed) {
              this.process.kill('SIGKILL');
            }
            resolve();
          }, 5000);
          
          this.process.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        this.logError(`Error stopping CCR process during restart: ${error.message}`);
      }
    }
    
    // Start new process
    try {
      await this.startCCRProcess();
      this.startHealthMonitoring();
      this.log('CCR process restarted successfully');
    } catch (error) {
      this.logError(`Failed to restart CCR process: ${error.message}`);
    }
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    // Handle termination signals
    process.on('SIGTERM', () => {
      this.log('Received SIGTERM signal');
      this.stop();
    });

    process.on('SIGINT', () => {
      this.log('Received SIGINT signal');
      this.stop();
    });

    process.on('SIGHUP', () => {
      this.log('Received SIGHUP signal');
      this.restart();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logError(`Uncaught exception: ${error.message}`);
      this.logError(error.stack);
      this.stop();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logError(`Unhandled promise rejection: ${reason}`);
      this.stop();
    });
  }

  /**
   * Check if daemon is already running
   */
  isRunning() {
    if (!fs.existsSync(this.pidFile)) {
      return false;
    }

    try {
      const pid = parseInt(fs.readFileSync(this.pidFile, 'utf8'));
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // PID file exists but process is not running
      fs.unlinkSync(this.pidFile);
      return false;
    }
  }

  /**
   * Get daemon status
   */
  getStatus() {
    if (!this.isRunning()) {
      return 'Daemon is not running';
    }

    const pid = fs.readFileSync(this.pidFile, 'utf8');
    return `Daemon is running with PID ${pid}`;
  }
}

// Main execution
async function main() {
  const daemon = new CCRDaemon({
    pidFile: process.env.CCR_PID_FILE || '/var/run/ccr-daemon.pid',
    logFile: process.env.CCR_LOG_FILE || '/var/log/ccr-daemon.log',
    errorLogFile: process.env.CCR_ERROR_LOG_FILE || '/var/log/ccr-daemon-error.log',
    checkInterval: parseInt(process.env.CCR_CHECK_INTERVAL) || 30000
  });

  const command = process.argv[2];

  switch (command) {
    case 'start':
      if (daemon.isRunning()) {
        console.log('Daemon is already running');
        process.exit(1);
      }
      await daemon.start();
      break;

    case 'stop':
      if (!daemon.isRunning()) {
        console.log('Daemon is not running');
        process.exit(1);
      }
      await daemon.stop();
      break;

    case 'restart':
      if (daemon.isRunning()) {
        await daemon.stop();
      }
      await daemon.start();
      break;

    case 'status':
      console.log(daemon.getStatus());
      break;

    default:
      console.log('Usage: ccr-daemon.js [start|stop|restart|status]');
      process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = CCRDaemon;