import { SQLiteMemoryManager } from '@devflow/core';
import type { MemoryBlock, TaskContext } from '@devflow/shared';
import { ContextManager } from './context/manager.js';
import { registerHooks, type HookRegistrar, type SessionEvent } from './hooks/index.js';
import { safeMkdir } from './filesystem/safe-ops.js';
import { DevFlowMCPServer } from './mcp-server.js';
import { SemanticSearchService } from './semantic-search.js';
import { PlatformHandoffEngine } from './handoff-engine.js';

export interface ClaudeAdapterConfig {
  contextDir?: string; // defaults to .claude/context
  task?: Pick<TaskContext, 'title' | 'priority'> & Partial<TaskContext>;
  enableMCP?: boolean;
  enableHandoff?: boolean;
  verbose?: boolean;
}

export class ClaudeAdapter implements HookRegistrar {
  private contextDir: string;
  private memory: SQLiteMemoryManager;
  private context: ContextManager;
  private mcpServer?: DevFlowMCPServer;
  private semanticService: SemanticSearchService;
  private handoffEngine: PlatformHandoffEngine;
  private config: ClaudeAdapterConfig;

  constructor(cfg: ClaudeAdapterConfig = {}) {
    this.config = cfg;
    this.contextDir = cfg.contextDir ?? `${process.cwd()}/.claude/context`;
    this.memory = new SQLiteMemoryManager();
    this.context = new ContextManager(this.memory, this.contextDir);
    
    // Initialize services
    this.semanticService = new SemanticSearchService({
      memoryManager: this.memory,
    });
    
    this.handoffEngine = new PlatformHandoffEngine();
    
    // Initialize MCP server if enabled
    if (cfg.enableMCP !== false) {
      this.mcpServer = new DevFlowMCPServer({
        memoryManager: this.memory,
        semanticService: this.semanticService,
        handoffEngine: this.handoffEngine,
        verbose: cfg.verbose ?? false,
      });
    }
    
    safeMkdir(this.contextDir);
  }

  register(cc: SessionEvent): void {
    registerHooks(cc, this);
  }

  async onSessionStart(event: { sessionId: string; taskId?: string }): Promise<void> {
    // Inject context at session start
    await this.context.inject(event.taskId, event.sessionId);
  }

  async onSessionEnd(event: { sessionId: string; taskId: string }): Promise<void> {
    // Extract and persist context
    await this.context.extractAndStore(event.taskId, event.sessionId);
  }

  async onToolUsed(event: { sessionId: string; taskId: string; tool: string; payload?: unknown }): Promise<void> {
    // Save context after significant tool usage
    await this.context.extractAndStore(event.taskId, event.sessionId, { reason: `tool:${event.tool}` });
  }

  async saveBlocks(taskId: string, sessionId: string, blocks: MemoryBlock[]): Promise<void> {
    for (const b of blocks) {
      await this.memory.storeMemoryBlock({
        taskId,
        sessionId,
        blockType: b.blockType,
        label: b.label,
        content: b.content,
        metadata: b.metadata ?? {},
        importanceScore: b.importanceScore ?? 0.5,
        relationships: b.relationships ?? [],
        embeddingModel: b.embeddingModel ?? 'openai-ada-002',
      });
    }
  }

  // MCP Server Management
  async startMCPServer(): Promise<void> {
    if (this.mcpServer) {
      await this.mcpServer.start();
      if (this.config.verbose) {
        console.log('DevFlow MCP Server started');
      }
    }
  }

  async stopMCPServer(): Promise<void> {
    if (this.mcpServer) {
      await this.mcpServer.stop();
      if (this.config.verbose) {
        console.log('DevFlow MCP Server stopped');
      }
    }
  }

  // Semantic Search
  async searchMemory(query: string, options?: {
    maxResults?: number;
    blockTypes?: string[];
    threshold?: number;
  }): Promise<any[]> {
    return await this.semanticService.hybridSearch({
      query,
      maxResults: options?.maxResults ?? 10,
      blockTypes: options?.blockTypes as any,
      threshold: options?.threshold ?? 0.7,
    });
  }

  // Platform Handoff
  async generateHandoff(platform: string, task: string, context?: string): Promise<string> {
    return await this.handoffEngine.generateHandoffCommand({
      platform: platform as any,
      task,
      context: context || '',
      preserveArchitecture: true,
      timestamp: new Date(),
      preservedDecisions: [],
      contextSummary: '',
      nextSteps: [],
      constraints: [],
      platformSpecificData: {} as any,
    });
  }

  // Health Check
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      memory: boolean;
      mcp: boolean;
      semantic: boolean;
      handoff: boolean;
    };
  }> {
    const services = {
      memory: true, // SQLiteMemoryManager is always available
      mcp: this.mcpServer !== undefined,
      semantic: true, // SemanticSearchService is always available
      handoff: true, // PlatformHandoffEngine is always available
    };

    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.keys(services).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      status = 'healthy';
    } else if (healthyServices >= totalServices / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, services };
  }
}

