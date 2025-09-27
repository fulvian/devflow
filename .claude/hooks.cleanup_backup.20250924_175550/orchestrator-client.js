#!/usr/bin/env node

const http = require('http');

const ORCHESTRATOR_CONFIG = {
  host: 'localhost',
  port: 3005,
  path: '/api/tasks'
};

async function callUnifiedOrchestrator(toolCall, lineCount) {
  const taskData = {
    taskId: `DEVFLOW-AUTO-${Date.now()}`,
    source: 'line-enforcement-hook',
    originalTool: toolCall.function.name,
    parameters: toolCall.function.parameters,
    metadata: {
      lineCount,
      reason: 'Exceeded 100-line limit',
      timestamp: new Date().toISOString()
    }
  };

  const postData = JSON.stringify(taskData);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: ORCHESTRATOR_CONFIG.host,
      port: ORCHESTRATOR_CONFIG.port,
      path: ORCHESTRATOR_CONFIG.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            success: res.statusCode === 200,
            status: res.statusCode,
            data: result
          });
        } catch (error) {
          resolve({
            success: false,
            error: error.message,
            rawData: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Orchestrator connection failed: ${error.message}`));
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Orchestrator request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

module.exports = { callUnifiedOrchestrator };