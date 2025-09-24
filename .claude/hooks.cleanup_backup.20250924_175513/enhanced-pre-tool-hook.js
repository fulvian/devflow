#!/usr/bin/env node

/**
 * ENHANCED PRE-TOOL-USE HOOK
 *
 * Funzionalità integrate:
 * 1. ENFORCEMENT: Intercetta automaticamente tool calls >100 righe e delega al UNIFIED ORCHESTRATOR
 * 2. CONTEXT INJECTION: Inietta contesto dal database quando vengono chiamati agenti di codifica
 *
 * Agenti di codifica supportati:
 * - mcp__devflow-synthetic-cc-sessions (Synthetic)
 * - mcp__gemini-cli (Gemini CLI)
 * - mcp__qwen-code (Qwen CLI)
 * - mcp__codex-cli (Codex CLI)
 * - Task (quando delega ad agenti)
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configurazione
const CONFIG = {
  MAX_LINES: 100,
  DB_PATH: './data/devflow_unified.sqlite',
  CONTEXT_LOADER_SCRIPT: '.claude/hooks/context-loader.py',
  ORCHESTRATOR_URL: 'http://localhost:3005',
  ENABLE_LOGGING: true,
  LOG_FILE: '.claude/logs/enhanced-pre-tool.log'
};

// Tools che scrivono file (per enforcement)
const WRITING_TOOLS = ['Write', 'MultiEdit', 'Edit'];

// Agenti di codifica (per context injection) - pattern matching
const CODING_AGENTS = [
  'mcp__devflow-synthetic-cc-sessions',
  'mcp__gemini-cli',
  'mcp__qwen-code',
  'mcp__codex-cli',
  'Task'  // Quando delega ad agenti
];

// Check if tool name matches coding agent pattern
function isCodingAgent(toolName) {
  return CODING_AGENTS.some(agent => toolName.includes(agent));
}

// Utility functions
function log(message, level = 'INFO') {
  if (!CONFIG.ENABLE_LOGGING) return;

  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} [${level}] ${message}\n`;

  try {
    const logDir = path.dirname(CONFIG.LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(CONFIG.LOG_FILE, logEntry);
  } catch (error) {
    console.error('Logging error:', error.message);
  }
}

function countLines(content) {
  if (!content || typeof content !== 'string') return 0;
  return content.split('\n').length;
}

function extractContent(toolCall) {
  const params = toolCall.function?.parameters || {};

  // Per tools di scrittura, estrai content
  if (params.content) return params.content;
  if (params.new_string) return params.new_string;

  // Per edits multipli
  if (params.edits && Array.isArray(params.edits)) {
    return params.edits.map(edit => edit.new_string || '').join('\n');
  }

  return '';
}

function isClaudeOnlyMode() {
  try {
    const modeFile = '.devflow/current-mode.txt';
    if (fs.existsSync(modeFile)) {
      const mode = fs.readFileSync(modeFile, 'utf8').trim();
      return mode === 'claude-only';
    }
  } catch (error) {
    log(`Error checking claude-only mode: ${error.message}`, 'WARN');
  }
  return false;
}

async function callUnifiedOrchestrator(toolCall, lineCount) {
  log(`Redirecting to Unified Orchestrator: ${toolCall.function?.name} (${lineCount} lines)`);

  try {
    const response = await fetch(`${CONFIG.ORCHESTRATOR_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer devflow-orchestrator-token'
      },
      body: JSON.stringify({
        task_id: `DEVFLOW-REDIRECT-${Date.now()}`,
        tool_call: toolCall,
        line_count: lineCount,
        source: 'enhanced-pre-tool-hook'
      })
    });

    if (!response.ok) {
      throw new Error(`Orchestrator responded with ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    log(`Orchestrator call failed: ${error.message}`, 'ERROR');
    throw error;
  }
}

async function loadContextFromDatabase(agentName, taskContext = {}) {
  log(`Loading context for agent: ${agentName}`);

  try {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [
        CONFIG.CONTEXT_LOADER_SCRIPT,
        agentName,
        JSON.stringify(taskContext)
      ], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            log(`Context loaded successfully for ${agentName}: ${result.blocks_count || 0} blocks`);
            resolve(result);
          } catch (parseError) {
            log(`Failed to parse context response: ${parseError.message}`, 'ERROR');
            resolve({ context: [], success: false });
          }
        } else {
          log(`Context loading failed for ${agentName}: ${stderr}`, 'ERROR');
          resolve({ context: [], success: false });
        }
      });

      pythonProcess.on('error', (error) => {
        log(`Context loading process error: ${error.message}`, 'ERROR');
        resolve({ context: [], success: false });
      });
    });
  } catch (error) {
    log(`Context loading error for ${agentName}: ${error.message}`, 'ERROR');
    return { context: [], success: false };
  }
}

async function enhancedPreToolHook(toolCall) {
  const toolName = toolCall.function?.name;
  log(`Processing tool call: ${toolName}`);

  const result = {
    redirect: false,
    contextInjected: false,
    toolName,
    timestamp: new Date().toISOString()
  };

  try {
    // 1. ENFORCEMENT CHECK: File >100 righe
    if (WRITING_TOOLS.includes(toolName)) {
      // Skip in claude-only mode
      if (isClaudeOnlyMode()) {
        log('Skipping enforcement in claude-only mode');
        result.reason = 'claude-only-mode';
        return result;
      }

      // Count lines
      const content = extractContent(toolCall);
      const lineCount = countLines(content);
      result.lineCount = lineCount;

      // Redirect if over limit
      if (lineCount > CONFIG.MAX_LINES) {
        try {
          const orchestratorResult = await callUnifiedOrchestrator(toolCall, lineCount);
          result.redirect = true;
          result.orchestratorResult = orchestratorResult;
          result.message = `Redirected ${toolName} (${lineCount} lines) to Unified Orchestrator`;
          return result;
        } catch (error) {
          result.redirect = true;
          result.error = true;
          result.message = `Failed to redirect to orchestrator: ${error.message}`;
          return result;
        }
      }
    }

    // 2. CONTEXT INJECTION: Agenti di codifica
    if (isCodingAgent(toolName)) {
      log(`Detected coding agent: ${toolName}, injecting context`);

      // Estrai contesto task da parametri tool call
      const taskContext = {
        task_name: toolCall.function?.parameters?.task_id ||
                   toolCall.function?.parameters?.objective ||
                   'coding_task',
        tool_parameters: toolCall.function?.parameters || {}
      };

      // Carica contesto dal database
      const contextResult = await loadContextFromDatabase(toolName, taskContext);

      if (contextResult.success && contextResult.context?.length > 0) {
        result.contextInjected = true;
        result.injectedContext = contextResult.context;
        result.message = `Context injected for ${toolName}: ${contextResult.context.length} blocks`;

        // IMPORTANTE: Modifica la tool call per includere il contesto
        const contextText = contextResult.context.join('\n\n');
        if (!toolCall.function.parameters.context) {
          toolCall.function.parameters.context = contextText;
        } else {
          toolCall.function.parameters.context += '\n\n' + contextText;
        }

        log(`Successfully injected context for ${toolName}`);
        log(`INJECTED CONTEXT TEXT:\n${contextText}`, 'DEBUG');
      } else {
        result.contextInjected = false;
        result.message = `No context available for ${toolName}`;
        log(`No context found for ${toolName}`);
      }
    }

    result.reason = 'processed-successfully';
    return result;

  } catch (error) {
    log(`Error in enhanced pre-tool hook: ${error.message}`, 'ERROR');
    result.error = true;
    result.message = `Hook error: ${error.message}`;
    return result;
  }
}

// Export per system hook integration
module.exports = { enhancedPreToolHook };

// CLI execution for testing
if (require.main === module) {
  // Test con agente di codifica
  const codingAgentCall = {
    function: {
      name: 'mcp__qwen-code',
      parameters: {
        task_id: 'DEVFLOW-TEST-001',
        objective: 'Implement user authentication system',
        language: 'typescript'
      }
    }
  };

  // Test con file grande
  const largeFileCall = {
    function: {
      name: 'Write',
      parameters: {
        file_path: 'test.js',
        content: 'line1\n'.repeat(150)
      }
    }
  };

  async function runTests() {
    console.log('=== Testing Context Injection ===');
    const contextResult = await enhancedPreToolHook(codingAgentCall);
    console.log(JSON.stringify(contextResult, null, 2));

    console.log('\n=== Testing Enforcement (SKIP - requires Orchestrator) ===');
    console.log('Enforcement test skipped - requires running Orchestrator on port 3005');

    // Test without calling orchestrator
    const simpleWriteCall = {
      function: {
        name: 'Write',
        parameters: {
          file_path: 'test.js',
          content: 'console.log("Hello World");'  // Small file
        }
      }
    };

    console.log('\n=== Testing Small File (No Enforcement) ===');
    const smallFileResult = await enhancedPreToolHook(simpleWriteCall);
    console.log(JSON.stringify(smallFileResult, null, 2));
  }

  runTests().catch(error => console.error('Test error:', error.message));
}