/**
 * Simple Phase 1 Validator - File and Structure Validation
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

class SimpleValidator {
  private results: ValidationResult[] = [];

  async validate(): Promise<void> {
    console.log('🔍 DevFlow Hub Phase 1 - Simple Validation\n');

    this.validateCore();
    this.validateAdapters();
    this.validateServices();
    this.validateDatabase();
    this.validateTests();

    this.printSummary();
  }

  private validateCore(): void {
    console.log('📋 Core Components:');
    const coreFiles = [
      'src/orchestrator/session-orchestrator.ts',
      'src/database/migrations/002-enhanced-schema.ts',
      'src/optimization/api-batching-system.ts',
      'src/services/service-integration-manager.ts'
    ];

    coreFiles.forEach(file => {
      const exists = fs.existsSync(file);
      const status = exists ? 'PASS' : 'FAIL';
      const size = exists ? fs.statSync(file).size : 0;

      console.log(`  ${exists ? '✅' : '❌'} ${path.basename(file)} (${size} bytes)`);
      this.results.push({
        component: `Core: ${path.basename(file)}`,
        status,
        details: exists ? `${size} bytes` : 'Missing'
      });
    });
  }

  private validateAdapters(): void {
    console.log('\n🔌 Platform Adapters:');
    const adapters = [
      'src/adapters/platform-adapter-registry.ts',
      'src/adapters/claude-code-adapter.ts',
      'src/adapters/codex-adapter.ts',
      'src/adapters/gemini-adapter.ts',
      'src/adapters/qwen-adapter.ts'
    ];

    adapters.forEach(file => {
      const exists = fs.existsSync(file);
      const status = exists ? 'PASS' : 'FAIL';
      const size = exists ? fs.statSync(file).size : 0;

      console.log(`  ${exists ? '✅' : '❌'} ${path.basename(file)} (${size} bytes)`);
      this.results.push({
        component: `Adapter: ${path.basename(file)}`,
        status,
        details: exists ? `${size} bytes` : 'Missing'
      });
    });
  }

  private validateServices(): void {
    console.log('\n⚙️ Services:');
    const services = [
      'src/compatibility/dual-write-layer.ts',
      'src/cli/daic-commands.ts',
      'src/integrations/context7-hub-integration.ts',
      'src/services/smart-session-retry-hub.ts',
      'src/ui/custom-footer-system.ts'
    ];

    services.forEach(file => {
      const exists = fs.existsSync(file);
      const status = exists ? 'PASS' : 'FAIL';
      const size = exists ? fs.statSync(file).size : 0;

      console.log(`  ${exists ? '✅' : '❌'} ${path.basename(file)} (${size} bytes)`);
      this.results.push({
        component: `Service: ${path.basename(file)}`,
        status,
        details: exists ? `${size} bytes` : 'Missing'
      });
    });
  }

  private validateDatabase(): void {
    console.log('\n💾 Database:');
    const dbFile = 'data/devflow.sqlite';
    const exists = fs.existsSync(dbFile);
    const status = exists ? 'PASS' : 'FAIL';
    const size = exists ? fs.statSync(dbFile).size : 0;

    console.log(`  ${exists ? '✅' : '❌'} devflow.sqlite (${size} bytes)`);
    this.results.push({
      component: 'Database',
      status,
      details: exists ? `${size} bytes` : 'Missing'
    });

    // Check for backup and migration files
    const backupExists = fs.existsSync('.claude/state/');
    console.log(`  ${backupExists ? '✅' : '❌'} cc-sessions backup (${backupExists ? 'exists' : 'missing'})`);
  }

  private validateTests(): void {
    console.log('\n🧪 Test Files:');
    const testFiles = [
      'tests/phase1-integration-tests.ts',
      'tests/comprehensive-hub-test-suite.ts'
    ];

    testFiles.forEach(file => {
      const exists = fs.existsSync(file);
      const status = exists ? 'PASS' : 'FAIL';
      const size = exists ? fs.statSync(file).size : 0;

      console.log(`  ${exists ? '✅' : '❌'} ${path.basename(file)} (${size} bytes)`);
      this.results.push({
        component: `Test: ${path.basename(file)}`,
        status,
        details: exists ? `${size} bytes` : 'Missing'
      });
    });
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;

    console.log('\n📊 Validation Summary:');
    console.log(`  ✅ Passed: ${passed}/${total}`);
    console.log(`  ❌ Failed: ${failed}/${total}`);
    console.log(`  📈 Success Rate: ${Math.round((passed/total)*100)}%`);

    if (failed === 0) {
      console.log('\n🎉 Phase 1 structure validation PASSED!');
      console.log('   Ready for production deployment testing');
    } else {
      console.log('\n⚠️ Some components are missing');
      console.log('   Review failed components before deployment');
    }

    // Show deployment readiness
    console.log('\n🚀 Deployment Readiness Assessment:');
    const coreScore = this.results.filter(r => r.component.startsWith('Core') && r.status === 'PASS').length;
    const adapterScore = this.results.filter(r => r.component.startsWith('Adapter') && r.status === 'PASS').length;
    const serviceScore = this.results.filter(r => r.component.startsWith('Service') && r.status === 'PASS').length;

    console.log(`   📋 Core Components: ${coreScore}/4`);
    console.log(`   🔌 Adapters: ${adapterScore}/5`);
    console.log(`   ⚙️ Services: ${serviceScore}/5`);
    console.log(`   💾 Database: ${fs.existsSync('data/devflow.sqlite') ? '✅' : '❌'}`);
  }
}

// Execute validation
const validator = new SimpleValidator();
validator.validate();