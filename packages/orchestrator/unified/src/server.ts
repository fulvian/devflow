/**
 * DevFlow Unified Orchestrator Server
 * Entry point che integra tutti i componenti dell'orchestratore unificato
 *
 * MODALITÀ: claude-only (no synthetic agents)
 * FASE: Deployment Fase 1 - Sistema unificato base
 */

import { config } from 'dotenv';
import { resolve, join } from 'path';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from project root .env file
config({ path: resolve(process.cwd(), '../../../.env') });

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Import dei componenti core
import { UnifiedOrchestrator } from './core/unified-orchestrator.js';
import { IntelligentRoutingSystem, Platform, TaskType, TaskComplexity } from './routing/intelligent-router.js';
import { CrossPlatformHandoffSystem, PlatformType } from './handoff/cross-platform-handoff.js';
import { OperationalModesManager, ModeCommandInterface } from './modes/operational-modes-manager.js';
import { MCPFallbackSystem, MCPToolCall, MCPResponse } from './fallback/mcp-fallback-system.js';
import { OAuthCredentialManager } from './auth/oauth-credential-manager.js';
import agentsRealtimeRouter from './routes/agents-realtime.js';

// Configurazione server
const PORT = process.env.ORCHESTRATOR_PORT || 3005;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Inizializzazione componenti
const app = express();
const server = createServer(app);

// Inizializzazione Socket.IO per eventi real-time
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Core orchestrator instances
const unifiedOrchestrator = new UnifiedOrchestrator();
const intelligentRouter = new IntelligentRoutingSystem();
const handoffSystem = new CrossPlatformHandoffSystem();
const modesManager = new OperationalModesManager();
const modeInterface = new ModeCommandInterface(modesManager);

// MCP Fallback System with proper CLI → Synthetic mapping
const mcpFallbackSystem = new MCPFallbackSystem();

// OAuth Credential Manager for CLI agents
const oauthManager = new OAuthCredentialManager();

// Middleware base
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount agent realtime status routes
app.use('/api/agents', agentsRealtimeRouter);

// Logging middleware semplice
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// DIRECT CLI API CALLS - OAuth-based direct calls to CLI services
async function callQwenCLIDirect(prompt: string, startTime: number): Promise<MCPResponse> {
  const https = await import('https');
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  try {
    // Load Qwen OAuth credentials
    const qwenCredsPath = path.resolve(os.homedir(), '.qwen', 'oauth_creds.json');

    if (!await fs.promises.access(qwenCredsPath).then(() => true).catch(() => false)) {
      return {
        success: false,
        error: 'Qwen OAuth credentials not found. Please run `qwen` CLI and complete OAuth setup.',
        executionTime: Date.now() - startTime
      };
    }

    const qwenCreds = JSON.parse(await fs.promises.readFile(qwenCredsPath, 'utf8'));

    console.log(`[DIRECT-CLI] Calling Qwen API directly`);

    const payload = {
      model: 'qwen-coder',
      input: {
        messages: [{ role: 'user', content: prompt }]
      },
      parameters: {
        result_format: 'message'
      }
    };

    const postData = JSON.stringify(payload);
    const url = new URL('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/text-generation/generation');

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${qwenCreds.access_token}`,
        'User-Agent': 'DevFlow-Unified-Orchestrator/1.0'
      },
      timeout: 20000 // 20 second timeout for CLI calls
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            const executionTime = Date.now() - startTime;

            console.log(`[DIRECT-CLI] Qwen call completed in ${executionTime}ms`);

            if (result.output && result.output.choices && result.output.choices[0]) {
              resolve({
                success: true,
                result: result.output.choices[0].message.content,
                executionTime: executionTime,
                metadata: {
                  directCLI: true,
                  provider: 'qwen-oauth',
                  model: 'qwen-coder'
                }
              });
            } else {
              resolve({
                success: false,
                error: result.message || 'No valid response from Qwen API',
                executionTime: executionTime
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse Qwen API response: ${parseError.message}`,
              executionTime: Date.now() - startTime
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: `Qwen API request failed: ${error.message}`,
          executionTime: Date.now() - startTime
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Qwen API request timeout after 20 seconds',
          executionTime: Date.now() - startTime
        });
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    return {
      success: false,
      error: `Qwen CLI direct call error: ${error.message}`,
      executionTime: Date.now() - startTime
    };
  }
}

async function callGeminiCLIDirect(prompt: string, startTime: number): Promise<MCPResponse> {
  const https = await import('https');
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  try {
    // Load Gemini OAuth settings
    const geminiSettingsPath = path.resolve(os.homedir(), '.gemini', 'settings.json');

    if (!await fs.promises.access(geminiSettingsPath).then(() => true).catch(() => false)) {
      return {
        success: false,
        error: 'Gemini CLI not configured. Please run `gemini` CLI and complete OAuth setup.',
        executionTime: Date.now() - startTime
      };
    }

    // Load Gemini OAuth credentials from CLI setup
    const geminiSettings = JSON.parse(await fs.promises.readFile(geminiSettingsPath, 'utf8'));

    if (geminiSettings.selectedAuthType !== 'oauth-personal') {
      return {
        success: false,
        error: 'Gemini CLI must be configured with oauth-personal authentication',
        executionTime: Date.now() - startTime
      };
    }

    // Look for OAuth token files created by Gemini CLI
    const geminiTokenPath = path.resolve(os.homedir(), '.gemini', 'oauth_token.json');

    if (!await fs.promises.access(geminiTokenPath).then(() => true).catch(() => false)) {
      return {
        success: false,
        error: 'Gemini OAuth token not found. Please re-authenticate with `gemini` CLI',
        executionTime: Date.now() - startTime
      };
    }

    const geminiToken = JSON.parse(await fs.promises.readFile(geminiTokenPath, 'utf8'));

    console.log(`[DIRECT-CLI] Calling Gemini API with OAuth token`);

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    const postData = JSON.stringify(payload);
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent');

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${geminiToken.access_token}`,
        'User-Agent': 'DevFlow-Unified-Orchestrator/1.0'
      },
      timeout: 20000 // 20 second timeout for CLI calls
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            const executionTime = Date.now() - startTime;

            console.log(`[DIRECT-CLI] Gemini call completed in ${executionTime}ms`);

            if (result.candidates && result.candidates[0] && result.candidates[0].content) {
              resolve({
                success: true,
                result: result.candidates[0].content.parts[0].text,
                executionTime: executionTime,
                metadata: {
                  directCLI: true,
                  provider: 'gemini-oauth',
                  model: 'gemini-pro'
                }
              });
            } else {
              resolve({
                success: false,
                error: result.error?.message || 'No valid response from Gemini API',
                executionTime: executionTime
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse Gemini API response: ${parseError.message}`,
              executionTime: Date.now() - startTime
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: `Gemini API request failed: ${error.message}`,
          executionTime: Date.now() - startTime
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Gemini API request timeout after 20 seconds',
          executionTime: Date.now() - startTime
        });
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    return {
      success: false,
      error: `Gemini CLI direct call error: ${error.message}`,
      executionTime: Date.now() - startTime
    };
  }
}

