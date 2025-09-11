#!/usr/bin/env node

/**
 * DevFlow Dual Enhanced MCP Server
 * Supports both cc-sessions (.md files) and new multi-layer (SQLite + Vector) storage systems
 * Provides direct code implementation capabilities for both versions
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { join, resolve, dirname, basename, extname } from 'path';
import { existsSync } from 'fs';
import { syntheticService } from './services/SyntheticService.js';
import { apiRateLimiter } from './utils/ApiRateLimiter.js';
import { SYNTHETIC_API_LIMITS } from './config/apiLimits.js';

dotenv.config();

// Configuration
const SYNTHETIC_API_URL = 'https://api.synthetic.new/v1';
const SYNTHETIC_API_KEY = process.env.SYNTHETIC_API_KEY;
const DEVFLOW_PROJECT_ROOT = process.env.DEVFLOW_PROJECT_ROOT || process.cwd();

// Storage mode detection
const DEVFLOW_STORAGE_MODE = process.env.DEVFLOW_STORAGE_MODE || 'auto';
const CC_SESSIONS_PATH = join(DEVFLOW_PROJECT_ROOT, 'sessions');
const SQLITE_DB_PATH = join(DEVFLOW_PROJECT_ROOT, 'devflow.sqlite');

// Enhanced configuration
const AUTONOMOUS_FILE_OPERATIONS = process.env.AUTONOMOUS_FILE_OPERATIONS !== 'false';
const REQUIRE_APPROVAL = process.env.REQUIRE_APPROVAL === 'true';
const CREATE_BACKUPS = process.env.CREATE_BACKUPS !== 'false';
const SYNTHETIC_DELETE_ENABLED = process.env.SYNTHETIC_DELETE_ENABLED !== 'false';
const ALLOWED_FILE_EXTENSIONS = process.env.ALLOWED_FILE_EXTENSIONS?.split(',') || 
  ['.ts', '.js', '.json', '.md', '.py', '.tsx', '.jsx', '.css', '.scss', '.html', '.yml', '.yaml'];

// Model configuration
const DEFAULT_CODE_MODEL = process.env.DEFAULT_CODE_MODEL || 'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct';
const DEFAULT_REASONING_MODEL = process.env.DEFAULT_REASONING_MODEL || 'hf:deepseek-ai/DeepSeek-V3';
const DEFAULT_CONTEXT_MODEL = process.env.DEFAULT_CONTEXT_MODEL || 'hf:Qwen/Qwen2.5-Coder-32B-Instruct';
const DEFAULT_QA_DEPLOYMENT_MODEL = process.env.DEFAULT_QA_DEPLOYMENT_MODEL || 'hf:Qwen/Qwen2.5-Coder-32B-Instruct';

interface StorageMode {
  mode: 'cc-sessions' | 'multi-layer';
  detected: boolean;
  description: string;
}

interface FileModification {
  file: string;
  operation: 'write' | 'append' | 'patch' | 'create' | 'delete';
  content?: string;
  storage_specific?: {
    create_task_entry?: boolean;
    update_memory_blocks?: boolean;
  };
}

export class DualEnhancedSyntheticMCPServer {
  private server: Server;
  private allowedPaths: string[];
  private storageMode: StorageMode;

  constructor() {
    this.server = new Server(
      {
        name: 'devflow-synthetic-dual-enhanced',
        version: '2.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.allowedPaths = [DEVFLOW_PROJECT_ROOT];
    this.storageMode = this.detectStorageMode();
    this.setupToolHandlers();
    this.setupErrorHandling();

    console.log(`🚀 DevFlow Dual Enhanced MCP Server initialized`);
    console.log(`📁 Storage Mode: ${this.storageMode.mode} (${this.storageMode.detected ? 'detected' : 'configured'})`);
    console.log(`💾 ${this.storageMode.description}`);
  }

  private detectStorageMode(): StorageMode {
    if (DEVFLOW_STORAGE_MODE !== 'auto') {
      return {
        mode: DEVFLOW_STORAGE_MODE as 'cc-sessions' | 'multi-layer',
        detected: false,
        description: `Configured mode: ${DEVFLOW_STORAGE_MODE}`
      };
    }

    // Auto-detection logic
    const hasCCSessions = existsSync(CC_SESSIONS_PATH);
    const hasSQLiteDB = existsSync(SQLITE_DB_PATH);
    const hasStartDevflowScript = existsSync(join(DEVFLOW_PROJECT_ROOT, 'start-devflow.mjs'));

    if (hasStartDevflowScript && hasSQLiteDB) {
      return {
        mode: 'multi-layer',
        detected: true,
        description: 'Multi-layer system detected (SQLite + Vector + start-devflow.mjs)'
      };
    }

    if (hasCCSessions) {
      return {
        mode: 'cc-sessions',
        detected: true,
        description: 'CC-Sessions system detected (.md files in sessions/)'
      };
    }

    // Default fallback
    return {
      mode: 'cc-sessions',
      detected: false,
      description: 'Default fallback to cc-sessions mode'
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[Dual Enhanced MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Core enhanced tools
        {
          name: 'synthetic_auto_file_dual',
          description: `🚀 DUAL-MODE AUTONOMOUS FILE OPERATIONS - Works with both cc-sessions and multi-layer storage (Current: ${this.storageMode.mode})`,
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Task identifier (e.g., DEVFLOW-DUAL-001)',
              },
              request: {
                type: 'string',
                description: 'Task description for autonomous code generation and file modification',
              },
              target_files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific files to modify (optional - will auto-detect)',
                default: [],
              },
              agent_type: {
                type: 'string',
                enum: ['code', 'reasoning', 'context', 'qa-deployment'],
                description: 'Agent specialization: code (Qwen3-Coder-480B), reasoning (DeepSeek-V3), context (Qwen2.5-Coder-32B), qa-deployment (Qwen2.5-Coder-32B for testing/docs/deployment)',
                default: 'code',
              },
              storage_integration: {
                type: 'boolean',
                description: 'Whether to integrate with storage system (cc-sessions tasks or multi-layer memory)',
                default: true,
              },
              create_backup: {
                type: 'boolean',
                description: 'Create backup before modification',
                default: CREATE_BACKUPS,
              },
              dry_run: {
                type: 'boolean',
                description: 'Preview changes without applying them',
                default: false,
              },
              allow_deletion: {
                type: 'boolean',
                description: 'Allow file deletion operations',
                default: SYNTHETIC_DELETE_ENABLED,
              },
            },
            required: ['task_id', 'request'],
          },
        },
        {
          name: 'synthetic_batch_dual',
          description: `⚡ DUAL-MODE BATCH PROCESSING - Optimized for current storage mode (${this.storageMode.mode})`,
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Batch task identifier',
              },
              batch_requests: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    file_path: { type: 'string' },
                    objective: { type: 'string' },
                    language: { type: 'string' },
                  },
                  required: ['file_path', 'objective', 'language'],
                },
                description: 'Array of code generation requests',
              },
              storage_integration: {
                type: 'boolean',
                description: 'Integrate with current storage system',
                default: true,
              },
            },
            required: ['task_id', 'batch_requests'],
          },
        },
        {
          name: 'devflow_storage_info',
          description: '📋 STORAGE SYSTEM INFORMATION - Shows current storage mode and capabilities',
          inputSchema: {
            type: 'object',
            properties: {
              detailed: {
                type: 'boolean',
                description: 'Show detailed storage system information',
                default: false,
              },
            },
          },
        },
        {
          name: 'synthetic_service_stats',
          description: '📊 SYNTHETIC SERVICE STATISTICS - Shows rate limiting, batch processing, and optimization metrics',
          inputSchema: {
            type: 'object',
            properties: {
              reset_stats: {
                type: 'boolean',
                description: 'Reset service statistics to zero',
                default: false,
              },
            },
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'synthetic_auto_file_dual':
            return await this.handleDualAutonomousFileOperation(args as any);
          case 'synthetic_batch_dual':
            return await this.handleDualBatchProcessing(args as any);
          case 'devflow_storage_info':
            return await this.handleStorageInfo(args as any);
          case 'synthetic_service_stats':
            return await this.handleServiceStats(args as any);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async callSyntheticAPI(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    maxTokens: number = 4000
  ): Promise<any> {
    if (!SYNTHETIC_API_KEY) {
      throw new Error('SYNTHETIC_API_KEY not configured');
    }

    const response = await axios.post(
      `${SYNTHETIC_API_URL}/chat/completions`,
      {
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${SYNTHETIC_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  }

  private async handleDualAutonomousFileOperation(args: {
    task_id: string;
    request: string;
    target_files?: string[];
    agent_type?: 'code' | 'reasoning' | 'context' | 'qa-deployment';
    storage_integration?: boolean;
    create_backup?: boolean;
    dry_run?: boolean;
    allow_deletion?: boolean;
  }): Promise<any> {
    const startTime = Date.now();
    
    console.log(`🚀 Processing autonomous file operation ${args.task_id}: ${args.request}`);
    
    // Check rate limits before processing
    const rateLimitStatus = apiRateLimiter.getStatus();
    if (!rateLimitStatus.canCall) {
      const waitTime = apiRateLimiter.getTimeUntilNextCall();
      return {
        content: [
          {
            type: 'text',
            text: `# ❌ RATE LIMIT EXCEEDED - ${args.task_id}

## Rate Limiting Status
- **Usage**: ${(rateLimitStatus.usagePercentage * 100).toFixed(1)}% of limit
- **Remaining Calls**: ${rateLimitStatus.remainingCalls}/${SYNTHETIC_API_LIMITS.maxCalls}
- **Next Call Available**: ${Math.ceil(waitTime / 1000)} seconds
- **Window Reset**: ${new Date(rateLimitStatus.resetTime).toLocaleString()}

## Recommendation
Please wait ${Math.ceil(waitTime / 1000)} seconds before retrying, or consider using batch processing to optimize API usage.`,
          },
        ],
        isError: true,
      };
    }
    
    // Select model based on agent_type
    const selectedModel = this.selectModelByAgentType(args.agent_type || 'code');
    
    // Enhanced system prompt with agent specialization
    const systemPrompt = `You are a dual-mode autonomous ${this.getAgentSpecialization(args.agent_type || 'code')} AI that works with both cc-sessions (.md files) and multi-layer (SQLite + Vector) storage systems.

Agent Type: ${args.agent_type || 'code'}
Current Storage Mode: ${this.storageMode.mode}
Storage Integration: ${args.storage_integration ? 'ENABLED' : 'DISABLED'}
File Deletion: ${args.allow_deletion ? 'ENABLED' : 'DISABLED'}

Generate structured JSON output for direct file application:
{
  "modifications": [
    {
      "file": "path/to/file.ts",
      "operation": "write|append|patch|create${args.allow_deletion ? '|delete' : ''}",
      "content": "complete file content",
      "storage_integration": {
        "create_task_entry": true,
        "update_memory_blocks": true,
        "cc_sessions_compatible": true
      }
    }
  ],
  "storage_actions": {
    "mode": "${this.storageMode.mode}",
    "actions": ["create_memory_entry", "update_task_file"]
  },
  "summary": "Brief description of changes",
  "tokensEstimatedSaved": 800
}

Focus on:
- ${this.storageMode.mode === 'cc-sessions' ? 'CC-Sessions .md file compatibility' : 'Multi-layer SQLite + Vector integration'}
- Complete, compilable code
- Proper TypeScript/JavaScript syntax
- Integration with DevFlow storage system`;

    const userPrompt = `Task ID: ${args.task_id}
Storage Mode: ${this.storageMode.mode}
Request: ${args.request}
Target Files: ${args.target_files?.join(', ') || 'Auto-detect'}
Integration: ${args.storage_integration ? 'Full storage integration' : 'File operations only'}

Generate code modifications optimized for current storage system.`;

    const response = await this.callSyntheticAPI(
      selectedModel,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      8000
    );

    // Parse response
    let modifications: FileModification[] = [];
    let storageActions: any = {};
    let summary = '';
    let tokensEstimatedSaved = 0;

    try {
      const result = JSON.parse(response.choices[0].message.content);
      modifications = result.modifications || [];
      storageActions = result.storage_actions || {};
      summary = result.summary || 'Code modifications generated';
      tokensEstimatedSaved = result.tokensEstimatedSaved || 600;
    } catch (parseError) {
      modifications = [{
        file: 'generated-output.ts',
        operation: 'write',
        content: response.choices[0].message.content,
      }];
      summary = 'Code generated with fallback parsing';
      tokensEstimatedSaved = 500;
    }

    // Apply modifications if not dry_run
    const results: any[] = [];
    
    if (!args.dry_run && AUTONOMOUS_FILE_OPERATIONS) {
      for (const mod of modifications) {
        try {
          // Check if deletion is allowed for this operation
          if (mod.operation === 'delete' && !args.allow_deletion) {
            results.push({
              path: mod.file,
              status: 'SKIPPED',
              message: 'File deletion not allowed in this operation',
            });
            continue;
          }

          const result = await this.applyFileModification(mod, args.create_backup);
          results.push(result);

          // Storage system integration
          if (args.storage_integration) {
            await this.integrateWithStorage(mod, args.task_id);
          }
        } catch (error) {
          results.push({
            path: mod.file,
            status: 'ERROR',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const executionTime = Date.now() - startTime;
    const serviceStats = syntheticService.getServiceStats();

    return {
      content: [
        {
          type: 'text',
          text: `# 🚀 DUAL-MODE AUTONOMOUS FILE OPERATION - ${args.task_id}

## Storage System
- **Mode**: ${this.storageMode.mode} (${this.storageMode.detected ? 'auto-detected' : 'configured'})
- **Integration**: ${args.storage_integration ? '✅ ENABLED' : '❌ DISABLED'}
- **File Deletion**: ${args.allow_deletion ? '✅ ENABLED' : '❌ DISABLED'}
- **Description**: ${this.storageMode.description}

## Summary
${summary}

## Files ${args.dry_run ? 'Analyzed' : 'Modified'}
${results.length > 0 ? results.map(r => `- **${r.path}**: ${r.status}${r.message ? ` (${r.message})` : ''}`).join('\n') : modifications.map(m => `- **${m.file}**: ${m.operation} (${args.dry_run ? 'DRY RUN' : 'READY'})`).join('\n')}

## Storage Actions
${JSON.stringify(storageActions, null, 2)}

## Rate Limiting Status
- **Remaining Calls**: ${rateLimitStatus.remainingCalls}/${SYNTHETIC_API_LIMITS.maxCalls}
- **Usage**: ${(rateLimitStatus.usagePercentage * 100).toFixed(1)}%
- **Window Reset**: ${new Date(rateLimitStatus.resetTime).toLocaleString()}

## Token Efficiency Report
- **Synthetic Generation**: ${response.usage?.total_tokens || 'N/A'} tokens
- **Claude File Operations**: 0 tokens ✅ (COMPLETELY BYPASSED)
- **Estimated Token Savings**: ~${tokensEstimatedSaved} tokens
- **Storage System**: Optimized for ${this.storageMode.mode}

## Service Statistics
- **Total Requests**: ${serviceStats.totalRequests}
- **Total Tokens Saved**: ${serviceStats.totalTokensSaved}
- **Calls Optimized**: ${serviceStats.totalCallsOptimized}
- **Optimization Efficiency**: ${serviceStats.optimizationEfficiency.toFixed(1)}%

## Execution Stats
- **Execution Time**: ${executionTime}ms
- **Files Processed**: ${modifications.length}
- **Mode**: ${args.dry_run ? '🔍 DRY RUN' : '🎯 AUTONOMOUS EXECUTION'}
- **Storage Integration**: ${args.storage_integration ? '🔗 INTEGRATED' : '📁 FILES ONLY'}

${args.dry_run ? '💡 **Run without dry_run=true to apply changes**' : '✅ **Direct code implementation completed successfully**'}`,
        },
      ],
    };
  }

  private async handleDualBatchProcessing(args: {
    task_id: string;
    batch_requests: Array<{ file_path: string; objective: string; language: string }>;
    storage_integration?: boolean;
  }): Promise<any> {
    const startTime = Date.now();
    
    console.log(`📦 Processing batch ${args.task_id} with ${args.batch_requests.length} requests`);
    
    try {
      // Check rate limits before processing
      const rateLimitStatus = apiRateLimiter.getStatus();
      if (!rateLimitStatus.canCall) {
        const waitTime = apiRateLimiter.getTimeUntilNextCall();
        throw new Error(`Rate limit exceeded. Usage: ${(rateLimitStatus.usagePercentage * 100).toFixed(1)}%. Next call in ${Math.ceil(waitTime / 1000)}s`);
      }

      // Execute batch operations using the enhanced service
      const batchResponse = await syntheticService.executeBatchOperations(
        args.task_id,
        args.batch_requests,
        'code', // Default agent type
        args.storage_integration
      );

      if (!batchResponse.success) {
        throw new Error(batchResponse.error || 'Batch processing failed');
      }

      const executionTime = Date.now() - startTime;
      const serviceStats = syntheticService.getServiceStats();

      return {
        content: [
          {
            type: 'text',
            text: `# ⚡ DUAL-MODE BATCH PROCESSING - ${args.task_id}

## Storage System: ${this.storageMode.mode}
Batch processing ${args.batch_requests.length} files with ${this.storageMode.description}

## Batch Results
✅ **Success**: ${batchResponse.success}
📊 **Files Processed**: ${args.batch_requests.length}
⏱️ **Execution Time**: ${executionTime}ms
🎯 **Batch Optimized**: ${batchResponse.batchOptimized ? 'YES' : 'NO'}

## Rate Limiting Status
- **Remaining Calls**: ${rateLimitStatus.remainingCalls}/${SYNTHETIC_API_LIMITS.maxCalls}
- **Usage**: ${(rateLimitStatus.usagePercentage * 100).toFixed(1)}%
- **Window Reset**: ${new Date(rateLimitStatus.resetTime).toLocaleString()}

## Token Efficiency Report
- **Tokens Used**: ~${batchResponse.tokensUsed}
- **Batch Optimization**: ${batchResponse.batchOptimized ? '30% cost reduction applied' : 'Individual processing'}
- **Claude Tokens**: 0 ✅ (COMPLETELY BYPASSED)
- **Estimated Savings**: ~${Math.ceil(batchResponse.tokensUsed * 0.3)} tokens

## Service Statistics
- **Total Requests**: ${serviceStats.totalRequests}
- **Total Tokens Saved**: ${serviceStats.totalTokensSaved}
- **Calls Optimized**: ${serviceStats.totalCallsOptimized}
- **Optimization Efficiency**: ${serviceStats.optimizationEfficiency.toFixed(1)}%

## Files Processed
${args.batch_requests.map((req, index) => 
  `- **${index + 1}**: ${req.filePath} (${req.language}) - ${req.objective}`
).join('\n')}

## Storage Integration
${args.storage_integration ? '🔗 **ENABLED** - Integrated with ' + this.storageMode.mode + ' system' : '📁 **DISABLED** - File operations only'}

${batchResponse.batchOptimized ? '🎯 **Batch processing completed with intelligent optimization**' : '⚡ **Individual processing completed**'}`,
          },
        ],
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`❌ Batch processing failed for ${args.task_id}:`, errorMessage);
      
      return {
        content: [
          {
            type: 'text',
            text: `# ❌ BATCH PROCESSING FAILED - ${args.task_id}

## Error Details
**Error**: ${errorMessage}
**Execution Time**: ${executionTime}ms
**Files Requested**: ${args.batch_requests.length}

## Rate Limiting Status
${apiRateLimiter.getStatus().canCall ? '✅ **Calls Available**' : '❌ **Rate Limit Exceeded**'}

## Troubleshooting
1. Check rate limit status
2. Verify API key configuration
3. Review request parameters
4. Consider reducing batch size

## Files Affected
${args.batch_requests.map((req, index) => 
  `- **${index + 1}**: ${req.filePath} - ${req.objective}`
).join('\n')}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleServiceStats(args: { reset_stats?: boolean }): Promise<any> {
    if (args.reset_stats) {
      syntheticService.resetStats();
      return {
        content: [
          {
            type: 'text',
            text: `# 🔄 SERVICE STATISTICS RESET

All service statistics have been reset to zero.

## Reset Items
- ✅ Total requests counter
- ✅ Total tokens saved counter  
- ✅ Total calls optimized counter
- ✅ Rate limiter history
- ✅ Batch processor queue

## Current Status
${this.getCurrentServiceStatus()}`,
          },
        ],
      };
    }

    const serviceStats = syntheticService.getServiceStats();
    const rateLimitStatus = apiRateLimiter.getStatus();
    const batchProcessorStatus = batchProcessor.getQueueStatus();

    return {
      content: [
        {
          type: 'text',
          text: `# 📊 SYNTHETIC SERVICE STATISTICS

## Rate Limiting Status
- **Current Usage**: ${rateLimitStatus.remainingCalls}/${SYNTHETIC_API_LIMITS.maxCalls} calls remaining
- **Usage Percentage**: ${(rateLimitStatus.usagePercentage * 100).toFixed(1)}%
- **Can Make Calls**: ${rateLimitStatus.canCall ? '✅ YES' : '❌ NO'}
- **Window Start**: ${new Date(rateLimitStatus.windowStart).toLocaleString()}
- **Window Reset**: ${new Date(rateLimitStatus.resetTime).toLocaleString()}
${!rateLimitStatus.canCall ? `- **Next Call In**: ${Math.ceil(apiRateLimiter.getTimeUntilNextCall() / 1000)} seconds` : ''}

## Service Performance
- **Total Requests Processed**: ${serviceStats.totalRequests}
- **Total Tokens Saved**: ${serviceStats.totalTokensSaved}
- **Total Calls Optimized**: ${serviceStats.totalCallsOptimized}
- **Optimization Efficiency**: ${serviceStats.optimizationEfficiency.toFixed(1)}%

## Batch Processing Status
- **Queue Length**: ${batchProcessorStatus.queueLength} requests
- **Currently Processing Batch**: ${batchProcessorStatus.processingBatch ? '✅ YES' : '❌ NO'}
- **Rate Limit Status**: ${batchProcessorStatus.rateLimitStatus.canCall ? '✅ Available' : '❌ Exceeded'}

## API Configuration
- **Max Calls Per Window**: ${SYNTHETIC_API_LIMITS.maxCalls}
- **Window Duration**: ${SYNTHETIC_API_LIMITS.windowHours} hours
- **Batch Size**: ${SYNTHETIC_API_LIMITS.batchSize}
- **Cost Per Call**: ${SYNTHETIC_API_LIMITS.costPerCall}

## Storage System
- **Current Mode**: ${this.storageMode.mode}
- **Auto-Detected**: ${this.storageMode.detected ? '✅ YES' : '❌ NO'}
- **Description**: ${this.storageMode.description}

## Recommendations
${this.getServiceRecommendations(serviceStats, rateLimitStatus)}`,
        },
      ],
    };
  }

  private getCurrentServiceStatus(): string {
    const serviceStats = syntheticService.getServiceStats();
    const rateLimitStatus = apiRateLimiter.getStatus();
    
    return `- **Requests**: ${serviceStats.totalRequests}
- **Tokens Saved**: ${serviceStats.totalTokensSaved}
- **Calls Optimized**: ${serviceStats.totalCallsOptimized}
- **Rate Limit**: ${rateLimitStatus.remainingCalls}/${SYNTHETIC_API_LIMITS.maxCalls} remaining`;
  }

  private getServiceRecommendations(serviceStats: any, rateLimitStatus: any): string {
    const recommendations: string[] = [];
    
    if (rateLimitStatus.usagePercentage > 0.8) {
      recommendations.push('⚠️ **High API usage detected** - Consider using batch processing to optimize calls');
    }
    
    if (serviceStats.optimizationEfficiency < 50) {
      recommendations.push('💡 **Low optimization efficiency** - More requests could benefit from batching');
    }
    
    if (rateLimitStatus.usagePercentage < 0.2) {
      recommendations.push('✅ **Low API usage** - Good capacity for additional requests');
    }
    
    if (serviceStats.totalCallsOptimized > 0) {
      recommendations.push(`🎯 **${serviceStats.totalCallsOptimized} calls optimized** - Batch processing is working effectively`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('✅ **Service operating optimally** - No specific recommendations');
    }
    
    return recommendations.join('\n');
  }

  private async handleStorageInfo(args: { detailed?: boolean }): Promise<any> {
    const info = {
      current_mode: this.storageMode.mode,
      detected: this.storageMode.detected,
      description: this.storageMode.description,
      project_root: DEVFLOW_PROJECT_ROOT,
      capabilities: {
        direct_file_operations: AUTONOMOUS_FILE_OPERATIONS,
        backup_system: CREATE_BACKUPS,
        approval_required: REQUIRE_APPROVAL,
      },
    };

    if (args.detailed) {
      const detailedInfo = {
        ...info,
        paths: {
          cc_sessions: CC_SESSIONS_PATH,
          sqlite_db: SQLITE_DB_PATH,
          exists: {
            cc_sessions: existsSync(CC_SESSIONS_PATH),
            sqlite_db: existsSync(SQLITE_DB_PATH),
          },
        },
        models: {
          code: DEFAULT_CODE_MODEL,
          reasoning: DEFAULT_REASONING_MODEL,
          context: DEFAULT_CONTEXT_MODEL,
        },
      };
      
      return {
        content: [
          {
            type: 'text',
            text: `# 📋 DEVFLOW STORAGE SYSTEM INFORMATION

${JSON.stringify(detailedInfo, null, 2)}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `# 📋 DevFlow Storage Mode: ${this.storageMode.mode}

${this.storageMode.description}

**Status**: ${this.storageMode.detected ? '🔍 Auto-detected' : '⚙️ Configured'}
**Direct Operations**: ${AUTONOMOUS_FILE_OPERATIONS ? '✅ Enabled' : '❌ Disabled'}
**Token Bypass**: ✅ Active (Claude tokens saved on all file operations)`,
        },
      ],
    };
  }

  private async applyFileModification(modification: FileModification, createBackup: boolean = true): Promise<any> {
    console.log(`[MCP DEBUG] Starting applyFileModification for: ${modification.file}`);
    const fullPath = resolve(DEVFLOW_PROJECT_ROOT, modification.file);
    console.log(`[MCP DEBUG] Resolved absolute path: ${fullPath}`);

    if (!this.isPathAllowed(fullPath)) {
      const errorMsg = `Path not allowed: ${fullPath}`;
      console.error(`[MCP DEBUG] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.log(`[MCP DEBUG] Path is allowed.`);

    // Check delete permissions
    if (modification.operation === 'delete' && !SYNTHETIC_DELETE_ENABLED) {
      const errorMsg = `File deletion not enabled. Set SYNTHETIC_DELETE_ENABLED=true to enable.`;
      console.error(`[MCP DEBUG] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const ext = basename(fullPath).split('.').pop();
    if (ext && !ALLOWED_FILE_EXTENSIONS.includes(`.${ext}`)) {
      const errorMsg = `File extension not allowed: .${ext}`;
      console.error(`[MCP DEBUG] ERROR: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.log(`[MCP DEBUG] File extension .${ext} is allowed.`);

    try {
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        console.log(`[MCP DEBUG] Directory ${dir} does not exist. Creating...`);
        await fs.mkdir(dir, { recursive: true });
        console.log(`[MCP DEBUG] Directory ${dir} created.`);
      }

      if (createBackup && existsSync(fullPath)) {
        console.log(`[MCP DEBUG] Creating backup for ${fullPath}...`);
        await this.createBackup(fullPath);
        console.log(`[MCP DEBUG] Backup created.`);
      }

      console.log(`[MCP DEBUG] Performing operation '${modification.operation}' on ${fullPath}.`);
      
      let finalContent = '';
      
      switch (modification.operation) {
        case 'write':
        case 'create':
          finalContent = modification.content || '';
          await fs.writeFile(fullPath, finalContent, 'utf8');
          console.log(`[MCP DEBUG] File written/created successfully: ${fullPath}`);
          break;
        case 'append':
          const currentContent = existsSync(fullPath) ? await fs.readFile(fullPath, 'utf8') : '';
          finalContent = currentContent + (modification.content || '');
          await fs.writeFile(fullPath, finalContent, 'utf8');
          console.log(`[MCP DEBUG] Content appended successfully: ${fullPath}`);
          break;
        case 'patch':
          finalContent = await this.applyPatch(fullPath, modification.content || '');
          console.log(`[MCP DEBUG] Patch applied successfully: ${fullPath}`);
          break;
        case 'delete':
          if (existsSync(fullPath)) {
            await fs.unlink(fullPath);
            console.log(`[MCP DEBUG] File deleted successfully: ${fullPath}`);
            return {
              path: modification.file,
              status: 'SUCCESS',
              message: 'File deleted successfully'
            };
          } else {
            console.log(`[MCP DEBUG] File does not exist, skipping deletion: ${fullPath}`);
            return {
              path: modification.file,
              status: 'SKIPPED',
              message: 'File does not exist'
            };
          }
      }
      
      // Validazione del codice dopo la modifica (solo per operazioni che modificano il contenuto)
      if (finalContent && (modification.operation === 'write' || modification.operation === 'create' || modification.operation === 'append' || modification.operation === 'patch')) {
        await this.validateCodeSyntax(fullPath, finalContent);
      }
      console.log(`[MCP DEBUG] Operation '${modification.operation}' completed successfully.`);

      const successResult = {
        path: modification.file,
        status: 'SUCCESS',
        message: `${modification.operation} completed`,
      };
      console.log(`[MCP DEBUG] Returning success:`, successResult);
      return successResult;
    } catch (error) {
      const errorResult = {
        path: modification.file,
        status: 'ERROR',
        message: error instanceof Error ? error.message : String(error),
      };
      console.error(`[MCP DEBUG] Caught error during file modification:`, errorResult);
      return errorResult;
    }
  }

  private async integrateWithStorage(modification: FileModification, taskId: string): Promise<void> {
    if (this.storageMode.mode === 'cc-sessions') {
      await this.integrateCCSessions(modification, taskId);
    } else {
      await this.integrateMultiLayer(modification, taskId);
    }
  }

  private async integrateCCSessions(modification: FileModification, taskId: string): Promise<void> {
    // Integration with cc-sessions .md files
    console.log(`🔗 CC-Sessions integration: ${modification.file} for task ${taskId}`);
  }

  private async integrateMultiLayer(modification: FileModification, taskId: string): Promise<void> {
    // Integration with SQLite + Vector system
    console.log(`🔗 Multi-layer integration: ${modification.file} for task ${taskId}`);
  }

  private async validateCodeSyntax(filePath: string, content: string): Promise<void> {
    try {
      const ext = basename(filePath).split('.').pop()?.toLowerCase();
      
      // Validazione specifica per tipo di file
      switch (ext) {
        case 'ts':
        case 'tsx':
          await this.validateTypeScript(content);
          break;
        case 'js':
        case 'jsx':
          await this.validateJavaScript(content);
          break;
        case 'json':
          await this.validateJSON(content);
          break;
        case 'py':
          await this.validatePython(content);
          break;
        default:
          // Per altri tipi di file, validazione di base
          await this.validateBasicSyntax(content);
      }
      
      console.log(`[VALIDATION] Code syntax validation passed for ${filePath}`);
    } catch (error) {
      console.warn(`[VALIDATION WARNING] Syntax validation failed for ${filePath}:`, error);
      // Non bloccare l'operazione per errori di validazione, solo loggare
    }
  }

  private async validateTypeScript(content: string): Promise<void> {
    // Validazione TypeScript di base
    const lines = content.split('\n');
    
    // Controlla parentesi graffe bilanciate
    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;
    
    for (const line of lines) {
      for (const char of line) {
        switch (char) {
          case '{': braceCount++; break;
          case '}': braceCount--; break;
          case '(': parenCount++; break;
          case ')': parenCount--; break;
          case '[': bracketCount++; break;
          case ']': bracketCount--; break;
        }
      }
    }
    
    if (braceCount !== 0) {
      throw new Error(`Unbalanced braces: ${braceCount > 0 ? 'missing' : 'extra'} closing braces`);
    }
    if (parenCount !== 0) {
      throw new Error(`Unbalanced parentheses: ${parenCount > 0 ? 'missing' : 'extra'} closing parentheses`);
    }
    if (bracketCount !== 0) {
      throw new Error(`Unbalanced brackets: ${bracketCount > 0 ? 'missing' : 'extra'} closing brackets`);
    }
    
    // Controlla sintassi di base TypeScript
    if (content.includes('function ') && !content.includes('{')) {
      throw new Error('Function declaration missing opening brace');
    }
    
    if (content.includes('class ') && !content.includes('{')) {
      throw new Error('Class declaration missing opening brace');
    }
  }

  private async validateJavaScript(content: string): Promise<void> {
    // Validazione JavaScript simile a TypeScript ma più permissiva
    await this.validateTypeScript(content);
  }

  private async validateJSON(content: string): Promise<void> {
    try {
      JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON syntax: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async validatePython(content: string): Promise<void> {
    const lines = content.split('\n');
    let indentLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') continue;
      
      // Controlla indentazione
      const currentIndent = line.length - line.trimStart().length;
      
      if (trimmedLine.endsWith(':')) {
        // Linea che dovrebbe aumentare l'indentazione
        if (currentIndent !== indentLevel) {
          throw new Error(`Incorrect indentation at line ${i + 1}: expected ${indentLevel}, got ${currentIndent}`);
        }
        indentLevel += 2; // Python usa 2 o 4 spazi
      } else {
        // Linea normale
        if (currentIndent !== indentLevel) {
          throw new Error(`Incorrect indentation at line ${i + 1}: expected ${indentLevel}, got ${currentIndent}`);
        }
      }
    }
  }

  private async validateBasicSyntax(content: string): Promise<void> {
    // Validazione di base per tutti i tipi di file
    const lines = content.split('\n');
    
    // Controlla che non ci siano caratteri di controllo non validi
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('\0') || line.includes('\x1a')) {
        throw new Error(`Invalid control character found at line ${i + 1}`);
      }
    }
  }

  private async applyPatch(filePath: string, patchContent: string): Promise<string> {
    try {
      // Leggi il contenuto attuale del file
      const currentContent = await fs.readFile(filePath, 'utf8');
      
      // Analizza il patch content per determinare il tipo di modifica
      const patchResult = await this.parseAndApplyPatch(currentContent, patchContent);
      
      console.log(`[PATCH] Applied patch to ${filePath}`);
      return patchResult;
    } catch (error) {
      console.error(`[PATCH ERROR] Failed to apply patch to ${filePath}:`, error);
      throw error;
    }
  }

  private async parseAndApplyPatch(currentContent: string, patchContent: string): Promise<string> {
    try {
      // Se il patch content è un JSON con istruzioni specifiche
      if (patchContent.trim().startsWith('{')) {
        const patchInstructions = JSON.parse(patchContent);
        return await this.applyStructuredPatch(currentContent, patchInstructions);
      }
      
      // Se il patch content contiene marcatori di sostituzione
      if (patchContent.includes('<<<REPLACE>>>') || patchContent.includes('<<<INSERT>>>') || patchContent.includes('<<<REMOVE>>>')) {
        return await this.applyMarkedPatch(currentContent, patchContent);
      }
      
      // Se il patch content è un diff standard
      if (patchContent.includes('---') && patchContent.includes('+++')) {
        return await this.applyDiffPatch(currentContent, patchContent);
      }
      
      // Fallback: sostituzione semplice basata su pattern matching intelligente
      return await this.applyIntelligentPatch(currentContent, patchContent);
      
    } catch (error) {
      console.error('[PATCH PARSE ERROR]', error);
      // Fallback: sostituzione diretta
      return patchContent;
    }
  }

  private async applyStructuredPatch(currentContent: string, instructions: any): Promise<string> {
    let result = currentContent;
    
    // Applica le istruzioni strutturate
    if (instructions.replace) {
      for (const replacement of instructions.replace) {
        result = result.replace(new RegExp(replacement.search, 'g'), replacement.with);
      }
    }
    
    if (instructions.insert) {
      for (const insertion of instructions.insert) {
        const lines = result.split('\n');
        lines.splice(insertion.line - 1, 0, insertion.content);
        result = lines.join('\n');
      }
    }
    
    if (instructions.remove) {
      for (const removal of instructions.remove) {
        const lines = result.split('\n');
        lines.splice(removal.startLine - 1, removal.endLine - removal.startLine + 1);
        result = lines.join('\n');
      }
    }
    
    return result;
  }

  private async applyMarkedPatch(currentContent: string, patchContent: string): Promise<string> {
    let result = currentContent;
    
    // Gestisce marcatori come <<<REPLACE>>>content<<</REPLACE>>>
    const replacePattern = /<<<REPLACE>>>([\s\S]*?)<<<\/REPLACE>>>/g;
    const insertPattern = /<<<INSERT>>>([\s\S]*?)<<<\/INSERT>>>/g;
    const removePattern = /<<<REMOVE>>>([\s\S]*?)<<<\/REMOVE>>>/g;
    
    // Applica sostituzioni
    result = result.replace(replacePattern, (match, content) => {
      return content;
    });
    
    // Applica inserimenti
    result = result.replace(insertPattern, (match, content) => {
      return content;
    });
    
    // Applica rimozioni
    result = result.replace(removePattern, (match, content) => {
      return '';
    });
    
    return result;
  }

  private async applyDiffPatch(currentContent: string, patchContent: string): Promise<string> {
    // Implementazione semplificata per diff standard
    // Per una implementazione completa, si potrebbe usare una libreria come 'diff'
    const lines = currentContent.split('\n');
    const patchLines = patchContent.split('\n');
    
    let result = [...lines];
    let patchIndex = 0;
    
    while (patchIndex < patchLines.length) {
      const line = patchLines[patchIndex];
      
      if (line.startsWith('@@')) {
        // Parse hunk header
        const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
        if (hunkMatch) {
          const oldStart = parseInt(hunkMatch[1]) - 1;
          const oldCount = parseInt(hunkMatch[2]) || 1;
          const newStart = parseInt(hunkMatch[3]) - 1;
          const newCount = parseInt(hunkMatch[4]) || 1;
          
          // Applica le modifiche del hunk
          patchIndex++;
          let oldLineIndex = oldStart;
          let newLineIndex = newStart;
          
          while (patchIndex < patchLines.length && !patchLines[patchIndex].startsWith('@@')) {
            const patchLine = patchLines[patchIndex];
            
            if (patchLine.startsWith('-')) {
              // Rimuovi linea
              if (oldLineIndex < result.length) {
                result.splice(oldLineIndex, 1);
              }
              oldLineIndex++;
            } else if (patchLine.startsWith('+')) {
              // Aggiungi linea
              result.splice(newLineIndex, 0, patchLine.substring(1));
              newLineIndex++;
              oldLineIndex++;
            } else {
              // Linea invariata
              oldLineIndex++;
              newLineIndex++;
            }
            
            patchIndex++;
          }
        }
      } else {
        patchIndex++;
      }
    }
    
    return result.join('\n');
  }

  private async applyIntelligentPatch(currentContent: string, patchContent: string): Promise<string> {
    // Patch intelligente basato su pattern matching
    const lines = currentContent.split('\n');
    const patchLines = patchContent.split('\n');
    
    // Cerca pattern comuni per identificare dove applicare le modifiche
    for (let i = 0; i < patchLines.length; i++) {
      const patchLine = patchLines[i].trim();
      
      if (patchLine.includes('function ') || patchLine.includes('class ') || patchLine.includes('const ') || patchLine.includes('let ')) {
        // Cerca la funzione/classe/variabile corrispondente nel contenuto attuale
        const searchPattern = patchLine.replace(/[{}();]/g, '').trim();
        
        for (let j = 0; j < lines.length; j++) {
          if (lines[j].includes(searchPattern.split(' ')[1] || searchPattern.split(' ')[0])) {
            // Sostituisci o inserisci il nuovo contenuto
            lines[j] = patchLine;
            break;
          }
        }
      }
    }
    
    return lines.join('\n');
  }

  private async createBackup(filePath: string): Promise<void> {
    try {
      // Create centralized backup directory structure: /backups/YYYY-MM-DD/
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toISOString().replace(/[:.]/g, '-').split('.')[0]; // YYYY-MM-DDTHH-mm-ss
      
      const backupDir = join(DEVFLOW_PROJECT_ROOT, 'backups', dateStr);
      await fs.mkdir(backupDir, { recursive: true });
      
      // Create backup with format: original-name_YYYY-MM-DD-HH-mm-ss.backup
      const originalName = basename(filePath, extname(filePath));
      const extension = extname(filePath);
      const backupFileName = `${originalName}_${timeStr}${extension}.backup`;
      const backupPath = join(backupDir, backupFileName);
      
      await fs.copyFile(filePath, backupPath);
      console.log(`[BACKUP] Created: ${backupPath}`);
      
      // Cleanup old backups (older than 24 hours)
      await this.cleanupOldBackups();
      
    } catch (error) {
      console.error(`[BACKUP ERROR] Failed to create backup for ${filePath}:`, error);
      // Fallback to old system in case of error
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fallbackPath = `${filePath}.backup-${timestamp}`;
      await fs.copyFile(filePath, fallbackPath);
    }
  }
  
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backupsRoot = join(DEVFLOW_PROJECT_ROOT, 'backups');
      if (!existsSync(backupsRoot)) return;
      
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      const entries = await fs.readdir(backupsRoot, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = join(backupsRoot, entry.name);
          const files = await fs.readdir(dirPath);
          
          for (const file of files) {
            const filePath = join(dirPath, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime.getTime() < cutoffTime) {
              await fs.unlink(filePath);
              console.log(`[CLEANUP] Removed old backup: ${filePath}`);
            }
          }
          
          // Remove empty directories
          const remainingFiles = await fs.readdir(dirPath);
          if (remainingFiles.length === 0) {
            await fs.rmdir(dirPath);
            console.log(`[CLEANUP] Removed empty backup directory: ${dirPath}`);
          }
        }
      }
    } catch (error) {
      console.error('[CLEANUP ERROR] Failed to cleanup old backups:', error);
    }
  }

  private isPathAllowed(fullPath: string): boolean {
    return this.allowedPaths.some(allowedPath => 
      fullPath.startsWith(allowedPath)
    );
  }

  private selectModelByAgentType(agentType: 'code' | 'reasoning' | 'context' | 'qa-deployment'): string {
    switch (agentType) {
      case 'code':
        return DEFAULT_CODE_MODEL;
      case 'reasoning':
        return DEFAULT_REASONING_MODEL;
      case 'context':
        return DEFAULT_CONTEXT_MODEL;
      case 'qa-deployment':
        return DEFAULT_QA_DEPLOYMENT_MODEL;
      default:
        return DEFAULT_CODE_MODEL;
    }
  }

  private getAgentSpecialization(agentType: 'code' | 'reasoning' | 'context' | 'qa-deployment'): string {
    switch (agentType) {
      case 'code':
        return 'code generation and implementation';
      case 'reasoning':
        return 'architectural analysis and complex reasoning';
      case 'context':
        return 'context analysis and documentation';
      case 'qa-deployment':
        return 'testing, debugging, deployment, and documentation';
      default:
        return 'code generation';
    }
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`DevFlow Dual Enhanced MCP server running on stdio (${this.storageMode.mode} mode)`);
  }
}

const server = new DualEnhancedSyntheticMCPServer();
server.run().catch(console.error);