/**
 * DevFlow v3.1 Phase 1 - Comprehensive Integration Test Suite
 * Tests all implemented features: Smart Session Retry, Footer System, Context7, Qwen CLI
 */

import { Context7MCPIntegration } from '../../integrations/context7-mcp-integration';
import { QwenCLIIntegration } from '../../integrations/qwen-cli-integration';
import { AgentFallbackSystem, DEFAULT_FALLBACK_CONFIG } from '../../core/orchestration/agent-fallback-system';
import { FooterRenderer } from '../../ui/footer/FooterRenderer';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  details?: any;
  error?: string;
}

class DevFlowV31ComprehensiveTest {
  private results: TestResult[] = [];
  private context7: Context7MCPIntegration;
  private qwen: QwenCLIIntegration;
  private fallbackSystem: AgentFallbackSystem;
  private footer: FooterRenderer;

  constructor() {
    this.context7 = new Context7MCPIntegration();
    this.qwen = new QwenCLIIntegration();
    this.fallbackSystem = new AgentFallbackSystem(DEFAULT_FALLBACK_CONFIG);
    this.footer = new FooterRenderer();
  }

  async runFullTestSuite(): Promise<void> {
    console.log('🧪 Starting DevFlow v3.1 Phase 1 Comprehensive Test Suite...');
    const startTime = Date.now();

    // Test 1: Context7 MCP Integration
    await this.testContext7Integration();

    // Test 2: Qwen CLI Integration
    await this.testQwenIntegration();

    // Test 3: Agent Fallback System
    await this.testAgentFallbackSystem();

    // Test 4: Footer System
    await this.testFooterSystem();

    // Test 5: End-to-End Integration
    await this.testEndToEndIntegration();

    // Generate report
    const totalTime = Date.now() - startTime;
    this.generateTestReport(totalTime);
  }

  private async testContext7Integration(): Promise<void> {
    const testName = 'Context7 MCP Integration';
    const startTime = Date.now();

    try {
      console.log('📚 Testing Context7 MCP Integration...');

      // Check installation
      const isInstalled = await this.context7.isInstalled();
      if (!isInstalled) {
        await this.context7.install();
      }

      // Test server startup
      await this.context7.startServer();
      
      // Test health check
      const isHealthy = await this.context7.healthCheck();
      if (!isHealthy) {
        throw new Error('Context7 health check failed');
      }

      // Test documentation retrieval
      const docs = await this.context7.getDocumentation('react', '18.0.0');
      if (!docs || docs.length < 100) {
        throw new Error('Documentation retrieval failed or insufficient content');
      }

      // Test semantic memory injection
      await this.context7.injectDocumentationContext('react', docs);

      this.results.push({
        name: testName,
        success: true,
        duration: Date.now() - startTime,
        details: { docsLength: docs.length }
      });

      console.log('✅ Context7 Integration Test: PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ Context7 Integration Test: FAILED', error);
    }
  }

  private async testQwenIntegration(): Promise<void> {
    const testName = 'Qwen CLI Integration';
    const startTime = Date.now();

    try {
      console.log('🏗️ Testing Qwen CLI Integration...');

      // Setup Qwen CLI
      await this.qwen.setup();

      // Verify status
      const status = this.qwen.getStatus();
      if (!status.installed || !status.configured) {
        throw new Error('Qwen CLI setup incomplete');
      }

      if (status.model !== 'Qwen3-Coder-480B-A35B-Instruct') {
        throw new Error(`Wrong model configured: ${status.model}`);
      }

      // Test health check
      const isHealthy = await this.qwen.healthCheck();
      if (!isHealthy) {
        throw new Error('Qwen CLI health check failed');
      }

      // Test code analysis
      const testCode = 'function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }';
      const analysis = await this.qwen.analyzeCode(testCode, 'performance');
      
      if (!analysis || analysis.length < 50) {
        throw new Error('Code analysis failed or insufficient result');
      }

      this.results.push({
        name: testName,
        success: true,
        duration: Date.now() - startTime,
        details: { 
          model: status.model,
          contextWindow: status.contextWindow,
          analysisLength: analysis.length
        }
      });

      console.log('✅ Qwen CLI Integration Test: PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ Qwen CLI Integration Test: FAILED', error);
    }
  }

  private async testAgentFallbackSystem(): Promise<void> {
    const testName = 'Agent Fallback System';
    const startTime = Date.now();

    try {
      console.log('🔄 Testing Agent Fallback System...');

      // Setup fallback system
      await this.fallbackSystem.setup();

      // Test health checks
      const health = await this.fallbackSystem.healthCheck();
      const healthyAgents = Object.values(health).filter(h => h).length;
      
      if (healthyAgents < 2) {
        throw new Error(`Too few healthy agents: ${healthyAgents}/4`);
      }

      // Test fallback execution
      const mockTask = {
        id: 'test-task-001',
        description: 'Test task for fallback system validation',
        context: 'function testFunction() { return "Hello DevFlow v3.1"; }',
        filePath: 'test.js'
      };

      const result = await this.fallbackSystem.executeWithFallback(
        mockTask,
        'code-review',
        ['react', 'typescript']
      );

      if (!result.success) {
        throw new Error(`Fallback execution failed: ${result.error}`);
      }

      // Test status reporting
      const status = this.fallbackSystem.getStatus();
      if (!status.agents || Object.keys(status.agents).length !== 4) {
        throw new Error('Incorrect agent configuration');
      }

      this.results.push({
        name: testName,
        success: true,
        duration: Date.now() - startTime,
        details: {
          healthyAgents,
          executionAgent: result.agent,
          attemptsUsed: result.attemptsUsed,
          context7Used: result.context7Used
        }
      });

      console.log('✅ Agent Fallback System Test: PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ Agent Fallback System Test: FAILED', error);
    }
  }

