#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'events';
import { EnhancedGeminiAuthService } from '../auth/enhanced-gemini-auth-service.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Types and interfaces
interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  activeRequests: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
  }>;
}

interface BatchRequest {
  id: string;
  method: string;
  params: any;
}

interface BatchResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Enhanced Gemini CLI MCP Server
 * Provides advanced MCP tools for interacting with Gemini CLI with comprehensive features
 */
class EnhancedGeminiMCPServer extends EventEmitter {
  private server: Server;
  private authService: EnhancedGeminiAuthService;
  private metrics: PerformanceMetrics;
  private healthStatus: HealthStatus;
  private responseTimes: number[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();

    this.authService = new EnhancedGeminiAuthService({
      defaultProvider: 'oauth',
      rateLimit: { requests: 100, windowMs: 60000 },
      healthCheckInterval: 30000
    });

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      activeRequests: 0
    };

    this.healthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      services: {}
    };

    this.server = new Server(
      {
        name: 'enhanced-gemini-mcp',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
    this.initializeHealthMonitoring();
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize auth service with providers
      const providers = {
        oauth: {
          type: 'oauth' as const,
          clientId: process.env.GEMINI_CLIENT_ID || '',
          clientSecret: process.env.GEMINI_CLIENT_SECRET || '',
          refreshToken: process.env.GEMINI_REFRESH_TOKEN || '',
          scopes: ['https://www.googleapis.com/auth/generative-language'],
          tokenUrl: 'https://oauth2.googleapis.com/token'
        },
        api_key: {
          type: 'api_key' as const,
          apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
        },
        adc: {
          type: 'adc' as const
        }
      };

      await this.authService.initialize(providers);
      this.emit('services-initialized');
    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw error;
    }
  }

  private initializeHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Perform initial health check
    this.performHealthCheck();
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const authHealth = this.authService.getHealthStatus();

      this.healthStatus = {
        status: authHealth.status,
        timestamp: new Date(),
        services: {
          auth: {
            status: authHealth.status,
            message: authHealth.details.error || undefined
          },
          gemini: {
            status: 'healthy' // Simplified for this implementation
          }
        }
      };

      this.emit('health-updated', this.healthStatus);
    } catch (error) {
      console.error('Health check failed:', error);
      this.healthStatus.status = 'unhealthy';
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[Enhanced Gemini MCP Error]', error);
      this.metrics.failedRequests++;
      this.emit('error', error);
    };

    process.on('SIGINT', async () => {
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.shutdown();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'ask-gemini',
          description: 'Advanced Gemini chat with OAuth authentication and context management',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Question or prompt to send to Gemini',
                minLength: 1,
              },
              model: {
                type: 'string',
                description: 'Gemini model to use (e.g., gemini-pro, gemini-2.5-flash)',
                default: 'gemini-pro'
              },
              temperature: {
                type: 'number',
                description: 'Temperature for response generation (0.0 to 1.0)',
                minimum: 0,
                maximum: 1,
                default: 0.7
              },
              maxTokens: {
                type: 'integer',
                description: 'Maximum tokens in response',
                minimum: 1,
                maximum: 8192,
                default: 2048
              },
              contextId: {
                type: 'string',
                description: 'Context ID for conversation continuity'
              }
            },
            required: ['prompt'],
          },
        },
        {
          name: 'brainstorm',
          description: 'Enhanced brainstorming with Gemini using advanced prompting techniques',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Primary brainstorming challenge or question',
                minLength: 1,
              },
              domain: {
                type: 'string',
                description: 'Domain context (technology, business, creative, etc.)',
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
                minimum: 1,
                maximum: 50,
                default: 12,
              },
              constraints: {
                type: 'string',
                description: 'Known limitations or requirements',
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
        {
          name: 'function-calling',
          description: 'Execute function calls through Gemini with tool integration',
          inputSchema: {
            type: 'object',
            properties: {
              functions: {
                type: 'array',
                description: 'Array of function definitions',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    parameters: { type: 'object' }
                  },
                  required: ['name', 'description', 'parameters']
                }
              },
              prompt: {
                type: 'string',
                description: 'Prompt that may trigger function calls',
                minLength: 1
              },
              model: {
                type: 'string',
                description: 'Gemini model to use',
                default: 'gemini-pro'
              }
            },
            required: ['functions', 'prompt']
          }
        },
        {
          name: 'batch-processing',
          description: 'Process multiple requests in parallel for improved efficiency',
          inputSchema: {
            type: 'object',
            properties: {
              requests: {
                type: 'array',
                description: 'Array of requests to process',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    method: { type: 'string' },
                    params: { type: 'object' }
                  },
                  required: ['id', 'method', 'params']
                },
                minItems: 1,
                maxItems: 10
              },
              parallel: {
                type: 'boolean',
                description: 'Whether to process requests in parallel',
                default: true
              }
            },
            required: ['requests']
          }
        },
        {
          name: 'get-metrics',
          description: 'Get performance metrics and health status',
          inputSchema: {
            type: 'object',
            properties: {
              includeHealth: {
                type: 'boolean',
                description: 'Include health status in response',
                default: true
              }
            }
          }
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();

      this.metrics.totalRequests++;
      this.metrics.activeRequests++;

      try {
        let result;
        switch (name) {
          case 'ask-gemini':
            result = await this.handleAskGemini(args as any);
            break;
          case 'brainstorm':
            result = await this.handleBrainstorm(args as any);
            break;
          case 'function-calling':
            result = await this.handleFunctionCalling(args as any);
            break;
          case 'batch-processing':
            result = await this.handleBatchProcessing(args as any);
            break;
          case 'get-metrics':
            result = await this.handleGetMetrics(args as any);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        this.metrics.successfulRequests++;
        const responseTime = Date.now() - startTime;
        this.updateResponseTime(responseTime);

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        this.metrics.failedRequests++;
        const responseTime = Date.now() - startTime;
        this.updateResponseTime(responseTime);

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      } finally {
        this.metrics.activeRequests--;
      }
    });
  }

  private updateResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    this.metrics.averageResponseTime =
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  /**
   * Handle enhanced ask-gemini tool requests
   */
  private async handleAskGemini(args: {
    prompt: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    contextId?: string;
  }) {
    try {
      // Build enhanced command arguments
      const geminiArgs = ['ask', args.prompt];

      if (args.model) {
        geminiArgs.push('--model', args.model);
      }

      if (args.temperature !== undefined) {
        geminiArgs.push('--temperature', args.temperature.toString());
      }

      if (args.maxTokens) {
        geminiArgs.push('--max-tokens', args.maxTokens.toString());
      }

      if (args.contextId) {
        geminiArgs.push('--context-id', args.contextId);
      }

      // Execute Gemini CLI command with enhanced monitoring
      const result = await this.executeGeminiCommand(geminiArgs);

      if (result.exitCode !== 0) {
        throw new Error(`Gemini CLI command failed: ${result.stderr}`);
      }

      return {
        response: result.stdout,
        model: args.model || 'gemini-pro',
        contextId: args.contextId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to execute ask-gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle enhanced brainstorm tool requests
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

      const result = await this.executeGeminiCommand(geminiArgs);

      if (result.exitCode !== 0) {
        throw new Error(`Gemini brainstorm command failed: ${result.stderr}`);
      }

      return {
        ideas: result.stdout,
        methodology: args.methodology || 'auto',
        domain: args.domain,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to execute brainstorm: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle function calling with tool integration
   */
  private async handleFunctionCalling(args: {
    functions: Array<{
      name: string;
      description: string;
      parameters: object;
    }>;
    prompt: string;
    model?: string;
  }) {
    try {
      const functionDefs = args.functions.map(f =>
        `${f.name}: ${f.description} (${JSON.stringify(f.parameters)})`
      ).join('\n');

      const enhancedPrompt = `Available functions:\n${functionDefs}\n\nRequest: ${args.prompt}`;

      const geminiArgs = ['ask', enhancedPrompt];
      if (args.model) {
        geminiArgs.push('--model', args.model);
      }
      geminiArgs.push('--function-calling');

      const result = await this.executeGeminiCommand(geminiArgs);

      if (result.exitCode !== 0) {
        throw new Error(`Function calling failed: ${result.stderr}`);
      }

      return {
        response: result.stdout,
        functions: args.functions.map(f => f.name),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to execute function calling: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle batch processing of multiple requests
   */
  private async handleBatchProcessing(args: {
    requests: BatchRequest[];
    parallel?: boolean;
  }): Promise<BatchResponse[]> {
    try {
      const processBatch = async (request: BatchRequest): Promise<BatchResponse> => {
        try {
          let result;
          switch (request.method) {
            case 'ask-gemini':
              result = await this.handleAskGemini(request.params);
              break;
            case 'brainstorm':
              result = await this.handleBrainstorm(request.params);
              break;
            default:
              throw new Error(`Unsupported batch method: ${request.method}`);
          }

          return {
            id: request.id,
            result
          };
        } catch (error) {
          return {
            id: request.id,
            error: {
              code: 500,
              message: error instanceof Error ? error.message : String(error)
            }
          };
        }
      };

      if (args.parallel !== false) {
        return await Promise.all(args.requests.map(processBatch));
      } else {
        const results: BatchResponse[] = [];
        for (const request of args.requests) {
          results.push(await processBatch(request));
        }
        return results;
      }
    } catch (error) {
      throw new Error(`Batch processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle metrics and health status requests
   */
  private async handleGetMetrics(args: { includeHealth?: boolean }) {
    const response: any = {
      metrics: { ...this.metrics },
      timestamp: new Date().toISOString()
    };

    if (args.includeHealth !== false) {
      response.health = this.healthStatus;
      response.auth = {
        performanceMetrics: this.authService.getPerformanceMetrics(),
        rateLimitInfo: this.authService.getRateLimitInfo()
      };
    }

    return response;
  }

  /**
   * Execute a Gemini CLI command with enhanced monitoring
   */
  private async executeGeminiCommand(args: string[]): Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string
  }> {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure authentication before executing command
        const token = await this.authService.getAuthToken();

        const { spawn } = await import('child_process');

        // Set up environment with auth token
        const env = {
          ...process.env,
          GEMINI_API_KEY: token
        };

        const geminiProcess = spawn('gemini', args, { env });

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

        // Set timeout for long-running commands
        setTimeout(() => {
          geminiProcess.kill('SIGTERM');
          reject(new Error('Gemini command timeout'));
        }, 60000); // 60 second timeout

      } catch (authError) {
        reject(new Error(`Authentication failed: ${authError instanceof Error ? authError.message : String(authError)}`));
      }
    });
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    console.log('Shutting down Enhanced Gemini MCP Server...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.authService.shutdown();
    await this.server.close();

    console.log('Enhanced Gemini MCP Server shutdown complete');
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    try {
      await this.initializeServices();

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      console.error('Enhanced Gemini MCP Server v2.0 running on stdio');
      this.emit('server-started');
    } catch (error) {
      console.error('Failed to start Enhanced Gemini MCP Server:', error);
      throw error;
    }
  }
}

// Only run if this file is executed directly
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const server = new EnhancedGeminiMCPServer();
  server.run().catch(console.error);
}

export default EnhancedGeminiMCPServer;