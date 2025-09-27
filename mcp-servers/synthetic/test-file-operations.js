#!/usr/bin/env node

/**
 * Integration test for Synthetic MCP File Operations
 * Tests all the new file operation tools we just implemented
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.join(__dirname, 'dist', 'dual-enhanced-index.js');

// Test cases for file operations
const testCases = [
  {
    name: 'Test File Write',
    tool: 'synthetic_file_write',
    args: {
      file_path: 'test-output.txt',
      content: 'Hello from Synthetic MCP File Operations!\nThis is a test file created by the enhanced MCP server.',
      backup: true
    }
  },
  {
    name: 'Test File Read', 
    tool: 'synthetic_file_read',
    args: {
      file_path: 'test-output.txt'
    }
  },
  {
    name: 'Test File Create',
    tool: 'synthetic_file_create',
    args: {
      file_path: 'new-test-file.md',
      content: '# Test Markdown File\n\nThis file was created using the `synthetic_file_create` tool.\n\n## Features\n- Direct file creation\n- Automatic backup support\n- Security path validation\n- Audit trail logging',
      backup: true
    }
  },
  {
    name: 'Test Batch Operations',
    tool: 'synthetic_batch_operations', 
    args: {
      task_id: 'TEST-BATCH-001',
      description: 'Testing batch file operations functionality',
      operations: [
        {
          type: 'create',
          path: 'batch-test-1.txt',
          content: 'File 1 from batch operation',
          backup: true
        },
        {
          type: 'create', 
          path: 'batch-test-2.txt',
          content: 'File 2 from batch operation',
          backup: true
        },
        {
          type: 'mkdir',
          path: 'test-directory',
          recursive: true
        }
      ]
    }
  }
];

async function testMCPCall(testCase) {
  console.log(`\n🧪 ${testCase.name}`);
  console.log('=' .repeat(50));
  
  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DEVFLOW_PROJECT_ROOT: __dirname,
        AUTONOMOUS_FILE_OPERATIONS: 'true',
        CREATE_BACKUPS: 'true',
        SYNTHETIC_DELETE_ENABLED: 'false',
        SYNTHETIC_API_KEY: process.env.SYNTHETIC_API_KEY || 'test-key'
      }
    });

    let output = '';
    let errorOutput = '';

    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    server.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Test completed successfully');
        console.log('Output:', output.substring(0, 200) + (output.length > 200 ? '...' : ''));
        resolve({ success: true, output, errorOutput });
      } else {
        console.log(`❌ Test failed with exit code ${code}`);
        console.log('Error:', errorOutput);
        resolve({ success: false, output, errorOutput, code });
      }
    });

    server.on('error', (error) => {
      console.log(`❌ Failed to start server: ${error.message}`);
      reject(error);
    });

    // Send MCP initialization and tool call
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    const toolRequest = {
      jsonrpc: '2.0', 
      id: 2,
      method: 'tools/call',
      params: {
        name: testCase.tool,
        arguments: testCase.args
      }
    };

    // Send requests
    server.stdin.write(JSON.stringify(initRequest) + '\n');
    server.stdin.write(JSON.stringify(toolRequest) + '\n');
    server.stdin.end();

    // Timeout after 10 seconds
    setTimeout(() => {
      server.kill();
      console.log('⚠️  Test timed out after 10 seconds');
      resolve({ success: false, timeout: true });
    }, 10000);
  });
}

async function runAllTests() {
  console.log('🚀 Starting Synthetic MCP File Operations Integration Tests');
  console.log(`📁 Project Root: ${__dirname}`);
  console.log(`🔧 Server Path: ${serverPath}`);
  
  const results = [];
  
  for (const testCase of testCases) {
    try {
      const result = await testMCPCall(testCase);
      results.push({ testCase: testCase.name, ...result });
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`❌ Test "${testCase.name}" failed with error:`, error.message);
      results.push({ testCase: testCase.name, success: false, error: error.message });
    }
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('=' .repeat(50));
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Successful: ${successful}/${total}`);
  console.log(`❌ Failed: ${total - successful}/${total}`);
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.testCase}`);
  });
  
  if (successful === total) {
    console.log('\n🎉 ALL TESTS PASSED! Synthetic MCP File Operations are working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the output above for details.');
  }
}

// Run tests
runAllTests().catch(console.error);