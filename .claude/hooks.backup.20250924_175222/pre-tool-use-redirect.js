#!/usr/bin/env node

/**
 * PRE-TOOL-USE REDIRECT HOOK
 * Intercetta automaticamente tool calls >100 righe e delega al UNIFIED ORCHESTRATOR
 */

const { countLines, isClaudeOnlyMode, extractContent } = require('./line-counter');
const { callUnifiedOrchestrator } = require('./orchestrator-client');

const WRITING_TOOLS = ['Write', 'MultiEdit', 'Edit'];
const MAX_LINES = 100;

async function redirectToOrchestrator(toolCall) {
  const toolName = toolCall.function?.name;

  // Skip non-writing tools
  if (!WRITING_TOOLS.includes(toolName)) {
    return { redirect: false, reason: 'not-writing-tool' };
  }

  // Skip in claude-only mode
  if (isClaudeOnlyMode()) {
    return { redirect: false, reason: 'claude-only-mode' };
  }

  // Count lines
  const content = extractContent(toolCall);
  const lineCount = countLines(content);

  // Allow if under limit
  if (lineCount <= MAX_LINES) {
    return { redirect: false, lineCount, reason: 'under-limit' };
  }

  // Redirect to orchestrator
  try {
    const result = await callUnifiedOrchestrator(toolCall, lineCount);

    return {
      redirect: true,
      lineCount,
      orchestratorResult: result,
      message: `Redirected ${toolName} (${lineCount} lines) to Unified Orchestrator`
    };
  } catch (error) {
    return {
      redirect: true,
      error: true,
      lineCount,
      message: `Failed to redirect to orchestrator: ${error.message}`
    };
  }
}

// Export per system hook integration
module.exports = { redirectToOrchestrator };

// CLI execution for testing
if (require.main === module) {
  const testCall = {
    function: {
      name: 'Write',
      parameters: {
        file_path: 'test.js',
        content: 'line1\n'.repeat(150)
      }
    }
  };

  redirectToOrchestrator(testCall)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => console.error('Error:', error.message));
}