/*
 * Intelligent Task Router Hook for Claude Code DevFlow
 * Automatically routes coding tasks to specialized CLI agents based on task analysis
 */

const path = require('path');
const fs = require('fs');

// Configuration
const CONFIG = {
  TIMEOUT_THRESHOLD: parseInt(process.env.TASK_ROUTER_TIMEOUT || '30000'),
  LINE_THRESHOLD: parseInt(process.env.TASK_ROUTER_LINE_THRESHOLD || '100'),
  ENABLE_LOGGING: process.env.TASK_ROUTER_LOGGING !== 'false',
  METRICS_FILE: process.env.TASK_ROUTER_METRICS_FILE || '.claude/logs/routing-metrics.json'
};

// Fallback mappings
const FALLBACK_MAPPINGS = {
  'codex': 'mcp__devflow-synthetic-cc-sessions__synthetic_code',
  'gemini': 'mcp__devflow-synthetic-cc-sessions__synthetic_reasoning',
  'qwen': 'mcp__devflow-synthetic-cc-sessions__synthetic_auto'
};

// Specialized agent mappings
const AGENT_MAPPINGS = {
  'codex': ['implementation', 'refactoring', 'debugging', 'standard libraries'],
  'gemini': ['analytics', 'context analysis', 'complex reasoning', 'data processing'],
  'qwen': ['specialized code', 'performance optimization', 'algorithms', 'low-level']
};

// Task type classifiers
const TYPE_CLASSIFIERS = {
  frontend: ['react', 'vue', 'angular', 'html', 'css', 'javascript', 'typescript', 'ui', 'component'],
  backend: ['node', 'express', 'python', 'django', 'flask', 'api', 'server', 'database'],
  ai: ['machine learning', 'neural network', 'tensorflow', 'pytorch', 'model', 'nlp'],
  database: ['sql', 'mongodb', 'postgresql', 'mysql', 'redis', 'query'],
  mobile: ['react native', 'flutter', 'android', 'ios', 'mobile', 'swift', 'kotlin']
};

// Circuit breaker pattern
const circuitBreaker = {
  failures: {},
  threshold: 5,
  timeout: 60000,
  
  recordFailure(agent) {
    if (!this.failures[agent]) {
      this.failures[agent] = { count: 1, lastFailure: Date.now() };
    } else {
      this.failures[agent].count++;
      this.failures[agent].lastFailure = Date.now();
    }
  },
  
  isAvailable(agent) {
    const failure = this.failures[agent];
    if (!failure) return true;
    
    // Reset if timeout has passed
    if (Date.now() - failure.lastFailure > this.timeout) {
      delete this.failures[agent];
      return true;
    }
    
    return failure.count < this.threshold;
  }
};

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
    fs.writeFileSync(CONFIG.METRICS_FILE, JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.error('[TaskRouter] Failed to save metrics:', error);
  }
}

// Estimate lines of code needed
function estimateLinesOfCode(taskDescription) {
  // Simple heuristic: estimate based on task complexity keywords
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
  const lineMatch = description.match(/(\d+) lines?/);
  if (lineMatch) {
    return parseInt(lineMatch[1]);
  }
  
  // Check complexity indicators
  const hasComplex = complexityKeywords.some(keyword => description.includes(keyword));
  const hasSimple = simpleKeywords.some(keyword => description.includes(keyword));
  
  if (hasComplex) return 150;
  if (hasSimple) return 30;
  
  // Default estimation
  return 75;
}

// Classify task type
function classifyTaskType(taskDescription) {
  const description = taskDescription.toLowerCase();
  
  for (const [type, keywords] of Object.entries(TYPE_CLASSIFIERS)) {
    if (keywords.some(keyword => description.includes(keyword))) {
      return type;
    }
  }
  
  return 'general';
}

// Select best CLI agent
function selectBestAgent(taskDescription, taskType) {
  const description = taskDescription.toLowerCase();
  
  // Check for explicit agent preferences
  for (const [agent, keywords] of Object.entries(AGENT_MAPPINGS)) {
    if (keywords.some(keyword => description.includes(keyword))) {
      return agent;
    }
  }
  
  // Default routing based on task type
  const routingMap = {
    frontend: 'codex',
    backend: 'codex',
    ai: 'qwen',
    database: 'codex',
    mobile: 'codex',
    general: 'codex'
  };
  
  return routingMap[taskType] || 'codex';
}

