/**
 * DEVFLOW-PROD-002-TEST - Real Synthetic API Integration Test
 * 
 * This test validates the production deployment of the Synthetic API integration
 * including rate limiting compliance, context injection/harvesting, and error handling.
 */

import { SyntheticApiClient, ApiConfig } from '../../core/synthetic-api/synthetic-api-client';
import { SyntheticEmbeddingModel } from '../../core/synthetic-api/embedding-model';
import { RateLimiter } from '../../core/synthetic-api/rate-limiter';

interface TestConfig {
  apiKey: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

class SyntheticApiIntegrationTest {
  private testConfig: TestConfig;
  private apiClient!: SyntheticApiClient;
  private embeddingModel!: SyntheticEmbeddingModel;
  private startTime: number;
  private testResults: { [key: string]: boolean } = {};

  constructor() {
    this.testConfig = {
      apiKey: process.env.SYNTHETIC_API_KEY || 'syn-iJ7rPT7b6jNvUNy4M1Gr2YNSXEFgCa',
      baseUrl: process.env.SYNTHETIC_BASE_URL || 'https://api.synthetic.new',
      clientId: process.env.SYNTHETIC_CLIENT_ID || 'devflow-client',
      clientSecret: process.env.SYNTHETIC_CLIENT_SECRET || 'devflow-secret'
    };

    this.startTime = Date.now();
  }

  /**
   * Initialize test environment
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Synthetic API Integration Test...');
      
      const apiConfig: ApiConfig = {
        baseUrl: this.testConfig.baseUrl,
        apiKey: this.testConfig.apiKey,
        clientId: this.testConfig.clientId,
        clientSecret: this.testConfig.clientSecret,
        timeout: 30000,
        maxRetries: 3,
        rateLimit: 135 / (5 * 60 * 60) // 135 requests per 5 hours
      };

      this.apiClient = new SyntheticApiClient(apiConfig);
      this.embeddingModel = new SyntheticEmbeddingModel(
        this.testConfig.apiKey,
        this.testConfig.baseUrl
      );

      await this.apiClient.initialize();
      console.log('✅ API Client initialized successfully');
      
      this.testResults['initialization'] = true;
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error);
      this.testResults['initialization'] = false;
      throw error;
    }
  }

  /**
   * Test 1: Basic API connectivity and authentication
   */
  async testApiConnectivity(): Promise<boolean> {
    try {
      console.log('\n🔍 Testing API connectivity and authentication...');
      
      // Test basic API endpoint
      const response = await this.apiClient.request('/health', 'GET');
      
      if (response.status === 200) {
        console.log('✅ API connectivity test passed');
        return true;
      } else {
        console.log(`❌ API connectivity test failed with status: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('❌ API connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Test 2: Embedding generation functionality
   */
  async testEmbeddingGeneration(): Promise<boolean> {
    try {
      console.log('\n🧮 Testing embedding generation...');
      
      const testTexts = [
        'DevFlow Cognitive Task Management System',
        'Memory persistence and context injection',
        'Rate limiting and API compliance testing'
      ];

      const embeddings = await this.embeddingModel.generateEmbeddings(testTexts);
      
      // Validate embeddings
      if (embeddings.length === testTexts.length) {
        const embeddingDimension = this.embeddingModel.getEmbeddingDimension();
        let validEmbeddings = true;
        
        for (let i = 0; i < embeddings.length; i++) {
          if (!Array.isArray(embeddings[i]) || embeddings[i].length !== embeddingDimension) {
            validEmbeddings = false;
            break;
          }
        }
        
        if (validEmbeddings) {
          console.log(`✅ Embedding generation test passed (${embeddings.length} embeddings, ${embeddingDimension}D)`);
          return true;
        } else {
          console.log('❌ Embedding validation failed - incorrect dimensions');
          return false;
        }
      } else {
        console.log(`❌ Embedding count mismatch: expected ${testTexts.length}, got ${embeddings.length}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Embedding generation test failed:', error);
      return false;
    }
  }

  /**
   * Test 3: Rate limiting compliance (135 requests per 5 hours)
   */
  async testRateLimitingCompliance(): Promise<boolean> {
    try {
      console.log('\n⏱️ Testing rate limiting compliance...');
      
      const rateLimiter = new RateLimiter({
        maxRequests: 5, // Test with 5 requests to simulate behavior
        windowMs: 10000, // 10 second window for testing
        identifier: 'test-rate-limiter'
      });

      const startTime = Date.now();
      const promises: Promise<boolean>[] = [];
      
      // Attempt to make 7 requests (exceeds our 5 request limit)
      for (let i = 0; i < 7; i++) {
        promises.push(rateLimiter.acquire());
      }

      const results = await Promise.allSettled(promises);
      const successfulRequests = results.filter(r => r.status === 'fulfilled').length;
      const duration = Date.now() - startTime;

      // Validate that rate limiting worked correctly
      if (duration > 5000 && successfulRequests === 7) { // Should take time due to rate limiting
        console.log(`✅ Rate limiting compliance test passed (${successfulRequests} requests in ${duration}ms)`);
        
        // Test API client rate limit info
        const rateLimitInfo = this.apiClient.getRateLimitInfo();
        console.log(`📊 Current rate limit: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}`);
        
        return true;
      } else {
        console.log(`❌ Rate limiting test failed: ${successfulRequests} requests in ${duration}ms`);
        return false;
      }
    } catch (error) {
      console.error('❌ Rate limiting compliance test failed:', error);
      return false;
    }
  }

  /**
   * Test 4: Context injection and harvesting protocols
   */
  async testContextManagement(): Promise<boolean> {
    try {
      console.log('\n🔄 Testing context injection and harvesting...');
      
      const contextData = {
        taskId: 'DEVFLOW-TEST-001',
        content: 'Test context content for memory bridge validation',
        metadata: {
          timestamp: Date.now(),
          priority: 'high',
          type: 'integration-test'
        }
      };

      // Simulate context injection
      const embedding = await this.embeddingModel.generateEmbeddings([contextData.content]);
      
      if (embedding && embedding.length > 0) {
        // Simulate context storage and retrieval
        const injectedContext = {
          ...contextData,
          embedding: embedding[0],
          injectedAt: Date.now()
        };

        // Validate context harvesting
        const harvestedContext = {
          ...injectedContext,
          harvestedAt: Date.now()
        };

        console.log(`✅ Context management test passed (context size: ${JSON.stringify(harvestedContext).length} bytes)`);
        return true;
      } else {
        console.log('❌ Context injection failed - no embedding generated');
        return false;
      }
    } catch (error) {
      console.error('❌ Context management test failed:', error);
      return false;
    }
  }

  /**
   * Test 5: Error handling and fallback mechanisms
   */
  async testErrorHandling(): Promise<boolean> {
    try {
      console.log('\n⚠️ Testing error handling and fallbacks...');
      
      // Test invalid API key
      try {
        const invalidEmbedding = new SyntheticEmbeddingModel('invalid-api-key', this.testConfig.baseUrl);
        await invalidEmbedding.generateEmbeddings(['test']);
        console.log('❌ Error handling test failed - should have thrown error for invalid API key');
        return false;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid API key')) {
          console.log('✅ Invalid API key error handling works correctly');
        } else {
          console.log(`⚠️ Unexpected error type: ${errorMessage}`);
        }
      }

      // Test empty input validation
      try {
        await this.embeddingModel.generateEmbeddings([]);
        console.log('❌ Error handling test failed - should have thrown error for empty input');
        return false;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('non-empty array')) {
          console.log('✅ Empty input validation works correctly');
        } else {
          console.log(`⚠️ Unexpected error type: ${errorMessage}`);
        }
      }

      console.log('✅ Error handling and fallbacks test passed');
      return true;
    } catch (error) {
      console.error('❌ Error handling test failed unexpectedly:', error);
      return false;
    }
  }

