/**
 * CCR Fallback Manager - Session Independence Solution
 *
 * Manages automatic fallback to Claude Code Router when Claude Code reaches session limits.
 * Provides seamless handoff with complete context preservation.
 */
import { SQLiteMemoryManager } from '../memory/manager.js';
import type { MemoryBlock } from '@devflow/shared';
export interface CCRConfig {
    log: boolean;
    NON_INTERACTIVE_MODE: boolean;
    OPENAI_API_KEY?: string;
    OPENROUTER_API_KEY?: string;
    router: {
        default: string;
        codex: string;
        synthetic: string;
        longContext: string;
    };
    transformers?: Array<{
        path: string;
        options: Record<string, unknown>;
    }>;
}
export interface PreservedContext {
    memoryBlocks: MemoryBlock[];
    sessionState: Record<string, unknown>;
    timestamp: Date;
    platform: string;
    taskId: string;
}
export interface PlatformHandoff {
    fromPlatform: string;
    toPlatform: string;
    context: PreservedContext;
    handoffTime: Date;
    success: boolean;
}
export declare class CCRFallbackManager {
    private ccrProcess;
    private fallbackChain;
    private memory;
    private isMonitoring;
    private monitoringInterval;
    constructor(memory: SQLiteMemoryManager);
    /**
     * Initialize CCR Fallback Manager
     */
    initialize(): Promise<void>;
    /**
     * Handle Claude Code session limit reached
     */
    handleClaudeCodeLimit(taskId: string): Promise<PlatformHandoff>;
    /**
     * Preserve complete context before session dies
     */
    private preserveContext;
    /**
     * Find next available platform in fallback chain
     */
    private findAvailablePlatform;
    /**
     * Start CCR with appropriate proxy configuration
     */
    private startCCRWithProxy;
    /**
     * Execute transparent handoff
     */
    private executeHandoff;
    /**
     * Start monitoring for session limits
     */
    private startMonitoring;
    /**
     * Check for session limits across all platforms
     */
    private checkSessionLimits;
    /**
     * Calculate context utilization for a session
     */
    private calculateUtilization;
    /**
     * Get CCR configuration for specific platform
     */
    private getCCRConfig;
    /**
     * Extract current session state
     */
    private extractSessionState;
    /**
     * Inject context into target platform
     */
    private injectContextToPlatform;
    /**
     * Update session tracking with handoff information
     */
    private updateSessionTracking;
    /**
     * Wait for CCR process to be ready
     */
    private waitForCCRReady;
    /**
     * Validate required environment variables
     */
    private validateEnvironment;
    /**
     * Shutdown CCR Fallback Manager
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=ccr-fallback-manager.d.ts.map