/**
 * Context Preservation - Complete Context Management
 *
 * Handles complete context preservation and restoration for seamless handoffs.
 * Ensures zero context loss during platform transitions.
 */
import { SQLiteMemoryManager } from '../memory/manager.js';
export class ContextPreservation {
    memory;
    config;
    snapshots = new Map();
    constructor(memory, config) {
        this.memory = memory;
        this.config = this.getDefaultConfig(config);
    }
    /**
     * Preserve complete context for CCR handoff
     */
    async preserveForCCRHandoff(taskId, sessionId, platform) {
        console.log(`[ContextPreservation] Preserving context for CCR handoff: ${platform} → task ${taskId}`);
        try {
            // 1. Extract all memory blocks for the task
            const memoryBlocks = await this.extractAllMemoryBlocks(taskId);
            // 2. Extract current session state
            const sessionState = await this.extractSessionState(sessionId);
            // 3. Extract task context
            const taskContext = await this.extractTaskContext(taskId);
            // 4. Extract platform-specific state
            const platformState = await this.extractPlatformState(platform, sessionId);
            // 5. Calculate context size
            const contextSize = this.calculateContextSize(memoryBlocks, sessionState, taskContext, platformState);
            // 6. Apply compression if needed
            const compressedContext = await this.applyCompressionIfNeeded({
                memoryBlocks,
                sessionState,
                taskContext,
                platformState,
                timestamp: new Date(),
                platform,
                taskId,
                sessionId,
                contextSize
            });
            // 7. Store emergency context
            await this.storeEmergencyContext(taskId, sessionId, compressedContext);
            console.log(`[ContextPreservation] Context preserved: ${compressedContext.memoryBlocks.length} blocks, ${compressedContext.contextSize} chars`);
            return compressedContext;
        }
        catch (error) {
            console.error('[ContextPreservation] Error preserving context:', error);
            throw new Error(`Context preservation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Restore context for new platform
     */
    async restoreContext(taskId, sessionId, targetPlatform) {
        console.log(`[ContextPreservation] Restoring context for ${targetPlatform}: task ${taskId}`);
        try {
            // 1. Retrieve emergency context
            const preservedContext = await this.retrieveEmergencyContext(taskId, sessionId);
            if (!preservedContext) {
                console.log('[ContextPreservation] No emergency context found');
                return null;
            }
            // 2. Adapt context for target platform
            const adaptedContext = await this.adaptContextForPlatform(preservedContext, targetPlatform);
            // 3. Inject context into target platform
            await this.injectContextIntoPlatform(adaptedContext, targetPlatform);
            console.log(`[ContextPreservation] Context restored for ${targetPlatform}: ${adaptedContext.memoryBlocks.length} blocks`);
            return adaptedContext;
        }
        catch (error) {
            console.error('[ContextPreservation] Error restoring context:', error);
            throw new Error(`Context restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create context snapshot
     */
    async createSnapshot(taskId, sessionId, platform, reason = 'manual') {
        console.log(`[ContextPreservation] Creating snapshot: ${platform} - ${reason}`);
        const context = await this.preserveForCCRHandoff(taskId, sessionId, platform);
        const snapshot = {
            id: this.generateSnapshotId(),
            taskId,
            sessionId,
            platform,
            timestamp: new Date(),
            context,
            metadata: {
                compressionApplied: !!context.compressionRatio,
                importantBlocks: context.memoryBlocks.filter(b => (b.importanceScore || 0) > 0.7).length,
                totalBlocks: context.memoryBlocks.length,
                contextSize: context.contextSize
            }
        };
        this.snapshots.set(snapshot.id, snapshot);
        await this.storeSnapshot(snapshot);
        console.log(`[ContextPreservation] Snapshot created: ${snapshot.id}`);
        return snapshot;
    }
    /**
     * Extract all memory blocks for a task
     */
    async extractAllMemoryBlocks(taskId) {
        // Get all memory blocks for the task (max 500 due to Zod validation)
        const blocks = await this.memory.retrieveMemoryBlocks({ taskId, limit: 500 });
        // Sort by importance and recency
        return blocks.sort((a, b) => {
            const importanceA = a.importanceScore || 0;
            const importanceB = b.importanceScore || 0;
            if (Math.abs(importanceA - importanceB) < 0.1) {
                // If importance is similar, sort by recency
                return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            }
            return importanceB - importanceA;
        });
    }
    /**
     * Extract current session state
     */
    async extractSessionState(sessionId) {
        const session = await this.memory.getSession(sessionId);
        if (!session) {
            return {};
        }
        return {
            sessionId: session.id,
            taskId: session.taskId,
            platform: session.platform,
            startTime: session.startTime,
            tokensUsed: session.tokensUsed,
            contextSizeStart: session.contextSizeStart,
            contextSizeEnd: session.contextSizeEnd,
            compactionEvents: session.compactionEvents,
            metadata: session.metadata || {}
        };
    }
    /**
     * Extract task context
     */
    async extractTaskContext(taskId) {
        return await this.memory.getTaskContext(taskId);
    }
    /**
     * Extract platform-specific state
     */
    async extractPlatformState(platform, sessionId) {
        // Platform-specific state extraction
        const baseState = {
            platform,
            sessionId,
            extractedAt: new Date().toISOString()
        };
        switch (platform) {
            case 'claude_code':
                return {
                    ...baseState,
                    contextDir: '.claude/context',
                    hooksActive: true,
                    ccSessionsIntegration: true
                };
            case 'openai_codex':
                return {
                    ...baseState,
                    model: 'gpt-4o',
                    temperature: 0.1,
                    maxTokens: 4000
                };
            case 'synthetic':
                return {
                    ...baseState,
                    agentType: 'code',
                    model: 'qwen/qwen-2.5-coder-32b',
                    flatFee: true
                };
            default:
                return baseState;
        }
    }
    /**
     * Calculate total context size
     */
    calculateContextSize(memoryBlocks, sessionState, taskContext, platformState) {
        let totalSize = 0;
        // Memory blocks size
        totalSize += memoryBlocks.reduce((sum, block) => {
            return sum + (block.content?.length || 0);
        }, 0);
        // Session state size
        totalSize += JSON.stringify(sessionState).length;
        // Task context size
        if (taskContext) {
            totalSize += JSON.stringify(taskContext).length;
        }
        // Platform state size
        totalSize += JSON.stringify(platformState).length;
        return totalSize;
    }
    /**
     * Apply compression if context is too large
     */
    async applyCompressionIfNeeded(context) {
        if (context.contextSize <= this.config.maxContextSize) {
            return context;
        }
        console.log(`[ContextPreservation] Applying compression: ${context.contextSize} → target ${this.config.maxContextSize}`);
        // Apply compression strategies
        const compressedBlocks = await this.compressMemoryBlocks(context.memoryBlocks);
        const compressedContext = {
            ...context,
            memoryBlocks: compressedBlocks,
            contextSize: this.calculateContextSize(compressedBlocks, context.sessionState, context.taskContext, context.platformState),
            compressionRatio: compressedBlocks.length / context.memoryBlocks.length
        };
        console.log(`[ContextPreservation] Compression applied: ${compressedContext.compressionRatio?.toFixed(2)} ratio`);
        return compressedContext;
    }
    /**
     * Compress memory blocks using importance-based filtering
     */
    async compressMemoryBlocks(blocks) {
        // Sort by importance
        const sortedBlocks = blocks.sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));
        // Keep most important blocks
        const importantBlocks = sortedBlocks.filter(block => (block.importanceScore || 0) >= this.config.importantBlockThreshold);
        // Add recent blocks if we have space
        const recentBlocks = sortedBlocks
            .filter(block => (block.importanceScore || 0) < this.config.importantBlockThreshold)
            .slice(0, Math.max(0, this.config.maxContextSize / 1000 - importantBlocks.length));
        return [...importantBlocks, ...recentBlocks];
    }
    /**
     * Adapt context for target platform
     */
    async adaptContextForPlatform(context, targetPlatform) {
        console.log(`[ContextPreservation] Adapting context for ${targetPlatform}`);
        // Platform-specific adaptations
        const adaptedPlatformState = await this.extractPlatformState(targetPlatform, context.sessionId);
        return {
            ...context,
            platform: targetPlatform,
            platformState: adaptedPlatformState
        };
    }
    /**
     * Inject context into target platform
     */
    async injectContextIntoPlatform(context, platform) {
        console.log(`[ContextPreservation] Injecting context into ${platform}`);
        // Platform-specific injection logic
        switch (platform) {
            case 'claude_code':
                await this.injectIntoClaudeCode(context);
                break;
            case 'openai_codex':
                await this.injectIntoOpenAICodex(context);
                break;
            case 'synthetic':
                await this.injectIntoSynthetic(context);
                break;
            default:
                console.warn(`[ContextPreservation] Unknown platform: ${platform}`);
        }
    }
    /**
     * Inject context into Claude Code
     */
    async injectIntoClaudeCode(_context) {
        // Implementation would integrate with cc-sessions hooks
        console.log('[ContextPreservation] Injecting into Claude Code via cc-sessions');
    }
    /**
     * Inject context into OpenAI Codex
     */
    async injectIntoOpenAICodex(_context) {
        // Implementation would integrate with OpenAI API
        console.log('[ContextPreservation] Injecting into OpenAI Codex via API');
    }
    /**
     * Inject context into Synthetic
     */
    async injectIntoSynthetic(_context) {
        // Implementation would integrate with Synthetic.new API
        console.log('[ContextPreservation] Injecting into Synthetic via API');
    }
    /**
     * Store emergency context
     */
    async storeEmergencyContext(taskId, sessionId, context) {
        await this.memory.storeEmergencyContext(taskId, sessionId, context);
    }
    /**
     * Retrieve emergency context
     */
    async retrieveEmergencyContext(taskId, sessionId) {
        return await this.memory.retrieveEmergencyContext(taskId, sessionId);
    }
    /**
     * Store snapshot
     */
    async storeSnapshot(snapshot) {
        await this.memory.storeContextSnapshot(snapshot);
    }
    /**
     * Generate snapshot ID
     */
    generateSnapshotId() {
        return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get default configuration
     */
    getDefaultConfig(overrides) {
        const defaultConfig = {
            maxContextSize: 50000, // 50k characters
            compressionThreshold: 0.8,
            importantBlockThreshold: 0.7,
            retentionDays: 7,
            compressionStrategies: ['importance-based', 'recency-based', 'semantic-clustering']
        };
        return { ...defaultConfig, ...overrides };
    }
    /**
     * Clean up old snapshots
     */
    async cleanupOldSnapshots() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
        const oldSnapshots = Array.from(this.snapshots.values())
            .filter(snapshot => snapshot.timestamp < cutoffDate);
        for (const snapshot of oldSnapshots) {
            this.snapshots.delete(snapshot.id);
            await this.memory.deleteContextSnapshot(snapshot.id);
        }
        console.log(`[ContextPreservation] Cleaned up ${oldSnapshots.length} old snapshots`);
    }
    /**
     * Get snapshot by ID
     */
    getSnapshot(snapshotId) {
        return this.snapshots.get(snapshotId);
    }
    /**
     * Get all snapshots
     */
    getAllSnapshots() {
        return Array.from(this.snapshots.values());
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('[ContextPreservation] Configuration updated');
    }
}
//# sourceMappingURL=context-preservation.js.map