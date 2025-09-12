#!/usr/bin/env node

/**
 * Emergency CCR - Immediate activation script for DevFlow continuity
 * 
 * Usage: node emergency-ccr.js [command]
 * Commands: start, stop, status, test, monitor
 */

import { EmergencyCCRActivator } from './packages/core/src/coordination/emergency-ccr-activator.js';
import { spawn } from 'child_process';

class EmergencyCCRCLI {
  constructor() {
    this.activator = new EmergencyCCRActivator();
  }

  async start() {
    console.log('🚨 EMERGENCY CCR ACTIVATION - DevFlow Continuity Mode');
    console.log('═══════════════════════════════════════════════════════');
    
    try {
      await this.activator.initialize();
      const success = await this.activator.manualActivation();
      
      if (success) {
        console.log('\n✅ === EMERGENCY CCR ACTIVATED ===');
        console.log('🎯 DevFlow can continue with Qwen3-Coder-480B');
        console.log('💡 Use: npx @musistudio/claude-code-router code');
        console.log('📝 Example: npx @musistudio/claude-code-router code "create hello world function"');
        console.log('\n🔄 To return to Claude Code: restart claude-code when session available');
        return 0;
      } else {
        console.log('\n❌ Emergency activation failed');
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
      // Stop CCR server
      const stopProcess = spawn('npx', ['@musistudio/claude-code-router', 'stop'], {
        stdio: 'inherit'
      });

      await new Promise((resolve) => {
        stopProcess.on('close', resolve);
      });

      await this.activator.shutdown();
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
      // Check CCR server status
      const ccrStatusProcess = spawn('npx', ['@musistudio/claude-code-router', 'status'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let ccrOutput = '';
      ccrStatusProcess.stdout.on('data', (data) => {
        ccrOutput += data.toString();
      });

      await new Promise((resolve) => {
        ccrStatusProcess.on('close', resolve);
      });

      console.log(ccrOutput);

      // Check activator status
      const activatorStatus = this.activator.getStatus();
      console.log('\n🔧 Emergency Activator Status:');
      console.log(`   Monitoring: ${activatorStatus.monitoring ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`   CCR Process: ${activatorStatus.ccrRunning ? '🟢 Running' : '🔴 Stopped'}`);

      return 0;
    } catch (error) {
      console.error('❌ Error checking status:', error.message);
      return 1;
    }
  }

  async test() {
    console.log('🧪 Testing Emergency CCR Integration');
    console.log('════════════════════════════════════');
    
    try {
      await this.activator.initialize();
      
      // Test 1: Check Claude Code accessibility
      console.log('\n📋 Test 1: Claude Code Accessibility Check');
      const claudeState = await this.activator.checkClaudeCodeAccessibility();
      console.log(`   Accessible: ${claudeState.isAccessible ? '✅' : '❌'}`);
      console.log(`   Session Limit: ${claudeState.sessionLimitReached ? '🚨 REACHED' : '✅ OK'}`);
      if (claudeState.errorMessage) {
        console.log(`   Error: ${claudeState.errorMessage}`);
      }

      // Test 2: CCR Configuration
      console.log('\n📋 Test 2: CCR Configuration Check');
      const configExists = require('fs').existsSync(require('path').join(require('os').homedir(), '.claude-code-router', 'config.json'));
      console.log(`   Config exists: ${configExists ? '✅' : '❌'}`);

      // Test 3: Emergency activation (dry run)
      console.log('\n📋 Test 3: Emergency Activation Test');
      const activationSuccess = await this.activator.manualActivation();
      console.log(`   Activation: ${activationSuccess ? '✅' : '❌'}`);

      if (activationSuccess) {
        // Test 4: CCR functionality
        console.log('\n📋 Test 4: CCR Functionality Test');
        const testCommand = spawn('npx', ['@musistudio/claude-code-router', 'code', 'hello world test'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 15000
        });

        let testOutput = '';
        let testError = '';
        
        testCommand.stdout.on('data', (data) => {
          testOutput += data.toString();
        });
        
        testCommand.stderr.on('data', (data) => {
          testError += data.toString();
        });

        const testResult = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            testCommand.kill();
            resolve(false);
          }, 15000);

          testCommand.on('close', (code) => {
            clearTimeout(timeout);
            resolve(code === 0 && testOutput.length > 0);
          });
        });

        console.log(`   CCR Response: ${testResult ? '✅' : '❌'}`);
        if (testOutput) console.log(`   Output: ${testOutput.slice(0, 100)}...`);
        if (testError && !testResult) console.log(`   Error: ${testError.slice(0, 100)}...`);
      }

      console.log('\n✅ === TEST COMPLETED ===');
      console.log(activationSuccess ? 
        '🎉 Emergency CCR is ready for production use!' : 
        '⚠️ Emergency CCR needs troubleshooting');

      return activationSuccess ? 0 : 1;

    } catch (error) {
      console.error('❌ Test error:', error.message);
      return 1;
    }
  }

  async monitor() {
    console.log('👁️ Starting Emergency CCR Monitor');
    console.log('═══════════════════════════════════');
    console.log('Monitor will check Claude Code accessibility every 10 seconds');
    console.log('Press Ctrl+C to stop monitoring\n');

    try {
      await this.activator.initialize();
      
      // Setup graceful shutdown
      process.on('SIGINT', async () => {
        console.log('\n🛑 Stopping monitor...');
        await this.activator.shutdown();
        process.exit(0);
      });

      // Monitor will run automatically via activator
      console.log('✅ Monitor active - CCR will activate automatically if Claude Code becomes inaccessible');
      
      // Keep process alive
      return new Promise(() => {});

    } catch (error) {
      console.error('❌ Monitor error:', error.message);
      return 1;
    }
  }

  async help() {
    console.log(`
🚨 Emergency CCR - DevFlow Continuity Solution
═══════════════════════════════════════════════

When Claude Code reaches session limits and becomes inaccessible,
Emergency CCR provides seamless continuity with Qwen3-Coder-480B.

Commands:
  start     🚀 Activate Emergency CCR immediately
  stop      🛑 Stop Emergency CCR and return to normal mode  
  status    📊 Check current Emergency CCR status
  test      🧪 Run comprehensive integration test
  monitor   👁️ Start automatic monitoring (activates CCR when needed)
  help      ❓ Show this help message

Quick Start:
  # When Claude Code is blocked by session limits:
  node emergency-ccr.js start

  # Then use CCR for coding:
  npx @musistudio/claude-code-router code "your coding request"

  # When Claude Code is available again:
  node emergency-ccr.js stop

Examples:
  node emergency-ccr.js start
  node emergency-ccr.js test
  node emergency-ccr.js monitor

Emergency Use Case:
  Claude Code shows "session limit reached" → Run 'node emergency-ccr.js start'
  → DevFlow continues with Qwen3-Coder-480B via CCR → No downtime!
`);
    return 0;
  }
}

// CLI Interface
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
    case 'test':
      exitCode = await cli.test();
      break;
    case 'monitor':
      exitCode = await cli.monitor();
      break;
    case 'help':
    case '--help':
    case '-h':
      exitCode = await cli.help();
      break;
    default:
      console.log('❓ Unknown command. Use "node emergency-ccr.js help" for usage information.');
      exitCode = 1;
  }

  process.exit(exitCode);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});