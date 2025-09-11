/**
 * Enhanced MCP Tools for Full Autonomous File Operations
 * Integrates AutonomousFileManager for complete project control
 */

export const enhancedMCPTools = [
  // Existing tools remain the same...
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

  // NEW: Direct file operations tools
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
    name: 'synthetic_file_move',
    description: '📦 MOVE FILE - Move/rename a file',
    inputSchema: {
      type: 'object',
      properties: {
        source_path: {
          type: 'string',
          description: 'Source file path (relative to project root)',
        },
        target_path: {
          type: 'string',
          description: 'Target file path (relative to project root)',
        },
        backup: {
          type: 'boolean',
          description: 'Create backup if target exists',
          default: true,
        },
      },
      required: ['source_path', 'target_path'],
    },
  },

  {
    name: 'synthetic_file_copy',
    description: '📋 COPY FILE - Copy a file to another location',
    inputSchema: {
      type: 'object',
      properties: {
        source_path: {
          type: 'string',
          description: 'Source file path (relative to project root)',
        },
        target_path: {
          type: 'string',
          description: 'Target file path (relative to project root)',
        },
        backup: {
          type: 'boolean',
          description: 'Create backup if target exists',
          default: true,
        },
      },
      required: ['source_path', 'target_path'],
    },
  },

  {
    name: 'synthetic_dir_create',
    description: '📁 CREATE DIRECTORY - Create a new directory',
    inputSchema: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'Directory path to create (relative to project root)',
        },
        recursive: {
          type: 'boolean',
          description: 'Create parent directories if they do not exist',
          default: true,
        },
      },
      required: ['dir_path'],
    },
  },

  {
    name: 'synthetic_dir_remove',
    description: '🗑️ REMOVE DIRECTORY - Remove a directory (requires SYNTHETIC_DELETE_ENABLED=true)',
    inputSchema: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'Directory path to remove (relative to project root)',
        },
        recursive: {
          type: 'boolean',
          description: 'Remove directory and all contents',
          default: false,
        },
      },
      required: ['dir_path'],
    },
  },

  {
    name: 'synthetic_dir_list',
    description: '📄 LIST DIRECTORY - List contents of a directory',
    inputSchema: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'Directory path to list (relative to project root)',
        },
      },
      required: ['dir_path'],
    },
  },

  {
    name: 'synthetic_path_info',
    description: 'ℹ️ PATH INFO - Get information about a file or directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to inspect (relative to project root)',
        },
      },
      required: ['path'],
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

  // Enhanced code generation with direct file application
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

  // Project structure tools
  {
    name: 'synthetic_project_scan',
    description: '🔍 PROJECT SCAN - Scan project structure and analyze codebase',
    inputSchema: {
      type: 'object',
      properties: {
        scan_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Paths to scan (relative to project root)',
          default: ['.'],
        },
        include_extensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'File extensions to include',
          default: ['.ts', '.js', '.json', '.md'],
        },
        max_depth: {
          type: 'number',
          description: 'Maximum directory depth to scan',
          default: 5,
        },
        include_content: {
          type: 'boolean',
          description: 'Include file contents in scan results',
          default: false,
        },
      },
    },
  },
];

export default enhancedMCPTools;

/**
 * MCP-compliant error handling and response utilities
 */

export interface MCPError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export enum MCPErrorCode {
  INVALID_INPUT = "INVALID_INPUT",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  TIMEOUT = "TIMEOUT",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  API_LIMIT_EXCEEDED = "API_LIMIT_EXCEEDED",
  MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE"
}

/**
 * Factory class for creating MCP-compliant errors
 */
export class MCPErrorFactory {
  static create(
    errorCode: MCPErrorCode,
    message: string,
    details?: Record<string, any>
  ): MCPError {
    return {
      code: errorCode,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
  }

  static fromError(error: Error, code: MCPErrorCode = MCPErrorCode.INTERNAL_ERROR): MCPError {
    return this.create(code, error.message, {
      stack: error.stack,
      name: error.name,
    });
  }
}

/**
 * Builder class for creating standardized MCP responses
 */
export class MCPResponseBuilder<T = any> {
  private response: any;

  constructor(requestId: string, version: string = '2.0.0') {
    this.response = {
      success: true,
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        version,
      },
    };
  }

  static success<T>(
    data: T,
    requestId: string,
    metadata?: any
  ): any {
    const builder = new MCPResponseBuilder<T>(requestId);
    return builder
      .withData(data)
      .withMetadata(metadata)
      .build();
  }

  static error(
    error: MCPError,
    requestId: string,
    metadata?: any
  ): any {
    const builder = new MCPResponseBuilder<never>(requestId);
    return builder
      .withError(error)
      .withMetadata(metadata)
      .build();
  }

  withData(data: T): this {
    this.response.data = data;
    this.response.success = true;
    return this;
  }

  withError(error: MCPError): this {
    this.response.error = error;
    this.response.success = false;
    delete this.response.data;
    return this;
  }

  withMetadata(metadata?: any): this {
    if (metadata) {
      this.response.metadata = { ...this.response.metadata, ...metadata };
    }
    return this;
  }

  withModel(model: string): this {
    this.response.metadata.model = model;
    return this;
  }

  withTokens(tokensUsed: number): this {
    this.response.metadata.tokensUsed = tokensUsed;
    return this;
  }

  withProcessingTime(startTime: number): this {
    this.response.metadata.processingTime = Date.now() - startTime;
    return this;
  }

  build(): any {
    return { ...this.response };
  }
}