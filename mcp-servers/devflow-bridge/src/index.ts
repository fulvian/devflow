#!/usr/bin/env node
/**
 * DevFlow Bridge MCP Server
 * Bridges external AI clients (Gemini CLI, Codex) to DevFlow Orchestrator
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const DEVFLOW_ORCHESTRATOR_URL = process.env.DEVFLOW_ORCHESTRATOR_URL || 'http://localhost:3005';
const DEVFLOW_API_TOKEN = process.env.DEVFLOW_API_TOKEN || 'devflow-orchestrator-token';

// Content sanitization for Gemini compatibility
function stripEmojis(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/gu, '');
}

function summarizeContent(content: string): string {
  const cleaned = stripEmojis(content)
    .replace(/[✅❌📋🔧⚡🌟🔗⚠️🎉]/g, '')
    .replace(/[*_`#\[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  return cleaned.length > 200 ? cleaned.substring(0, 200) + '...' : cleaned;
}

class DevFlowBridgeServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'devflow-bridge',
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
      console.error('[MCP Error]', error);
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
          name: 'devflow_synthetic_code',
          description: 'Generate code using DevFlow Synthetic agents',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Code generation prompt',
              },
              context: {
                type: 'object',
                description: 'Additional context for code generation',
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'devflow_synthetic_reasoning',
          description: 'Perform reasoning tasks using DevFlow agents',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Reasoning prompt',
              },
              context: {
                type: 'object',
                description: 'Additional context for reasoning',
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'devflow_memory_query',
          description: 'Query DevFlow semantic memory',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for semantic memory',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'devflow_task_create',
          description: 'Create a task in DevFlow task management',
          inputSchema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Task title',
              },
              description: {
                type: 'string',
                description: 'Task description',
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: 'Task priority',
              },
            },
            required: ['title'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'devflow_synthetic_code':
            return await this.callSyntheticCode(args as any);
          case 'devflow_synthetic_reasoning':
            return await this.callSyntheticReasoning(args as any);
          case 'devflow_memory_query':
            return await this.callMemoryQuery(args as any);
          case 'devflow_task_create':
            return await this.callTaskCreate(args as any);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async callSyntheticCode(args: { prompt: string; context?: any }) {
    const response = await axios.post(
      `${DEVFLOW_ORCHESTRATOR_URL}/api/synthetic/code`,
      {
        prompt: args.prompt,
        context: args.context || {},
      },
      {
        headers: {
          'Authorization': `Bearer ${DEVFLOW_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;
    let narrative = '';

    if (data.success) {
      narrative = `DevFlow ha generato il seguente codice:\n\n\`\`\`\n${data.code || data.result || 'Codice non disponibile'}\n\`\`\`\n\n`;
      if (data.explanation) {
        narrative += `Spiegazione: ${data.explanation}\n`;
      }
      if (data.language) {
        narrative += `Linguaggio: ${data.language}\n`;
      }
    } else {
      narrative = `Errore nella generazione del codice DevFlow: ${data.error || 'Errore sconosciuto'}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: narrative,
        },
      ],
    };
  }

  private async callSyntheticReasoning(args: { prompt: string; context?: any }) {
    const response = await axios.post(
      `${DEVFLOW_ORCHESTRATOR_URL}/api/synthetic/reasoning`,
      {
        prompt: args.prompt,
        context: args.context || {},
      },
      {
        headers: {
          'Authorization': `Bearer ${DEVFLOW_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;
    let narrative = '';

    if (data.success) {
      narrative = `DevFlow ha analizzato la tua richiesta e fornisce questa risposta:\n\n${data.reasoning || data.result || data.analysis || 'Analisi non disponibile'}\n\n`;
      if (data.recommendations) {
        narrative += `Raccomandazioni:\n${data.recommendations}\n`;
      }
      if (data.considerations) {
        narrative += `Considerazioni aggiuntive:\n${data.considerations}\n`;
      }
    } else {
      narrative = `Errore nell'analisi DevFlow: ${data.error || 'Errore sconosciuto'}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: narrative,
        },
      ],
    };
  }

  private async callMemoryQuery(args: { query: string; limit?: number }) {
    const response = await axios.post(
      `${DEVFLOW_ORCHESTRATOR_URL}/api/memory/query`,
      {
        query: args.query,
        limit: 1, // Ultra-conservative: only 1 result for Gemini compatibility
      },
      {
        headers: {
          'Authorization': `Bearer ${DEVFLOW_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;
    let narrative = '';

    if (data.success) {
      if (data.data && data.data.length > 0) {
        narrative = `Found ${data.data.length} results in DevFlow memory for "${args.query}":\n\n`;
        data.data.forEach((item: any, index: number) => {
          const summary = summarizeContent(item.content || item.summary || '');
          narrative += `${index + 1}. ${summary}\n\n`;
        });
      } else {
        narrative = `No results found in DevFlow memory for "${args.query}". The memory database might be empty or the query may need more specific terms.`;
      }
    } else {
      narrative = `Error searching DevFlow memory: ${data.error || 'Unknown error'}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: narrative,
        },
      ],
    };
  }

  private async callTaskCreate(args: { title: string; description?: string; priority?: string }) {
    const response = await axios.post(
      `${DEVFLOW_ORCHESTRATOR_URL}/api/tasks`,
      {
        title: args.title,
        description: args.description,
        priority: args.priority || 'medium',
      },
      {
        headers: {
          'Authorization': `Bearer ${DEVFLOW_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;
    let narrative = '';

    if (data.success) {
      narrative = `✅ Task creato con successo in DevFlow!\n\n`;
      narrative += `Titolo: ${data.task?.title || args.title}\n`;
      narrative += `ID: ${data.task?.id || 'Non disponibile'}\n`;
      narrative += `Priorità: ${data.task?.priority || args.priority || 'medium'}\n`;
      if (data.task?.description) {
        narrative += `Descrizione: ${data.task.description}\n`;
      }
      narrative += `\nIl task è stato aggiunto al sistema DevFlow e può essere tracciato attraverso l'API di orchestrazione.`;
    } else {
      narrative = `❌ Errore nella creazione del task DevFlow: ${data.error || 'Errore sconosciuto'}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: narrative,
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('DevFlow Bridge MCP server running on stdio');
  }
}

const server = new DevFlowBridgeServer();
server.run().catch(console.error);