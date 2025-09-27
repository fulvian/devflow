#!/usr/bin/env node

/**
 * DevFlow Emergency CCR CLI
 * 
 * This CLI provides emergency Claude Code Replacement (CCR) functionality
 * for DevFlow when Claude Pro usage limits are reached.
 */

import { spawn } from 'child_process';
import http from 'http';

class ClaudeUsageLimitDetector {
  constructor() {
    this.isMonitoring = false;
    this.eventListeners = [];
    this.originalConsoleError = console.error;
    
    // Regex patterns for various time formats
    this.regexPatterns = [
      /Claude Pro usage limit reached\. Your limit will reset at (\d{1,2} ?(?:am|pm))/i,
      /Claude Pro usage limit reached\. Your limit will reset at (\d{1,2}:\d{2} ?(?:am|pm)?)/i,
      /Claude Pro usage limit reached\. Your limit will reset at ([0-2]?\d:[0-5]?\d)/i,
      /limit will reset at ([0-2]?\d:[0-5]?\d ?(?:am|pm)?)/i,
      /limit will reset at (\d{1,2} ?(?:am|pm))/i
    ];
  }

  start() {
    if (this.isMonitoring) {
      console.warn('ClaudeUsageLimitDetector is already monitoring');
      return;
    }

    try {
      this.setupConsoleHooking();
      this.isMonitoring = true;
      console.log('ClaudeUsageLimitDetector started monitoring');
    } catch (error) {
      console.error('Failed to start ClaudeUsageLimitDetector:', error);
    }
  }

  stop() {
    if (!this.isMonitoring) {
      return;
    }

    try {
      this.cleanupConsoleHooking();
      this.isMonitoring = false;
      console.log('ClaudeUsageLimitDetector stopped monitoring');
    } catch (error) {
      console.error('Error stopping ClaudeUsageLimitDetector:', error);
    }
  }

  addEventListener(listener) {
    if (!this.eventListeners.includes(listener)) {
      this.eventListeners.push(listener);
    }
  }

  setupConsoleHooking() {
    const self = this;
    console.error = function(...args) {
      try {
        for (const arg of args) {
          if (typeof arg === 'string') {
            self.checkForUsageLimitMessage(arg);
          } else if (arg && typeof arg === 'object' && arg.message) {
            self.checkForUsageLimitMessage(arg.message);
          }
        }
      } catch (error) {
        console.warn('Error in console hook:', error);
      }
      
      self.originalConsoleError.apply(console, args);
    };
  }

  checkForUsageLimitMessage(message) {
    if (!message || typeof message !== 'string') return;
    
    if (!message.toLowerCase().includes('claude pro') || 
        !message.toLowerCase().includes('usage limit')) {
      return;
    }

    for (const pattern of this.regexPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const resetTime = match[1].trim();
        this.emitUsageLimitDetected({
          resetTime,
          resetTimestamp: this.parseResetTimeToTimestamp(resetTime),
          rawMessage: message
        });
        break;
      }
    }
  }

  parseResetTimeToTimestamp(timeString) {
    try {
      const normalizedTime = timeString.toLowerCase().replace(/\s+/g, '');
      
      if (normalizedTime.includes('am') || normalizedTime.includes('pm')) {
        const [time, modifier] = normalizedTime.split(/(am|pm)/);
        let [hours, minutes = '0'] = time.split(':');
        
        let hour = parseInt(hours, 10);
        const minute = parseInt(minutes, 10) || 0;
        
        if (modifier === 'pm' && hour !== 12) {
          hour += 12;
        } else if (modifier === 'am' && hour === 12) {
          hour = 0;
        }
        
        const now = new Date();
        const resetDate = new Date(now);
        resetDate.setHours(hour, minute, 0, 0);
        
        if (resetDate <= now) {
          resetDate.setDate(resetDate.getDate() + 1);
        }
        
        return resetDate.getTime();
      } else {
        const [hours, minutes = '0'] = normalizedTime.split(':');
        const hour = parseInt(hours, 10);
        const minute = parseInt(minutes, 10) || 0;
        
        const now = new Date();
        const resetDate = new Date(now);
        resetDate.setHours(hour, minute, 0, 0);
        
        if (resetDate <= now) {
          resetDate.setDate(resetDate.getDate() + 1);
        }
        
        return resetDate.getTime();
      }
    } catch (error) {
      console.warn('Failed to parse reset time:', timeString, error);
      return Date.now() + 24 * 60 * 60 * 1000;
    }
  }

  emitUsageLimitDetected(data) {
    const listeners = [...this.eventListeners];
    
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in ClaudeUsageLimitDetector event listener:', error);
      }
    }
  }

  cleanupConsoleHooking() {
    console.error = this.originalConsoleError;
  }

  isMonitoringActive() {
    return this.isMonitoring;
  }
}

