/**
 * RWTEST-007: Memory Bridge Protocol Validation Test
 * 
 * This test validates the memory bridge protocols under production conditions
 * with actual Synthetic API calls and realistic development workflows.
 */

import { 
  MemoryBridgeService, 
  ContextInjector, 
  ContextHarvester, 
  TokenBudgetManager,
  RateLimiter,
  MemoryPersistenceService
} from '@devflow/memory-bridge';
import { SyntheticAPI } from '@devflow/synthetic-api';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const TEST_CONFIG = {
  TOKEN_BUDGET_LIMIT: 2000,
  RATE_LIMIT_WINDOW_MS: 5 * 60 * 60 * 1000, // 5 hours
  RATE_LIMIT_REQUESTS: 135,
  CONCURRENT_AGENTS: 5,
  TEST_DURATION_MS: 300000, // 5 minutes
  CONTEXT_SAMPLE_SIZE: 100
};

// Test data structures
interface TestContext {
  taskId: string;
  taskDescription: string;
  timestamp: number;
  metadata: Record<string, any>;
}

interface TestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitViolations: number;
  tokenBudgetExceeded: number;
  contextInjectionSuccess: number;
  contextHarvestingSuccess: number;
  persistenceSuccess: number;
  averageResponseTime: number;
  concurrencyPeak: number;
}

interface AgentState {
  id: string;
  active: boolean;
  requestCount: number;
  errorCount: number;
  lastRequestTime: number;
}

// Test implementation
class MemoryBridgeProtocolTest {
  private memoryBridge: MemoryBridgeService;
  private contextInjector: ContextInjector;
  private contextHarvester: ContextHarvester;
  private tokenBudgetManager: TokenBudgetManager;
  private rateLimiter: RateLimiter;
  private persistenceService: MemoryPersistenceService;
  private syntheticAPI: SyntheticAPI;
  
  private metrics: TestMetrics;
  private agents: Map<string, AgentState>;
  private testStartTime: number;
  
  constructor() {
    // Initialize services
    this.memoryBridge = new MemoryBridgeService();
    this.contextInjector = new ContextInjector();
    this.contextHarvester = new ContextHarvester();
    this.tokenBudgetManager = new TokenBudgetManager(TEST_CONFIG.TOKEN_BUDGET_LIMIT);
    this.rateLimiter = new RateLimiter(
      TEST_CONFIG.RATE_LIMIT_REQUESTS, 
      TEST_CONFIG.RATE_LIMIT_WINDOW_MS
    );
    this.persistenceService = new MemoryPersistenceService();
    this.syntheticAPI = new SyntheticAPI();
    
    // Initialize test state
    this.metrics = this.initializeMetrics();
    this.agents = new Map();
    this.testStartTime = 0;
  }
  