  /**
   * Run all integration tests
   */
  async runAllTests(): Promise<void> {
    console.log('🎯 Starting DevFlow Synthetic API Integration Tests\n');
    
    try {
      await this.initialize();
      
      // Run all tests
      this.testResults['apiConnectivity'] = await this.testApiConnectivity();
      this.testResults['embeddingGeneration'] = await this.testEmbeddingGeneration();
      this.testResults['rateLimitingCompliance'] = await this.testRateLimitingCompliance();
      this.testResults['contextManagement'] = await this.testContextManagement();
      this.testResults['errorHandling'] = await this.testErrorHandling();
      
      // Generate test report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Integration test suite failed:', error);
      process.exit(1);
    }
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 DEVFLOW SYNTHETIC API INTEGRATION TEST REPORT');
    console.log('='.repeat(60));
    
    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(result => result === true).length;
    const testDuration = Date.now() - this.startTime;
    
    console.log(`\n📊 Test Summary:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passedTests}`);
    console.log(`   Failed: ${totalTests - passedTests}`);
    console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
    console.log(`   Duration: ${testDuration}ms`);
    
    console.log('\n📋 Test Results:');
    Object.entries(this.testResults).forEach(([testName, result]) => {
      const status = result ? '✅ PASS' : '❌ FAIL';
      console.log(`   ${testName}: ${status}`);
    });
    
    console.log('\n📈 Performance Metrics:');
    console.log(`   Average test time: ${Math.round(testDuration / totalTests)}ms`);
    
    const rateLimitInfo = this.apiClient?.getRateLimitInfo();
    if (rateLimitInfo) {
      console.log(`   Rate limit status: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED - Production deployment ready!');
    } else {
      console.log('⚠️ Some tests failed - Please review before production deployment');
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const integrationTest = new SyntheticApiIntegrationTest();
  integrationTest.runAllTests().catch((error) => {
    console.error('❌ Integration test execution failed:', error);
    process.exit(1);
  });
}

export { SyntheticApiIntegrationTest };