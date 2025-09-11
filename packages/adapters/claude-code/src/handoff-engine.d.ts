/**
 * Platform Handoff Engine for DevFlow
 * Generates handoff commands and preserves context across platforms
 */
import type { HandoffContext, Platform } from '@devflow/shared';
export interface HandoffCommand {
    command: string;
    context: string;
    platform: Platform;
    metadata: {
        timestamp: Date;
        taskId?: string;
        sessionId?: string;
    };
}
export declare class PlatformHandoffEngine {
    private readonly platformConfigs;
    constructor();
    generateHandoffCommand(handoffContext: HandoffContext): Promise<string>;
    private buildHandoffCommand;
    private getCodexHandoffTemplate;
    private getSyntheticHandoffTemplate;
    private getGeminiHandoffTemplate;
    private getCursorHandoffTemplate;
    private getClaudeCodeHandoffTemplate;
    private getOpenRouterHandoffTemplate;
    getSupportedPlatforms(): Platform[];
    getPlatformCapabilities(platform: Platform): string[];
}
//# sourceMappingURL=handoff-engine.d.ts.map