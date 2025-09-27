#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Ensure local server always loads project .env overriding parent env
dotenv.config({ path: resolve(__dirname, '../../../.env'), override: true });

// Synthetic.new API configuration
const SYNTHETIC_API_URL = 'https://api.synthetic.new/v1';
const SYNTHETIC_API_KEY = process.env.SYNTHETIC_API_KEY;

// Model configuration from environment variables
const DEFAULT_CODE_MODEL = process.env.DEFAULT_CODE_MODEL || 'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct';
const DEFAULT_REASONING_MODEL = process.env.DEFAULT_REASONING_MODEL || 'hf:deepseek-ai/DeepSeek-V3';
const DEFAULT_CONTEXT_MODEL = process.env.DEFAULT_CONTEXT_MODEL || 'hf:Qwen/Qwen2.5-Coder-32B-Instruct';

interface SyntheticRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
}

interface SyntheticResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class SyntheticMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'devflow-synthetic-mcp',
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
          name: 'synthetic_code',
          description: 'Generate code using Synthetic.new specialized code model (Qwen Coder)',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Task identifier (e.g., SYNTHETIC-1A)',
              },
              objective: {
                type: 'string',
                description: 'Clear description of what code to generate',
              },
              language: {
                type: 'string',
                description: 'Programming language (typescript, python, etc.)',
              },
              requirements: {
                type: 'array',
                items: { type: 'string' },
                description: 'Technical requirements and constraints',
              },
              context: {
                type: 'string',
                description: 'Additional context or existing code',
                default: '',
              },
            },
            required: ['task_id', 'objective', 'language'],
          },
        },
        {
          name: 'synthetic_reasoning',
          description: 'Complex reasoning and analysis using DeepSeek V3',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Task identifier (e.g., SYNTHETIC-1A)',
              },
              problem: {
                type: 'string',
                description: 'Problem to analyze or reason about',
              },
              context: {
                type: 'string',
                description: 'Relevant context for the reasoning task',
                default: '',
              },
              approach: {
                type: 'string',
                enum: ['analytical', 'creative', 'systematic', 'comparative'],
                description: 'Reasoning approach to use',
                default: 'analytical',
              },
            },
            required: ['task_id', 'problem'],
          },
        },
        {
          name: 'synthetic_context',
          description: 'Context analysis and understanding using Qwen 72B',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Task identifier (e.g., SYNTHETIC-1A)',
              },
              content: {
                type: 'string',
                description: 'Content to analyze and understand',
              },
              analysis_type: {
                type: 'string',
                enum: ['summarize', 'extract', 'classify', 'explain'],
                description: 'Type of context analysis',
                default: 'explain',
              },
              focus: {
                type: 'string',
                description: 'Specific aspect to focus on',
                default: '',
              },
            },
            required: ['task_id', 'content'],
          },
        },
        {
          name: 'synthetic_auto',
          description: 'Autonomous task execution with intelligent model selection',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Task identifier (e.g., SYNTHETIC-1A)',
              },
              request: {
                type: 'string',
                description: 'Task description for autonomous execution',
              },
              constraints: {
                type: 'array',
                items: { type: 'string' },
                description: 'Constraints and requirements',
                default: [],
              },
              approval_required: {
                type: 'boolean',
                description: 'Whether approval is required before execution',
                default: true,
              },
            },
            required: ['task_id', 'request'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'synthetic_code':
            return await this.handleCodeGeneration(args as any);
          case 'synthetic_reasoning':
            return await this.handleReasoning(args as any);
          case 'synthetic_context':
            return await this.handleContextAnalysis(args as any);
          case 'synthetic_auto':
            return await this.handleAutonomousTask(args as any);
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
  ): Promise<SyntheticResponse> {
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
      } as SyntheticRequest,
      {
        headers: {
          'Authorization': `Bearer ${SYNTHETIC_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  }

  private async handleCodeGeneration(args: {
    task_id: string;
    objective: string;
    language: string;
    requirements?: string[];
    context?: string;
  }) {
    const systemPrompt = `You are a specialized code generation AI. Generate clean, production-ready ${args.language} code that meets the specified requirements.

Focus on:
- Clean, readable code structure
- Proper error handling
- TypeScript strict mode compliance (if TypeScript)
- Following established patterns
- Including necessary imports/dependencies`;

    const userPrompt = `Task ID: ${args.task_id}

Objective: ${args.objective}

Language: ${args.language}

Requirements:
${args.requirements?.map(req => `- ${req}`).join('\n') || 'None specified'}

Context:
${args.context || 'None provided'}

Generate the code with proper documentation and structure.`;

    const response = await this.callSyntheticAPI(
      DEFAULT_CODE_MODEL,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
    );

    return {
      content: [
        {
          type: 'text',
          text: `# SYNTHETIC CODE GENERATION - ${args.task_id}

## Generated Code

${response.choices[0].message.content}

## Usage Stats
- Model: ${DEFAULT_CODE_MODEL} (Code Specialist)
- Tokens: ${response.usage?.total_tokens || 'N/A'}
- Language: ${args.language}`,
        },
      ],
    };
  }

  private async handleReasoning(args: {
    task_id: string;
    problem: string;
    context?: string;
    approach?: string;
  }) {
    const systemPrompt = `You are a specialized reasoning AI using advanced analytical capabilities. Provide deep, structured analysis with clear logical progression.

Reasoning approach: ${args.approach || 'analytical'}

Focus on:
- Clear logical structure
- Evidence-based conclusions  
- Alternative perspectives
- Practical implications
- Step-by-step analysis`;

    const userPrompt = `Task ID: ${args.task_id}

Problem to analyze: ${args.problem}

Context: ${args.context || 'None provided'}

Provide comprehensive reasoning and analysis.`;

    const response = await this.callSyntheticAPI(
      DEFAULT_REASONING_MODEL,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
    );

    return {
      content: [
        {
          type: 'text',
          text: `# SYNTHETIC REASONING ANALYSIS - ${args.task_id}

## Analysis Results

${response.choices[0].message.content}

## Usage Stats
- Model: ${DEFAULT_REASONING_MODEL} (Reasoning Specialist)  
- Tokens: ${response.usage?.total_tokens || 'N/A'}
- Approach: ${args.approach || 'analytical'}`,
        },
      ],
    };
  }

  private async handleContextAnalysis(args: {
    task_id: string;
    content: string;
    analysis_type?: string;
    focus?: string;
  }) {
    const systemPrompt = `You are a specialized context analysis AI. Provide thorough understanding and analysis of the provided content.

Analysis type: ${args.analysis_type || 'explain'}
Focus area: ${args.focus || 'general analysis'}

Focus on:
- Key insights and patterns
- Important relationships
- Context significance
- Actionable conclusions`;

    const userPrompt = `Task ID: ${args.task_id}

Content to analyze:
${args.content}

Please provide ${args.analysis_type || 'explanation'} focusing on: ${args.focus || 'general analysis'}`;

    const response = await this.callSyntheticAPI(
      DEFAULT_CONTEXT_MODEL,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]
    );

    return {
      content: [
        {
          type: 'text',
          text: `# SYNTHETIC CONTEXT ANALYSIS - ${args.task_id}

## Context Analysis Results

${response.choices[0].message.content}

## Usage Stats
- Model: ${DEFAULT_CONTEXT_MODEL} (Context Specialist)
- Tokens: ${response.usage?.total_tokens || 'N/A'}
- Analysis: ${args.analysis_type || 'explain'}`,
        },
      ],
    };
  }

  private async handleAutonomousTask(args: {
    task_id: string;
    request: string;
    constraints?: string[];
    approval_required?: boolean;
  }) {
    // First, classify the task to determine the best model
    const classificationPrompt = `Analyze this task and determine the best approach:

Task: ${args.request}
Constraints: ${args.constraints?.join(', ') || 'None'}

Classify as: CODE, REASONING, or CONTEXT
Provide a brief explanation of your classification.`;

    const classificationResponse = await this.callSyntheticAPI(
      DEFAULT_CONTEXT_MODEL,
      [{ role: 'user', content: classificationPrompt }]
    );

    const classification = classificationResponse.choices[0].message.content;

    // Determine model based on classification
    let selectedModel: string;
    let modelType: string;

    if (classification.toLowerCase().includes('code')) {
      selectedModel = DEFAULT_CODE_MODEL;
      modelType = 'Code Specialist';
    } else if (classification.toLowerCase().includes('reasoning')) {
      selectedModel = DEFAULT_REASONING_MODEL;
      modelType = 'Reasoning Specialist';
    } else {
      selectedModel = DEFAULT_CONTEXT_MODEL;
      modelType = 'Context Specialist';
    }

    // Execute the task with the selected model
    const executionPrompt = `Task ID: ${args.task_id}

Request: ${args.request}

Constraints:
${args.constraints?.map(c => `- ${c}`).join('\n') || '- None specified'}

${args.approval_required ? 'NOTE: This task requires approval before implementation.' : 'Proceed with autonomous execution.'}`;

    const executionResponse = await this.callSyntheticAPI(selectedModel, [
      { role: 'user', content: executionPrompt },
    ]);

    return {
      content: [
        {
          type: 'text',
          text: `# SYNTHETIC AUTONOMOUS EXECUTION - ${args.task_id}

## Task Classification
${classification}

## Selected Model
${selectedModel} (${modelType})

## Execution Results

${executionResponse.choices[0].message.content}

## Approval Status
${args.approval_required ? '⚠️  APPROVAL REQUIRED before implementation' : '✅ Autonomous execution authorized'}

## Usage Stats
- Classification Tokens: ${classificationResponse.usage?.total_tokens || 'N/A'}
- Execution Tokens: ${executionResponse.usage?.total_tokens || 'N/A'}`,
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DevFlow Synthetic MCP server running on stdio');
  }
}

const server = new SyntheticMCPServer();
server.run().catch(console.error);