// GPT-5 Model Selection for Codex CLI based on task complexity
function selectGPT5ModelForCodex(prompt: string): { model: string, reasoning: string } {
  const lowerPrompt = prompt.toLowerCase();

  // Massive/Important Coding Tasks - GPT-5-Codex High
  const massiveCodingKeywords = [
    'framework', 'architecture', 'system', 'infrastructure', 'database',
    'api design', 'microservices', 'complex algorithm', 'performance optimization',
    'scalability', 'security implementation', 'full stack', 'enterprise',
    'integration', 'deployment', 'ci/cd', 'massive', 'large scale', 'production'
  ];

  // Reasoning Tasks - GPT-5 High
  const reasoningKeywords = [
    'explain', 'analyze', 'why', 'how does', 'compare', 'evaluate',
    'strategy', 'approach', 'best practice', 'review', 'assess',
    'troubleshoot', 'debug logic', 'optimization strategy', 'design pattern'
  ];

  // Check for massive coding tasks
  if (massiveCodingKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    return {
      model: 'gpt-5-codex-high',
      reasoning: 'Massive/important coding task detected - using GPT-5-Codex High for maximum code quality'
    };
  }

  // Check for reasoning tasks
  if (reasoningKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    return {
      model: 'gpt-5-high',
      reasoning: 'Reasoning task detected - using GPT-5 High for deep analysis'
    };
  }

  // Default to ordinary coding - GPT-5-Codex Medium
  return {
    model: 'gpt-5-codex-medium',
    reasoning: 'Standard coding task - using GPT-5-Codex Medium for balanced performance'
  };
}

async function callCodexCLIDirect(prompt: string, startTime: number): Promise<MCPResponse> {
  try {
    // Select optimal GPT-5 model based on task type (for logging purposes)
    const modelSelection = selectGPT5ModelForCodex(prompt);
    console.log(`[OAUTH-CLI] ${modelSelection.reasoning}`);
    console.log(`[OAUTH-CLI] Using model: ${modelSelection.model}`);

    // Check if we have valid credentials
    const validation = oauthManager.validateCredentials('codex');

    if (!validation.isValid) {
      // Fallback to original implementation if OAuth credentials not valid
      console.log(`[OAUTH-CLI] OAuth credentials not valid, falling back to legacy auth`);
      return await callCodexCLIDirectLegacy(prompt, startTime);
    }

    console.log(`[OAUTH-CLI] Using OAuth credentials for ChatGPT Plus API call`);

    const payload = {
      model: modelSelection.model,
      messages: [
        {
          role: 'system',
          content: modelSelection.model.includes('codex') ?
            'You are an expert code assistant. Generate high-quality, well-commented code based on user requests.' :
            'You are an expert reasoning assistant. Provide deep analysis and thoughtful explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: modelSelection.model.includes('codex') ? 0.1 : 0.3,
      max_tokens: modelSelection.model.includes('high') ? 8000 : 4000
    };

    // Get authenticated HTTP client
    const httpClient = oauthManager.getHttpClient('codex');

    // Make authenticated API call
    const response = await httpClient.post('/chat/completions', payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DevFlow-Unified-Orchestrator/1.0'
      }
    });

    const executionTime = Date.now() - startTime;
    console.log(`[OAUTH-CLI] Codex call completed in ${executionTime}ms using ${modelSelection.model}`);

    if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      return {
        success: true,
        result: response.data.choices[0].message.content,
        executionTime: executionTime,
        metadata: {
          directCLI: true,
          provider: 'openai-oauth-api',
          model: modelSelection.model,
          modelReasoning: modelSelection.reasoning,
          usage: response.data.usage,
          authMethod: 'oauth-manager'
        }
      };
    } else {
      return {
        success: false,
        error: response.data.error?.message || 'No valid response from OpenAI API',
        executionTime: executionTime
      };
    }

  } catch (error) {
    console.error(`[OAUTH-CLI] OAuth call failed:`, error);

    // Fallback to legacy implementation
    console.log(`[OAUTH-CLI] Falling back to legacy authentication`);
    return await callCodexCLIDirectLegacy(prompt, startTime);
  }
}

