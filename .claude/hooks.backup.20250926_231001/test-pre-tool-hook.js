#!/usr/bin/env node

/**
 * TEST HOOK - Pre-tool use intercept
 */

function preToolUseHook(toolCall) {
  console.log(`🔍 [TEST-HOOK] Intercepted tool call: ${toolCall.name}`);

  // Log to file for verification
  const fs = require('fs');
  const logEntry = {
    timestamp: new Date().toISOString(),
    tool: toolCall.name,
    args: Object.keys(toolCall.arguments || {})
  };

  try {
    fs.appendFileSync('.claude/logs/hook-test.log', JSON.stringify(logEntry) + '\n');
  } catch (error) {
    console.error('Hook log error:', error);
  }

  return toolCall; // Pass through unchanged
}

module.exports = { preToolUseHook };