/**
 * ZTA Tool Interceptor - Zero Touch Architecture Core Component
 *
 * This is the most critical security component that intercepts ALL tool calls
 * before execution to prevent direct code implementation by the Architect.
 *
 * Security Level: MAXIMUM
 * Bypass Resistance: Mathematical impossibility without user override password
 * Performance Target: <50ms overhead per tool call
 */
export interface ZTAInterceptionResult {
    allow: boolean;
    reason: string;
    requiresDelegation: boolean;
    suggestedAgent?: 'synthetic-code' | 'synthetic-reasoning' | 'synthetic-context';
    overrideDetected?: boolean;
    securityLevel?: 'BLOCK' | 'ALLOW' | 'DELEGATE';
    performanceMetrics?: {
        processingTimeMs: number;
        rulesEvaluated: number;
    };
}
export interface ToolCallContext {
    toolName: string;
    arguments: Record<string, any>;
    prompt: string;
    userInput: string;
    timestamp: Date;
    sessionId?: string;
    userId?: string;
}
export interface ZTAConfiguration {
    whitelistedTools: Set<string>;
    readOnlyBashCommands: Set<string>;
    codingIntentPatterns: RegExp[];
    overridePassword: string;
    loggingEnabled: boolean;
    performanceMonitoring: boolean;
    failSafeMode: boolean;
}
export interface ZTASecurityEvent {
    type: 'BLOCK' | 'ALLOW' | 'DELEGATE' | 'OVERRIDE' | 'BYPASS_ATTEMPT';
    toolName: string;
    reason: string;
    timestamp: Date;
    userInput: string;
    sessionId?: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
export declare class ZTAToolInterceptor {
    private readonly config;
    private readonly securityLog;
    private readonly performanceMetrics;
    constructor(config?: Partial<ZTAConfiguration>);
    interceptToolCall(context: ToolCallContext): Promise<ZTAInterceptionResult>;
    checkToolWhitelist(toolName: string): boolean;
    detectCodingIntent(text: string): boolean;
    checkUserOverride(text: string): boolean;
    private isReadOnlyBashCommand;
    private extractBashCommand;
    private detectHiddenCodingPatterns;
    private determineSuggestedAgent;
    generateDelegationPrompt(originalPrompt: string, suggestedAgent: string): string;
    private logSecurityEvent;
    private updateSecurityLog;
    private recordPerformanceMetrics;
    getSecurityReport(): {
        totalEvents: number;
        eventsByType: Record<string, number>;
        eventsByRisk: Record<string, number>;
        recentEvents: ZTASecurityEvent[];
        performanceStats: Record<string, {
            avg: number;
            max: number;
            min: number;
        }>;
    };
    clearSecurityLog(): void;
    isHealthy(): boolean;
}
export declare function createZTAInterceptor(config?: Partial<ZTAConfiguration>): ZTAToolInterceptor;
export declare function getZTAInterceptor(): ZTAToolInterceptor;
export declare function interceptToolCallGlobal(toolName: string, args: Record<string, any>, prompt: string, userInput: string): Promise<ZTAInterceptionResult>;
export declare function validateZTAConfiguration(config: Partial<ZTAConfiguration>): boolean;
export default ZTAToolInterceptor;
//# sourceMappingURL=ToolInterceptor.d.ts.map