// Legacy implementation as fallback
async function callCodexCLIDirectLegacy(prompt: string, startTime: number): Promise<MCPResponse> {
  const https = await import('https');
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  try {
    // Select optimal GPT-5 model based on task type (for logging purposes)
    const modelSelection = selectGPT5ModelForCodex(prompt);
    console.log(`[LEGACY-CLI] ${modelSelection.reasoning}`);
    console.log(`[LEGACY-CLI] Would use model: ${modelSelection.model}`);

    // Load Codex CLI OAuth credentials from ChatGPT Plus personal account
    const codexAuthPath = path.resolve(os.homedir(), '.codex', 'auth.json');

    if (!await fs.promises.access(codexAuthPath).then(() => true).catch(() => false)) {
      return {
        success: false,
        error: 'Codex CLI not configured. Please run `codex login` with ChatGPT Plus personal account',
        executionTime: Date.now() - startTime,
        metadata: {
          selectedModel: modelSelection.model,
          modelReasoning: modelSelection.reasoning,
          authStatus: 'not_configured',
          authMethod: 'legacy-fallback'
        }
      };
    }

    const codexAuth = JSON.parse(await fs.promises.readFile(codexAuthPath, 'utf8'));

    if (!codexAuth.tokens || !codexAuth.tokens.access_token) {
      return {
        success: false,
        error: 'Codex CLI OAuth token not found. Please re-authenticate with `codex login`',
        executionTime: Date.now() - startTime
      };
    }

    console.log(`[LEGACY-CLI] Calling Codex API with legacy token using ${modelSelection.model}`);

    const payload = {
      model: modelSelection.model,
      messages: [
        {
          role: 'system',
          content: modelSelection.model.includes('codex') ?
            'You are an expert code assistant. Generate high-quality, well-commented code based on user requests.' :
            'You are an expert reasoning assistant. Provide deep analysis and thoughtful explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: modelSelection.model.includes('codex') ? 0.1 : 0.3,
      max_tokens: modelSelection.model.includes('high') ? 8000 : 4000
    };

    const postData = JSON.stringify(payload);
    const url = new URL('https://api.openai.com/v1/chat/completions');

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${codexAuth.tokens.access_token}`,
        'User-Agent': 'DevFlow-Unified-Orchestrator/1.0'
      },
      timeout: 20000 // 20 second timeout for CLI calls
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            const executionTime = Date.now() - startTime;

            console.log(`[LEGACY-CLI] Codex call completed in ${executionTime}ms using ${modelSelection.model}`);

            if (result.choices && result.choices[0] && result.choices[0].message) {
              resolve({
                success: true,
                result: result.choices[0].message.content,
                executionTime: executionTime,
                metadata: {
                  directCLI: true,
                  provider: 'openai-legacy-api',
                  model: modelSelection.model,
                  modelReasoning: modelSelection.reasoning,
                  usage: result.usage,
                  authMethod: 'legacy-fallback'
                }
              });
            } else {
              resolve({
                success: false,
                error: result.error?.message || 'No valid response from OpenAI API',
                executionTime: executionTime
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse OpenAI API response: ${parseError.message}`,
              executionTime: Date.now() - startTime
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: `OpenAI API request failed: ${error.message}`,
          executionTime: Date.now() - startTime
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'OpenAI API request timeout after 20 seconds',
          executionTime: Date.now() - startTime
        });
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    return {
      success: false,
      error: `Codex CLI direct call error: ${error.message}`,
      executionTime: Date.now() - startTime
    };
  }
}

// DIRECT SYNTHETIC API CALL - Bypass MCP bridge for performance
async function callSyntheticAPIDirect(call: MCPToolCall, startTime: number): Promise<MCPResponse> {
  const https = await import('https');

  try {
    // Extract tool name from full MCP tool name
    const toolMatch = call.tool.match(/mcp__devflow-synthetic-cc-sessions__synthetic_(.+)$/);
    if (!toolMatch) {
      return {
        success: false,
        error: `Invalid synthetic tool name format: ${call.tool}`,
        executionTime: Date.now() - startTime
      };
    }

    const syntheticTool = toolMatch[1]; // 'auto', 'code', 'code_to_file', etc.

    // Load API configuration from environment
    const SYNTHETIC_API_KEY = process.env.SYNTHETIC_API_KEY;
    const SYNTHETIC_BASE_URL = process.env.SYNTHETIC_BASE_URL || 'https://api.synthetic.new/v1';

    if (!SYNTHETIC_API_KEY) {
      return {
        success: false,
        error: 'SYNTHETIC_API_KEY environment variable not configured',
        executionTime: Date.now() - startTime
      };
    }

    console.log(`[DIRECT-API] Calling synthetic.new directly: ${syntheticTool}`);

    // Prepare API endpoint and payload based on tool
    let endpoint: string;
    let payload: any = call.parameters;

    switch (syntheticTool) {
      case 'auto':
        endpoint = '/tasks/autonomous';
        break;
      case 'code':
        endpoint = '/code/generate';
        break;
      case 'code_to_file':
        endpoint = '/code/generate-to-file';
        break;
      case 'reasoning':
        endpoint = '/tasks/reasoning';
        break;
      case 'context':
        endpoint = '/tasks/context-analysis';
        break;
      default:
        return {
          success: false,
          error: `Unknown synthetic tool: ${syntheticTool}`,
          executionTime: Date.now() - startTime
        };
    }

    // Make direct HTTPS request to synthetic.new API
    const postData = JSON.stringify(payload);
    const url = new URL(endpoint, SYNTHETIC_BASE_URL);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${SYNTHETIC_API_KEY}`,
        'User-Agent': 'DevFlow-Unified-Orchestrator/1.0',
        'X-Source': 'unified-orchestrator'
      },
      timeout: 45000 // 45 second timeout for synthetic calls
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);
            const executionTime = Date.now() - startTime;

            console.log(`[DIRECT-API] Synthetic call completed in ${executionTime}ms`);

            resolve({
              success: result.success !== false,
              result: result.result || result.content || result.response,
              error: result.error || undefined,
              executionTime: executionTime,
              metadata: {
                directAPI: true,
                toolUsed: call.tool,
                apiEndpoint: endpoint,
                ...result.metadata
              }
            });
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse synthetic API response: ${parseError.message}`,
              executionTime: Date.now() - startTime,
              metadata: {
                directAPI: true,
                rawResponse: responseData.substring(0, 500) // First 500 chars for debugging
              }
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: `Synthetic API request failed: ${error.message}`,
          executionTime: Date.now() - startTime,
          metadata: {
            directAPI: true,
            networkError: true
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Synthetic API request timeout after 45 seconds',
          executionTime: Date.now() - startTime,
          metadata: {
            directAPI: true,
            timeout: true
          }
        });
      });

      req.write(postData);
      req.end();
    });

  } catch (error) {
    return {
      success: false,
      error: `Direct API call error: ${error.message}`,
      executionTime: Date.now() - startTime,
      metadata: {
        directAPI: true,
        internalError: true
      }
    };
  }
}

