import { AdapterConfig as ClaudeAdapterConfig } from '@devflow/shared';
import { SQLiteMemory } from '@devflow/core';
import { VectorEmbeddingService } from '@devflow/core';
import { PlatformHandoffEngine } from './handoff-engine.js';
import { ContextManager } from './context/manager.js';
import { MCPService } from './mcp-server.js';
import { SafeFileOperations } from './filesystem/safe-ops.js';

export class ClaudeCodeAdapter {
  private config: ClaudeAdapterConfig;
  private memoryManager: SQLiteMemory;
  private embeddingService: VectorEmbeddingService;
  private handoffEngine: PlatformHandoffEngine | null = null;
  private contextManager: ContextManager | null = null;
  private mcpService: MCPService | null = null;
  private fileOps: SafeFileOperations;

  constructor(config: ClaudeAdapterConfig) {
    this.config = config;
    this.memoryManager = new SQLiteMemory();
    this.embeddingService = new VectorEmbeddingService();
    this.fileOps = new SafeFileOperations();
    
    if ((config as any).enableHandoff) {
      this.handoffEngine = new PlatformHandoffEngine();
    }
    
    if ((config as any).contextDir) {
      this.contextManager = new ContextManager((config as any).contextDir);
    }
    
    if ((config as any).enableMCP) {
      this.mcpService = new MCPService();
    }
  }

  async processMessage(message: { content: string; role: 'user' | 'assistant' }): Promise<{ content: string; role: 'assistant' }> {
    return { content: 'Response content', role: 'assistant' };
  }

  async searchContext(query: string) {
    if (!this.contextManager) return null;
    return await (this.contextManager as any).search(query);
  }

  async saveToMemory(key: string, data: unknown) {
    return await (this.memoryManager as any).set?.(key, data);
  }

  async retrieveFromMemory(key: string) {
    return await (this.memoryManager as any).get?.(key);
  }

  async generateEmbedding(text: string) {
    return await (this.embeddingService as any).generateEmbeddings?.(text);
  }

  async executeHandoff(task: any) {
    if (!this.handoffEngine) return null;
    return await (this.handoffEngine as any).execute?.(task);
  }

  async startMCP() {
    if (!this.mcpService) return null;
    return await (this.mcpService as any).start?.();
  }
}