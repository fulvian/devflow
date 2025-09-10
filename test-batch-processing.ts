// Test Batch Processing Functionality

import { mcp__devflow_synthetic_cc_sessions__synthetic_batch_dual } from './mcp-servers/synthetic/src/dual-enhanced-index';

async function testBatchProcessing() {
  console.log('🧪 Testing Batch Processing...');
  
  const testBatch = [
    {
      file_path: 'test-batch-1.ts',
      objective: 'Create simple test function',
      language: 'typescript'
    },
    {
      file_path: 'test-batch-2.py', 
      objective: 'Create hello world function',
      language: 'python'
    },
    {
      file_path: 'test-batch-3.js',
      objective: 'Create utility function',
      language: 'javascript'
    }
  ];

  try {
    const result = await mcp__devflow_synthetic_cc_sessions__synthetic_batch_dual({
      task_id: 'BATCH-TEST-001',
      batch_requests: testBatch,
      storage_integration: true
    });
    
    console.log('✅ Batch processing test successful:', result);
    return true;
  } catch (error) {
    console.error('❌ Batch processing test failed:', error);
    return false;
  }
}

testBatchProcessing();