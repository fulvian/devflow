/**
 * Context Preservation - Complete Context Management
 *
 * Handles complete context preservation and restoration for seamless handoffs.
 * Ensures zero context loss during platform transitions.
 */
import { SQLiteMemoryManager } from '../memory/manager.js';
import type { MemoryBlock } from '@devflow/shared';
export interface PreservedContext {
    memoryBlocks: MemoryBlock[];
    sessionState: Record<string, unknown>;
    taskContext: any | null;
    platformState: Record<string, unknown>;
    timestamp: Date;
    platform: string;
    taskId: string;
    sessionId: string;
    contextSize: number;
    compressionRatio?: number;
}
export interface ContextSnapshot {
    id: string;
    taskId: string;
    sessionId: string;
    platform: string;
    timestamp: Date;
    context: PreservedContext;
    metadata: {
        compressionApplied: boolean;
        importantBlocks: number;
        totalBlocks: number;
        contextSize: number;
    };
}
export interface PreservationConfig {
    maxContextSize: number;
    compressionThreshold: number;
    importantBlockThreshold: number;
    retentionDays: number;
    compressionStrategies: string[];
}
export declare class ContextPreservation {
    private memory;
    private config;
    private snapshots;
    constructor(memory: SQLiteMemoryManager, config?: Partial<PreservationConfig>);
    /**
     * Preserve complete context for CCR handoff
     */
    preserveForCCRHandoff(taskId: string, sessionId: string, platform: string): Promise<PreservedContext>;
    /**
     * Restore context for new platform
     */
    restoreContext(taskId: string, sessionId: string, targetPlatform: string): Promise<PreservedContext | null>;
    /**
     * Create context snapshot
     */
    createSnapshot(taskId: string, sessionId: string, platform: string, reason?: string): Promise<ContextSnapshot>;
    /**
     * Extract all memory blocks for a task
     */
    private extractAllMemoryBlocks;
    /**
     * Extract current session state
     */
    private extractSessionState;
    /**
     * Extract task context
     */
    private extractTaskContext;
    /**
     * Extract platform-specific state
     */
    private extractPlatformState;
    /**
     * Calculate total context size
     */
    private calculateContextSize;
    /**
     * Apply compression if context is too large
     */
    private applyCompressionIfNeeded;
    /**
     * Compress memory blocks using importance-based filtering
     */
    private compressMemoryBlocks;
    /**
     * Adapt context for target platform
     */
    private adaptContextForPlatform;
    /**
     * Inject context into target platform
     */
    private injectContextIntoPlatform;
    /**
     * Inject context into Claude Code
     */
    private injectIntoClaudeCode;
    /**
     * Inject context into OpenAI Codex
     */
    private injectIntoOpenAICodex;
    /**
     * Inject context into Synthetic
     */
    private injectIntoSynthetic;
    /**
     * Store emergency context
     */
    private storeEmergencyContext;
    /**
     * Retrieve emergency context
     */
    private retrieveEmergencyContext;
    /**
     * Store snapshot
     */
    private storeSnapshot;
    /**
     * Generate snapshot ID
     */
    private generateSnapshotId;
    /**
     * Get default configuration
     */
    private getDefaultConfig;
    /**
     * Clean up old snapshots
     */
    cleanupOldSnapshots(): Promise<void>;
    /**
     * Get snapshot by ID
     */
    getSnapshot(snapshotId: string): ContextSnapshot | undefined;
    /**
     * Get all snapshots
     */
    getAllSnapshots(): ContextSnapshot[];
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<PreservationConfig>): void;
}
//# sourceMappingURL=context-preservation.d.ts.map