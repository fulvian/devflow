import { ClaudeAdapterConfig, ClaudeMessage, ClaudeResponse } from '@devflow/shared';
import { SQLiteMemoryManager } from '@devflow/core';
import { VectorEmbeddingService } from '@devflow/core';
import { PlatformHandoffEngine } from './handoff-engine.js';
import { ContextManager } from './context/manager.js';
import { MCPService } from './mcp-server.js';
import { SafeFileOperations } from './filesystem/safe-ops.js';
export class ClaudeCodeAdapter {
    config;
    memoryManager;
    embeddingService;
    handoffEngine = null;
    contextManager = null;
    mcpService = null;
    fileOps;
    constructor(config) {
        this.config = config;
        this.memoryManager = new SQLiteMemoryManager();
        this.embeddingService = new VectorEmbeddingService();
        this.fileOps = new SafeFileOperations();
        if (config.enableHandoff) {
            this.handoffEngine = new PlatformHandoffEngine();
        }
        if (config.contextDir) {
            this.contextManager = new ContextManager(config.contextDir);
        }
        if (config.enableMCP) {
            this.mcpService = new MCPService();
        }
    }
    async processMessage(message) {
        // Implementation would go here
        return { content: 'Response content', role: 'assistant' };
    }
    async searchContext(query) {
        if (!this.contextManager)
            return null;
        return await this.contextManager.search(query);
    }
    async saveToMemory(key, data) {
        return await this.memoryManager.set(key, data);
    }
    async retrieveFromMemory(key) {
        return await this.memoryManager.get(key);
    }
    async generateEmbedding(text) {
        return await this.embeddingService.generateEmbedding(text);
    }
    async executeHandoff(task) {
        if (!this.handoffEngine)
            return null;
        return await this.handoffEngine.execute(task);
    }
    async startMCP() {
        if (!this.mcpService)
            return null;
        return await this.mcpService.start();
    }
}
//# sourceMappingURL=adapter.js.map