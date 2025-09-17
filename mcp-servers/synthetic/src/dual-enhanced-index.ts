#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { AutonomousFileManager, FileOperation } from './file-operations.js';
import { MCPErrorFactory, MCPResponseBuilder, MCPError, MCPErrorCode } from './enhanced-tools.js';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Load .env from project root (2 levels up from mcp-servers/synthetic/)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Force-load project .env and override any pre-set values from parent process
dotenv.config({ path: resolve(__dirname, '../../../.env'), override: true });

// Synthetic.new API configuration
const SYNTHETIC_API_URL = process.env.SYNTHETIC_API_BASE_URL || 'https://api.synthetic.new/v1';
const SYNTHETIC_API_KEY = process.env.SYNTHETIC_API_KEY;

// Debug: Log API configuration (without exposing full key)
console.log(`[Synthetic MCP] API Configuration:
- Base URL: ${SYNTHETIC_API_URL}
- API Key: ${SYNTHETIC_API_KEY ? `${SYNTHETIC_API_KEY.substring(0, 15)}...` : 'NOT LOADED'}`);

// Enhanced configuration
const DEVFLOW_PROJECT_ROOT = process.env.DEVFLOW_PROJECT_ROOT || process.cwd();
const AUTONOMOUS_FILE_OPERATIONS = process.env.AUTONOMOUS_FILE_OPERATIONS === 'true';
const REQUIRE_APPROVAL = process.env.REQUIRE_APPROVAL !== 'true'; // Default to false for autonomous operations
const CREATE_BACKUPS = process.env.CREATE_BACKUPS !== 'false';
const SYNTHETIC_DELETE_ENABLED = process.env.SYNTHETIC_DELETE_ENABLED === 'true';
const ALLOWED_FILE_EXTENSIONS = process.env.ALLOWED_FILE_EXTENSIONS?.split(',') || 
  ['.ts', '.js', '.json', '.md', '.py', '.tsx', '.jsx', '.css', '.scss', '.html', '.yml', '.yaml', '.txt', '.sh', '.sql', '.env'];

console.log(`[Synthetic MCP] Configuration loaded:
- Project Root: ${DEVFLOW_PROJECT_ROOT}
- Autonomous File Operations: ${AUTONOMOUS_FILE_OPERATIONS}
- Require Approval: ${REQUIRE_APPROVAL}
- Create Backups: ${CREATE_BACKUPS}
- Delete Operations: ${SYNTHETIC_DELETE_ENABLED}
- Allowed Extensions: ${ALLOWED_FILE_EXTENSIONS.length} types`);

// Expand allowed paths to include all DevFlow project subdirectories
const getAllowedPaths = () => {
  const basePaths = [
    resolve(DEVFLOW_PROJECT_ROOT),
    resolve(DEVFLOW_PROJECT_ROOT, 'packages'),
    resolve(DEVFLOW_PROJECT_ROOT, 'mcp-servers'),
    resolve(DEVFLOW_PROJECT_ROOT, 'sessions'),
    resolve(DEVFLOW_PROJECT_ROOT, 'docs'),
    resolve(DEVFLOW_PROJECT_ROOT, 'tools'),
    resolve(DEVFLOW_PROJECT_ROOT, 'src'),
    resolve(DEVFLOW_PROJECT_ROOT, 'dist'),
    resolve(DEVFLOW_PROJECT_ROOT, 'test'),
    resolve(DEVFLOW_PROJECT_ROOT, 'tests'),
    resolve(DEVFLOW_PROJECT_ROOT, 'scripts'),
    resolve(DEVFLOW_PROJECT_ROOT, 'config'),
    resolve(DEVFLOW_PROJECT_ROOT, 'configs'),
    resolve(DEVFLOW_PROJECT_ROOT, 'lib'),
    resolve(DEVFLOW_PROJECT_ROOT, 'build'),
    resolve(DEVFLOW_PROJECT_ROOT, 'public'),
  ];
  
  console.log(`[Synthetic MCP] Allowed paths: ${basePaths.length} directories`);
  return basePaths;
};

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

// MCP-compliant response interface
interface MCPResponse<T = any> {
  success: boolean;
  data?: T;
  error?: MCPError;
  metadata: {
    requestId: string;
    timestamp: string;
    version: string;
    model?: string;
    tokensUsed?: number;
  };
}


interface FileModification {
  file: string;
  operation: 'write' | 'append' | 'patch' | 'create';
  content: string;
  patches?: Array<{
    line: number;
    oldContent: string;
    newContent: string;
  }>;
}

interface FileOperationResult {
  path: string;
  status: 'SUCCESS' | 'ERROR' | 'SKIPPED';
  message?: string;
  tokensUsed?: number;
  tokensSaved?: number;
}

export class EnhancedSyntheticMCPServer {
  private server: Server;
  private allowedPaths: string[];
  private fileManager: AutonomousFileManager;
  private requestIdCounter: number = 0;
  private db: any;

