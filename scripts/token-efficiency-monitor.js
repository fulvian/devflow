#!/usr/bin/env node

/**
 * DevFlow Token Efficiency Monitor
 * Tracks and analyzes token usage patterns to measure the effectiveness
 * of the Enhanced MCP Server vs traditional Claude Code workflows
 */

import fs from 'fs/promises';
import path from 'path';

class TokenEfficiencyMonitor {
  constructor() {
    this.logFile = path.join(process.cwd(), 'token-usage-log.json');
    this.reports = [];
  }

  async initializeLog() {
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      this.reports = JSON.parse(data);
    } catch (error) {
      // File doesn't exist yet, start with empty array
      this.reports = [];
    }
  }

  async logTokenUsage(operation) {
    const report = {
      timestamp: new Date().toISOString(),
      operation_type: operation.type,
      task_id: operation.taskId,
      ...operation
    };

    this.reports.push(report);
    await this.saveLog();
    
    console.log(`📊 Token Usage Logged: ${operation.type} - ${operation.taskId}`);
    this.displayEfficiencyStats(report);
  }

  displayEfficiencyStats(report) {
    if (report.tokens_saved && report.tokens_saved > 0) {
      console.log(`✅ Token Efficiency: ${report.tokens_saved} tokens saved (${report.efficiency_percentage || 'N/A'}% reduction)`);
      console.log(`💰 Cost Savings: ~$${(report.tokens_saved * 0.015 / 1000).toFixed(4)} USD`);
    }
  }

  async generateEfficiencyReport() {
    await this.initializeLog();
    
    const report = {
      period: {
        start: this.reports[0]?.timestamp || 'N/A',
        end: this.reports[this.reports.length - 1]?.timestamp || 'N/A',
        total_operations: this.reports.length
      },
      efficiency_metrics: this.calculateEfficiencyMetrics(),
      operation_breakdown: this.getOperationBreakdown(),
      recommendations: this.generateRecommendations()
    };

    console.log('\n📈 DEVFLOW TOKEN EFFICIENCY REPORT');
    console.log('=' + '='.repeat(50));
    
    console.log(`\n🕒 Period: ${report.period.start} to ${report.period.end}`);
    console.log(`📊 Total Operations: ${report.period.total_operations}`);
    
    console.log('\n💡 Efficiency Metrics:');
    console.log(`   Total Tokens Saved: ${report.efficiency_metrics.total_tokens_saved}`);
    console.log(`   Average Tokens/Operation: ${report.efficiency_metrics.avg_tokens_per_operation}`);
    console.log(`   Efficiency Rate: ${report.efficiency_metrics.efficiency_rate}%`);
    console.log(`   Cost Savings: $${report.efficiency_metrics.total_cost_savings}`);

    console.log('\n🔍 Operation Breakdown:');
    Object.entries(report.operation_breakdown).forEach(([type, stats]) => {
      console.log(`   ${type}: ${stats.count} operations, ${stats.avg_tokens_saved} avg tokens saved`);
    });

    console.log('\n💭 Recommendations:');
    report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });

    return report;
  }

  calculateEfficiencyMetrics() {
    if (this.reports.length === 0) return { total_tokens_saved: 0, avg_tokens_per_operation: 0, efficiency_rate: 0, total_cost_savings: '0.0000' };

    const totalTokensSaved = this.reports.reduce((sum, r) => sum + (r.tokens_saved || 0), 0);
    const totalTokensUsed = this.reports.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
    
    return {
      total_tokens_saved: totalTokensSaved,
      avg_tokens_per_operation: Math.round((totalTokensUsed + totalTokensSaved) / this.reports.length),
      efficiency_rate: totalTokensSaved > 0 ? Math.round((totalTokensSaved / (totalTokensUsed + totalTokensSaved)) * 100) : 0,
      total_cost_savings: (totalTokensSaved * 0.015 / 1000).toFixed(4)
    };
  }

  getOperationBreakdown() {
    const breakdown = {};
    
    this.reports.forEach(report => {
      const type = report.operation_type || 'unknown';
      if (!breakdown[type]) {
        breakdown[type] = { count: 0, total_tokens_saved: 0 };
      }
      breakdown[type].count++;
      breakdown[type].total_tokens_saved += (report.tokens_saved || 0);
    });

    // Calculate averages
    Object.keys(breakdown).forEach(type => {
      breakdown[type].avg_tokens_saved = Math.round(breakdown[type].total_tokens_saved / breakdown[type].count);
    });

    return breakdown;
  }

  generateRecommendations() {
    const metrics = this.calculateEfficiencyMetrics();
    const breakdown = this.getOperationBreakdown();
    const recommendations = [];

    if (metrics.efficiency_rate < 30) {
      recommendations.push("Consider using more synthetic_auto_file operations to increase token efficiency");
    }

    if (breakdown['synthetic_batch_code']?.count < breakdown['synthetic_code']?.count * 0.3) {
      recommendations.push("Increase usage of batch operations to reduce API calls and improve efficiency");
    }

    if (metrics.total_tokens_saved > 10000) {
      recommendations.push("Excellent token optimization! Consider documenting successful patterns for team use");
    }

    if (recommendations.length === 0) {
      recommendations.push("Token usage patterns look good. Continue monitoring for optimization opportunities");
    }

    return recommendations;
  }

  async saveLog() {
    await fs.writeFile(this.logFile, JSON.stringify(this.reports, null, 2));
  }

  // Helper method to simulate logging different operation types
  async simulateOperations() {
    const operations = [
      {
        type: 'synthetic_auto_file',
        taskId: 'DEVFLOW-AUTO-001',
        tokens_used: 1200,
        tokens_saved: 800,
        files_modified: 2,
        efficiency_percentage: 40
      },
      {
        type: 'synthetic_batch_code',
        taskId: 'DEVFLOW-BATCH-001',
        tokens_used: 2500,
        tokens_saved: 1500,
        files_modified: 5,
        efficiency_percentage: 37.5
      },
      {
        type: 'synthetic_code',
        taskId: 'DEVFLOW-CODE-001',
        tokens_used: 800,
        tokens_saved: 200,
        files_modified: 1,
        efficiency_percentage: 20
      }
    ];

    for (const op of operations) {
      await this.logTokenUsage(op);
    }
  }
}