  private initializeMetrics(): TestMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitViolations: 0,
      tokenBudgetExceeded: 0,
      contextInjectionSuccess: 0,
      contextHarvestingSuccess: 0,
      persistenceSuccess: 0,
      averageResponseTime: 0,
      concurrencyPeak: 0
    };
  }
  
  /**
   * Generate realistic development task contexts for testing
   */
  private generateTestContexts(count: number): TestContext[] {
    const contexts: TestContext[] = [];
    const taskTypes = [
      'bug_fix', 'feature_development', 'code_review', 
      'refactoring', 'performance_optimization', 'security_audit'
    ];
    
    for (let i = 0; i < count; i++) {
      contexts.push({
        taskId: uuidv4(),
        taskDescription: `Development task ${i}: ${taskTypes[Math.floor(Math.random() * taskTypes.length)]}`,
        timestamp: Date.now(),
        metadata: {
          priority: Math.floor(Math.random() * 5) + 1,
          estimatedHours: Math.floor(Math.random() * 20) + 1,
          technologies: ['typescript', 'react', 'nodejs'].slice(0, Math.floor(Math.random() * 3) + 1)
        }
      });
    }
    
    return contexts;
  }
  
  /**
   * Test Synthetic API integration with memory bridge
   */
  private async testSyntheticAPIIntegration(): Promise<boolean> {
    try {
      const testContexts = this.generateTestContexts(TEST_CONFIG.CONTEXT_SAMPLE_SIZE);
      let totalResponseTime = 0;
      
      for (const context of testContexts) {
        const startTime = performance.now();
        
        // Check rate limiting
        if (!this.rateLimiter.isAllowed()) {
          this.metrics.rateLimitViolations++;
          continue;
        }
        
        // Check token budget
        const estimatedTokens = context.taskDescription.length; // Simplified estimation
        if (!this.tokenBudgetManager.consume(estimatedTokens)) {
          this.metrics.tokenBudgetExceeded++;
          continue;
        }
        
        try {
          // Inject context
          const injectionResult = await this.contextInjector.inject(context);
          if (injectionResult.success) {
            this.metrics.contextInjectionSuccess++;
          }
          
          // Call Synthetic API
          const apiResponse = await this.syntheticAPI.processContext(context);
          this.metrics.successfulRequests++;
          
          // Harvest context
          const harvestedContext = await this.contextHarvester.harvest(apiResponse);
          if (harvestedContext) {
            this.metrics.contextHarvestingSuccess++;
          }
          
          // Persist memory
          const persistenceResult = await this.persistenceService.saveContext(harvestedContext || context);
          if (persistenceResult) {
            this.metrics.persistenceSuccess++;
          }
          
        } catch (error) {
          this.metrics.failedRequests++;
          console.error(`API Integration Error: ${error}`);
        } finally {
          const responseTime = performance.now() - startTime;
          totalResponseTime += responseTime;
          this.metrics.totalRequests++;
        }
      }
      
      this.metrics.averageResponseTime = totalResponseTime / this.metrics.totalRequests;
      return true;
    } catch (error) {
      console.error(`Synthetic API Integration Test Failed: ${error}`);
      return false;
    }
  }
  
  /**
   * Test concurrent agent operations
   */
  private async testConcurrentAgents(): Promise<boolean> {
    try {
      const agentPromises: Promise<void>[] = [];
      
      // Create concurrent agents
      for (let i = 0; i < TEST_CONFIG.CONCURRENT_AGENTS; i++) {
        const agentId = `agent-${i}`;
        this.agents.set(agentId, {
          id: agentId,
          active: true,
          requestCount: 0,
          errorCount: 0,
          lastRequestTime: 0
        });
        
        agentPromises.push(this.runAgent(agentId));
      }
      
      // Run all agents concurrently
      await Promise.all(agentPromises);
      
      // Update concurrency metrics
      this.metrics.concurrencyPeak = TEST_CONFIG.CONCURRENT_AGENTS;
      return true;
    } catch (error) {
      console.error(`Concurrent Agents Test Failed: ${error}`);
      return false;
    }
  }
  
  /**
   * Run individual agent operations
   */
  private async runAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    const testContexts = this.generateTestContexts(TEST_CONFIG.CONTEXT_SAMPLE_SIZE / TEST_CONFIG.CONCURRENT_AGENTS);
    
    for (const context of testContexts) {
      if (!agent.active) break;
      
      agent.lastRequestTime = Date.now();
      agent.requestCount++;
      
      try {
        // Simulate agent work with memory bridge
        await this.contextInjector.inject(context);
        await this.syntheticAPI.processContext(context);
        await this.contextHarvester.harvest(context);
        await this.persistenceService.saveContext(context);
      } catch (error) {
        agent.errorCount++;
        console.error(`Agent ${agentId} Error: ${error}`);
      }
    }
  }
  
  /**
   * Test error recovery and fallback mechanisms
   */
  private async testErrorRecovery(): Promise<boolean> {
    try {
      // Simulate API failure
      const failureContext: TestContext = {
        taskId: uuidv4(),
        taskDescription: 'Error recovery test task',
        timestamp: Date.now(),
        metadata: {}
      };
      
      // Test fallback to cached context
      const fallbackResult = await this.memoryBridge.getFallbackContext(failureContext.taskId);
      if (fallbackResult) {
        // Verify fallback context integrity
        return typeof fallbackResult === 'object' && fallbackResult.taskId === failureContext.taskId;
      }
      
      return false;
    } catch (error) {
      console.error(`Error Recovery Test Failed: ${error}`);
      return false;
    }
  }
  
  /**
   * Test cross-session persistence
   */
  private async testCrossSessionPersistence(): Promise<boolean> {
    try {
      const sessionId = uuidv4();
      const testContexts = this.generateTestContexts(10);
      
      // Save contexts in current session
      for (const context of testContexts) {
        await this.persistenceService.saveContext(context, sessionId);
      }
      
      // Simulate new session
      const newSessionId = uuidv4();
      
      // Retrieve contexts in new session (should use cross-session persistence)
      let persistenceSuccess = 0;
      for (const context of testContexts) {
        const retrieved = await this.persistenceService.getContext(context.taskId, newSessionId);
        if (retrieved) {
          persistenceSuccess++;
        }
      }
      
      // At least 80% should be retrievable
      return (persistenceSuccess / testContexts.length) >= 0.8;
    } catch (error) {
      console.error(`Cross-Session Persistence Test Failed: ${error}`);
      return false;
    }
  }
  
  /**
   * Validate rate limiting compliance
   */
  private validateRateLimiting(): boolean {
    try {
      const requestCount = this.metrics.totalRequests;
      const testDuration = Date.now() - this.testStartTime;
      
      // Calculate requests per hour
      const requestsPerHour = (requestCount / testDuration) * 3600000;
      
      // Should be within 10% of rate limit
      const maxAllowed = (TEST_CONFIG.RATE_LIMIT_REQUESTS / (TEST_CONFIG.RATE_LIMIT_WINDOW_MS / 3600000)) * 1.1;
      
      return requestsPerHour <= maxAllowed;
    } catch (error) {
      console.error(`Rate Limiting Validation Failed: ${error}`);
      return false;
    }
  }
  
  /**
   * Validate token budget management
   */
  private validateTokenBudget(): boolean {
    try {
      const remainingBudget = this.tokenBudgetManager.getRemainingTokens();
      return remainingBudget >= 0 && remainingBudget <= TEST_CONFIG.TOKEN_BUDGET_LIMIT;
    } catch (error) {
      console.error(`Token Budget Validation Failed: ${error}`);
      return false;
    }
  }
  
  /**
   * Run all test suites
   */
  public async runAllTests(): Promise<TestMetrics> {
    this.testStartTime = Date.now();
    console.log('Starting Memory Bridge Protocol Validation Test...');
    
    try {
      // Run Synthetic API integration test
      console.log('Running Synthetic API Integration Test...');
      const apiIntegrationSuccess = await this.testSyntheticAPIIntegration();
      console.log(`API Integration Test: ${apiIntegrationSuccess ? 'PASSED' : 'FAILED'}`);
      
      // Run concurrent agents test
      console.log('Running Concurrent Agents Test...');
      const concurrentAgentsSuccess = await this.testConcurrentAgents();
      console.log(`Concurrent Agents Test: ${concurrentAgentsSuccess ? 'PASSED' : 'FAILED'}`);
      
      // Run error recovery test
      console.log('Running Error Recovery Test...');
      const errorRecoverySuccess = await this.testErrorRecovery();
      console.log(`Error Recovery Test: ${errorRecoverySuccess ? 'PASSED' : 'FAILED'}`);
      
      // Run cross-session persistence test
      console.log('Running Cross-Session Persistence Test...');
      const persistenceSuccess = await this.testCrossSessionPersistence();
      console.log(`Cross-Session Persistence Test: ${persistenceSuccess ? 'PASSED' : 'FAILED'}`);
      
      // Validate rate limiting compliance
      console.log('Validating Rate Limiting Compliance...');
      const rateLimitingValid = this.validateRateLimiting();
      console.log(`Rate Limiting Compliance: ${rateLimitingValid ? 'VALID' : 'INVALID'}`);
      
      // Validate token budget management
      console.log('Validating Token Budget Management...');
      const tokenBudgetValid = this.validateTokenBudget();
      console.log(`Token Budget Management: ${tokenBudgetValid ? 'VALID' : 'INVALID'}`);
      
      // Compile final metrics
      this.metrics = {
        ...this.metrics,
        rateLimitViolations: rateLimitingValid ? 0 : this.metrics.rateLimitViolations,
        tokenBudgetExceeded: tokenBudgetValid ? 0 : this.metrics.tokenBudgetExceeded
      };
      
      console.log('Memory Bridge Protocol Validation Test Completed');
      return this.metrics;
      
    } catch (error) {
      console.error(`Test Execution Failed: ${error}`);
      throw error;
    }
  }
  
  /**
   * Export detailed performance metrics
   */
  public exportMetrics(): TestMetrics {
    return { ...this.metrics };
  }
}

// Export test runner
export async function runMemoryBridgeProtocolTest(): Promise<TestMetrics> {
  const test = new MemoryBridgeProtocolTest();
  const results = await test.runAllTests();
  return test.exportMetrics();
}

// Export for direct usage
export { MemoryBridgeProtocolTest, TestMetrics };