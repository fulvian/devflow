#!/usr/bin/env node

/**
 * Context7 CLI - Command Line Interface for Mode Transitions
 *
 * Provides production-ready CLI for managing Context7 mode transitions
 * with comprehensive safety checks and detailed reporting
 */

const { Context7ModeTransitionController } = require('./mode-transition-controller');
const { ProductionReadinessValidator } = require('./production-readiness-validator');

class Context7CLI {
  constructor() {
    this.controller = new Context7ModeTransitionController();
    this.validator = new ProductionReadinessValidator();
  }

  /**
   * Main CLI entry point
   */
  async run() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
      switch (command) {
        case 'status':
          await this.showStatus();
          break;

        case 'validate':
          await this.runValidation();
          break;

        case 'transition':
          const targetMode = args[1];
          const reason = args[2] || 'manual';
          await this.executeTransition(targetMode, reason);
          break;

        case 'report':
          await this.generateReport();
          break;

        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;

        default:
          console.error(`❌ Unknown command: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Command failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Show current Context7 status
   */
  async showStatus() {
    console.log('📊 Context7 System Status\n');

    try {
      // Get controller status
      const controllerStatus = this.controller.getCurrentStatus();

      console.log(`🎯 Current Mode: ${controllerStatus.currentMode.toUpperCase()}`);
      console.log(`⚡ Transition State: ${controllerStatus.transitionState}`);
      console.log(`🔄 Transition Attempts: ${controllerStatus.transitionAttempts}`);

      if (controllerStatus.lastTransitionAttempt) {
        console.log(`📅 Last Attempt: ${new Date(controllerStatus.lastTransitionAttempt).toLocaleString()}`);
      }

      console.log('\n📈 Quality Thresholds:');
      console.log(`   Shadow → Hybrid: ${(controllerStatus.config.shadowToHybrid * 100)}%`);
      console.log(`   Hybrid → Full: ${(controllerStatus.config.hybridToFull * 100)}%`);
      console.log(`   Rollback Trigger: ${(controllerStatus.config.rollbackThreshold * 100)}% drop`);

      // Get current metrics
      const metrics = await this.controller.getCurrentMetrics();

      console.log('\n📊 Current Metrics:');
      console.log(`   Context7 Quality: ${(metrics.context7Quality * 100).toFixed(1)}%`);
      console.log(`   Coherence: ${(metrics.coherenceScore * 100).toFixed(1)}%`);
      console.log(`   Precision: ${(metrics.precisionScore * 100).toFixed(1)}%`);
      console.log(`   Orchestrator Success: ${(metrics.orchestratorSuccessRate * 100).toFixed(1)}%`);
      console.log(`   Total Tasks: ${metrics.totalTasks}`);
      console.log(`   Completed: ${metrics.completedTasks}`);
      console.log(`   Failed: ${metrics.failedTasks}`);

      // Show readiness for next mode
      const nextMode = this.getNextMode(controllerStatus.currentMode);
      if (nextMode) {
        const readiness = this.controller.evaluateTransitionReadiness(metrics, nextMode);

        console.log(`\n🎯 Readiness for ${nextMode.toUpperCase()} Mode:`);
        console.log(`   Status: ${readiness.ready ? '✅ READY' : '❌ NOT READY'}`);

        if (!readiness.ready) {
          console.log('   Blockers:');
          readiness.blockers.forEach(blocker => {
            console.log(`     • ${blocker}`);
          });
        }
      }

    } catch (error) {
      console.error(`❌ Failed to get status: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Run production readiness validation
   */
  async runValidation() {
    console.log('🔍 Running Context7 Production Readiness Validation...\n');

    try {
      const results = await this.validator.validateProductionReadiness();

      // Show summary
      console.log('📋 Validation Summary:');
      console.log(`   Overall Status: ${this.getStatusIcon(results.overallStatus)} ${results.overallStatus.toUpperCase()}`);
      console.log(`   Readiness Score: ${results.readinessScore}/100`);
      console.log(`   Validation Duration: ${results.validationDuration}ms`);

      // Show stage results
      console.log('\n📊 Stage Results:');
      Object.entries(results.validationStages).forEach(([key, stage]) => {
        const statusIcon = this.getStatusIcon(stage.status);
        console.log(`   ${statusIcon} ${stage.name}: ${stage.score}/100`);
      });

      // Show critical issues
      if (results.criticalIssues.length > 0) {
        console.log(`\n🚨 Critical Issues (${results.criticalIssues.length}):`);
        results.criticalIssues.forEach(issue => {
          console.log(`   • ${issue}`);
        });
      }

      // Show warnings
      if (results.warnings.length > 0) {
        console.log(`\n⚠️ Warnings (${results.warnings.length}):`);
        results.warnings.forEach(warning => {
          console.log(`   • ${warning}`);
        });
      }

      // Show recommendations
      if (results.recommendations.length > 0) {
        console.log(`\n💡 Recommendations:`);
        results.recommendations.forEach((rec, i) => {
          console.log(`   ${i + 1}. ${rec}`);
        });
      }

      // Exit with appropriate code
      if (results.overallStatus === 'ready') {
        console.log('\n✅ System is ready for Context7 Full Mode transition!');
        process.exit(0);
      } else {
        console.log('\n❌ System is not ready for Context7 Full Mode transition.');
        process.exit(1);
      }

    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Execute mode transition
   */
  async executeTransition(targetMode, reason) {
    if (!targetMode) {
      console.error('❌ Target mode required. Available modes: shadow, hybrid, full');
      process.exit(1);
    }

    const validModes = ['shadow', 'hybrid', 'full'];
    if (!validModes.includes(targetMode.toLowerCase())) {
      console.error(`❌ Invalid mode: ${targetMode}. Available modes: ${validModes.join(', ')}`);
      process.exit(1);
    }

    const normalizedMode = targetMode.toLowerCase();

    console.log(`🚀 Initiating Context7 mode transition to: ${normalizedMode.toUpperCase()}`);
    console.log(`📝 Reason: ${reason}\n`);

    try {
      // Get current status
      const currentStatus = this.controller.getCurrentStatus();

      if (currentStatus.currentMode === normalizedMode) {
        console.log(`✅ Already in ${normalizedMode.toUpperCase()} mode`);
        return;
      }

      // Run pre-transition validation
      console.log('🔍 Running pre-transition validation...');
      const validationResults = await this.validator.validateProductionReadiness();

      if (validationResults.criticalIssues.length > 0) {
        console.log('❌ Pre-transition validation failed:');
        validationResults.criticalIssues.forEach(issue => {
          console.log(`   • ${issue}`);
        });

        console.log('\n💡 Resolve critical issues before attempting transition');
        process.exit(1);
      }

      console.log('✅ Pre-transition validation passed');

      // Confirm transition
      if (process.env.NODE_ENV === 'production') {
        const confirmed = await this.confirmTransition(currentStatus.currentMode, normalizedMode);
        if (!confirmed) {
          console.log('❌ Transition cancelled by user');
          return;
        }
      }

      // Execute transition
      console.log(`🔄 Executing transition from ${currentStatus.currentMode.toUpperCase()} to ${normalizedMode.toUpperCase()}...`);

      const result = await this.controller.executeTransition(normalizedMode, reason);

      console.log('✅ Transition completed successfully!');
      console.log(`   From: ${result.fromMode.toUpperCase()}`);
      console.log(`   To: ${result.toMode.toUpperCase()}`);
      console.log(`   Transition ID: ${result.transitionId}`);

      // Show post-transition status
      console.log('\n📊 Post-transition metrics:');
      console.log(`   Context7 Quality: ${(result.metrics.context7Quality * 100).toFixed(1)}%`);
      console.log(`   Orchestrator Success: ${(result.metrics.orchestratorSuccessRate * 100).toFixed(1)}%`);

    } catch (error) {
      console.error(`❌ Transition failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Generate detailed report
   */
  async generateReport() {
    console.log('📋 Generating Context7 Production Readiness Report...\n');

    try {
      // Run validation if not done recently
      const results = await this.validator.validateProductionReadiness();
      const report = this.validator.generateDetailedReport();

      console.log(report);

      // Save report to file
      const fs = require('fs');
      const path = require('path');

      const reportsDir = './reports';
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `context7-readiness-report-${timestamp}.md`;
      const filepath = path.join(reportsDir, filename);

      fs.writeFileSync(filepath, report);
      console.log(`\n📄 Report saved to: ${filepath}`);

    } catch (error) {
      console.error(`❌ Report generation failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
Context7 CLI - Mode Transition Management

Usage: node context7-cli.js <command> [options]

Commands:
  status                    Show current Context7 system status
  validate                  Run production readiness validation
  transition <mode> [reason] Execute mode transition (shadow|hybrid|full)
  report                    Generate detailed readiness report
  help                      Show this help message

Examples:
  node context7-cli.js status
  node context7-cli.js validate
  node context7-cli.js transition hybrid "quality_threshold_reached"
  node context7-cli.js report

Mode Transition Flow:
  Shadow Mode (0-25% quality)   → Observing, no control
  Hybrid Mode (25-75% quality)  → Selective integration
  Full Mode (75%+ quality)      → Complete Context7 control

Safety Features:
  • Comprehensive pre-transition validation
  • Automatic rollback on failure
  • Production confirmation prompts
  • Detailed audit logging
  • Progressive quality monitoring

For more information, see: /Users/fulvioventura/devflow/src/core/context7/
`);
  }

  /**
   * Helper methods
   */
  getStatusIcon(status) {
    const icons = {
      'pass': '✅',
      'ready': '✅',
      'warning': '⚠️',
      'needs_improvement': '⚠️',
      'fail': '❌',
      'not_ready': '❌',
      'error': '🚨'
    };
    return icons[status] || '❓';
  }

  getNextMode(currentMode) {
    const progression = {
      'shadow': 'hybrid',
      'hybrid': 'full',
      'full': null
    };
    return progression[currentMode];
  }

  async confirmTransition(fromMode, toMode) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      rl.question(
        `⚠️ Confirm Context7 mode transition from ${fromMode.toUpperCase()} to ${toMode.toUpperCase()}? (y/N): `,
        answer => {
          rl.close();
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        }
      );
    });
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new Context7CLI();
  cli.run().catch(error => {
    console.error(`❌ CLI Error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { Context7CLI };