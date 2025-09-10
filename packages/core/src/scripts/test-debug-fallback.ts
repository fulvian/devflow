import { DebugRouterService } from '../ml/DebugRouterService';
import { GeminiService } from '../ml/GeminiService';
import { ClaudeService } from '../ml/ClaudeService';
import { SyntheticAutoService } from '../ml/SyntheticAutoService';
import { Logger } from '../../utils/Logger';

// Mock service implementations for testing
class MockGeminiService {
  async debugCode(errorContext: any): Promise<string> {
    if (errorContext.error.message.includes('Unexpected token')) {
      return 'Fixed syntax error by correcting the token';
    }
    throw new Error('Gemini cannot handle this error type');
  }
}

class MockClaudeService {
  async debugCode(errorContext: any): Promise<string> {
    if (errorContext.error.message.includes('Cannot read property')) {
      return 'Fixed type error by adding null check';
    }
    if (errorContext.error.message.includes('UnhandledPromiseRejection')) {
      return 'Fixed async error by adding catch handler';
    }
    throw new Error('Claude cannot handle this error type');
  }
}

class MockSyntheticAutoService {
  async debugCode(errorContext: any): Promise<string> {
    return 'Fixed with synthetic auto solution';
  }
}

async function runTests() {
  const logger = new Logger('DebugFallbackTest');
  
  // Initialize mock services
  const geminiService = new MockGeminiService() as any;
  const claudeService = new MockClaudeService() as any;
  const syntheticAutoService = new MockSyntheticAutoService() as any;
  
  // Create debug router with mock services
  const debugRouter = new DebugRouterService(
    geminiService,
    claudeService,
    syntheticAutoService
  );
  
  logger.info('Starting debug fallback tests...');
  
  // Test 1: Syntax error (should route to Gemini)
  try {
    const syntaxErrorContext = {
      error: new Error('Unexpected token'),
      code: 'const x = ;',
      stack: 'SyntaxError: Unexpected token',
      timestamp: Date.now(),
      attempt: 1
    };
    
    const result = await debugRouter.routeDebugRequest(syntaxErrorContext);
    logger.info(`✓ Syntax error test passed: ${result}`);
  } catch (error) {
    logger.error(`✗ Syntax error test failed: ${error.message}`);
  }
  
  // Test 2: Type error (should route to Claude)
  try {
    const typeErrorContext = {
      error: new Error('Cannot read property of undefined'),
      code: 'console.log(obj.property)',
      stack: 'TypeError: Cannot read property of undefined',
      timestamp: Date.now(),
      attempt: 1
    };
    
    const result = await debugRouter.routeDebugRequest(typeErrorContext);
    logger.info(`✓ Type error test passed: ${result}`);
  } catch (error) {
    logger.error(`✗ Type error test failed: ${error.message}`);
  }
  
  // Test 3: Async error (should route to Claude)
  try {
    const asyncErrorContext = {
      error: new Error('UnhandledPromiseRejection'),
      code: 'Promise.reject("error");',
      stack: 'at async PromiseRejectCallback',
      timestamp: Date.now(),
      attempt: 1
    };
    
    const result = await debugRouter.routeDebugRequest(asyncErrorContext);
    logger.info(`✓ Async error test passed: ${result}`);
  } catch (error) {
    logger.error(`✗ Async error test failed: ${error.message}`);
  }
  
  // Test 4: Unknown error (should use fallback chain)
  try {
    const unknownErrorContext = {
      error: new Error('Custom error'),
      code: 'custom code',
      stack: 'CustomStack',
      timestamp: Date.now(),
      attempt: 1
    };
    
    const result = await debugRouter.routeDebugRequest(unknownErrorContext);
    logger.info(`✓ Unknown error test passed: ${result}`);
  } catch (error) {
    logger.error(`✗ Unknown error test failed: ${error.message}`);
  }
  
  // Test 5: Service failure with fallback
  try {
    const geminiFailureContext = {
      error: new Error('Cannot read property'), // This would normally go to Claude
      code: 'console.log(obj.property)',
      stack: 'TypeError: Cannot read property of undefined',
      timestamp: Date.now(),
      attempt: 1
    };
    
    // Temporarily make Claude fail to test fallback
    const originalClaudeDebug = claudeService.debugCode;
    claudeService.debugCode = () => Promise.reject(new Error('Claude service down'));
    
    const result = await debugRouter.routeDebugRequest(geminiFailureContext);
    logger.info(`✓ Service failure fallback test passed: ${result}`);
    
    // Restore Claude service
    claudeService.debugCode = originalClaudeDebug;
  } catch (error) {
    logger.error(`✗ Service failure fallback test failed: ${error.message}`);
  }
  
  logger.info('Debug fallback tests completed.');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}
