/*
 * Intelligent Task Router Hook for Claude Code DevFlow
 * Bridge between Claude Code and DevFlow Unified Orchestrator
 * Delegates all routing decisions to the centralized Orchestrator
 */

const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  ORCHESTRATOR_URL: process.env.ORCHESTRATOR_URL || 'http://localhost:3005',
  LINE_THRESHOLD: parseInt(process.env.TASK_ROUTER_LINE_THRESHOLD || '100'),
  ENABLE_LOGGING: process.env.TASK_ROUTER_LOGGING !== 'false',
  METRICS_FILE: process.env.TASK_ROUTER_METRICS_FILE || '.claude/logs/routing-metrics.json',
  REQUEST_TIMEOUT: parseInt(process.env.ORCHESTRATOR_TIMEOUT || '5000')
};

// HTTP client utility for Orchestrator communication
async function callOrchestrator(endpoint, data, method = 'POST') {
  const url = `${CONFIG.ORCHESTRATOR_URL}${endpoint}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Claude-Code-Hook/1.0'
      },
      body: method !== 'GET' ? JSON.stringify(data) : undefined,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Orchestrator request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Check for application-level errors (like authentication failures)
    if (result.error || result.status === 'error') {
      throw new Error(`Orchestrator API error: ${result.error || result.message || 'Unknown error'}`);
    }

    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Orchestrator request timeout');
    }
    throw error;
  }
}

// Logging utility
function logRoutingDecision(decision) {
  if (!CONFIG.ENABLE_LOGGING) return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    ...decision
  };

  console.log(`[TaskRouter] ${JSON.stringify(logEntry)}`);

  // Save metrics
  try {
    let metrics = [];
    if (fs.existsSync(CONFIG.METRICS_FILE)) {
      metrics = JSON.parse(fs.readFileSync(CONFIG.METRICS_FILE, 'utf8'));
    }
    metrics.push(logEntry);

    // Ensure directory exists
    const dir = path.dirname(CONFIG.METRICS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(CONFIG.METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.error('[TaskRouter] Failed to save metrics:', error);
  }
}

// Simple task size estimation (rest delegated to Orchestrator)
function estimateTaskSize(taskDescription) {
  const complexityKeywords = [
    'complex', 'advanced', 'large', 'comprehensive', 'extensive',
    'multiple functions', 'several components', 'full implementation'
  ];

  const simpleKeywords = [
    'simple', 'basic', 'small', 'minimal', 'single function',
    'quick fix', 'minor change', 'small component'
  ];

  const description = taskDescription.toLowerCase();

  // Check for explicit line count mentions
  const lineMatch = description.match(/(\d+)\+?\s*lines?/);
  if (lineMatch) {
    return parseInt(lineMatch[1]);
  }

  // Check for explicit large size indicators
  if (description.includes('150+') || description.includes('massiv') || description.includes('completo') || description.includes('comprehensive')) {
    return 200;
  }

  // Basic complexity estimation
  const hasComplex = complexityKeywords.some(keyword => description.includes(keyword));
  const hasSimple = simpleKeywords.some(keyword => description.includes(keyword));

  if (hasComplex) return 150;
  if (hasSimple) return 30;
  return 75; // Default estimation
}

// Main hook function - Bridge to Unified Orchestrator
async function preToolUseHook(toolCall) {
  try {
    // Intercept ALL coding agents: CLI + Synthetic (CLAUDE.md compliance)
    const cliAgents = ['mcp__codex-cli__', 'mcp__gemini-cli__', 'mcp__qwen-code__'];
    const syntheticAgents = ['mcp__devflow-synthetic-cc-sessions__'];
    const allCodingAgents = [...cliAgents, ...syntheticAgents];
    const isCodingTask = allCodingAgents.some(agent => toolCall.name.startsWith(agent));

    if (!isCodingTask) {
      return toolCall; // Pass through non-coding tools
    }

    const taskDescription = toolCall.arguments.prompt ||
                           toolCall.arguments.description ||
                           toolCall.arguments.task ||
                           JSON.stringify(toolCall.arguments);

    // 1. Local size estimation for small tasks
    const estimatedLines = estimateTaskSize(taskDescription);

    // If small task, let Claude handle it directly
    if (estimatedLines < CONFIG.LINE_THRESHOLD) {
      logRoutingDecision({
        event: 'direct_execution',
        reason: 'small_task',
        lines: estimatedLines,
        task: taskDescription.substring(0, 100) + '...',
        originalTool: toolCall.name
      });
      return toolCall; // Pass through
    }

    // 2. Extract preferred agent from tool name
    let preferredAgent = 'auto';
    if (toolCall.name.includes('codex')) preferredAgent = 'codex';
    else if (toolCall.name.includes('gemini')) preferredAgent = 'gemini';
    else if (toolCall.name.includes('qwen')) preferredAgent = 'qwen';
    else if (toolCall.name.includes('synthetic')) {
      // Determine Synthetic subtype based on function name
      if (toolCall.name.includes('synthetic_code')) preferredAgent = 'qwen3-coder';
      else if (toolCall.name.includes('synthetic_reasoning')) preferredAgent = 'kimi-k2';
      else if (toolCall.name.includes('synthetic_auto')) preferredAgent = 'glm-4.5';
      else preferredAgent = 'qwen3-coder'; // Default Synthetic
    }

    // 3. Submit task to Unified Orchestrator
    const taskRequest = {
      id: `hook-${Date.now()}`,
      type: 'coding',
      description: taskDescription,
      preferredAgent: preferredAgent,
      priority: 'medium',
      metadata: {
        originalTool: toolCall.name,
        estimatedLines: estimatedLines,
        source: 'claude-code-hook'
      }
    };

    logRoutingDecision({
      event: 'orchestrator_submission',
      taskId: taskRequest.id,
      preferredAgent: preferredAgent,
      lines: estimatedLines,
      task: taskDescription.substring(0, 100) + '...',
      originalTool: toolCall.name
    });

    // 4. Call Orchestrator API
    const orchestratorResult = await callOrchestrator('/api/tasks', taskRequest);

    // 5. Process Orchestrator response
    logRoutingDecision({
      event: 'orchestrator_response',
      taskId: taskRequest.id,
      success: orchestratorResult.success,
      agentUsed: orchestratorResult.agentUsed,
      fallbacksUsed: orchestratorResult.fallbacksUsed || 0,
      executionTime: orchestratorResult.totalExecutionTime,
      originalTool: toolCall.name
    });

    // 6. Modify tool call based on Orchestrator decision
    if (orchestratorResult.success && orchestratorResult.agentUsed !== 'claude-emergency') {
      // Orchestrator selected an agent - modify the tool call
      const selectedTool = mapAgentToTool(orchestratorResult.agentUsed);

      if (selectedTool && selectedTool !== toolCall.name) {
        return {
          ...toolCall,
          name: selectedTool,
          arguments: {
            ...toolCall.arguments,
            routedBy: 'unified-orchestrator',
            originalTool: toolCall.name,
            agentUsed: orchestratorResult.agentUsed,
            taskId: taskRequest.id
          }
        };
      }
    }

    // 7. Return original tool call if no routing needed
    return toolCall;

  } catch (error) {
    console.error('[TaskRouter] Error communicating with Orchestrator:', error.message);

    logRoutingDecision({
      event: 'orchestrator_error',
      error: error.message,
      task: taskDescription?.substring(0, 100) + '...',
      originalTool: toolCall.name,
      fallback: 'direct_execution'
    });

    // Fail open - let original tool execute
    return toolCall;
  }
}

// Map agent names to MCP tool names
function mapAgentToTool(agentName) {
  const agentMapping = {
    'codex': 'mcp__codex-cli__codex',
    'gemini': 'mcp__gemini-cli__ask-gemini',
    'qwen': 'mcp__qwen-code__ask-qwen',
    'qwen3-coder': 'mcp__devflow-synthetic-cc-sessions__synthetic_code',
    'kimi-k2': 'mcp__devflow-synthetic-cc-sessions__synthetic_reasoning',
    'glm-4.5': 'mcp__devflow-synthetic-cc-sessions__synthetic_auto'
  };

  return agentMapping[agentName] || null;
}

module.exports = {
  preToolUseHook,
  // Export for testing
  estimateTaskSize,
  mapAgentToTool,
  callOrchestrator
};
