/**
 * DevFlow MCP Server for Claude Code Integration
 * Provides DevFlow tools via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SQLiteMemoryManager } from '@devflow/core';
import { SemanticSearchService } from './semantic-search.js';
import { PlatformHandoffEngine } from './handoff-engine.js';
import type { MemoryBlock, SearchQuery, HandoffContext } from '@devflow/shared';

export interface DevFlowMCPServerConfig {
  memoryManager: SQLiteMemoryManager;
  semanticService: SemanticSearchService;
  handoffEngine: PlatformHandoffEngine;
  verbose?: boolean;
}

export class DevFlowMCPServer {
  private server: Server;
  private memoryManager: SQLiteMemoryManager;
  private semanticService: SemanticSearchService;
  private handoffEngine: PlatformHandoffEngine;
  private verbose: boolean;

  constructor(config: DevFlowMCPServerConfig) {
    this.memoryManager = config.memoryManager;
    this.semanticService = config.semanticService;
    this.handoffEngine = config.handoffEngine;
    this.verbose = config.verbose ?? false;

    this.server = new Server(
      {
        name: 'devflow-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getDevFlowTools(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'devflow_search':
            return await this.handleSearch(args);
          case 'devflow_handoff':
            return await this.handleHandoff(args);
          case 'devflow_memory_store':
            return await this.handleMemoryStore(args);
          case 'devflow_context_inject':
            return await this.handleContextInject(args);
          case 'devflow_analytics':
            return await this.handleAnalytics(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (this.verbose) {
          console.error(`DevFlow MCP Server Error [${name}]:`, errorMessage);
        }
        throw new Error(`DevFlow tool error: ${errorMessage}`);
      }
    });
  }

  private getDevFlowTools(): Tool[] {
    return [
      {
        name: 'devflow_search',
        description: 'Search DevFlow memory for relevant context and architectural decisions',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query for semantic search',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 10,
            },
            blockTypes: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['architectural', 'implementation', 'debugging', 'maintenance'],
              },
              description: 'Filter by memory block types',
            },
            threshold: {
              type: 'number',
              description: 'Similarity threshold (0.0-1.0)',
              default: 0.7,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'devflow_handoff',
        description: 'Handoff context to another AI platform with preserved architectural decisions',
        inputSchema: {
          type: 'object',
          properties: {
            platform: {
              type: 'string',
              enum: ['codex', 'synthetic', 'gemini', 'cursor'],
              description: 'Target platform for handoff',
            },
            task: {
              type: 'string',
              description: 'Task description for handoff',
            },
            context: {
              type: 'string',
              description: 'Additional context for handoff',
            },
            preserveArchitecture: {
              type: 'boolean',
              description: 'Whether to preserve architectural decisions',
              default: true,
            },
          },
          required: ['platform', 'task'],
        },
      },
      {
        name: 'devflow_memory_store',
        description: 'Store important architectural decisions or implementation patterns',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'Content to store in memory',
            },
            blockType: {
              type: 'string',
              enum: ['architectural', 'implementation', 'debugging', 'maintenance'],
              description: 'Type of memory block',
            },
            label: {
              type: 'string',
              description: 'Human-readable label for the memory block',
            },
            importanceScore: {
              type: 'number',
              description: 'Importance score (0.0-1.0)',
              default: 0.8,
            },
            metadata: {
              type: 'object',
              description: 'Additional metadata',
            },
          },
          required: ['content', 'blockType', 'label'],
        },
      },
      {
        name: 'devflow_context_inject',
        description: 'Inject relevant context into current session',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'Task ID to inject context for',
            },
            sessionId: {
              type: 'string',
              description: 'Session ID for context injection',
            },
            contextTypes: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['architectural', 'implementation', 'debugging', 'maintenance'],
              },
              description: 'Types of context to inject',
            },
          },
          required: ['taskId', 'sessionId'],
        },
      },
      {
        name: 'devflow_analytics',
        description: 'Get DevFlow analytics and performance metrics',
        inputSchema: {
          type: 'object',
          properties: {
            metricType: {
              type: 'string',
              enum: ['session', 'memory', 'handoff', 'token_usage', 'cost'],
              description: 'Type of analytics to retrieve',
            },
            timeRange: {
              type: 'string',
              description: 'Time range for analytics (e.g., "7d", "30d")',
              default: '7d',
            },
          },
        },
      },
    ];
  }

  private async handleSearch(args: any): Promise<any> {
    const { query, maxResults = 10, blockTypes, threshold = 0.7 } = args;

    const searchQuery: SearchQuery = {
      query,
      maxResults,
      blockTypes,
      threshold,
    };

    const results = await this.semanticService.hybridSearch(searchQuery);

    return {
      content: [
        {
          type: 'text',
          text: `# DevFlow Memory Search Results\n\nFound ${results.length} relevant memory blocks:\n\n${results
            .map((result: any, index: number) => {
              const block = result.block;
              return `## ${index + 1}. ${block.label} (${block.blockType})\n**Similarity**: ${(result.similarity * 100).toFixed(1)}%\n**Content**:\n${block.content}\n`;
            })
            .join('\n')}`,
        },
      ],
    };
  }

  private async handleHandoff(args: any): Promise<any> {
    const { platform, task, context, preserveArchitecture = true } = args;

    const handoffContext: HandoffContext = {
      platform: platform as any,
      task,
      context: context || '',
      preserveArchitecture,
      timestamp: new Date(),
      preservedDecisions: [],
      contextSummary: '',
      nextSteps: [],
      constraints: [],
      platformSpecificData: {} as any,
    };

    const handoffCommand = await this.handoffEngine.generateHandoffCommand(handoffContext);

    return {
      content: [
        {
          type: 'text',
          text: `# DevFlow Platform Handoff\n\n**Target Platform**: ${platform}\n**Task**: ${task}\n\n## Handoff Command\n\`\`\`bash\n${handoffCommand}\n\`\`\`\n\n## Context Preserved\n${preserveArchitecture ? '✅ Architectural decisions preserved' : '❌ Architectural decisions not preserved'}\n\n## Next Steps\n1. Execute the handoff command\n2. Continue development on ${platform}\n3. Use DevFlow memory to maintain context continuity`,
        },
      ],
    };
  }

  private async handleMemoryStore(args: any): Promise<any> {
    const { content, blockType, label, importanceScore = 0.8, metadata = {} } = args;

    const memoryBlock: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'> = {
      content,
      blockType: blockType as any,
      label,
      importanceScore,
      metadata,
      relationships: [],
      embeddingModel: 'openai-ada-002',
      taskId: 'mcp-store',
      sessionId: 'mcp-session',
    };

    const storedBlock = await this.memoryManager.storeMemoryBlock(memoryBlock);

    return {
      content: [
        {
          type: 'text',
          text: `# DevFlow Memory Stored\n\n**Label**: ${label}\n**Type**: ${blockType}\n**Importance**: ${(importanceScore * 100).toFixed(1)}%\n**ID**: ${typeof storedBlock === 'string' ? storedBlock : (storedBlock as any).id}\n\n## Content\n${content}\n\n✅ Memory block successfully stored and indexed for semantic search.`,
        },
      ],
    };
  }

  private async handleContextInject(args: any): Promise<any> {
    const { taskId, sessionId, contextTypes = ['architectural', 'implementation'] } = args;

    // Retrieve relevant context
    const contextBlocks = await this.memoryManager.retrieveMemoryBlocks({
      taskId,
      blockTypes: contextTypes as any[],
      limit: 20,
    });

    if (contextBlocks.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `# DevFlow Context Injection\n\n❌ No relevant context found for task ${taskId}.\n\nThis might be a new task or the context hasn't been stored yet.`,
          },
        ],
      };
    }

    // Format context for injection
    const formattedContext = contextBlocks
      .map((block, index) => {
        return `## ${index + 1}. ${block.label} (${block.blockType})\n**Importance**: ${(block.importanceScore * 100).toFixed(1)}%\n**Content**:\n${block.content}\n`;
      })
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `# DevFlow Context Injection\n\n**Task ID**: ${taskId}\n**Session ID**: ${sessionId}\n**Context Types**: ${contextTypes.join(', ')}\n**Blocks Found**: ${contextBlocks.length}\n\n## Injected Context\n\n${formattedContext}\n\n✅ Context successfully injected into session.`,
        },
      ],
    };
  }

  private async handleAnalytics(args: any): Promise<any> {
    const { metricType = 'session', timeRange = '7d' } = args;

    // This would integrate with the analytics system
    // For now, return a placeholder response
    return {
      content: [
        {
          type: 'text',
          text: `# DevFlow Analytics\n\n**Metric Type**: ${metricType}\n**Time Range**: ${timeRange}\n\n## Metrics\n- **Active Sessions**: 0\n- **Memory Blocks**: 0\n- **Handoffs Executed**: 0\n- **Token Usage**: 0\n- **Cost Savings**: $0.00\n\n*Analytics system integration pending*`,
        },
      ],
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    if (this.verbose) {
      console.log('DevFlow MCP Server started successfully');
    }
  }

  async stop(): Promise<void> {
    await this.server.close();
    
    if (this.verbose) {
      console.log('DevFlow MCP Server stopped');
    }
  }
}
