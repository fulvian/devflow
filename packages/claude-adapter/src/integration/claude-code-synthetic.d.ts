export interface ClaudeCodeSyntheticConfig {
    autoActivate?: boolean;
    defaultAgent?: 'code' | 'reasoning' | 'context' | 'auto';
    autonomousMode?: boolean;
    requireApproval?: boolean;
    costThreshold?: number;
}
export declare class ClaudeCodeSyntheticIntegration {
    private gateway;
    private codeModifier;
    private config;
    private isInitialized;
    constructor(config?: ClaudeCodeSyntheticConfig);
    /**
     * Initialize Synthetic.new integration for Claude Code
     */
    initialize(): Promise<boolean>;
    /**
     * Process a natural language request with Claude Code context
     */
    processRequest(request: string, context?: {
        currentFile?: string;
        projectFiles?: string[];
        workingDirectory?: string;
    }): Promise<string>;
    /**
     * Handle autonomous code modification requests
     */
    private handleAutonomousModification;
    /**
     * Handle standard AI assistance requests
     */
    private handleStandardRequest;
    private enhancePromptWithContext;
    private detectCodeModificationIntent;
    /**
     * Get integration status and usage statistics
     */
    getStatus(): Promise<string>;
    /**
     * Register Claude Code slash commands
     */
    registerSlashCommands(): Record<string, Function>;
    private getCurrentContext;
    private updateConfig;
    private parseConfigArgs;
}
export declare const claudeCodeSynthetic: ClaudeCodeSyntheticIntegration;
//# sourceMappingURL=claude-code-synthetic.d.ts.map