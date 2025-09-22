#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CodexOrchestrator } from '../orchestration/codex-orchestrator.js';
import { CodexAuthManager } from '../auth/codex-auth-manager.js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Codex MCP Server
 * Provides MCP tools for interacting with OpenAI Codex through multiple providers
 */
class CodexMCPServer {
  private server: Server;
  private orchestrator: CodexOrchestrator;
  private authManager: CodexAuthManager;

  constructor() {
    this.authManager = new CodexAuthManager();
    this.orchestrator = new CodexOrchestrator(this.authManager);
    
    this.server = new Server(
      {
        name: 'devflow-codex-mcp',
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
      console.error('[Codex MCP Error]', error);
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
          name: 'codex-chat',
          description: 'Chat with OpenAI Codex models for coding assistance and general programming questions',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Message to send to Codex',
                minLength: 1,
              },
              model: {
                type: 'string',
                description: 'OpenAI model to use (e.g., o4-mini, gpt-4-turbo)',
                default: 'o4-mini',
              },
              provider: {
                type: 'string',
                enum: ['openai', 'azure', 'custom', 'auto'],
                description: 'Provider to use for the request',
                default: 'auto',
              },
              temperature: {
                type: 'number',
                description: 'Temperature for response generation',
                minimum: 0,
                maximum: 2,
                default: 0.1,
              },
              maxTokens: {
                type: 'number',
                description: 'Maximum tokens in response',
                minimum: 1,
                maximum: 4096,
                default: 2048,
              },
            },
            required: ['message'],
          },
        },
        {
          name: 'function-calling',
          description: 'Execute function calls with Codex using structured outputs',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Task description for function execution',
                minLength: 1,
              },
              functions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    parameters: { type: 'object' },
                  },
                  required: ['name', 'description', 'parameters'],
                },
                description: 'Available functions for the model to call',
              },
              functionChoice: {
                type: 'string',
                enum: ['auto', 'none'],
                description: 'How the model should use functions',
                default: 'auto',
              },
            },
            required: ['prompt', 'functions'],
          },
        },
        {
          name: 'code-completion',
          description: 'Get code completions and suggestions using Codex',
          inputSchema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: 'Existing code context',
                minLength: 1,
              },
              language: {
                type: 'string',
                description: 'Programming language',
              },
              completionType: {
                type: 'string',
                enum: ['continue', 'fix', 'optimize', 'explain'],
                description: 'Type of completion requested',
                default: 'continue',
              },
              maxSuggestions: {
                type: 'number',
                description: 'Maximum number of completion suggestions',
                minimum: 1,
                maximum: 5,
                default: 3,
              },
            },
            required: ['code'],
          },
        },
        {
          name: 'claude-codex-handoff',
          description: 'Intelligent handoff between Claude and Codex for complex tasks',
          inputSchema: {
            type: 'object',
            properties: {
              task: {
                type: 'string',
                description: 'Complex task requiring Claude-Codex collaboration',
                minLength: 1,
              },
              claudeAnalysis: {
                type: 'string',
                description: 'Optional Claude analysis to pass to Codex',
              },
              handoffType: {
                type: 'string',
                enum: ['analysis-to-implementation', 'review-to-fix', 'design-to-code'],
                description: 'Type of handoff workflow',
                default: 'analysis-to-implementation',
              },
              preserveContext: {
                type: 'boolean',
                description: 'Whether to preserve context across the handoff',
                default: true,
              },
            },
            required: ['task'],
          },
        },
        {
          name: 'batch-processing',
          description: 'Process multiple coding tasks in batch with Codex',
          inputSchema: {
            type: 'object',
            properties: {
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    prompt: { type: 'string' },
                    model: { type: 'string' },
                  },
                  required: ['id', 'type', 'prompt'],
                },
                description: 'Array of tasks to process',
              },
              maxConcurrent: {
                type: 'number',
                description: 'Maximum concurrent tasks',
                default: 2,
                minimum: 1,
                maximum: 5,
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
          case 'codex-chat':
            return await this.handleCodexChat(args as any);
          case 'function-calling':
            return await this.handleFunctionCalling(args as any);
          case 'code-completion':
            return await this.handleCodeCompletion(args as any);
          case 'claude-codex-handoff':
            return await this.handleClaudeCodexHandoff(args as any);
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
   * Handle codex chat requests
   */
  private async handleCodexChat(args: {
    message: string;
    model?: string;
    provider?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    const result = await this.orchestrator.executeChat({
      message: args.message,
      model: args.model || 'o4-mini',
      provider: args.provider || 'auto',
      temperature: args.temperature || 0.1,
      maxTokens: args.maxTokens || 2048,
    });

    return {
      content: [
        {
          type: 'text',
          text: result.content,
        },
      ],
    };
  }

  /**
   * Handle function calling requests
   */
  private async handleFunctionCalling(args: {
    prompt: string;
    functions: Array<any>;
    functionChoice?: string;
  }) {
    const result = await this.orchestrator.executeFunctionCall({
      prompt: args.prompt,
      functions: args.functions,
      functionChoice: args.functionChoice || 'auto',
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Handle code completion requests
   */
  private async handleCodeCompletion(args: {
    code: string;
    language?: string;
    completionType?: string;
    maxSuggestions?: number;
  }) {
    const result = await this.orchestrator.executeCompletion({
      code: args.code,
      language: args.language,
      completionType: args.completionType || 'continue',
      maxSuggestions: args.maxSuggestions || 3,
    });

    return {
      content: [
        {
          type: 'text',
          text: result.completions.join('\n\n---\n\n'),
        },
      ],
    };
  }

  /**
   * Handle Claude-Codex handoff requests
   */
  private async handleClaudeCodexHandoff(args: {
    task: string;
    claudeAnalysis?: string;
    handoffType?: string;
    preserveContext?: boolean;
  }) {
    const result = await this.orchestrator.executeHandoff({
      task: args.task,
      claudeAnalysis: args.claudeAnalysis,
      handoffType: args.handoffType || 'analysis-to-implementation',
      preserveContext: args.preserveContext !== false,
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
      model?: string;
    }>;
    maxConcurrent?: number;
  }) {
    const results = await this.orchestrator.executeBatch(
      args.tasks,
      args.maxConcurrent || 2
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
    console.error('DevFlow Codex MCP server running on stdio');
  }
}

// Only run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const server = new CodexMCPServer();
  server.run().catch(console.error);
}

export default CodexMCPServer;