#!/usr/bin/env node

/**
 * DevFlow Emergency CCR CLI
 * 
 * This CLI provides emergency Claude Code Replacement (CCR) functionality
 * for DevFlow when Claude Pro usage limits are reached.
 * 
 * Commands:
 * - start: Manually activate CCR
 * - stop: Deactivate CCR
 * - status: Show current CCR status
 * - monitor: Continuously monitor for usage limits and auto-activate CCR
 * - test: Run component tests
 */

import { spawn, ChildProcess } from 'child_process';
import { ClaudeUsageLimitDetector } from './packages/core/src/coordination/claude-usage-limit-detector.js';
import { CCRAutoStarter } from './packages/core/src/coordination/ccr-auto-starter.js';

// Emergency CCR CLI Class
class EmergencyCCRCLI {
  private detector: ClaudeUsageLimitDetector;
  private ccr: CCRAutoStarter;
  private monitoringActive: boolean = false;

  constructor() {
    this.detector = new ClaudeUsageLimitDetector();
    this.ccr = new CCRAutoStarter();
    
    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    process.on('SIGINT', () => {
      console.log('\\n🛑 Received SIGINT. Shutting down gracefully...');
      this.detector.stop();
      this.monitoringActive = false;
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\\n🛑 Received SIGTERM. Shutting down gracefully...');
      this.detector.stop();
      this.monitoringActive = false;
      process.exit(0);
    });
  }

  async start(): Promise<number> {
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
      console.error('❌ Error:', error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  async stop(): Promise<number> {
    console.log('🛑 Stopping Emergency CCR...');
    
    try {
      await this.ccr.stop();
      console.log('✅ Emergency CCR stopped');
      return 0;
    } catch (error) {
      console.error('❌ Error stopping:', error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  async status(): Promise<number> {
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
      
      console.log(`\\n🔍 Detector Status:`);
      console.log(`   Monitoring: ${this.detector.isMonitoringActive() ? '🟢 Active' : '🔴 Inactive'}`);

      return 0;
    } catch (error) {
      console.error('❌ Error checking status:', error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  async monitor(): Promise<number> {
    console.log('👁️ Starting Emergency CCR Monitor');
    console.log('═══════════════════════════════════');
    console.log('Monitor will detect Claude Pro usage limits automatically');
    console.log('Press Ctrl+C to stop monitoring\\n');

    try {
      // Start detector
      this.detector.start();
      
      // Add listener for usage limit detection
      this.detector.addEventListener(async (data) => {
        console.log('🚨 CLAUDE PRO USAGE LIMIT DETECTED!');
        console.log(`🕒 Reset time: ${data.resetTime}`);
        console.log(`📝 Message: ${data.rawMessage}`);
        
        // Auto-activate CCR if not already running
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
      
      // Keep process alive
      return new Promise(() => {});

    } catch (error) {
      console.error('❌ Monitor error:', error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  async test(): Promise<number> {
    console.log('🧪 Testing Emergency CCR Integration');
    console.log('════════════════════════════════════');
    
    try {
      let allTestsPassed = true;
      
      // Test 1: CCR Auto Starter
      console.log('\\n📋 Test 1: CCR Auto Starter');
      try {
        const status = this.ccr.getStatus();
        console.log(`   Initial Status: ${status.isRunning ? 'Running' : 'Stopped'} ✅`);
      } catch (error) {
        console.log(`   CCR Status Check: ❌ Failed`);
        allTestsPassed = false;
      }

      // Test 2: Usage Limit Detector  
      console.log('\\n📋 Test 2: Usage Limit Detector');
      try {
        const detectorActive = this.detector.isMonitoringActive();
        console.log(`   Detector Status: ${detectorActive ? 'Active' : 'Inactive'} ✅`);
      } catch (error) {
        console.log(`   Detector Check: ❌ Failed`);
        allTestsPassed = false;
      }

      // Test 3: CCR Server Connectivity
      console.log('\\n📋 Test 3: CCR Server Connectivity');
      try {
        // Check if CCR command is available
        const testProcess = spawn('npx', ['@musistudio/claude-code-router', '--version'], {
          stdio: 'pipe'
        });
        
        const testResult = await new Promise<boolean>((resolve) => {
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

      console.log('\\n' + (allTestsPassed ? 
        '✅ === ALL TESTS PASSED ===' : 
        '❌ === SOME TESTS FAILED ==='));
      console.log(allTestsPassed ? 
        '🎉 Emergency CCR system is ready for production!' : 
        '⚠️ Emergency CCR system needs attention');

      return allTestsPassed ? 0 : 1;

    } catch (error) {
      console.error('❌ Test error:', error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  help(): number {
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
  npx ts-node emergency-ccr-cli.ts start

  # Then use CCR for coding:
  npx @musistudio/claude-code-router code "your coding request"

  # When Claude Code is available again:
  npx ts-node emergency-ccr-cli.ts stop

Examples:
  npx ts-node emergency-ccr-cli.ts start
  npx ts-node emergency-ccr-cli.ts test
  npx ts-node emergency-ccr-cli.ts monitor

Emergency Use Case:
  Claude Code shows "session limit reached" → Run 'start' command
  → DevFlow continues with Qwen3-Coder-480B via CCR → No downtime!
`);
    return 0;
  }
}

// CLI Interface
async function main() {
  const cli = new EmergencyCCRCLI();
  const command = process.argv[2];

  let exitCode: number;
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
      console.log('❓ Unknown command. Use "npx ts-node emergency-ccr-cli.ts help" for usage information.');
      exitCode = 1;
  }

  process.exit(exitCode);
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the CLI
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { EmergencyCCRCLI };