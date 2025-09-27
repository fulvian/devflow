#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { GeminiAuthService } from '../auth/gemini-auth-service.js';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Gemini CLI MCP Server
 * Provides MCP tools for interacting with Gemini CLI
 */
class GeminiMCPServer {
  private server: Server;
  private authService: GeminiAuthService;

  constructor() {
    this.authService = GeminiAuthService.getInstance();
    
    this.server = new Server(
      {
        name: 'devflow-gemini-mcp',
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
      console.error('[Gemini MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'ask-gemini',
          description: 'Ask questions to Gemini CLI with OAuth authentication',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Question or prompt to send to Gemini CLI',
                minLength: 1,
              },
              model: {
                type: 'string',
                description: 'Optional model to use (e.g., gemini-pro, gemini-ultra)',
              },
              sandbox: {
                type: 'boolean',
                description: 'Use sandbox mode for safe execution',
                default: false,
              },
              changeMode: {
                type: 'boolean',
                description: 'Enable structured change mode for code modifications',
                default: false,
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'brainstorm',
          description: 'Generate ideas with Gemini CLI using structured brainstorming techniques',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Primary brainstorming challenge or question to explore',
                minLength: 1,
              },
              domain: {
                type: 'string',
                description: 'Domain context for specialized brainstorming',
              },
              methodology: {
                type: 'string',
                enum: ['divergent', 'convergent', 'scamper', 'design-thinking', 'lateral', 'auto'],
                description: 'Brainstorming framework to use',
                default: 'auto',
              },
              ideaCount: {
                type: 'integer',
                description: 'Target number of ideas to generate',
                default: 12,
                exclusiveMinimum: 0,
              },
              constraints: {
                type: 'string',
                description: 'Known limitations, requirements, or boundaries',
              },
              includeAnalysis: {
                type: 'boolean',
                description: 'Include feasibility and implementation analysis',
                default: true,
              },
            },
            required: ['prompt'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'ask-gemini':
            return await this.handleAskGemini(args as any);
          case 'brainstorm':
            return await this.handleBrainstorm(args as any);
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
   * Handle ask-gemini tool requests
   */
  private async handleAskGemini(args: {
    prompt: string;
    model?: string;
    sandbox?: boolean;
    changeMode?: boolean;
  }) {
    try {
      // Ensure we have a valid access token
      await this.authService.refreshTokenIfNeeded();
      
      // Build command arguments
      const geminiArgs = ['ask', args.prompt];
      
      if (args.model) {
        geminiArgs.push('--model', args.model);
      }
      
      if (args.sandbox) {
        geminiArgs.push('--sandbox');
      }
      
      if (args.changeMode) {
        geminiArgs.push('--change-mode');
      }
      
      // Execute Gemini CLI command
      const result = await this.executeGeminiCommand(geminiArgs);
      
      if (result.exitCode !== 0) {
        throw new Error(`Gemini CLI command failed: ${result.stderr}`);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: result.stdout,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to execute ask-gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle brainstorm tool requests
   */
  private async handleBrainstorm(args: {
    prompt: string;
    domain?: string;
    methodology?: string;
    ideaCount?: number;
    constraints?: string;
    includeAnalysis?: boolean;
  }) {
    try {
      // Ensure we have a valid access token
      await this.authService.refreshTokenIfNeeded();
      
      // Build command arguments
      const geminiArgs = ['brainstorm', args.prompt];
      
      if (args.domain) {
        geminiArgs.push('--domain', args.domain);
      }
      
      if (args.methodology) {
        geminiArgs.push('--methodology', args.methodology);
      }
      
      if (args.ideaCount) {
        geminiArgs.push('--idea-count', args.ideaCount.toString());
      }
      
      if (args.constraints) {
        geminiArgs.push('--constraints', args.constraints);
      }
      
      if (args.includeAnalysis !== undefined) {
        geminiArgs.push('--include-analysis', args.includeAnalysis.toString());
      }
      
      // Execute Gemini CLI command
      const result = await this.executeGeminiCommand(geminiArgs);
      
      if (result.exitCode !== 0) {
        throw new Error(`Gemini CLI command failed: ${result.stderr}`);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: result.stdout,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to execute brainstorm: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a Gemini CLI command
   */
  private async executeGeminiCommand(args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const geminiProcess = spawn('gemini', args);
      
      let stdout = '';
      let stderr = '';
      
      geminiProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      geminiProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      geminiProcess.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });
      
      geminiProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn gemini process: ${error.message}`));
      });
    });
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DevFlow Gemini MCP server running on stdio');
  }
}

// Only run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const server = new GeminiMCPServer();
  server.run().catch(console.error);
}

export default GeminiMCPServer;