  private async testFooterSystem(): Promise<void> {
    const testName = 'Footer System';
    const startTime = Date.now();

    try {
      console.log('🎨 Testing Footer System...');

      // Test basic rendering
      const preview = this.footer.renderPreview();
      if (!preview.includes('🧠') || !preview.includes('🔥') || !preview.includes('📊')) {
        throw new Error('Footer preview missing required elements');
      }

      // Test performance (1000 renders)
      const perfStartTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        this.footer.renderPreview();
      }
      const avgRenderTime = (Date.now() - perfStartTime) / 1000;
      
      if (avgRenderTime > 16) { // Should be <16ms per render
        throw new Error(`Footer rendering too slow: ${avgRenderTime}ms average`);
      }

      // Test width adaptation
      this.footer.setMaxWidth(50);
      const narrowPreview = this.footer.renderPreview();
      if (narrowPreview.length >= preview.length) {
        throw new Error('Width adaptation not working');
      }

      // Test theme switching
      const customTheme = {
        model: '\x1b[94m',
        calls: '\x1b[93m',
        context: '\x1b[92m',
        hierarchy: '\x1b[95m',
        warning: '\x1b[93m',
        critical: '\x1b[91m'
      };
      this.footer.setTheme(customTheme);
      const themedPreview = this.footer.renderPreview();
      
      this.results.push({
        name: testName,
        success: true,
        duration: Date.now() - startTime,
        details: {
          avgRenderTime: `${avgRenderTime.toFixed(3)}ms`,
          previewLength: preview.length,
          narrowPreviewLength: narrowPreview.length
        }
      });

      console.log('✅ Footer System Test: PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ Footer System Test: FAILED', error);
    }
  }

  private async testEndToEndIntegration(): Promise<void> {
    const testName = 'End-to-End Integration';
    const startTime = Date.now();

    try {
      console.log('🔗 Testing End-to-End Integration...');

      // Test complete workflow:
      // 1. Context7 provides documentation
      // 2. Qwen analyzes code with documentation context
      // 3. Fallback system coordinates execution
      // 4. Footer displays system status

      // Step 1: Get documentation via Context7
      const libraries = ['typescript', 'node'];
      const documentation = await this.context7.useContext7(libraries);
      
      if (Object.keys(documentation).length !== libraries.length) {
        throw new Error('Not all libraries documented');
      }

      // Step 2: Use documentation in Qwen analysis
      const complexCode = `
        interface UserService {
          getUser(id: string): Promise<User>;
          createUser(userData: UserData): Promise<User>;
        }
        
        class DatabaseUserService implements UserService {
          async getUser(id: string): Promise<User> {
            // Implementation with potential issues
            return database.query('SELECT * FROM users WHERE id = ?', id);
          }
        }
      `;
      
      const analysis = await this.qwen.reviewCodeArchitecture(complexCode);
      if (!analysis || analysis.length < 200) {
        throw new Error('Insufficient architecture analysis');
      }

      // Step 3: Test fallback system with Context7 enhancement
      const integrationTask = {
        id: 'integration-test-001',
        description: 'End-to-end integration validation',
        context: complexCode,
        filePath: 'UserService.ts'
      };

      const result = await this.fallbackSystem.executeWithFallback(
        integrationTask,
        'architecture-analysis',
        libraries
      );

      if (!result.success || !result.context7Used) {
        throw new Error('Integration execution failed or Context7 not used');
      }

      // Step 4: Validate footer shows integrated status
      const footerStatus = this.footer.renderPreview();
      if (!footerStatus.includes('DevFlow')) {
        throw new Error('Footer not showing DevFlow status');
      }

      this.results.push({
        name: testName,
        success: true,
        duration: Date.now() - startTime,
        details: {
          librariesDocumented: Object.keys(documentation).length,
          analysisLength: analysis.length,
          executionAgent: result.agent,
          context7Enhanced: result.context7Used,
          totalWorkflowTime: Date.now() - startTime
        }
      });

      console.log('✅ End-to-End Integration Test: PASSED');

    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('❌ End-to-End Integration Test: FAILED', error);
    }
  }

  private generateTestReport(totalTime: number): void {
    console.log('\n📊 DevFlow v3.1 Phase 1 - Comprehensive Test Report');
    console.log('=' .repeat(60));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const successRate = (passed / this.results.length * 100).toFixed(1);
    
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log('\nDetailed Results:');
    console.log('-'.repeat(40));
    
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${(result.duration / 1000).toFixed(2)}s`;
      
      console.log(`${index + 1}. ${status} ${result.name} (${duration})`);
      
      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      console.log('');
    });
    
    // Final verdict
    if (passed === this.results.length) {
      console.log('🎉 ALL TESTS PASSED - DevFlow v3.1 Phase 1 Ready for Production!');
    } else {
      console.log('⚠️  Some tests failed - Review before production deployment');
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.context7.cleanup();
      await this.qwen.cleanup();
      await this.fallbackSystem.cleanup();
      console.log('✅ Test cleanup completed');
    } catch (error) {
      console.error('❌ Test cleanup failed:', error);
    }
  }
}

// Export for external use
export { DevFlowV31ComprehensiveTest };

// Run if called directly
if (require.main === module) {
  const tester = new DevFlowV31ComprehensiveTest();
  
  tester.runFullTestSuite()
    .then(() => tester.cleanup())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Test suite execution failed:', error);
      tester.cleanup().finally(() => process.exit(1));
    });
}