  constructor() {
    // Initialize expanded allowed paths for full project control
    this.allowedPaths = getAllowedPaths();
    
    // Initialize autonomous file manager
    this.fileManager = new AutonomousFileManager(
      DEVFLOW_PROJECT_ROOT,
      this.allowedPaths,
      ALLOWED_FILE_EXTENSIONS,
      CREATE_BACKUPS,
      SYNTHETIC_DELETE_ENABLED
    );
    
    console.log(`[Synthetic MCP] Full project access enabled: ${this.allowedPaths.length} paths`);
    this.server = new Server(
      {
        name: 'devflow-synthetic-enhanced',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.allowedPaths = [DEVFLOW_PROJECT_ROOT];
    this.initDatabase();
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private async initDatabase(): Promise<void> {
    try {
      const dbPath = resolve(DEVFLOW_PROJECT_ROOT, 'data/devflow.sqlite');
      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      console.log('[Synthetic MCP] Connected to DevFlow database');
    } catch (error) {
      console.error('[Synthetic MCP] Error connecting to database:', error);
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[Enhanced MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Original tools maintained
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
        // NEW ENHANCED TOOLS
        {
          name: 'synthetic_auto_file',
          description: '🚀 AUTONOMOUS CODE GENERATION WITH DIRECT FILE MODIFICATION - Bypasses Claude token usage for file operations',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Task identifier (e.g., DEVFLOW-AUTO-FILE-001)',
              },
              request: {
                type: 'string',
                description: 'Task description for autonomous code generation and file modification',
              },
              target_files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific files to modify (optional - will auto-detect if not provided)',
                default: [],
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
              approval_required: {
                type: 'boolean',
                description: 'Whether approval is required before file modification',
                default: REQUIRE_APPROVAL,
              },
            },
            required: ['task_id', 'request'],
          },
        },
        
        // === DIRECT FILE OPERATIONS ===
        {
          name: 'synthetic_file_write',
          description: '✏️ WRITE FILE - Write/overwrite content to a file',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Path to the file to write (relative to project root)',
              },
              content: {
                type: 'string',
                description: 'Content to write to the file',
              },
              backup: {
                type: 'boolean',
                description: 'Create backup before overwriting',
                default: true,
              },
            },
            required: ['file_path', 'content'],
          },
        },
        {
          name: 'synthetic_file_read',
          description: '📖 READ FILE - Read content from a file',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Path to the file to read (relative to project root)',
              },
            },
            required: ['file_path'],
          },
        },
        {
          name: 'synthetic_file_create',
          description: '📁 CREATE FILE - Create a new file with content',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Path to the file to create (relative to project root)',
              },
              content: {
                type: 'string',
                description: 'Content to write to the file',
              },
              backup: {
                type: 'boolean',
                description: 'Create backup if file exists',
                default: true,
              },
            },
            required: ['file_path', 'content'],
          },
        },
        {
          name: 'synthetic_file_delete',
          description: '🗑️ DELETE FILE - Delete a file (requires SYNTHETIC_DELETE_ENABLED=true)',
          inputSchema: {
            type: 'object',
            properties: {
              file_path: {
                type: 'string',
                description: 'Path to the file to delete (relative to project root)',
              },
              backup: {
                type: 'boolean',
                description: 'Create backup before deleting',
                default: true,
              },
            },
            required: ['file_path'],
          },
        },
        {
          name: 'synthetic_batch_operations',
          description: '⚡ BATCH FILE OPERATIONS - Execute multiple file operations atomically',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Task identifier for the batch operation',
              },
              operations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['create', 'write', 'delete', 'move', 'copy', 'mkdir', 'rmdir'],
                      description: 'Type of operation to perform',
                    },
                    path: {
                      type: 'string',
                      description: 'File/directory path (relative to project root)',
                    },
                    content: {
                      type: 'string',
                      description: 'Content for create/write operations',
                    },
                    targetPath: {
                      type: 'string',
                      description: 'Target path for move/copy operations',
                    },
                    recursive: {
                      type: 'boolean',
                      description: 'Recursive flag for directory operations',
                    },
                    backup: {
                      type: 'boolean',
                      description: 'Create backup before operation',
                    },
                  },
                  required: ['type', 'path'],
                },
                description: 'Array of file operations to execute',
              },
              description: {
                type: 'string',
                description: 'Description of the batch operation',
                default: '',
              },
            },
            required: ['task_id', 'operations'],
          },
        },
        {
          name: 'synthetic_code_to_file',
          description: '💾 GENERATE CODE TO FILE - Generate code and write directly to file',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Task identifier',
              },
              file_path: {
                type: 'string',
                description: 'Target file path (relative to project root)',
              },
              objective: {
                type: 'string',
                description: 'What code to generate',
              },
              language: {
                type: 'string',
                description: 'Programming language',
              },
              requirements: {
                type: 'array',
                items: { type: 'string' },
                description: 'Technical requirements',
              },
              context: {
                type: 'string',
                description: 'Additional context',
                default: '',
              },
              backup: {
                type: 'boolean',
                description: 'Create backup if file exists',
                default: true,
              },
            },
            required: ['task_id', 'file_path', 'objective', 'language'],
          },
        },
        
        {
          name: 'synthetic_batch_code',
          description: '⚡ BATCH CODE GENERATION - Process multiple related files in a single call to optimize Synthetic API usage',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Batch task identifier (e.g., DEVFLOW-BATCH-001)',
              },
              batch_requests: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    file_path: { type: 'string' },
                    objective: { type: 'string' },
                    language: { type: 'string' },
                    requirements: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                  required: ['file_path', 'objective', 'language'],
                },
                description: 'Array of code generation requests to process in batch',
              },
              shared_context: {
                type: 'string',
                description: 'Context shared across all batch requests',
                default: '',
              },
              apply_changes: {
                type: 'boolean',
                description: 'Whether to apply changes directly to files',
                default: AUTONOMOUS_FILE_OPERATIONS,
              },
            },
            required: ['task_id', 'batch_requests'],
          },
        },
        {
          name: 'synthetic_file_analyzer',
          description: '🔍 FILE ANALYSIS AND MODIFICATION PLANNING - Analyze existing files and plan modifications',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Analysis task identifier',
              },
              file_paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Files to analyze',
              },
              analysis_goal: {
                type: 'string',
                description: 'What to analyze the files for',
              },
              modification_intent: {
                type: 'string',
                description: 'What modifications are planned',
                default: '',
              },
            },
            required: ['task_id', 'file_paths', 'analysis_goal'],
          },
        },
        {
          name: 'synthetic_bash',
          description: '⚡ TERMINAL COMMAND EXECUTION - Execute bash commands with safety controls and output capture',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'Task identifier (e.g., DEVFLOW-BASH-001)',
              },
              command: {
                type: 'string',
                description: 'Bash command to execute',
              },
              working_directory: {
                type: 'string',
                description: 'Working directory for command execution (relative to project root)',
                default: '.',
              },
              timeout_ms: {
                type: 'number',
                description: 'Timeout in milliseconds (max 60000ms = 1 minute)',
                default: 30000,
                minimum: 1000,
                maximum: 60000,
              },
              capture_output: {
                type: 'boolean',
                description: 'Capture stdout/stderr output',
                default: true,
              },
              allow_interactive: {
                type: 'boolean',
                description: 'Allow interactive commands (dangerous - use with caution)',
                default: false,
              },
            },
            required: ['task_id', 'command'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const requestId = this.generateRequestId();
        
        switch (name) {
          case 'synthetic_code':
            return await this.handleWithErrorHandling(() => this.handleCodeGeneration(args as any, requestId), requestId);
          case 'synthetic_reasoning':
            return await this.handleWithErrorHandling(() => this.handleReasoning(args as any, requestId), requestId);
          case 'synthetic_context':
            return await this.handleWithErrorHandling(() => this.handleContextAnalysis(args as any, requestId), requestId);
          case 'synthetic_auto':
            return await this.handleWithErrorHandling(() => this.handleAutonomousTask(args as any, requestId), requestId);
          // New enhanced handlers
          case 'synthetic_auto_file':
            return await this.handleWithErrorHandling(() => this.handleAutonomousFileOperation(args as any, requestId), requestId);
          case 'synthetic_batch_code':
            return await this.handleWithErrorHandling(() => this.handleBatchCodeGeneration(args as any, requestId), requestId);
          case 'synthetic_file_analyzer':
            return await this.handleWithErrorHandling(() => this.handleFileAnalysis(args as any, requestId), requestId);
          case 'synthetic_bash':
            return await this.handleWithErrorHandling(() => this.handleBashCommand(args as any, requestId), requestId);
          
          // === DIRECT FILE OPERATION HANDLERS ===
          case 'synthetic_file_write':
            return await this.handleWithErrorHandling(() => this.handleFileWrite(args as any, requestId), requestId);
          case 'synthetic_file_read':
            return await this.handleWithErrorHandling(() => this.handleFileRead(args as any, requestId), requestId);
          case 'synthetic_file_create':
            return await this.handleWithErrorHandling(() => this.handleFileCreate(args as any, requestId), requestId);
          case 'synthetic_file_delete':
            return await this.handleWithErrorHandling(() => this.handleFileDelete(args as any, requestId), requestId);
          case 'synthetic_batch_operations':
            return await this.handleWithErrorHandling(() => this.handleBatchOperations(args as any, requestId), requestId);
          case 'synthetic_code_to_file':
            return await this.handleWithErrorHandling(() => this.handleCodeToFile(args as any, requestId), requestId);
          
          default:
            return this.formatErrorResponse(
              MCPErrorFactory.create(MCPErrorCode.INVALID_INPUT, `Unknown tool: ${name}`),
              this.generateRequestId()
            );
        }
      } catch (error) {
        return this.formatErrorResponse(
          MCPErrorFactory.create(MCPErrorCode.INTERNAL_ERROR, error instanceof Error ? error.message : String(error)),
          this.generateRequestId()
        );
      }
    });
  }

  private async callSyntheticAPI(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    maxTokens: number = 4000
  ): Promise<SyntheticResponse> {
    // Direct API call - no rate limiting
    if (!SYNTHETIC_API_KEY) {
      throw new Error('SYNTHETIC_API_KEY not configured');
    }

    console.log(`[Synthetic API] Direct call to ${model} (No rate limiting)`);

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
        timeout: 120000 // 2 minute timeout
      }
    );

    return response.data;
  }


  // MCP UTILITY METHODS
  private generateRequestId(): string {
    return `mcp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2)}`;
  }

  private async handleWithErrorHandling<T>(
    handler: () => Promise<any>,
    requestId: string
  ): Promise<any> {
    const startTime = Date.now();
    try {
      const result = await handler();
      return {
        ...result,
        content: result.content?.map((c: any) => ({
          ...c,
          text: c.text + `\n\n**Request ID**: ${requestId}\n**Processing Time**: ${Date.now() - startTime}ms`
        }))
      };
    } catch (error) {
      console.error(`[MCP Error ${requestId}]:`, error);
      return this.formatErrorResponse(
        MCPErrorFactory.fromError(error instanceof Error ? error : new Error(String(error))),
        requestId,
        Date.now() - startTime
      );
    }
  }

  private formatErrorResponse(error: MCPError, requestId: string, processingTime?: number): any {
    return {
      content: [
        {
          type: 'text',
          text: `# ❌ MCP ERROR - ${error.code}\n\n**Message**: ${error.message}\n\n**Request ID**: ${requestId}\n**Timestamp**: ${error.timestamp}\n${processingTime ? `**Processing Time**: ${processingTime}ms\n` : ''}\n${error.details ? `**Details**: ${JSON.stringify(error.details, null, 2)}` : ''}`,
        },
      ],
      isError: true,
    };
  }

  // ORIGINAL METHODS (maintained for backward compatibility)
  private async handleCodeGeneration(args: {
    task_id: string;
    objective: string;
    language: string;
    requirements?: string[];
    context?: string;
  }, requestId?: string) {
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

    const mcpResponse = MCPResponseBuilder.success(
      {
        generatedCode: response.choices[0].message.content,
        language: args.language,
        objective: args.objective
      },
      requestId || this.generateRequestId()
    )
    .withModel(DEFAULT_CODE_MODEL)
    .withTokens(response.usage?.total_tokens || 0)
    .build();

    return {
      content: [
        {
          type: 'text',
          text: `# SYNTHETIC CODE GENERATION - ${args.task_id} → ${DEFAULT_CODE_MODEL}

## Generated Code

${response.choices[0].message.content}

## Usage Stats
- Model: ${DEFAULT_CODE_MODEL} (Code Specialist)
- Tokens: ${response.usage?.total_tokens || 'N/A'}
- Language: ${args.language}

## MCP Response Metadata
${JSON.stringify(mcpResponse.metadata, null, 2)}`,
        },
      ],
    };
  }

  private async handleReasoning(args: {
    task_id: string;
    problem: string;
    context?: string;
    approach?: string;
  }, requestId?: string) {
    if (this.db) {
      try {
        const tasks = await this.db.all('SELECT * FROM tasks WHERE description LIKE ?', `%${args.problem}%`);
        if (tasks && tasks.length > 0) {
          const taskDetails = tasks.map((t: any) => `- **${t.title}**: ${t.status} - ${t.description}`).join('\n');
          return {
            content: [
              {
                type: 'text',
                text: `# COMETA MEMORY ANALYSIS - ${args.task_id}\n\n## Analysis Results\n\n${taskDetails}\n\n## Usage Stats\n- Datasource: Cometa (SQLite)\n- Tasks Found: ${tasks.length}`
              },
            ],
          };
        }
      } catch (error) {
        console.error('[Synthetic MCP] Error querying database:', error);
      }
    }

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
          text: `# SYNTHETIC REASONING ANALYSIS - ${args.task_id} → ${DEFAULT_REASONING_MODEL}\n\n## Analysis Results\n\n${response.choices[0].message.content}\n\n## Usage Stats\n- Model: ${DEFAULT_REASONING_MODEL} (Reasoning Specialist)  \n- Tokens: ${response.usage?.total_tokens || 'N/A'}\n- Approach: ${args.approach || 'analytical'}`,
        },
      ],
    };
  }

  private async handleContextAnalysis(args: {
    task_id: string;
    content: string;
    analysis_type?: string;
    focus?: string;
  }, requestId?: string) {
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
          text: `# SYNTHETIC CONTEXT ANALYSIS - ${args.task_id} → ${DEFAULT_CONTEXT_MODEL}

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
  }, requestId?: string) {
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
          text: `# SYNTHETIC AUTONOMOUS EXECUTION - ${args.task_id} → ${selectedModel}

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

  // NEW ENHANCED METHODS
  private async handleAutonomousFileOperation(args: {
    task_id: string;
    request: string;
    target_files?: string[];
    create_backup?: boolean;
    dry_run?: boolean;
    approval_required?: boolean;
  }, requestId?: string): Promise<any> {
    const startTime = Date.now();
    
    // 1. Generate the code modifications using Synthetic
    const systemPrompt = `You are an autonomous code generation AI with direct file modification capabilities.

Generate structured JSON output for direct file application with this exact format:
{
  "modifications": [
    {
      "file": "path/to/file.ts",
      "operation": "write|append|patch|create",
      "content": "full file content or content to append",
      "patches": [
        {
          "line": 42,
          "oldContent": "old line content",
          "newContent": "new line content"
        }
      ]
    }
  ],
  "summary": "Brief description of changes made",
  "tokensEstimatedSaved": 500
}

Focus on:
- Precise file paths relative to project root
- Complete, compilable code
- Proper TypeScript/JavaScript syntax
- Following project patterns
- Error handling and edge cases`;

    const userPrompt = `Task ID: ${args.task_id}

Request: ${args.request}

Target Files: ${args.target_files?.length ? args.target_files.join(', ') : 'Auto-detect based on request'}

Project Root: ${DEVFLOW_PROJECT_ROOT}

Generate code modifications for direct file application.`;

    const response = await this.callSyntheticAPI(
      DEFAULT_CODE_MODEL,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      8000 // Increased token limit for complex modifications
    );

    // 2. Parse the structured response
    let modifications: FileModification[];
    let summary: string;
    let tokensEstimatedSaved: number;

    try {
      const result = JSON.parse(response.choices[0].message.content);
      modifications = result.modifications;
      summary = result.summary;
      tokensEstimatedSaved = result.tokensEstimatedSaved || 0;
    } catch (parseError) {
      // Fallback: try to extract modifications from text response
      modifications = this.parseModificationInstructions(response.choices[0].message.content);
      summary = 'Code modifications generated';
      tokensEstimatedSaved = (modifications.length * 300); // Estimate
    }

    // 3. Apply modifications (if not dry_run)
    const results: FileOperationResult[] = [];
    
    if (!args.dry_run && (!args.approval_required || !REQUIRE_APPROVAL)) {
      for (const mod of modifications) {
        try {
          const result = await this.applyFileModification(mod, args.create_backup);
          results.push(result);
        } catch (error) {
          results.push({
            path: mod.file,
            status: 'ERROR',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } else {
      // Dry run or approval required
      for (const mod of modifications) {
        results.push({
          path: mod.file,
          status: 'SKIPPED',
          message: args.dry_run ? 'Dry run mode' : 'Approval required',
        });
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      content: [
        {
          type: 'text',
          text: `# 🚀 AUTONOMOUS FILE OPERATION COMPLETED - ${args.task_id}

## Summary
${summary}

## Files ${args.dry_run ? 'Analyzed' : 'Modified'}
${results.map(r => `- **${r.path}**: ${r.status}${r.message ? ` (${r.message})` : ''}`).join('\n')}

## Modifications Planned/Applied
${modifications.map(m => `### ${m.file}
- **Operation**: ${m.operation}
- **Content Length**: ${m.content.length} characters
${m.operation === 'patch' && m.patches ? `- **Patches**: ${m.patches.length} line changes` : ''}`).join('\n')}

## Token Efficiency Report
- **Synthetic Generation**: ${response.usage?.total_tokens || 'N/A'} tokens
- **Claude File Operations**: 0 tokens ✅ (BYPASSED)
- **Estimated Token Savings**: ~${tokensEstimatedSaved} tokens
- **Cost Efficiency**: Direct file modification without Claude processing

## Execution Stats
- **Execution Time**: ${executionTime}ms
- **Files Processed**: ${modifications.length}
- **Success Rate**: ${results.filter(r => r.status === 'SUCCESS').length}/${results.length}
- **Mode**: ${args.dry_run ? '🔍 DRY RUN' : args.approval_required && REQUIRE_APPROVAL ? '⚠️ APPROVAL REQUIRED' : '🎯 AUTONOMOUS EXECUTION'}

${args.approval_required && REQUIRE_APPROVAL ? '⚠️ **Approval required before implementation. Run without approval_required=true to apply changes.**' : ''}`,
        },
      ],
    };
  }

  private async handleBatchCodeGeneration(args: {
    task_id: string;
    batch_requests: Array<{
      file_path: string;
      objective: string;
      language: string;
      requirements?: string[];
    }>;
    shared_context?: string;
    apply_changes?: boolean;
  }, requestId?: string): Promise<any> {
    const startTime = Date.now();

    // Optimize by combining all requests into a single Synthetic API call
    const systemPrompt = `You are a batch code generation AI. Process multiple related code generation requests efficiently in a single response.

Generate structured JSON output with this exact format:
{
  "batch_results": [
    {
      "file_path": "path/to/file.ts",
      "language": "typescript",
      "content": "complete file content",
      "summary": "brief description of what was generated"
    }
  ],
  "shared_insights": "common patterns or insights across all files",
  "total_files": 3
}

Focus on:
- Consistent patterns across all files
- Shared utilities and imports
- Proper cross-file dependencies
- Complete, compilable code for each file`;

    const batchPrompt = `Task ID: ${args.task_id}

Shared Context: ${args.shared_context || 'None provided'}

Batch Requests (${args.batch_requests.length} files):

${args.batch_requests.map((req, i) => `
### Request ${i + 1}: ${req.file_path}
- **Objective**: ${req.objective}
- **Language**: ${req.language}
- **Requirements**: ${req.requirements?.join(', ') || 'None'}
`).join('\n')}

Generate code for all files in a single structured response.`;

    const response = await this.callSyntheticAPI(
      DEFAULT_CODE_MODEL,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: batchPrompt },
      ],
      12000 // Large token limit for batch processing
    );

    // Parse batch results
    let batchResults: Array<{
      file_path: string;
      language: string;
      content: string;
      summary: string;
    }>;
    let sharedInsights: string;

    try {
      const result = JSON.parse(response.choices[0].message.content);
      batchResults = result.batch_results;
      sharedInsights = result.shared_insights || '';
    } catch (parseError) {
      // Fallback parsing
      batchResults = args.batch_requests.map(req => ({
        file_path: req.file_path,
        language: req.language,
        content: `// Generated content for ${req.objective}`,
        summary: req.objective,
      }));
      sharedInsights = 'Batch generation completed with fallback parsing';
    }

    // Apply changes if requested
    const fileResults: FileOperationResult[] = [];
    
    if (args.apply_changes && AUTONOMOUS_FILE_OPERATIONS) {
      for (const result of batchResults) {
        try {
          const modification: FileModification = {
            file: result.file_path,
            operation: existsSync(resolve(DEVFLOW_PROJECT_ROOT, result.file_path)) ? 'write' : 'create',
            content: result.content,
          };
          
          const fileResult = await this.applyFileModification(modification, CREATE_BACKUPS);
          fileResults.push(fileResult);
        } catch (error) {
          fileResults.push({
            path: result.file_path,
            status: 'ERROR',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const executionTime = Date.now() - startTime;
    const totalTokensSaved = args.batch_requests.length * 400; // Estimate savings from batch processing

    return {
      content: [
        {
          type: 'text',
          text: `# ⚡ BATCH CODE GENERATION COMPLETED - ${args.task_id}

## Batch Summary
${sharedInsights}

## Files Generated (${batchResults.length})
${batchResults.map(r => `- **${r.file_path}** (${r.language}): ${r.summary}`).join('\n')}

${args.apply_changes && AUTONOMOUS_FILE_OPERATIONS ? `## File Application Results
${fileResults.map(r => `- **${r.path}**: ${r.status}${r.message ? ` (${r.message})` : ''}`).join('\n')}` : ''}

## Batch Efficiency Report
- **Single API Call**: ${response.usage?.total_tokens || 'N/A'} tokens
- **Files Processed**: ${batchResults.length}
- **Estimated Individual Calls**: ${args.batch_requests.length} calls saved
- **Token Efficiency**: ~${totalTokensSaved} tokens saved vs individual calls
- **Time Efficiency**: ${executionTime}ms for ${batchResults.length} files

## Generated Code Preview
${batchResults.slice(0, 2).map(r => `### ${r.file_path}
\`\`\`${r.language}
${r.content.slice(0, 300)}${r.content.length > 300 ? '...' : ''}
\`\`\``).join('\n')}

${!args.apply_changes ? '💡 **Tip**: Set apply_changes=true to automatically write generated code to files' : ''}`,
        },
      ],
    };
  }

  private async handleFileAnalysis(args: {
    task_id: string;
    file_paths: string[];
    analysis_goal: string;
    modification_intent?: string;
  }, requestId?: string): Promise<any> {
    // Read and analyze multiple files
    const fileContents: Array<{ path: string; content: string; error?: string }> = [];
    
    for (const filePath of args.file_paths) {
      try {
        const fullPath = resolve(DEVFLOW_PROJECT_ROOT, filePath);
        if (!this.isPathAllowed(fullPath)) {
          fileContents.push({ path: filePath, content: '', error: 'Path not allowed' });
          continue;
        }
        
        if (!existsSync(fullPath)) {
          fileContents.push({ path: filePath, content: '', error: 'File not found' });
          continue;
        }

        const content = await fs.readFile(fullPath, 'utf8');
        fileContents.push({ path: filePath, content });
      } catch (error) {
        fileContents.push({
          path: filePath,
          content: '',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Analyze with Synthetic
    const systemPrompt = `You are a specialized file analysis AI. Analyze multiple files and provide comprehensive insights for the specified goal.

Focus on:
- Code structure and patterns
- Dependencies and relationships
- Potential issues or improvements
- Modification recommendations
- Impact analysis`;

    const analysisPrompt = `Task ID: ${args.task_id}

Analysis Goal: ${args.analysis_goal}

Modification Intent: ${args.modification_intent || 'General analysis'}

Files to Analyze (${fileContents.length}):

${fileContents.map(f => `
### ${f.path}
${f.error ? `ERROR: ${f.error}` : `
\`\`\`
${f.content.slice(0, 2000)}${f.content.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
`}
`).join('\n')}

Provide comprehensive analysis and recommendations.`;

    const response = await this.callSyntheticAPI(
      DEFAULT_CONTEXT_MODEL,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: analysisPrompt },
      ],
      8000
    );

    return {
      content: [
        {
          type: 'text',
          text: `# 🔍 FILE ANALYSIS COMPLETED - ${args.task_id}

## Analysis Goal
${args.analysis_goal}

## Files Analyzed
${fileContents.map(f => `- **${f.path}**: ${f.error || `${f.content.length} characters`}`).join('\n')}

## Analysis Results

${response.choices[0].message.content}

## Usage Stats
- Model: ${DEFAULT_CONTEXT_MODEL} (Context Specialist)
- Tokens: ${response.usage?.total_tokens || 'N/A'}
- Files Processed: ${fileContents.length}
- Success Rate: ${fileContents.filter(f => !f.error).length}/${fileContents.length}`,
        },
      ],
    };
  }

  private async handleBashCommand(args: {
    task_id: string;
    command: string;
    working_directory?: string;
    timeout_ms?: number;
    capture_output?: boolean;
    allow_interactive?: boolean;
  }, requestId: string) {
    const startTime = Date.now();
    
    // Security validations
    const workingDir = resolve(DEVFLOW_PROJECT_ROOT, args.working_directory || '.');
    
    // Ensure working directory is within allowed paths
    const allowedPaths = getAllowedPaths();
    const isAllowed = allowedPaths.some(allowedPath => workingDir.startsWith(allowedPath));
    
    if (!isAllowed) {
      throw MCPErrorFactory.create(MCPErrorCode.ACCESS_DENIED, 
        `Working directory ${workingDir} is outside allowed paths`);
    }
    
    // Command safety checks
    const dangerousCommands = ['rm -rf', 'sudo', 'su', 'chmod 777', 'format', 'fdisk', 'mkfs'];
    const isDangerous = dangerousCommands.some(cmd => args.command.toLowerCase().includes(cmd));
    
    if (isDangerous) {
      throw MCPErrorFactory.create(MCPErrorCode.ACCESS_DENIED,
        'Command contains dangerous operations that are blocked for security');
    }
    
    // Timeout validation
    const timeout = Math.min(args.timeout_ms || 30000, 60000); // Max 1 minute
    
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', args.command], {
        cwd: workingDir,
        stdio: args.capture_output !== false ? 'pipe' : 'inherit',
        timeout: timeout,
        killSignal: 'SIGTERM',
      });
      
      let stdout = '';
      let stderr = '';
      let isCompleted = false;
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!isCompleted) {
          child.kill('SIGTERM');
          reject(MCPErrorFactory.create(MCPErrorCode.TIMEOUT, 
            `Command timed out after ${timeout}ms`));
        }
      }, timeout);
      
      if (args.capture_output !== false) {
        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });
        
        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }
      
      child.on('close', (code, signal) => {
        isCompleted = true;
        clearTimeout(timeoutId);
        
        const executionTime = Date.now() - startTime;
        const success = code === 0;
        
        const auditEntry = {
          operation: 'bash_command',
          task_id: args.task_id,
          command: args.command,
          working_directory: workingDir,
          exit_code: code,
          signal: signal,
          execution_time_ms: executionTime,
          success: success,
          stdout_length: stdout.length,
          stderr_length: stderr.length,
          timestamp: new Date().toISOString(),
          request_id: requestId
        };
        
        console.log(`[Audit] ${JSON.stringify(auditEntry)}`);
        
        resolve({
          content: [{
            type: 'text',
            text: `# ⚡ BASH COMMAND EXECUTION - ${args.task_id}

## Command
\`\`\`bash
${args.command}
\`\`\`

## Execution Details
- **Working Directory**: \`${workingDir}\`
- **Exit Code**: ${code}${signal ? ` (Signal: ${signal})` : ''}
- **Execution Time**: ${executionTime}ms
- **Status**: ${success ? '✅ SUCCESS' : '❌ FAILED'}

## Output
${stdout ? `### STDOUT
\`\`\`
${stdout}
\`\`\`` : ''}
${stderr ? `### STDERR
\`\`\`
${stderr}
\`\`\`` : ''}
${!stdout && !stderr ? 'No output captured' : ''}

## Security Notes
- Command executed in restricted environment
- Working directory validated against allowed paths
- Timeout enforced (${timeout}ms max)
- Dangerous operations blocked`
          }]
        });
      });
      
      child.on('error', (error) => {
        isCompleted = true;
        clearTimeout(timeoutId);
        
        console.error(`[Bash Error] Task ${args.task_id}: ${error.message}`);
        reject(MCPErrorFactory.create(MCPErrorCode.EXECUTION_ERROR,
          `Command execution failed: ${error.message}`));
      });
    });
  }

  // UTILITY METHODS
  private parseModificationInstructions(content: string): FileModification[] {
    // Fallback parser for non-JSON responses
    const modifications: FileModification[] = [];
    
    // Simple pattern matching for file modifications
    const fileBlocks = content.split(/```(?:typescript|javascript|json|ts|js|py|md)/);
    
    for (let i = 1; i < fileBlocks.length; i += 2) {
      if (i + 1 < fileBlocks.length) {
        const codeContent = fileBlocks[i];
        modifications.push({
          file: `generated-file-${i}.ts`, // Default filename
          operation: 'write',
          content: codeContent.trim(),
        });
      }
    }
    
    return modifications.length > 0 ? modifications : [{
      file: 'generated-output.ts',
      operation: 'write',
      content: content,
    }];
  }

  private async applyFileModification(modification: FileModification, createBackup: boolean = true): Promise<FileOperationResult> {
    const fullPath = resolve(DEVFLOW_PROJECT_ROOT, modification.file);
    
    // Security check
    if (!this.isPathAllowed(fullPath)) {
      throw new Error(`Path not allowed: ${fullPath}`);
    }

    // Extension check
    const ext = basename(fullPath).split('.').pop();
    if (ext && !ALLOWED_FILE_EXTENSIONS.includes(`.${ext}`)) {
      throw new Error(`File extension not allowed: .${ext}`);
    }

    try {
      // Create directory if it doesn't exist
      const dir = dirname(fullPath);
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
      }

      // Create backup if file exists and backup is requested
      if (createBackup && existsSync(fullPath)) {
        await this.createBackup(fullPath);
      }

      // Apply modification based on operation type
      switch (modification.operation) {
        case 'write':
        case 'create':
          await fs.writeFile(fullPath, modification.content, 'utf8');
          break;
        case 'append':
          await fs.appendFile(fullPath, modification.content, 'utf8');
          break;
        case 'patch':
          await this.applyPatches(fullPath, modification.patches || []);
          break;
        default:
          throw new Error(`Unknown operation: ${modification.operation}`);
      }

      return {
        path: modification.file,
        status: 'SUCCESS',
        message: `${modification.operation} completed`,
      };
    } catch (error) {
      return {
        path: modification.file,
        status: 'ERROR',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async createBackup(filePath: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup-${timestamp}`;
    await fs.copyFile(filePath, backupPath);
  }

  private async applyPatches(filePath: string, patches: Array<{ line: number; oldContent: string; newContent: string }>): Promise<void> {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    
    // Apply patches in reverse order to maintain line numbers
    const sortedPatches = patches.sort((a, b) => b.line - a.line);
    
    for (const patch of sortedPatches) {
      if (patch.line > 0 && patch.line <= lines.length) {
        lines[patch.line - 1] = patch.newContent;
      }
    }
    
    await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  }

  private isPathAllowed(fullPath: string): boolean {
    return this.allowedPaths.some(allowedPath => 
      fullPath.startsWith(allowedPath)
    );
  }

  // === DIRECT FILE OPERATION HANDLERS ===
  
  private async handleFileWrite(args: {
    file_path: string;
    content: string;
    backup?: boolean;
  }, requestId: string) {
    console.log(`[Synthetic MCP] File write operation: ${args.file_path}`);
    
    const result = await this.fileManager.writeFile(
      args.file_path, 
      args.content, 
      args.backup !== false
    );
    
    const auditEntry = {
      operation: 'file_write',
      file_path: args.file_path,
      timestamp: new Date().toISOString(),
      status: result.status,
      backup_created: result.backupPath ? true : false,
      request_id: requestId
    };
    
    console.log(`[Audit] ${JSON.stringify(auditEntry)}`);
    
    return {
      content: [{
        type: 'text',
        text: `# ✏️ FILE WRITE OPERATION\n\n**File**: \`${args.file_path}\`\n**Status**: ${result.status}\n**Message**: ${result.message}\n${result.backupPath ? `**Backup Created**: \`${result.backupPath}\`\n` : ''}\n**Content Size**: ${args.content.length} characters`
      }]
    };
  }

  private async handleFileRead(args: {
    file_path: string;
  }, requestId: string) {
    console.log(`[Synthetic MCP] File read operation: ${args.file_path}`);
    
    const result = await this.fileManager.readFile(args.file_path);
    
    const auditEntry = {
      operation: 'file_read',
      file_path: args.file_path,
      timestamp: new Date().toISOString(),
      status: result.status,
      content_size: result.content.length,
      request_id: requestId
    };
    
    console.log(`[Audit] ${JSON.stringify(auditEntry)}`);
    
    if (result.status === 'ERROR') {
      return {
        content: [{
          type: 'text',
          text: `# ❌ FILE READ ERROR\n\n**File**: \`${args.file_path}\`\n**Error**: ${result.message}`
        }]
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: `# 📖 FILE READ OPERATION\n\n**File**: \`${args.file_path}\`\n**Size**: ${result.content.length} characters\n**Status**: ${result.status}\n\n## Content:\n\n\`\`\`\n${result.content}\n\`\`\``
      }]
    };
  }

  private async handleFileCreate(args: {
    file_path: string;
    content: string;
    backup?: boolean;
  }, requestId: string) {
    console.log(`[Synthetic MCP] File create operation: ${args.file_path}`);
    
    const result = await this.fileManager.createFile(
      args.file_path, 
      args.content, 
      args.backup !== false
    );
    
    const auditEntry = {
      operation: 'file_create',
      file_path: args.file_path,
      timestamp: new Date().toISOString(),
      status: result.status,
      backup_created: result.backupPath ? true : false,
      request_id: requestId
    };
    
    console.log(`[Audit] ${JSON.stringify(auditEntry)}`);
    
    return {
      content: [{
        type: 'text',
        text: `# 📁 FILE CREATE OPERATION\n\n**File**: \`${args.file_path}\`\n**Status**: ${result.status}\n**Message**: ${result.message}\n${result.backupPath ? `**Backup Created**: \`${result.backupPath}\`\n` : ''}\n**Content Size**: ${args.content.length} characters`
      }]
    };
  }

  private async handleFileDelete(args: {
    file_path: string;
    backup?: boolean;
  }, requestId: string) {
    console.log(`[Synthetic MCP] File delete operation: ${args.file_path}`);
    
    if (!SYNTHETIC_DELETE_ENABLED) {
      return {
        content: [{
          type: 'text',
          text: `# ❌ DELETE OPERATION DISABLED\n\n**File**: \`${args.file_path}\`\n**Error**: Delete operations require SYNTHETIC_DELETE_ENABLED=true in environment`
        }]
      };
    }
    
    const result = await this.fileManager.deleteFile(
      args.file_path, 
      args.backup !== false
    );
    
    const auditEntry = {
      operation: 'file_delete',
      file_path: args.file_path,
      timestamp: new Date().toISOString(),
      status: result.status,
      backup_created: result.backupPath ? true : false,
      request_id: requestId
    };
    
    console.log(`[Audit] ${JSON.stringify(auditEntry)}`);
    
    return {
      content: [{
        type: 'text',
        text: `# 🗑️ FILE DELETE OPERATION\n\n**File**: \`${args.file_path}\`\n**Status**: ${result.status}\n**Message**: ${result.message}\n${result.backupPath ? `**Backup Created**: \`${result.backupPath}\`\n` : ''}`
      }]
    };
  }

  private async handleBatchOperations(args: {
    task_id: string;
    operations: Array<{
      type: 'create' | 'write' | 'delete' | 'move' | 'copy' | 'mkdir' | 'rmdir';
      path: string;
      content?: string;
      targetPath?: string;
      recursive?: boolean;
      backup?: boolean;
    }>;
    description?: string;
  }, requestId: string) {
    console.log(`[Synthetic MCP] Batch operations: ${args.task_id} (${args.operations.length} ops)`);
    
    const operations = args.operations.map(op => ({
      type: op.type,
      path: op.path,
      content: op.content,
      targetPath: op.targetPath,
      recursive: op.recursive,
      backup: op.backup !== false
    }));
    
    const results = await this.fileManager.executeOperations(operations);
    
    const auditEntry = {
      operation: 'batch_operations',
      task_id: args.task_id,
      operations_count: args.operations.length,
      timestamp: new Date().toISOString(),
      success_count: results.filter(r => r.status === 'SUCCESS').length,
      error_count: results.filter(r => r.status === 'ERROR').length,
      request_id: requestId
    };
    
    console.log(`[Audit] ${JSON.stringify(auditEntry)}`);
    
    let resultText = `# ⚡ BATCH FILE OPERATIONS\n\n**Task ID**: ${args.task_id}\n**Operations**: ${args.operations.length}\n**Description**: ${args.description || 'N/A'}\n\n## Results:\n\n`;
    
    results.forEach((result, index) => {
      const op = args.operations[index];
      const statusEmoji = result.status === 'SUCCESS' ? '✅' : result.status === 'ERROR' ? '❌' : '⚠️';
      resultText += `${statusEmoji} **${op.type}** \`${result.path}\` - ${result.message}\n`;
      if (result.backupPath) {
        resultText += `   📋 Backup: \`${result.backupPath}\`\n`;
      }
    });
    
    return {
      content: [{
        type: 'text',
        text: resultText
      }]
    };
  }

  private async handleCodeToFile(args: {
    task_id: string;
    file_path: string;
    objective: string;
    language: string;
    requirements?: string[];
    context?: string;
    backup?: boolean;
  }, requestId: string) {
    console.log(`[Synthetic MCP] Code to file operation: ${args.file_path}`);
    
    // First generate the code using existing code generation
    const codeResult = await this.handleCodeGeneration({
      task_id: args.task_id,
      objective: args.objective,
      language: args.language,
      requirements: args.requirements,
      context: args.context
    }, requestId);
    
    // Extract generated code from the result
    let generatedCode = '';
    if (codeResult.content && codeResult.content[0] && codeResult.content[0].text) {
      const text = codeResult.content[0].text;
      // Extract code from markdown code blocks
      const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;
      let match = codeBlockRegex.exec(text);
      if (match) {
        generatedCode = match[1].trim();
      } else {
        generatedCode = text;
      }
    }
    
    if (!generatedCode) {
      return {
        content: [{
          type: 'text',
          text: `# ❌ CODE GENERATION FAILED\n\n**File**: \`${args.file_path}\`\n**Error**: Could not extract generated code`
        }]
      };
    }
    
    // Write the generated code to file
    const writeResult = await this.fileManager.writeFile(
      args.file_path,
      generatedCode,
      args.backup !== false
    );
    
    const auditEntry = {
      operation: 'code_to_file',
      task_id: args.task_id,
      file_path: args.file_path,
      language: args.language,
      timestamp: new Date().toISOString(),
      status: writeResult.status,
      code_size: generatedCode.length,
      backup_created: writeResult.backupPath ? true : false,
      request_id: requestId
    };
    
    console.log(`[Audit] ${JSON.stringify(auditEntry)}`);
    
    return {
      content: [{
        type: 'text',
        text: `# 💾 CODE GENERATION TO FILE\n\n**Task ID**: ${args.task_id}\n**File**: \`${args.file_path}\`\n**Language**: ${args.language}\n**Objective**: ${args.objective}\n\n## Write Result:\n**Status**: ${writeResult.status}\n**Message**: ${writeResult.message}\n**Code Size**: ${generatedCode.length} characters\n${writeResult.backupPath ? `**Backup Created**: \`${writeResult.backupPath}\`\n` : ''}\n\n## Generated Code Preview:\n\`\`\`${args.language}\n${generatedCode.substring(0, 500)}${generatedCode.length > 500 ? '...' : ''}\n\`\`\``
      }]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DevFlow Enhanced Synthetic MCP server running on stdio');
  }
}

const server = new EnhancedSyntheticMCPServer();
server.run().catch(console.error);