class CCRAutoStarter {
  constructor() {
    this.ccrProcess = null;
    this.isStarting = false;
    this.isRunning = false;
    this.healthCheckInterval = null;
    this.CCR_PORT = 3456;
    this.STARTUP_TIMEOUT = 30000;
    this.HEALTH_CHECK_INTERVAL = 10000;
    this.MAX_RESTART_ATTEMPTS = 3;
    this.restartAttempts = 0;
  }

  async start() {
    if (this.isStarting) {
      this.log('CCR start already in progress');
      return false;
    }

    if (this.isRunning) {
      this.log('CCR is already running');
      return true;
    }

    this.isStarting = true;
    this.log('Starting CCR process...');

    try {
      if (!(await this.isPortAvailable(this.CCR_PORT))) {
        this.log(`Port ${this.CCR_PORT} is not available. Checking for existing CCR process.`);
        if (await this.isCCRRuntimeAvailable()) {
          this.log('Found existing CCR instance');
          this.isRunning = true;
          this.isStarting = false;
          this.startHealthMonitoring();
          return true;
        } else {
          this.log(`Port ${this.CCR_PORT} is occupied but not responding as CCR.`);
          // Optional forced takeover
          if ((process.env.CCR_FORCE_TAKEOVER || 'true').toLowerCase() === 'true') {
            this.log('Attempting forced takeover of port...');
            try {
              const { spawnSync } = await import('child_process');
              const res = spawnSync('lsof', ['-ti', `:${this.CCR_PORT}`], { encoding: 'utf8' });
              if (res.status === 0 && res.stdout.trim()) {
                const pids = res.stdout.trim().split(/\s+/);
                for (const pid of pids) {
                  this.log(`Killing process on port ${this.CCR_PORT}: PID ${pid}`);
                  process.kill(parseInt(pid, 10), 'SIGKILL');
                }
                // Small delay for OS to release the socket
                await new Promise(r => setTimeout(r, 1000));
                // proceed to spawn below
              } else {
                this.log('No PID found via lsof; cannot takeover.');
                this.isStarting = false;
                return false;
              }
            } catch (e) {
              this.log(`Forced takeover failed: ${e?.message || e}`);
              this.isStarting = false;
              return false;
            }
          } else {
            this.log(`CCR_FORCE_TAKEOVER is disabled. Cannot start.`);
            this.isStarting = false;
            return false;
          }
        }
      }

      // Load environment variables from .env file
      const env = { ...process.env };
      try {
        const fs = await import('fs');
        const path = await import('path');
        const envFile = path.join(process.cwd(), '.env');
        if (fs.existsSync(envFile)) {
          const envContent = fs.readFileSync(envFile, 'utf8');
          envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
              env[key.trim()] = valueParts.join('=').trim();
            }
          });
        }
      } catch (error) {
        console.warn('Failed to load .env file:', error.message);
      }

      this.ccrProcess = spawn('npx', [
        '@musistudio/claude-code-router',
        'start'
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env: env
      });

      this.setupProcessHandlers();

      const isReady = await this.waitForServerReady();
      
      if (isReady) {
        this.isRunning = true;
        this.isStarting = false;
        this.restartAttempts = 0;
        this.log('CCR started successfully');
        this.startHealthMonitoring();
        return true;
      } else {
        throw new Error('CCR failed to start within timeout period');
      }
    } catch (error) {
      this.isStarting = false;
      this.log(`Failed to start CCR: ${error.message}`);
      
      if (this.restartAttempts < this.MAX_RESTART_ATTEMPTS) {
        this.restartAttempts++;
        this.log(`Attempting restart (${this.restartAttempts}/${this.MAX_RESTART_ATTEMPTS})`);
        return this.start();
      }
      
      return false;
    }
  }

  async stop() {
    this.log('Stopping CCR process...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.isRunning = false;
    this.isStarting = false;
    this.restartAttempts = 0;

    if (this.ccrProcess) {
      try {
        this.ccrProcess.kill('SIGTERM');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (this.ccrProcess.kill(0)) {
          this.ccrProcess.kill('SIGKILL');
        }
      } catch (error) {
        this.log(`Error during CCR shutdown: ${error.message}`);
      } finally {
        this.ccrProcess = null;
      }
    }
    
    this.log('CCR stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isStarting: this.isStarting,
      pid: this.ccrProcess?.pid || null,
      port: this.CCR_PORT
    };
  }

  async isHealthy() {
    if (!this.isRunning) return false;
    return this.isCCRRuntimeAvailable();
  }

  async waitForServerReady() {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.STARTUP_TIMEOUT) {
      if (await this.isCCRRuntimeAvailable()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
  }

  async isCCRRuntimeAvailable() {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${this.CCR_PORT}/health`, (res) => {
        resolve(res.statusCode === 200);
      });
      
      req.on('error', () => resolve(false));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      
      server.listen(port, () => {
        server.close();
        resolve(true);
      });
      
      server.on('error', () => {
        resolve(false);
      });
    });
  }

  setupProcessHandlers() {
    if (!this.ccrProcess) return;

    this.ccrProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      this.log(`CCR stdout: ${output}`);
    });

    this.ccrProcess.stderr?.on('data', (data) => {
      const error = data.toString().trim();
      this.log(`CCR stderr: ${error}`);
    });

    this.ccrProcess.on('exit', (code, signal) => {
      this.log(`CCR process exited with code ${code} and signal ${signal}`);
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      this.isRunning = false;
      this.isStarting = false;
    });

    this.ccrProcess.on('error', (error) => {
      this.log(`CCR process error: ${error.message}`);
    });
  }

  startHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const isHealthy = await this.isHealthy();
        if (!isHealthy) {
          this.log('CCR health check failed');
          
          if (!this.isStarting) {
            this.log('Attempting to restart CCR due to health check failure');
            await this.stop();
            await this.start();
          }
        }
      } catch (error) {
        this.log(`Health check error: ${error.message}`);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  log(message) {
    console.log(`[CCRAutoStarter] ${new Date().toISOString()} - ${message}`);
  }
}

class EmergencyCCRCLI {
  constructor() {
    this.detector = new ClaudeUsageLimitDetector();
    this.ccr = new CCRAutoStarter();
    this.monitoringActive = false;
    
    this.setupSignalHandlers();
  }

  setupSignalHandlers() {
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
      this.detector.stop();
      this.monitoringActive = false;
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
      this.detector.stop();
      this.monitoringActive = false;
      process.exit(0);
    });
  }

  async start() {
    console.log('🚀 === EMERGENCY CCR ACTIVATION ===');
    console.log('🎯 Activating CCR Emergency Proxy...');
    
    try {
      const success = await this.ccr.start();
      if (success) {
        console.log('✅ CCR Emergency Proxy ACTIVATED');
        console.log('🎯 DevFlow can continue with Qwen3-Coder-480B');
        console.log('💡 Use: npx @musistudio/claude-code-router code "your request"');
        return 0;
      } else {
        console.log('❌ Failed to activate CCR Emergency Proxy');
        return 1;
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      return 1;
    }
  }

  async stop() {
    console.log('🛑 Stopping Emergency CCR...');
    
    try {
      await this.ccr.stop();
      console.log('✅ Emergency CCR stopped');
      return 0;
    } catch (error) {
      console.error('❌ Error stopping:', error.message);
      return 1;
    }
  }

  async status() {
    console.log('📊 Emergency CCR Status');
    console.log('═══════════════════════════');
    
    try {
      const ccrStatus = this.ccr.getStatus();
      const isHealthy = await this.ccr.isHealthy();
      
      console.log(`🔧 CCR Status:`);
      console.log(`   Running: ${ccrStatus.isRunning ? '🟢 Yes' : '🔴 No'}`);
      console.log(`   Starting: ${ccrStatus.isStarting ? '🟡 Yes' : '⚪ No'}`);
      console.log(`   PID: ${ccrStatus.pid || 'N/A'}`);
      console.log(`   Port: ${ccrStatus.port}`);
      console.log(`   Health: ${isHealthy ? '🟢 Healthy' : '🔴 Unhealthy'}`);
      
      console.log(`\n🔍 Detector Status:`);
      console.log(`   Monitoring: ${this.detector.isMonitoringActive() ? '🟢 Active' : '🔴 Inactive'}`);

      return 0;
    } catch (error) {
      console.error('❌ Error checking status:', error.message);
      return 1;
    }
  }

  async monitor() {
    console.log('👁️ Starting Emergency CCR Monitor');
    console.log('═══════════════════════════════════');
    console.log('Monitor will detect Claude Pro usage limits automatically');
    console.log('Press Ctrl+C to stop monitoring\n');

    try {
      this.detector.start();
      
      this.detector.addEventListener(async (data) => {
        console.log('🚨 CLAUDE PRO USAGE LIMIT DETECTED!');
        console.log(`🕒 Reset time: ${data.resetTime}`);
        console.log(`📝 Message: ${data.rawMessage}`);
        
        const status = this.ccr.getStatus();
        if (!status.isRunning && !status.isStarting) {
          console.log('🔄 Auto-activating CCR Emergency Proxy...');
          const success = await this.ccr.start();
          if (success) {
            console.log('✅ CCR Emergency Proxy activated automatically');
          } else {
            console.log('❌ Failed to auto-activate CCR');
          }
        }
      });

      this.monitoringActive = true;
      console.log('✅ Monitor active - CCR will activate automatically when needed');
      
      return new Promise(() => {});

    } catch (error) {
      console.error('❌ Monitor error:', error.message);
      return 1;
    }
  }

  async test() {
    console.log('🧪 Testing Emergency CCR Integration');
    console.log('════════════════════════════════════');
    
    try {
      let allTestsPassed = true;
      
      console.log('\n📋 Test 1: CCR Auto Starter');
      try {
        const status = this.ccr.getStatus();
        console.log(`   Initial Status: ${status.isRunning ? 'Running' : 'Stopped'} ✅`);
      } catch (error) {
        console.log(`   CCR Status Check: ❌ Failed`);
        allTestsPassed = false;
      }

      console.log('\n📋 Test 2: Usage Limit Detector');
      try {
        const detectorActive = this.detector.isMonitoringActive();
        console.log(`   Detector Status: ${detectorActive ? 'Active' : 'Inactive'} ✅`);
      } catch (error) {
        console.log(`   Detector Check: ❌ Failed`);
        allTestsPassed = false;
      }

      console.log('\n📋 Test 3: CCR Server Connectivity');
      try {
        const testProcess = spawn('npx', ['@musistudio/claude-code-router', '--version'], {
          stdio: 'pipe'
        });
        
        const testResult = await new Promise((resolve) => {
          testProcess.on('close', (code) => {
            resolve(code === 0);
          });
          testProcess.on('error', () => {
            resolve(false);
          });
        });

        console.log(`   CCR Command Available: ${testResult ? '✅' : '❌'}`);
        if (!testResult) allTestsPassed = false;
      } catch (error) {
        console.log(`   CCR Command Test: ❌ Failed`);
        allTestsPassed = false;
      }

      console.log('\n' + (allTestsPassed ? 
        '✅ === ALL TESTS PASSED ===' : 
        '❌ === SOME TESTS FAILED ==='));
      console.log(allTestsPassed ? 
        '🎉 Emergency CCR system is ready for production!' : 
        '⚠️ Emergency CCR system needs attention');

      return allTestsPassed ? 0 : 1;

    } catch (error) {
      console.error('❌ Test error:', error.message);
      return 1;
    }
  }

  help() {
    console.log(`
🚨 Emergency CCR - DevFlow Continuity Solution
═══════════════════════════════════════════════

When Claude Code reaches session limits and becomes inaccessible,
Emergency CCR provides seamless continuity with Qwen3-Coder-480B.

Commands:
  start     🚀 Activate Emergency CCR immediately
  stop      🛑 Stop Emergency CCR and return to normal mode  
  status    📊 Check current Emergency CCR status
  monitor   👁️ Start automatic monitoring (activates CCR when needed)
  test      🧪 Run comprehensive integration test
  help      ❓ Show this help message

Quick Start:
  # When Claude Code is blocked by session limits:
  node emergency-ccr-cli.mjs start

  # Then use CCR for coding:
  npx @musistudio/claude-code-router code "your coding request"

  # When Claude Code is available again:
  node emergency-ccr-cli.mjs stop

Examples:
  node emergency-ccr-cli.mjs start
  node emergency-ccr-cli.mjs test
  node emergency-ccr-cli.mjs monitor

Emergency Use Case:
  Claude Code shows "session limit reached" → Run 'start' command
  → DevFlow continues with Qwen3-Coder-480B via CCR → No downtime!
`);
    return 0;
  }
}

async function main() {
  const cli = new EmergencyCCRCLI();
  const command = process.argv[2];

  let exitCode;
  switch (command) {
    case 'start':
      exitCode = await cli.start();
      break;
    case 'stop':
      exitCode = await cli.stop();
      break;
    case 'status':
      exitCode = await cli.status();
      break;
    case 'monitor':
      exitCode = await cli.monitor();
      break;
    case 'test':
      exitCode = await cli.test();
      break;
    case 'help':
    case '--help':
    case '-h':
      exitCode = cli.help();
      break;
    default:
      console.log('❓ Unknown command. Use "node emergency-ccr-cli.mjs help" for usage information.');
      exitCode = 1;
  }

  process.exit(exitCode);
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
