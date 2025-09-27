#!/usr/bin/env node

// Test reale enforcement per verificare cosa succede con file >100 righe

async function testEnforcement() {
  const fs = require('fs');

  // Simula tool call con file >100 righe
  const largeContent = 'console.log("test line");\n'.repeat(150);

  const toolCall = {
    function: {
      name: 'Write',
      parameters: {
        file_path: 'test-large-enforcement.js',
        content: largeContent
      }
    }
  };

  console.log(`=== ENFORCEMENT TEST ===`);
  console.log(`Content lines: ${largeContent.split('\n').length}`);
  console.log(`Should trigger enforcement (>100 lines)`);

  // Test chiamata orchestrator diretta
  try {
    const response = await fetch('http://localhost:3005/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer devflow-orchestrator-token'
      },
      body: JSON.stringify({
        task_id: `DEVFLOW-TEST-${Date.now()}`,
        tool_call: toolCall,
        line_count: largeContent.split('\n').length,
        source: 'test-enforcement'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Orchestrator error ${response.status}: ${errorText}`);
      return;
    }

    const result = await response.json();
    console.log('✅ Orchestrator response:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.log(`❌ Orchestrator call failed: ${error.message}`);
  }

  // Test controllo mode
  try {
    const modeResponse = await fetch('http://localhost:3005/api/mode');
    if (modeResponse.ok) {
      const modeData = await modeResponse.json();
      console.log('📊 Current mode:', modeData);
    }
  } catch (error) {
    console.log('⚠️ Mode check failed:', error.message);
  }
}

testEnforcement().catch(error => console.error('Test failed:', error.message));