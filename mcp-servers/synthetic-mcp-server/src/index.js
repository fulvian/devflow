#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { SyntheticClient } from './synthetic-client.js';
import { generateCodeTool, executeGenerateCode } from './tools/generate-code.js';
import { editFileTool, executeEditFile } from './tools/edit-file.js';
import { analyzeCodebaseTool, executeAnalyzeCodebase } from './tools/analyze-codebase.js';

// Load environment variables from devflow/.env
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the devflow directory
const devflowEnvPath = join(__dirname, '../../.env');
dotenv.config({ path: devflowEnvPath });

class SyntheticMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'synthetic-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Inizializza il client synthetic.new
    const apiKey = process.env.SYNTHETIC_API_KEY;
    if (!apiKey) {
      console.error('❌ SYNTHETIC_API_KEY non configurata nelle variabili di ambiente');
      process.exit(1);
    }

    this.syntheticClient = new SyntheticClient(apiKey);
    this.setupHandlers();
  }

  setupHandlers() {
    // Lista degli strumenti disponibili
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [generateCodeTool, editFileTool, analyzeCodebaseTool]
      };
    });

    // Esecuzione degli strumenti
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'generate_code':
            return await executeGenerateCode(this.syntheticClient, args);
          
          case 'edit_file':
            return await executeEditFile(this.syntheticClient, args);
          
          case 'analyze_codebase':
            return await executeAnalyzeCodebase(this.syntheticClient, args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Strumento sconosciuto: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Errore nell'esecuzione di ${name}: ${error.message}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 Synthetic MCP Server avviato e connesso');
  }
}

// Avvia il server
const server = new SyntheticMCPServer();
server.run().catch(console.error);