#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { QwenOrchestrator } from '../orchestration/qwen-orchestrator.js';
import { QwenAuthManager } from '../auth/qwen-auth-manager.js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Qwen Code CLI MCP Server
 * Provides MCP tools for interacting with Qwen Code CLI with orchestrator-worker architecture
 */
class QwenMCPServer {
  private server: Server;
  private orchestrator: QwenOrchestrator;
  private authManager: QwenAuthManager;

  constructor() {
    this.authManager = new QwenAuthManager();
    this.orchestrator = new QwenOrchestrator(this.authManager);
    
    this.server = new Server(
      {
        name: 'devflow-qwen-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[Qwen MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.orchestrator.shutdown();
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'ask-qwen',
          description: 'Execute coding tasks using Qwen Code CLI with multi-provider support',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Coding task or question for Qwen Code',
                minLength: 1,
              },
              provider: {
                type: 'string',
                enum: ['dashscope', 'modelscope', 'openrouter', 'auto'],
                description: 'Qwen provider to use',
                default: 'auto',
              },
              model: {
                type: 'string',
                description: 'Specific model to use (e.g., qwen3-coder-plus)',
              },
              sandbox: {
                type: 'boolean',
                description: 'Execute in sandbox mode',
                default: false,
              },
              priority: {
                type: 'string',
                enum: ['low', 'normal', 'high'],
                description: 'Task priority',
                default: 'normal',
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'code-generation',
          description: 'Generate code using Qwen specialized for coding tasks',
          inputSchema: {
            type: 'object',
            properties: {
              requirement: {
                type: 'string',
                description: 'Code generation requirement',
                minLength: 1,
              },
              language: {
                type: 'string',
                description: 'Programming language',
              },
              framework: {
                type: 'string',
                description: 'Framework or library context',
              },
              complexity: {
                type: 'string',
                enum: ['simple', 'moderate', 'complex'],
                default: 'moderate',
              },
            },
            required: ['requirement', 'language'],
          },
        },
        {
          name: 'code-analysis',
          description: 'Analyze existing code for improvements, bugs, or explanations',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Code to analyze',
                minLength: 1,
              },
              analysisType: {
                type: 'string',
                enum: ['review', 'debug', 'explain', 'optimize'],
                description: 'Type of analysis to perform',
                default: 'review',
              },
              language: {
                type: 'string',
                description: 'Programming language',
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'batch-processing',
          description: 'Process multiple coding tasks in batch with optimized resource usage',
          inputSchema: {
            type: 'object',
            properties: {
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string', enum: ['generation', 'analysis', 'review'] },
                    prompt: { type: 'string' },
                    priority: { type: 'string', enum: ['low', 'normal', 'high'], default: 'normal' },
                  },
                  required: ['id', 'type', 'prompt'],
                },
                description: 'Array of tasks to process',
              },
              maxConcurrent: {
                type: 'number',
                description: 'Maximum concurrent tasks',
                default: 3,
                minimum: 1,
                maximum: 10,
              },
            },
            required: ['tasks'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'ask-qwen':
            return await this.handleAskQwen(args as any);
          case 'code-generation':
            return await this.handleCodeGeneration(args as any);
          case 'code-analysis':
            return await this.handleCodeAnalysis(args as any);
          case 'batch-processing':
            return await this.handleBatchProcessing(args as any);
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

  /**
   * Handle ask-qwen tool requests
   */
  private async handleAskQwen(args: {
    prompt: string;
    provider?: string;
    model?: string;
    sandbox?: boolean;
    priority?: string;
  }) {
    const result = await this.orchestrator.executeTask({
      type: 'general',
      prompt: args.prompt,
      provider: args.provider || 'auto',
      model: args.model,
      sandbox: args.sandbox || false,
      priority: args.priority || 'normal',
    });

    return {
      content: [
        {
          type: 'text',
          text: result.output,
        },
      ],
    };
  }

  /**
   * Handle code generation requests
   */
  private async handleCodeGeneration(args: {
    requirement: string;
    language: string;
    framework?: string;
    complexity?: string;
  }) {
    const result = await this.orchestrator.executeTask({
      type: 'code_generation',
      prompt: `Generate ${args.language} code for: ${args.requirement}`,
      language: args.language,
      framework: args.framework,
      complexity: args.complexity || 'moderate',
      priority: 'normal',
    });

    return {
      content: [
        {
          type: 'text',
          text: result.output,
        },
      ],
    };
  }

  /**
   * Handle code analysis requests
   */
  private async handleCodeAnalysis(args: {
    code: string;
    analysisType?: string;
    language?: string;
  }) {
    const result = await this.orchestrator.executeTask({
      type: 'code_analysis',
      prompt: `${args.analysisType || 'review'} this ${args.language || ''} code:\n\n${args.code}`,
      code: args.code,
      analysisType: args.analysisType || 'review',
      language: args.language,
      priority: 'normal',
    });

    return {
      content: [
        {
          type: 'text',
          text: result.output,
        },
      ],
    };
  }

  /**
   * Handle batch processing requests
   */
  private async handleBatchProcessing(args: {
    tasks: Array<{
      id: string;
      type: string;
      prompt: string;
      priority?: string;
    }>;
    maxConcurrent?: number;
  }) {
    const results = await this.orchestrator.executeBatch(
      args.tasks.map(task => ({
        id: task.id,
        type: task.type,
        prompt: task.prompt,
        priority: task.priority || 'normal',
      })),
      args.maxConcurrent || 3
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    await this.orchestrator.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DevFlow Qwen MCP server running on stdio');
  }
}

// Only run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const server = new QwenMCPServer();
  server.run().catch(console.error);
}

export default QwenMCPServer;