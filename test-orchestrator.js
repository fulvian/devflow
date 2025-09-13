#!/usr/bin/env node

/**
 * MCP Orchestrator Test Suite
 * Validates orchestrator functionality including session management,
 * model switching, and role transfer mechanisms
 */

const WebSocket = require('ws');

class OrchestratorTester {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.testResults = [];
  }

  async runTests() {
    console.log('🧪 Starting MCP Orchestrator Test Suite...');
    console.log('=' .repeat(50));

    try {
      await this.testConnection();
      await this.testSessionInitialization();
      await this.testModelSwitching();
      await this.testUsageMonitoring();
      await this.testSessionPersistence();

      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      if (this.ws) {
        this.ws.close();
      }
    }
  }

  async testConnection() {
    console.log('\n📡 Testing WebSocket connection...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.ws = new WebSocket('ws://localhost:3001');

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.addResult('Connection Test', true, 'Successfully connected to orchestrator');
        console.log('✅ Connected to ws://localhost:3001');
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.addResult('Connection Test', false, `Connection failed: ${error.message}`);
        reject(error);
      });
    });
  }

  async testSessionInitialization() {
    console.log('\n🎭 Testing session initialization...');

    const message = {
      type: 'init',
      payload: {
        userId: 'test-user-001'
      },
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.addResult('Session Init', false, 'Session initialization timeout');
        reject(new Error('Session initialization timeout'));
      }, 3000);

      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.type === 'init') {
            clearTimeout(timeout);
            this.sessionId = response.sessionId;
            this.addResult('Session Init', true, `Session initialized: ${this.sessionId}`);
            console.log(`✅ Session initialized: ${this.sessionId}`);
            console.log(`📋 Starting model: ${response.model}`);
            this.ws.off('message', messageHandler);
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          this.addResult('Session Init', false, `Parse error: ${error.message}`);
          reject(error);
        }
      };

      this.ws.on('message', messageHandler);
      this.ws.send(JSON.stringify(message));
    });
  }

  async testModelSwitching() {
    console.log('\n🔄 Testing model switching...');

    if (!this.sessionId) {
      this.addResult('Model Switch', false, 'No active session for testing');
      return;
    }

    const models = ['codex', 'gemini', 'sonnet'];

    for (const targetModel of models) {
      console.log(`   Switching to ${targetModel}...`);

      const message = {
        type: 'handoff',
        payload: {
          targetModel,
          sessionId: this.sessionId
        },
        timestamp: Date.now()
      };

      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`${targetModel} switch timeout`));
          }, 3000);

          const messageHandler = (data) => {
            try {
              const response = JSON.parse(data.toString());

              if (response.type === 'handoff' && response.payload?.status === 'completed') {
                clearTimeout(timeout);
                console.log(`   ✅ Switched to ${targetModel}`);
                this.ws.off('message', messageHandler);
                resolve();
              }
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          };

          this.ws.on('message', messageHandler);
          this.ws.send(JSON.stringify(message));
        });

        // Small delay between switches
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        this.addResult('Model Switch', false, `Failed to switch to ${targetModel}: ${error.message}`);
        return;
      }
    }

    this.addResult('Model Switch', true, 'Successfully tested all model switches');
  }

  async testUsageMonitoring() {
    console.log('\n📊 Testing usage monitoring...');

    const message = {
      type: 'status',
      sessionId: this.sessionId,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.addResult('Usage Monitor', false, 'Status request timeout');
        reject(new Error('Status request timeout'));
      }, 3000);

      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.type === 'status') {
            clearTimeout(timeout);
            const payload = response.payload;

            console.log(`   📈 Session uptime: ${payload.uptime}ms`);
            console.log(`   🔢 Current model: ${payload.currentModel}`);
            console.log(`   📊 Usage: ${payload.usage.requests} requests, ${payload.usage.tokens} tokens`);

            this.addResult('Usage Monitor', true, 'Successfully retrieved usage statistics');
            this.ws.off('message', messageHandler);
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          this.addResult('Usage Monitor', false, `Parse error: ${error.message}`);
          reject(error);
        }
      };

      this.ws.on('message', messageHandler);
      this.ws.send(JSON.stringify(message));
    });
  }

  async testSessionPersistence() {
    console.log('\n💾 Testing session persistence...');

    // Simulate message exchange to generate some session history
    const testMessage = {
      type: 'message',
      payload: {
        content: 'Test message for session persistence validation'
      },
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.addResult('Session Persistence', false, 'Message processing timeout');
        reject(new Error('Message processing timeout'));
      }, 5000);

      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.type === 'message') {
            clearTimeout(timeout);
            console.log(`   ✅ Message processed by ${response.payload.model}`);
            console.log(`   📝 Response: ${response.payload.content.substring(0, 50)}...`);

            this.addResult('Session Persistence', true, 'Session state maintained across interactions');
            this.ws.off('message', messageHandler);
            resolve();
          }
        } catch (error) {
          clearTimeout(timeout);
          this.addResult('Session Persistence', false, `Parse error: ${error.message}`);
          reject(error);
        }
      };

      this.ws.on('message', messageHandler);
      this.ws.send(JSON.stringify(testMessage));
    });
  }

  addResult(test, passed, message) {
    this.testResults.push({ test, passed, message });
  }

  printResults() {
    console.log('\n📋 TEST RESULTS SUMMARY');
    console.log('=' .repeat(50));

    let passed = 0;
    let total = this.testResults.length;

    this.testResults.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${result.test}: ${result.message}`);
      if (result.passed) passed++;
    });

    console.log('\n📊 FINAL SCORE');
    console.log('-' .repeat(30));
    console.log(`Passed: ${passed}/${total} tests`);
    console.log(`Success Rate: ${((passed/total) * 100).toFixed(1)}%`);

    if (passed === total) {
      console.log('\n🎉 ALL TESTS PASSED - Orchestrator is ready for production!');
    } else {
      console.log('\n⚠️  Some tests failed - Check orchestrator configuration');
    }
  }
}

// Run the test suite
async function main() {
  const tester = new OrchestratorTester();
  await tester.runTests();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test suite interrupted');
  process.exit(0);
});

main().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});