// Apply circuit breaker
function applyCircuitBreaker(selectedAgent) {
  if (circuitBreaker.isAvailable(selectedAgent)) {
    return selectedAgent;
  }
  
  // Fallback to another agent
  const fallbackAgents = Object.keys(AGENT_MAPPINGS).filter(agent => agent !== selectedAgent);
  for (const agent of fallbackAgents) {
    if (circuitBreaker.isAvailable(agent)) {
      return agent;
    }
  }
  
  return selectedAgent; // If all circuits are open, use original
}

// Execute with timeout and fallback
async function executeWithTimeout(agent, task, timeout) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      circuitBreaker.recordFailure(agent);
      const fallbackAgent = FALLBACK_MAPPINGS[agent] || agent;
      
      logRoutingDecision({
        event: 'timeout',
        originalAgent: agent,
        fallbackAgent: fallbackAgent,
        task: task.description.substring(0, 100) + '...'
      });
      
      resolve({
        agent: fallbackAgent,
        isFallback: true
      });
    }, timeout);
    
    // Simulate actual execution (in real implementation, this would call the CLI)
    setTimeout(() => {
      clearTimeout(timer);
      resolve({
        agent: agent,
        isFallback: false
      });
    }, Math.random() * timeout / 2); // Simulate completion
  });
}

// Main hook function
async function preToolUseHook(toolCall) {
  try {
    // Only intercept MCP CLI agents for coding tasks
    const cliAgents = ['mcp__codex-cli__', 'mcp__gemini-cli__', 'mcp__qwen-code__'];
    const isCodingTask = cliAgents.some(agent => toolCall.name.startsWith(agent));

    if (!isCodingTask) {
      return toolCall; // Pass through non-coding tools
    }
    
    const taskDescription = toolCall.arguments.description || 
                           toolCall.arguments.task || 
                           JSON.stringify(toolCall.arguments);
    
    // 1. Size estimation
    const estimatedLines = estimateLinesOfCode(taskDescription);
    
    // If small task, let Claude handle it directly
    if (estimatedLines < CONFIG.LINE_THRESHOLD) {
      logRoutingDecision({
        event: 'direct_execution',
        reason: 'small_task',
        lines: estimatedLines,
        task: taskDescription.substring(0, 100) + '...'
      });
      return toolCall; // Pass through
    }
    
    // 2. Type classification
    const taskType = classifyTaskType(taskDescription);
    
    // 3. CLI selection
    let selectedAgent = selectBestAgent(taskDescription, taskType);
    
    // 4. Apply circuit breaker
    selectedAgent = applyCircuitBreaker(selectedAgent);
    
    // 5. Log decision
    logRoutingDecision({
      event: 'routing_decision',
      originalAgent: toolCall.name,
      selectedAgent: selectedAgent,
      taskType: taskType,
      lines: estimatedLines,
      task: taskDescription.substring(0, 100) + '...'
    });
    
    // 6. Execute with timeout monitoring
    const executionResult = await executeWithTimeout(selectedAgent, {
      description: taskDescription,
      type: taskType
    }, CONFIG.TIMEOUT_THRESHOLD);
    
    // 7. Modify tool call if needed
    if (executionResult.isFallback || executionResult.agent !== toolCall.name) {
      return {
        ...toolCall,
        name: executionResult.agent,
        arguments: {
          ...toolCall.arguments,
          routedFrom: toolCall.name,
          routingReason: executionResult.isFallback ? 'timeout' : 'specialization'
        }
      };
    }
    
    return toolCall; // No modification needed
    
  } catch (error) {
    console.error('[TaskRouter] Error in pre-tool-use hook:', error);
    return toolCall; // Fail open - let original tool execute
  }
}

module.exports = {
  preToolUseHook,
  // Export for testing
  estimateLinesOfCode,
  classifyTaskType,
  selectBestAgent,
  applyCircuitBreaker
};
