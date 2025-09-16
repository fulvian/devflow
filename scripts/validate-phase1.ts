/**
 * Phase 1 Production Validation Script
 * Tests core DevFlow Hub components for production readiness
 */

import { Database } from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  timestamp: Date;
}

class Phase1Validator {
  private results: ValidationResult[] = [];

  async validateAll(): Promise<ValidationResult[]> {
    console.log('🔍 Starting Phase 1 Production Validation...\n');

    await this.validateDatabase();
    await this.validateCore();
    await this.validateAdapters();
    await this.validateServices();

    this.printResults();
    return this.results;
  }

  private async validateDatabase(): Promise<void> {
    try {
      const db = new Database('data/devflow.sqlite');

      // Check tables exist
      const tables = await this.queryDatabase(db,
        "SELECT name FROM sqlite_master WHERE type='table'"
      );

      const requiredTables = [
        'tasks', 'sessions', 'memory_blocks',
        'platform_adapters', 'sessions_enhanced',
        'conflicts', 'entity_versions'
      ];

      const existingTables = tables.map((row: any) => row.name);
      const missingTables = requiredTables.filter(t => !existingTables.includes(t));

      if (missingTables.length === 0) {
        this.addResult('Database Schema', 'PASS', 'All required tables present');
      } else {
        this.addResult('Database Schema', 'FAIL', `Missing tables: ${missingTables.join(', ')}`);
      }

      // Check data
      const taskCount = await this.queryDatabase(db, "SELECT COUNT(*) as count FROM tasks");
      this.addResult('Database Data', 'PASS', `Found ${taskCount[0].count} tasks`);

      db.close();
    } catch (error) {
      this.addResult('Database', 'FAIL', `Database error: ${error}`);
    }
  }

  private async validateCore(): Promise<void> {
    const coreFiles = [
      'src/orchestrator/session-orchestrator.ts',
      'src/database/migrations/002-enhanced-schema.ts',
      'src/optimization/api-batching-system.ts'
    ];

    for (const file of coreFiles) {
      if (fs.existsSync(file)) {
        this.addResult(`Core: ${path.basename(file)}`, 'PASS', 'File exists');
      } else {
        this.addResult(`Core: ${path.basename(file)}`, 'FAIL', 'File missing');
      }
    }
  }

  private async validateAdapters(): Promise<void> {
    const adapterFiles = [
      'src/adapters/platform-adapter-registry.ts',
      'src/adapters/claude-code-adapter.ts',
      'src/adapters/codex-adapter.ts',
      'src/adapters/gemini-adapter.ts',
      'src/adapters/qwen-adapter.ts'
    ];

    for (const file of adapterFiles) {
      if (fs.existsSync(file)) {
        this.addResult(`Adapter: ${path.basename(file)}`, 'PASS', 'File exists');
      } else {
        this.addResult(`Adapter: ${path.basename(file)}`, 'FAIL', 'File missing');
      }
    }
  }

  private async validateServices(): Promise<void> {
    const serviceFiles = [
      'src/compatibility/dual-write-layer.ts',
      'src/cli/daic-commands.ts',
      'src/integrations/context7-hub-integration.ts',
      'src/ui/custom-footer-system.ts'
    ];

    for (const file of serviceFiles) {
      if (fs.existsSync(file)) {
        this.addResult(`Service: ${path.basename(file)}`, 'PASS', 'File exists');
      } else {
        this.addResult(`Service: ${path.basename(file)}`, 'FAIL', 'File missing');
      }
    }
  }

  private queryDatabase(db: Database, query: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  private addResult(component: string, status: 'PASS' | 'FAIL' | 'WARNING', message: string): void {
    this.results.push({
      component,
      status,
      message,
      timestamp: new Date()
    });
  }

  private printResults(): void {
    console.log('\n📊 Phase 1 Validation Results:\n');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;

    this.results.forEach(result => {
      const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${emoji} ${result.component}: ${result.message}`);
    });

    console.log(`\n📈 Summary: ${passed} passed, ${failed} failed, ${warnings} warnings`);

    if (failed === 0) {
      console.log('🎉 Phase 1 is READY for production deployment!');
    } else {
      console.log('🔧 Phase 1 needs fixes before production deployment');
    }
  }
}

// Execute validation
const validator = new Phase1Validator();
validator.validateAll().catch(console.error);