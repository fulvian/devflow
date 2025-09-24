#!/usr/bin/env node

// Test rapido per verificare se le chiamate MCP synthetic funzionano ora

async function testMCPSynthetic() {
  console.log('=== TEST MCP SYNTHETIC RESTORATION ===');

  // Simula chiamata che farebbe l'Unified Orchestrator
  const testCall = {
    method: 'tools/call',
    params: {
      name: 'mcp__devflow-synthetic-cc-sessions__synthetic_auto',
      arguments: {
        task_id: 'TEST-MCP-RESTORE-' + Date.now(),
        request: 'Generate a simple hello world function in TypeScript',
        approval_required: false,
        constraints: ['Use model: hf:Qwen/Qwen3-Coder-480B-A35B-Instruct']
      }
    }
  };

  console.log('🔧 Tool call prepared:');
  console.log(JSON.stringify(testCall, null, 2));

  // Ora prova a chiamare l'orchestrator
  try {
    console.log('\n🌐 Testing via Unified Orchestrator...');

    const response = await fetch('http://localhost:3005/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer devflow-orchestrator-token'
      },
      body: JSON.stringify({
        task_id: `DEVFLOW-MCP-TEST-${Date.now()}`,
        tool_call: testCall,
        line_count: 5,
        source: 'test-mcp-restoration',
        preferred_agent: 'codex'  // Force specific fallback chain
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Orchestrator error ${response.status}: ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log('✅ Orchestrator response:', JSON.stringify(result, null, 2));

    // Verifica se synthetic è stato chiamato
    if (result.metadata && result.metadata.fallbacksUsed) {
      const usedSynthetic = result.metadata.fallbacksUsed.some(f =>
        f.includes('synthetic') || f.includes('qwen3-coder')
      );

      if (usedSynthetic) {
        console.log('🎯 Synthetic agent was called in fallback chain!');
      } else {
        console.log('⚠️ No synthetic agent found in fallback chain');
      }
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
}

testMCPSynthetic().catch(error => console.error('Test error:', error.message));