// REAL MCP call function using Bridge Executor - Architecture v1.0 Compliant
async function callMCPTool(call: MCPToolCall): Promise<MCPResponse> {
  const startTime = Date.now();

  try {
    // Validate tool name
    if (!call.tool) {
      return {
        success: false,
        error: 'Tool name is undefined or empty',
        executionTime: Date.now() - startTime
      };
    }

    console.log(`[MCP-REAL] Executing real tool: ${call.tool}`);
    console.log(`[MCP-REAL] Parameters:`, JSON.stringify(call.parameters, null, 2));

    // DIRECT API: Check if this is a synthetic tool - call directly to synthetic.new API
    if (call.tool.includes('mcp__devflow-synthetic-cc-sessions__')) {
      return await callSyntheticAPIDirect(call, startTime);
    }

    // DIRECT CLI: Check if this is a CLI tool - call directly to respective APIs
    if (call.tool.includes('mcp__qwen-code__ask-qwen')) {
      const prompt = call.parameters.prompt || call.parameters.request || 'Execute task';
      return await callQwenCLIDirect(prompt, startTime);
    }

    if (call.tool.includes('mcp__gemini-cli__ask-gemini')) {
      const prompt = call.parameters.prompt || call.parameters.request || 'Execute task';
      return await callGeminiCLIDirect(prompt, startTime);
    }

    if (call.tool.includes('mcp__codex-cli__codex')) {
      const prompt = call.parameters.prompt || call.parameters.request || 'Execute task';
      return await callCodexCLIDirect(prompt, startTime);
    }

    // BRIDGE MCP: For any other tools, use existing bridge system
    // Path to the MCP Bridge Executor
    const bridgeExecutorPath = process.env.DEVFLOW_PROJECT_ROOT
      ? `${process.env.DEVFLOW_PROJECT_ROOT}/tools/mcp-bridge-executor.js`
      : '../../../tools/mcp-bridge-executor.js'; // Fix relative path from packages/orchestrator/unified

    // Import required modules dynamically
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const fs = await import('fs');

    // Prepare parameters for bridge executor
    const parametersJson = JSON.stringify(call.parameters);

    // Execute bridge with timeout
    const executeWithTimeout = async (timeout: number = 30000): Promise<MCPResponse> => {
      return new Promise((resolve, reject) => {
        const bridgeProcess = spawn('node', [bridgeExecutorPath, call.tool, parametersJson], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: timeout
        });

        let stdout = '';
        let stderr = '';

        bridgeProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        bridgeProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        bridgeProcess.on('close', (code) => {
          try {
            if (code === 0 && stdout.trim()) {
              // Parse the JSON response from bridge executor
              const result = JSON.parse(stdout.trim());
              resolve({
                success: result.success || false,
                result: result.result || result.error || 'No result',
                error: result.success ? undefined : (result.error || 'Unknown error'),
                executionTime: Date.now() - startTime,
                metadata: {
                  bridgeExecutor: true,
                  toolType: result.toolType || 'unknown',
                  taskId: result.taskId || undefined,
                  authRequired: result.authRequired || false
                }
              });
            } else {
              resolve({
                success: false,
                error: `Bridge executor failed with code ${code}. stderr: ${stderr}`,
                executionTime: Date.now() - startTime
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse bridge response: ${parseError.message}. Raw output: ${stdout}`,
              executionTime: Date.now() - startTime
            });
          }
        });

        bridgeProcess.on('error', (error) => {
          reject(new Error(`Bridge executor spawn error: ${error.message}`));
        });

        // Handle timeout
        setTimeout(() => {
          bridgeProcess.kill('SIGTERM');
          resolve({
            success: false,
            error: `Tool execution timeout after ${timeout}ms`,
            executionTime: Date.now() - startTime
          });
        }, timeout);
      });
    };

    // Execute with dynamic timeout based on tool type
    const timeout = (call.tool && call.tool.includes('synthetic')) ? 45000 : 30000; // Synthetic tools get more time
    const result = await executeWithTimeout(timeout);

    console.log(`[MCP-REAL] Tool ${call.tool} completed:`, {
      success: result.success,
      executionTime: result.executionTime,
      hasError: !!result.error
    });

    return result;

  } catch (error) {
    console.error(`[MCP-REAL] Error executing ${call.tool}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTime: Date.now() - startTime
    };
  }
}

// Initialize MCP Fallback System and agents
function initializeMCPFallbackSystem() {
  // Configure MCP fallback system with MCP call function
  mcpFallbackSystem.setMCPCallFunction(callMCPTool);

  // Set initial operational mode (sync with modes manager)
  mcpFallbackSystem.setOperationalMode(modeInterface.getCurrentMode());

  // Initialize OAuth credential manager with Codex configuration
  initializeOAuthManager();
}

// Initialize OAuth Manager with agent configurations
function initializeOAuthManager() {
  try {
    // Configure Codex CLI for ChatGPT Plus OAuth
    oauthManager.registerAgent('codex', {
      clientId: process.env.CODEX_CLIENT_ID || 'codex-cli-client',
      clientSecret: process.env.CODEX_CLIENT_SECRET || '',
      redirectUri: process.env.CODEX_REDIRECT_URI || 'http://localhost:8080/callback',
      tokenEndpoint: 'https://api.openai.com/v1/oauth/token',
      authEndpoint: 'https://api.openai.com/v1/oauth/authorize',
      apiBaseURL: 'https://api.openai.com/v1',
      scopes: ['api.read', 'api.write', 'chat.completions']
    });

    console.log('✅ OAuth Manager initialized for Codex CLI');
  } catch (error) {
    console.warn('⚠️  OAuth Manager initialization failed, using legacy auth:', error.message);
  }

  // Register CLI and Synthetic agents in the modes manager
  // CLI Agents
  modesManager.registerAgent({
    id: 'codex-cli',
    name: 'Codex CLI',
    capabilities: ['code', 'reasoning', 'tools', 'heavy-computation'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 2000,
      errorRate: 0.3
    },
    isActive: true
  });

  modesManager.registerAgent({
    id: 'gemini-cli',
    name: 'Gemini CLI',
    capabilities: ['frontend', 'refactoring', 'analysis', 'creative'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 1500,
      errorRate: 0.2
    },
    isActive: true
  });

  modesManager.registerAgent({
    id: 'qwen-cli',
    name: 'Qwen CLI',
    capabilities: ['backend', 'automation', 'fast-patching', 'generation'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 1000,
      errorRate: 0.1
    },
    isActive: true
  });

  // Synthetic Fallback Agents
  modesManager.registerAgent({
    id: 'qwen3-coder',
    name: 'Qwen3 Coder (Synthetic)',
    capabilities: ['code', 'reasoning', 'tools', 'heavy-computation'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 3000,
      errorRate: 0.05
    },
    isActive: true
  });

  modesManager.registerAgent({
    id: 'kimi-k2',
    name: 'Kimi K2 (Synthetic)',
    capabilities: ['frontend', 'refactoring', 'robust-processing'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 2500,
      errorRate: 0.05
    },
    isActive: true
  });

  modesManager.registerAgent({
    id: 'glm-4.5',
    name: 'GLM 4.5 (Synthetic)',
    capabilities: ['backend', 'automation', 'fast-patching'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 2000,
      errorRate: 0.05
    },
    isActive: true
  });

  // Claude as supreme orchestrator and emergency fallback
  modesManager.registerAgent({
    id: 'claude-sonnet',
    name: 'Claude Sonnet (Supreme Orchestrator)',
    capabilities: ['reasoning', 'analysis', 'code', 'creative', 'emergency', 'orchestration'],
    performanceMetrics: {
      tasksCompleted: 0,
      avgResponseTime: 1200,
      errorRate: 0.01
    },
    isActive: true
  });

  console.log('✅ MCP Fallback System initialized with CLI → Synthetic mapping');
  console.log('✅ Agents registered:', {
    cli: ['codex-cli', 'gemini-cli', 'qwen-cli'],
    synthetic: ['qwen3-coder', 'kimi-k2', 'glm-4.5'],
    orchestrator: ['claude-sonnet']
  });
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const systemHealth = unifiedOrchestrator.getSystemHealth();
    const taskStats = unifiedOrchestrator.getTaskStats();
    const modeStatus = modeInterface.getStatus();

    res.json({
      status: systemHealth.overallStatus,
      timestamp: Date.now(),
      system: systemHealth,
      tasks: taskStats,
      mode: modeStatus,
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: Date.now(),
      error: 'Health check failed'
    });
  }
});

// Mode management endpoints
app.get('/api/mode', (req, res) => {
  try {
    const status = modeInterface.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/mode/:modeName', (req, res) => {
  try {
    const { modeName } = req.params;
    const result = modeInterface.changeMode(modeName as any);

    // Context7 Pattern: Event-based notification trigger on mode change
    if (result.success) {
      // Trigger footer refresh immediately using Context7 node-notifier pattern
      const rootDir = resolve(process.cwd(), '../../../');
      const footerScript = join(rootDir, '.claude/cometa-footer.sh');
      exec(footerScript, {
        timeout: 5000,
        cwd: rootDir
      }, (error, stdout, stderr) => {
        if (error) {
          console.log(`[Footer] Refresh failed: ${error.message}`);
        } else {
          console.log(`[Footer] Refreshed on mode change: ${modeName}`);
        }
      });
    }

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Endpoint specifico dell'architettura: /mode/switch/:mode
app.post('/mode/switch/:mode', (req, res) => {
  try {
    const { mode } = req.params;
    const previousMode = modeInterface.getCurrentMode();
    const result = modeInterface.changeMode(mode as any);

    // Sync operational mode with MCP fallback system
    if (result.success) {
      mcpFallbackSystem.setOperationalMode(mode as any);
      console.log(`[MCP] Fallback system mode synchronized to: ${mode}`);

      // Context7 Pattern: Event-based notification trigger on mode change
      const rootDir = resolve(process.cwd(), '../../../');
      const footerScript = join(rootDir, '.claude/cometa-footer.sh');
      exec(footerScript, {
        timeout: 5000,
        cwd: rootDir
      }, (error, stdout, stderr) => {
        if (error) {
          console.log(`[Footer] Refresh failed: ${error.message}`);
        } else {
          console.log(`[Footer] Refreshed on mode change: ${mode}`);
        }
      });
    }

    // Log mode change per audit trail
    console.log(`[AUDIT] Mode switched from ${previousMode} to ${mode} at ${new Date().toISOString()}`);

    // Get fallback configuration for the new mode
    const fallbackConfig = mcpFallbackSystem.getConfiguration();

    // Emit WebSocket event per modeChange
    io.emit('modeChange', {
      from: previousMode,
      to: mode,
      timestamp: new Date().toISOString(),
      success: result.success,
      fallbackChains: fallbackConfig.fallbackChains[mode as keyof typeof fallbackConfig.fallbackChains]
    });

    res.json({
      success: result.success,
      message: result.message,
      previousMode,
      newMode: mode,
      timestamp: new Date().toISOString(),
      fallbackConfiguration: {
        operationalMode: mode,
        fallbackChain: fallbackConfig.fallbackChains[mode as keyof typeof fallbackConfig.fallbackChains],
        cliToSyntheticMapping: fallbackConfig.cliToSyntheticMapping
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint performance agenti specifico dell'architettura
app.get('/agents/performance', (req, res) => {
  try {
    // Ottieni performance da sistemi disponibili
    const orchestratorMetrics = unifiedOrchestrator.getMetrics();
    const systemHealth = unifiedOrchestrator.getSystemHealth();
    const modesManagerPerf = modeInterface.getStatus();

    const agentsPerformance = {
      timestamp: Date.now(),
      currentMode: modeInterface.getCurrentMode(),
      agents: {
        claude: {
          type: 'supreme_orchestrator',
          tasks_completed: modesManagerPerf.performance?.tasksProcessed || 0,
          avg_response_time: modesManagerPerf.performance?.avgProcessingTime || 0,
          success_rate: modesManagerPerf.performance?.successRate || 1.0,
          error_rate: 1 - (modesManagerPerf.performance?.successRate || 1.0)
        }
      },
      orchestratorMetrics,
      systemHealth
    };

    res.json(agentsPerformance);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve agents performance',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Task submission endpoint - uses MCP Fallback System
app.post('/api/tasks', async (req, res) => {
  try {
    const { id, type, payload, priority, description, preferredAgent } = req.body;

    const taskId = id || `task-${Date.now()}`;
    const taskType = type || 'general';
    const taskDescription = description || payload?.description || `Execute ${taskType} task`;

    console.log(`[TASK] Submitting task ${taskId} (${taskType}): ${taskDescription}`);
    console.log(`[TASK] Current mode: ${modeInterface.getCurrentMode()}, Preferred agent: ${preferredAgent || 'auto'}`);

    // Execute task using MCP fallback system with proper CLI → Synthetic fallback chains
    const fallbackResult = await mcpFallbackSystem.executeWithFallback(
      taskDescription,
      taskType,
      preferredAgent
    );

    // Update agent performance metrics if task was successful
    if (fallbackResult.success && fallbackResult.agentUsed !== 'claude-emergency') {
      modesManager.updatePerformanceMetrics(1, 0, fallbackResult.totalExecutionTime);
    } else if (!fallbackResult.success) {
      modesManager.updatePerformanceMetrics(0, 1, fallbackResult.totalExecutionTime);
    }

    // Update agent cache based on real usage (SMART CACHE UPDATE)
    if (fallbackResult.agentUsed && fallbackResult.agentUsed !== 'claude-emergency') {
      await updateAgentCacheOnUsage(fallbackResult.agentUsed, fallbackResult.success, fallbackResult.totalExecutionTime);
    }

    // Emit WebSocket event for real-time task monitoring
    io.emit('taskCompleted', {
      taskId,
      success: fallbackResult.success,
      agentUsed: fallbackResult.agentUsed,
      fallbacksUsed: fallbackResult.fallbacksUsed,
      executionTime: fallbackResult.totalExecutionTime,
      timestamp: new Date().toISOString(),
      mode: modeInterface.getCurrentMode()
    });

    // Return result in unified orchestrator format for compatibility
    res.json({
      taskId,
      platformId: fallbackResult.agentUsed,
      success: fallbackResult.success,
      result: fallbackResult.result,
      error: fallbackResult.error,
      executionTime: fallbackResult.totalExecutionTime,
      metadata: {
        type: taskType,
        operationalMode: modeInterface.getCurrentMode(),
        fallbacksUsed: fallbackResult.fallbacksUsed,
        fallbackChainActivated: fallbackResult.fallbacksUsed.length > 0
      }
    });

  } catch (error) {
    console.error('Task submission error:', error);
    res.status(500).json({
      error: 'Task submission failed',
      message: error instanceof Error ? error.message : String(error),
      taskId: req.body.id || `task-${Date.now()}`,
      success: false
    });
  }
});

// Metrics endpoint
app.get('/api/metrics', (req, res) => {
  try {
    const metrics = unifiedOrchestrator.getMetrics();
    const systemHealth = unifiedOrchestrator.getSystemHealth();

    res.json({
      performance: metrics,
      health: systemHealth,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Platforms endpoint - shows MCP agents and fallback configuration
app.get('/api/platforms', (req, res) => {
  try {
    const fallbackConfig = mcpFallbackSystem.getConfiguration();
    const agentsStatus = modesManager.getSystemStatus();

    res.json({
      operationalMode: fallbackConfig.operationalMode,
      fallbackChains: fallbackConfig.fallbackChains,
      cliToSyntheticMapping: fallbackConfig.cliToSyntheticMapping,
      agentsStatus: {
        currentMode: agentsStatus.currentMode,
        activeAgents: agentsStatus.activeAgents,
        queuedTasks: agentsStatus.queuedTasks,
        performance: agentsStatus.performance
      },
      mcpTools: {
        cli: {
          codex: 'mcp__codex-cli__codex',
          gemini: 'mcp__gemini-cli__ask-gemini',
          qwen: 'mcp__qwen-code__ask-qwen'
        },
        synthetic: {
          'qwen3-coder': 'mcp__devflow-synthetic-cc-sessions__synthetic_auto',
          'kimi-k2': 'mcp__devflow-synthetic-cc-sessions__synthetic_auto',
          'glm-4.5': 'mcp__devflow-synthetic-cc-sessions__synthetic_auto'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Smart cache-based agents status endpoint - Context7 Cachified Pattern
app.get('/api/agents/realtime-status', async (req, res) => {
  try {
    const cacheFile = path.join(process.cwd(), '.devflow', 'cache', 'agents', 'realtime-status.json');
    const forceRefresh = req.query.refresh === 'true';

    // Context7 Pattern: Check cache validity with TTL
    if (!forceRefresh && fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const cacheAge = Date.now() - (cached.cache_updated || 0);
      const maxAge = 300_000; // 5 minutes TTL

      // Serve stale cache immediately (Context7 stale-while-revalidate)
      if (cacheAge < maxAge) {
        return res.json({
          ...cached,
          cache_hit: true,
          cache_age_seconds: Math.floor(cacheAge / 1000),
          response_time_ms: 0
        });
      }
    }

    // Context7 Pattern: Initialize conservative state only once
    let result;
    const isFirstRun = !fs.existsSync(cacheFile);

    if (isFirstRun) {
      // First initialization: use real agent health monitor
      const healthMonitor = new (await import('./health/agent-health-monitor.js')).AgentHealthMonitor();
      result = await healthMonitor.getRealtimeStatus();
      console.log(`[CACHE-INIT] First run: initialized real agent cache (${result.active}/${result.total} active)`);
    } else {
      // Subsequent updates: preserve existing state, update metadata only
      const existing = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      result = {
        ...existing,
        timestamp: Date.now(),
        cache_updated: Date.now(),
        cache_hit: false,
        response_time_ms: 0
      };
      console.log('[CACHE-REFRESH] Cache refreshed, state preserved');
    }

    // Create cache directory and file
    await fs.promises.mkdir(path.dirname(cacheFile), { recursive: true });
    await fs.promises.writeFile(cacheFile, JSON.stringify(result, null, 2));

    res.json(result);
  } catch (error) {
    console.error('[CACHE-ERROR]', error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Initialize agent cache with conservative states (called only at startup or cache miss)
async function initializeAgentCache() {
  const agents = [
    {
      id: "claude-sonnet",
      name: "Claude Sonnet (Supreme Orchestrator)",
      type: "claude",
      status: "active", // Always active if server running
      last_ping: Date.now(),
      health_score: 1,
      capabilities: ["reasoning", "analysis", "code", "orchestration"]
    },
    {
      id: "qwen3-coder",
      name: "Qwen3 Coder (Synthetic)",
      type: "synthetic",
      status: "unknown", // Will be updated on first real usage
      last_ping: Date.now(),
      health_score: 0.5,
      capabilities: ["code", "reasoning", "tools"]
    },
    {
      id: "kimi-k2",
      name: "Kimi K2 (Synthetic)",
      type: "synthetic",
      status: "unknown",
      last_ping: Date.now(),
      health_score: 0.5,
      capabilities: ["frontend", "refactoring"]
    },
    {
      id: "glm-4.5",
      name: "GLM 4.5 (Synthetic)",
      type: "synthetic",
      status: "unknown",
      last_ping: Date.now(),
      health_score: 0.5,
      capabilities: ["backend", "automation"]
    },
    {
      id: "deepseek-3.1",
      name: "DeepSeek 3.1 (Synthetic)",
      type: "synthetic",
      status: "unknown",
      last_ping: Date.now(),
      health_score: 0.5,
      capabilities: ["reasoning", "complex-analysis"]
    },
    {
      id: "qwen-cli",
      name: "Qwen Code CLI",
      type: "cli",
      status: "unknown",
      last_ping: Date.now(),
      health_score: 0.5,
      capabilities: ["backend", "automation", "fast-patching"]
    },
    {
      id: "gemini-cli",
      name: "Gemini CLI",
      type: "cli",
      status: "inactive", // Known to be inactive due to OAuth issues
      last_ping: Date.now(),
      health_score: 0,
      capabilities: ["frontend", "refactoring", "analysis"]
    },
    {
      id: "codex-cli",
      name: "Codex CLI (GPT-5)",
      type: "cli",
      status: "unknown",
      last_ping: Date.now(),
      health_score: 0.5,
      capabilities: ["code", "reasoning", "tools", "heavy-computation"]
    }
  ];

  // Count active agents (only Claude is guaranteed active at startup, unknown agents count as inactive for counting)
  const activeAgents = agents.filter(a => a.status === "active").length;
  const totalAgents = agents.length;
  const healthRatio = parseFloat((activeAgents / totalAgents).toFixed(2));

  return {
    active: activeAgents,
    total: totalAgents,
    health_ratio: healthRatio,
    timestamp: Date.now(),
    agents: agents,
    cache_updated: Date.now(),
    response_time_ms: 0,
    cache_hit: false,
    schema_version: "1.0"
  };
}

// Smart cache update function - updates agent status based on real usage
async function updateAgentCacheOnUsage(agentUsed, success, executionTime) {
  try {
    const cacheFile = path.join(process.cwd(), '.devflow', 'cache', 'agents', 'realtime-status.json');

    // Read existing cache or initialize if missing
    let cacheData;
    if (fs.existsSync(cacheFile)) {
      cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    } else {
      cacheData = await initializeAgentCache();
    }

    // Map agent names to IDs for cache lookup
    const agentIdMap = {
      'qwen3-coder': 'qwen3-coder',
      'kimi-k2': 'kimi-k2',
      'glm-4.5': 'glm-4.5',
      'deepseek-3.1': 'deepseek-3.1',
      'qwen-code-cli': 'qwen-cli',
      'gemini-cli': 'gemini-cli',
      'codex-cli': 'codex-cli'
    };

    // Find agent in cache and update its status
    const agentId = agentIdMap[agentUsed] || agentUsed;
    const agentIndex = cacheData.agents.findIndex(agent => agent.id === agentId);

    if (agentIndex !== -1) {
      const agent = cacheData.agents[agentIndex];

      // Update agent status based on real usage
      if (success) {
        agent.status = "active";
        agent.last_ping = Date.now();

        // Calculate health score based on execution time (performance-based)
        if (executionTime < 2000) {
          agent.health_score = 1.0;
        } else if (executionTime < 5000) {
          agent.health_score = 0.95;
        } else if (executionTime < 10000) {
          agent.health_score = 0.9;
        } else {
          agent.health_score = 0.8;
        }

        console.log(`[CACHE-UPDATE] Agent ${agentId} marked as ACTIVE (exec: ${executionTime}ms, score: ${agent.health_score})`);
      } else {
        agent.status = "inactive";
        agent.last_ping = Date.now();
        agent.health_score = 0;
        console.log(`[CACHE-UPDATE] Agent ${agentId} marked as INACTIVE (task failed)`);
      }

      // Recalculate summary metrics
      const activeAgents = cacheData.agents.filter(a => a.status === "active").length;
      const totalAgents = cacheData.agents.length;

      cacheData.active = activeAgents;
      cacheData.total = totalAgents;
      cacheData.health_ratio = parseFloat((activeAgents / totalAgents).toFixed(2));
      cacheData.cache_updated = Date.now();
      cacheData.timestamp = Date.now();

      // Write updated cache
      await fs.promises.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));

      console.log(`[CACHE-UPDATE] Cache updated: ${activeAgents}/${totalAgents} agents active`);
    }

  } catch (error) {
    console.error('[CACHE-UPDATE] Error updating agent cache:', error);
  }
}

// Helper function for agent capabilities
function getAgentCapabilities(type) {
  const capabilities = {
    claude: ["reasoning", "analysis", "code", "orchestration"],
    synthetic: ["code", "reasoning", "tools"],
    cli: ["backend", "automation", "fast-patching"]
  };
  return capabilities[type] || [];
}

// Fallback system test endpoint
app.post('/api/test-fallback', async (req, res) => {
  try {
    const { taskDescription, preferredAgent } = req.body;

    const testTask = taskDescription || "Generate a simple hello world function in TypeScript";
    console.log(`[TEST] Testing fallback system with task: ${testTask}`);
    console.log(`[TEST] Current mode: ${modeInterface.getCurrentMode()}, Preferred agent: ${preferredAgent || 'auto'}`);

    const testResult = await mcpFallbackSystem.executeWithFallback(
      testTask,
      'code-generation',
      preferredAgent
    );

    res.json({
      testTask,
      mode: modeInterface.getCurrentMode(),
      preferredAgent: preferredAgent || 'auto',
      result: testResult,
      fallbackConfiguration: mcpFallbackSystem.getConfiguration(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Fallback test failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Routing intelligence endpoint
app.post('/api/route', async (req, res) => {
  try {
    const { taskCharacteristics } = req.body;

    if (!taskCharacteristics) {
      return res.status(400).json({ error: 'taskCharacteristics required' });
    }

    const routingDecision = await intelligentRouter.routeTask(taskCharacteristics);
    res.json(routingDecision);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path
  });
});

// WebSocket event handling per architettura v1.0
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  // Invia stato iniziale agenti
  socket.emit('agentStatus', {
    timestamp: Date.now(),
    currentMode: modeInterface.getCurrentMode(),
    systemHealth: unifiedOrchestrator.getSystemHealth(),
    agents: {
      orchestrator: 'online',
      claudeSonnet: 'active',
      unifiedSystem: 'operational'
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
});

// Emissione periodica eventi agentStatus ogni 30 secondi
setInterval(() => {
  const agentStatusUpdate = {
    timestamp: Date.now(),
    currentMode: modeInterface.getCurrentMode(),
    systemHealth: unifiedOrchestrator.getSystemHealth(),
    metrics: unifiedOrchestrator.getMetrics(),
    agents: {
      orchestrator: 'online',
      claudeSonnet: 'active',
      unifiedSystem: 'operational',
      modesManager: modeInterface.getStatus()
    }
  };

  io.emit('agentStatus', agentStatusUpdate);
}, 30000);

// Server startup
async function startServer() {
  try {
    console.log('🚀 Starting DevFlow Unified Orchestrator...');

    // Initialize MCP Fallback System with CLI → Synthetic mapping
    initializeMCPFallbackSystem();

    // Start unified orchestrator for compatibility
    await unifiedOrchestrator.start();
    console.log('✅ Unified Orchestrator started');

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`🌐 DevFlow Unified Orchestrator listening on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🎛️  Mode management: http://localhost:${PORT}/mode/switch/:mode`);
      console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics`);
      console.log(`🔧 Platforms: http://localhost:${PORT}/api/platforms`);
      console.log(`🧪 Test fallback: http://localhost:${PORT}/api/test-fallback`);
      console.log(`🔄 Current mode: ${modeInterface.getCurrentMode()}`);
      console.log(`⚡ MCP Fallback System: ACTIVE with CLI → Synthetic mapping`);

      // Log current fallback configuration
      const fallbackConfig = mcpFallbackSystem.getConfiguration();
      console.log(`📋 Fallback chains:`, JSON.stringify(fallbackConfig.fallbackChains, null, 2));
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('🛑 Graceful shutdown initiated...');

  try {
    await unifiedOrchestrator.stop();
    console.log('✅ Unified Orchestrator stopped');

    server.close(() => {
      console.log('✅ HTTP Server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Signal handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

// Export direct CLI functions for use by fallback system
export { callCodexCLIDirect, callGeminiCLIDirect, callQwenCLIDirect };

export default app;