// CLI Interface
async function main() {
  const monitor = new TokenEfficiencyMonitor();
  const command = process.argv[2];

  switch (command) {
    case 'log':
      const operation = {
        type: process.argv[3],
        taskId: process.argv[4],
        tokens_used: parseInt(process.argv[5]) || 0,
        tokens_saved: parseInt(process.argv[6]) || 0,
        files_modified: parseInt(process.argv[7]) || 1
      };
      await monitor.logTokenUsage(operation);
      break;

    case 'report':
      await monitor.generateEfficiencyReport();
      break;

    case 'simulate':
      console.log('🎭 Simulating token efficiency operations...');
      await monitor.simulateOperations();
      await monitor.generateEfficiencyReport();
      break;

    case 'init':
      await monitor.initializeLog();
      console.log('📊 Token efficiency monitoring initialized');
      break;

    default:
      console.log(`
DevFlow Token Efficiency Monitor

Usage:
  node token-efficiency-monitor.js init                     Initialize monitoring
  node token-efficiency-monitor.js log <type> <taskId> <tokens_used> <tokens_saved> <files>
  node token-efficiency-monitor.js report                   Generate efficiency report
  node token-efficiency-monitor.js simulate                 Run simulation with sample data

Examples:
  node token-efficiency-monitor.js log synthetic_auto_file DEVFLOW-001 1200 800 2
  node token-efficiency-monitor.js report
      `);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch(console.error);
}

export default TokenEfficiencyMonitor;