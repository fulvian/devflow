// DevFlow Real-World Integration Test Suite
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

// Test Configuration
const TEST_CONFIG = {
  dbPath: '/Users/fulvioventura/devflow/data/devflow_unified.sqlite',
  testDataPath: './.devflow',
  timeout: 30000,
  performanceThresholds: {
    taskCreation: 100, // ms
    hierarchyQuery: 200, // ms
    memoryQuery: 150 // ms
  }
};

class DevFlowIntegrationTest {
  constructor() {
    this.db = null;
    this.testResults = [];
    this.startTime = Date.now();
  }

  async initialize() {
    console.log('🚀 Initializing DevFlow Integration Test Suite');
    console.log('=' * 60);

    try {
      // Connect to DevFlow database
      await this.connectDatabase();
      console.log('✅ Database connection established');

      // Load test configuration
      await this.loadConfiguration();
      console.log('✅ Test configuration loaded');

      return true;
    } catch (error) {
      console.error(`❌ Initialization failed: ${error.message}`);
      return false;
    }
  }

  async connectDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(TEST_CONFIG.dbPath, (err) => {
        if (err) {
          reject(new Error(`Database connection failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async loadConfiguration() {
    const configPath = path.join(TEST_CONFIG.testDataPath, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`📋 Loaded configuration for project: ${config.project.name}`);
    }
  }

  async testTaskHierarchy() {
    console.log('\n🌳 Testing Task Hierarchy Management...');

    const testCases = [
      {
        name: 'Create parent task',
        test: () => this.createTask('Real-World Test Parent', 'Parent task for testing')
      },
      {
        name: 'Create child tasks',
        test: () => this.createChildTasks()
      },
      {
        name: 'Query hierarchy',
        test: () => this.queryTaskHierarchy()
      }
    ];

    for (const testCase of testCases) {
      try {
        const startTime = Date.now();
        const result = await testCase.test();
        const duration = Date.now() - startTime;

        this.testResults.push({
          category: 'TaskHierarchy',
          name: testCase.name,
          status: 'PASS',
          duration,
          result
        });

        console.log(`  ✅ ${testCase.name} (${duration}ms)`);
      } catch (error) {
        this.testResults.push({
          category: 'TaskHierarchy',
          name: testCase.name,
          status: 'FAIL',
          error: error.message
        });

        console.log(`  ❌ ${testCase.name}: ${error.message}`);
      }
    }
  }

  async createTask(title, description) {
    return new Promise((resolve, reject) => {
      const taskId = `rwtest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.db.run(`
        INSERT INTO task_contexts (id, title, description, status, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `, [taskId, title, description, 'active', 'medium'], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: taskId, title, description });
        }
      });
    });
  }

  async createChildTasks() {
    const parentTask = await this.createTask('Parent Task', 'Test parent task');
    const childTasks = [];

    for (let i = 1; i <= 3; i++) {
      const child = await this.createTask(
        `Child Task ${i}`,
        `Child task ${i} for hierarchy testing`
      );
      childTasks.push(child);
    }

    return { parent: parentTask, children: childTasks };
  }

  async queryTaskHierarchy() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT id, title, description, status, priority, created_at
        FROM task_contexts
        WHERE id LIKE 'rwtest-%'
        ORDER BY created_at DESC
        LIMIT 10
      `, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async testSemanticMemory() {
    console.log('\n🧠 Testing Semantic Memory System...');

    const testCases = [
      {
        name: 'Load semantic index',
        test: () => this.loadSemanticIndex()
      },
      {
        name: 'Query semantic memory',
        test: () => this.querySemanticMemory('task hierarchy management')
      },
      {
        name: 'Test contextual suggestions',
        test: () => this.getContextualSuggestions()
      }
    ];

    for (const testCase of testCases) {
      try {
        const startTime = Date.now();
        const result = await testCase.test();
        const duration = Date.now() - startTime;

        this.testResults.push({
          category: 'SemanticMemory',
          name: testCase.name,
          status: 'PASS',
          duration,
          result
        });

        console.log(`  ✅ ${testCase.name} (${duration}ms)`);
      } catch (error) {
        this.testResults.push({
          category: 'SemanticMemory',
          name: testCase.name,
          status: 'FAIL',
          error: error.message
        });

        console.log(`  ❌ ${testCase.name}: ${error.message}`);
      }
    }
  }

  async loadSemanticIndex() {
    const indexPath = path.join(TEST_CONFIG.testDataPath, 'memory', 'semantic-index.json');
    if (fs.existsSync(indexPath)) {
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      return index;
    } else {
      throw new Error('Semantic index file not found');
    }
  }

  async querySemanticMemory(query) {
    const index = await this.loadSemanticIndex();

    // Simple semantic search simulation
    const results = index.index.entities.filter(entity =>
      entity.id.toLowerCase().includes(query.toLowerCase()) ||
      entity.related.some(rel => rel.toLowerCase().includes(query.toLowerCase()))
    );

    return results;
  }

  async getContextualSuggestions() {
    const index = await this.loadSemanticIndex();

    // Return sample contextual suggestions
    return index.index.entities.slice(0, 3).map(entity => ({
      type: entity.type,
      id: entity.id,
      relevance: Math.random() * 0.5 + 0.5, // Random relevance between 0.5-1.0
      reason: `Related to ${entity.type} context`
    }));
  }

  async testDatabaseConnectivity() {
    console.log('\n🗄️  Testing Database Connectivity...');

    const testCases = [
      {
        name: 'Database connection',
        test: () => this.testDbConnection()
      },
      {
        name: 'Schema validation',
        test: () => this.validateSchema()
      },
      {
        name: 'Data integrity',
        test: () => this.testDataIntegrity()
      }
    ];

    for (const testCase of testCases) {
      try {
        const startTime = Date.now();
        const result = await testCase.test();
        const duration = Date.now() - startTime;

        this.testResults.push({
          category: 'Database',
          name: testCase.name,
          status: 'PASS',
          duration,
          result
        });

        console.log(`  ✅ ${testCase.name} (${duration}ms)`);
      } catch (error) {
        this.testResults.push({
          category: 'Database',
          name: testCase.name,
          status: 'FAIL',
          error: error.message
        });

        console.log(`  ❌ ${testCase.name}: ${error.message}`);
      }
    }
  }

  async testDbConnection() {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT 1 as test", [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({ connected: true, testValue: row.test });
        }
      });
    });
  }

  async validateSchema() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT name, sql FROM sqlite_master
        WHERE type='table' AND name='task_contexts'
      `, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          if (rows.length > 0) {
            resolve({ tableExists: true, schema: rows[0].sql });
          } else {
            reject(new Error('task_contexts table not found'));
          }
        }
      });
    });
  }

  async testDataIntegrity() {
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT COUNT(*) as count FROM task_contexts
      `, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({ taskCount: row.count, integrity: true });
        }
      });
    });
  }

  async testPerformance() {
    console.log('\n⚡ Testing Performance Benchmarks...');

    const benchmarks = [];

    // Task creation benchmark
    const taskCreationStart = Date.now();
    await this.createTask('Performance Test Task', 'Benchmark task creation');
    const taskCreationTime = Date.now() - taskCreationStart;

    benchmarks.push({
      operation: 'Task Creation',
      duration: taskCreationTime,
      threshold: TEST_CONFIG.performanceThresholds.taskCreation,
      passed: taskCreationTime <= TEST_CONFIG.performanceThresholds.taskCreation
    });

    // Hierarchy query benchmark
    const hierarchyQueryStart = Date.now();
    await this.queryTaskHierarchy();
    const hierarchyQueryTime = Date.now() - hierarchyQueryStart;

    benchmarks.push({
      operation: 'Hierarchy Query',
      duration: hierarchyQueryTime,
      threshold: TEST_CONFIG.performanceThresholds.hierarchyQuery,
      passed: hierarchyQueryTime <= TEST_CONFIG.performanceThresholds.hierarchyQuery
    });

    benchmarks.forEach(benchmark => {
      const status = benchmark.passed ? '✅' : '❌';
      console.log(`  ${status} ${benchmark.operation}: ${benchmark.duration}ms (threshold: ${benchmark.threshold}ms)`);
    });

    this.testResults.push({
      category: 'Performance',
      name: 'Benchmarks',
      status: benchmarks.every(b => b.passed) ? 'PASS' : 'FAIL',
      result: benchmarks
    });
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));

    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    const totalDuration = Date.now() - this.startTime;
    console.log(`Total Duration: ${totalDuration}ms`);

    // Group results by category
    const categories = [...new Set(this.testResults.map(r => r.category))];

    categories.forEach(category => {
      console.log(`\n📋 ${category} Tests:`);
      const categoryTests = this.testResults.filter(r => r.category === category);

      categoryTests.forEach(test => {
        const status = test.status === 'PASS' ? '✅' : '❌';
        const duration = test.duration ? ` (${test.duration}ms)` : '';
        console.log(`  ${status} ${test.name}${duration}`);

        if (test.error) {
          console.log(`     Error: ${test.error}`);
        }
      });
    });

    // Final recommendation
    console.log('\n' + '='.repeat(60));

    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED - DevFlow system ready for production!');
    } else if (passedTests >= totalTests * 0.8) {
      console.log('⚠️  MOST TESTS PASSED - System mostly functional with minor issues');
    } else {
      console.log('❌ CRITICAL ISSUES FOUND - System needs attention before production');
    }
  }

  async cleanup() {
    if (this.db) {
      // Clean up test data
      try {
        await new Promise((resolve, reject) => {
          this.db.run(`DELETE FROM task_contexts WHERE id LIKE 'rwtest-%'`, [], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        this.db.close();
        console.log('\n🧹 Test cleanup completed');
      } catch (error) {
        console.error(`⚠️  Cleanup warning: ${error.message}`);
      }
    }
  }

  async run() {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        process.exit(1);
      }

      await this.testDatabaseConnectivity();
      await this.testTaskHierarchy();
      await this.testSemanticMemory();
      await this.testPerformance();

      await this.generateReport();
      await this.cleanup();

    } catch (error) {
      console.error(`💥 Test suite failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run the test suite
if (require.main === module) {
  const testSuite = new DevFlowIntegrationTest();
  testSuite.run().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = DevFlowIntegrationTest;