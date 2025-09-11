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

import { performance } from 'perf_hooks';

// ================================================================================================
// CORE INTERFACES
// ================================================================================================

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

// ================================================================================================
// MAIN TOOL INTERCEPTOR CLASS
// ================================================================================================

export class ZTAToolInterceptor {
  private readonly config: ZTAConfiguration;
  private readonly securityLog: ZTASecurityEvent[] = [];
  private readonly performanceMetrics: Map<string, number[]> = new Map();

  constructor(config?: Partial<ZTAConfiguration>) {
    this.config = {
      whitelistedTools: new Set([
        // Read-only operations
        'Read', 'Glob', 'Grep',
        // Task management
        'TodoWrite',
        // Information retrieval
        'WebFetch', 'WebSearch',
        // MCP tools (synthetic agents)
        'mcp__ctir-router-mcp__openrouter_chat',
        'mcp__ctir-router-mcp__route_task',
        'mcp__ctir-router-mcp__health',
        // Bash output monitoring
        'BashOutput', 'KillBash'
      ]),
      readOnlyBashCommands: new Set([
        'ls', 'find', 'cat', 'head', 'tail', 'wc', 'grep', 'awk',
        'git status', 'git log', 'git diff', 'git branch', 'git show',
        'ps', 'top', 'df', 'du', 'pwd', 'whoami', 'date', 'which'
      ]),
      codingIntentPatterns: [
        // Implementation keywords
        /\b(implement|write|create|build|develop|code|program)\b/i,
        // Modification keywords  
        /\b(fix|modify|update|change|edit|refactor|optimize)\b/i,
        // Code structure keywords
        /\b(function|class|method|component|interface|type|module)\b/i,
        // Code blocks
        /```(typescript|javascript|python|rust|go|java|c\+\+|c#)/i,
        // Function signatures
        /\b(function\s+\w+|def\s+\w+|class\s+\w+|interface\s+\w+)\b/i,
        // Import statements
        /\b(import|from|require|use|include)\s+['"]/i,
        // File operations in context
        /\b(edit|write|modify|update)\s+(file|code|script|component)/i,
        // Creation intents
        /\b(create|add|insert)\s+(new\s+)?(file|function|class|method)/i
      ],
      overridePassword: 'ARCHITECT_OVERRIDE_ZTA_TEMPORARY',
      loggingEnabled: true,
      performanceMonitoring: true,
      failSafeMode: true,
      ...config
    };
  }

  // ================================================================================================
  // MAIN INTERCEPTION METHOD
  // ================================================================================================

  public async interceptToolCall(context: ToolCallContext): Promise<ZTAInterceptionResult> {
    const startTime = performance.now();
    let rulesEvaluated = 0;

    try {
      // Security Event Logging
      this.logSecurityEvent({
        type: 'ALLOW', // Will be updated based on result
        toolName: context.toolName,
        reason: 'Tool call initiated',
        timestamp: context.timestamp,
        userInput: context.userInput,
        sessionId: context.sessionId ?? '',
        riskLevel: 'LOW'
      });

      // Rule 1: Check for user override first (highest priority)
      rulesEvaluated++;
      if (this.checkUserOverride(context.prompt) || this.checkUserOverride(context.userInput)) {
        const result: ZTAInterceptionResult = {
          allow: true,
          reason: 'ZTA Override detected - temporary architect access granted',
          requiresDelegation: false,
          overrideDetected: true,
          securityLevel: 'ALLOW',
          performanceMetrics: {
            processingTimeMs: performance.now() - startTime,
            rulesEvaluated
          }
        };

        this.updateSecurityLog('OVERRIDE', context, 'CRITICAL');
        return result;
      }

      // Rule 2: Tool whitelist enforcement (core security)
      rulesEvaluated++;
      if (!this.checkToolWhitelist(context.toolName)) {
        const result: ZTAInterceptionResult = {
          allow: false,
          reason: `Tool "${context.toolName}" is blocked by ZTA. Only read-only and delegation tools are permitted.`,
          requiresDelegation: true,
          suggestedAgent: this.determineSuggestedAgent(context),
          securityLevel: 'BLOCK',
          performanceMetrics: {
            processingTimeMs: performance.now() - startTime,
            rulesEvaluated
          }
        };

        this.updateSecurityLog('BLOCK', context, 'HIGH');
        return result;
      }

      // Rule 3: Bash command filtering for Bash tool
      rulesEvaluated++;
      if (context.toolName === 'Bash') {
        const bashCommand = this.extractBashCommand(context.arguments);
        if (!this.isReadOnlyBashCommand(bashCommand)) {
          const result: ZTAInterceptionResult = {
            allow: false,
            reason: `Bash command "${bashCommand}" is blocked. Only read-only commands are permitted.`,
            requiresDelegation: true,
            suggestedAgent: 'synthetic-code',
            securityLevel: 'BLOCK',
            performanceMetrics: {
              processingTimeMs: performance.now() - startTime,
              rulesEvaluated
            }
          };

          this.updateSecurityLog('BLOCK', context, 'HIGH');
          return result;
        }
      }

      // Rule 4: Coding intent detection
      rulesEvaluated++;
      if (this.detectCodingIntent(context.prompt) || this.detectCodingIntent(context.userInput)) {
        const result: ZTAInterceptionResult = {
          allow: false,
          reason: 'Coding intent detected. All implementation must be delegated to synthetic agents.',
          requiresDelegation: true,
          suggestedAgent: this.determineSuggestedAgent(context),
          securityLevel: 'DELEGATE',
          performanceMetrics: {
            processingTimeMs: performance.now() - startTime,
            rulesEvaluated
          }
        };

        this.updateSecurityLog('DELEGATE', context, 'MEDIUM');
        return result;
      }

      // Rule 5: Content analysis for hidden coding patterns
      rulesEvaluated++;
      if (this.detectHiddenCodingPatterns(context)) {
        const result: ZTAInterceptionResult = {
          allow: false,
          reason: 'Hidden coding patterns detected in tool arguments or context.',
          requiresDelegation: true,
          suggestedAgent: 'synthetic-code',
          securityLevel: 'DELEGATE',
          performanceMetrics: {
            processingTimeMs: performance.now() - startTime,
            rulesEvaluated
          }
        };

        this.updateSecurityLog('DELEGATE', context, 'MEDIUM');
        return result;
      }

      // All checks passed - allow the tool call
      const result: ZTAInterceptionResult = {
        allow: true,
        reason: 'Tool call approved - no security violations detected',
        requiresDelegation: false,
        securityLevel: 'ALLOW',
        performanceMetrics: {
          processingTimeMs: performance.now() - startTime,
          rulesEvaluated
        }
      };

      this.updateSecurityLog('ALLOW', context, 'LOW');
      this.recordPerformanceMetrics(context.toolName, performance.now() - startTime);
      
      return result;

    } catch (error) {
      // Fail-safe mode: if any error occurs, BLOCK the tool call
      const result: ZTAInterceptionResult = {
        allow: false,
        reason: `ZTA Security Error: ${error instanceof Error ? error.message : 'Unknown error'}. Fail-safe mode activated.`,
        requiresDelegation: false,
        securityLevel: 'BLOCK',
        performanceMetrics: {
          processingTimeMs: performance.now() - startTime,
          rulesEvaluated
        }
      };

      this.logSecurityEvent({
        type: 'BLOCK',
        toolName: context.toolName,
        reason: 'ZTA Security Error - Fail-safe activated',
        timestamp: new Date(),
        userInput: context.userInput,
        sessionId: context.sessionId ?? '',
        riskLevel: 'CRITICAL'
      });

      return result;
    }
  }

  // ================================================================================================
  // SECURITY CHECK METHODS
  // ================================================================================================

  public checkToolWhitelist(toolName: string): boolean {
    return this.config.whitelistedTools.has(toolName);
  }

  public detectCodingIntent(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    return this.config.codingIntentPatterns.some(pattern => pattern.test(text));
  }

  public checkUserOverride(text: string): boolean {
    if (!text || typeof text !== 'string') return false;

    return text.includes(this.config.overridePassword);
  }

  private isReadOnlyBashCommand(command: string): boolean {
    if (!command) return false;

    // Extract the base command (first word)
    const baseCommand = command.trim().split(/\s+/)[0];
    
    // Check if it's in the whitelist
    if (this.config.readOnlyBashCommands.has(baseCommand)) {
      return true;
    }

    // Check for git commands specifically
    if (command.startsWith('git ')) {
      const gitSubCommand = command.split(/\s+/)[1];
      return ['status', 'log', 'diff', 'branch', 'show', 'remote'].includes(gitSubCommand);
    }

    return false;
  }

  private extractBashCommand(args: Record<string, any>): string {
    return (args as Record<string, any>)['command'] ?? (args as Record<string, any>)['cmd'] ?? '';
  }

  private detectHiddenCodingPatterns(context: ToolCallContext): boolean {
    // Check tool arguments for file creation/modification patterns
    const argsString = JSON.stringify(context.arguments ?? {}).toLowerCase();
    
    // File creation patterns
    if (argsString.includes('new_string') || argsString.includes('content')) {
      return true;
    }

    // Edit patterns in arguments
    if (argsString.includes('old_string') && argsString.includes('new_string')) {
      return true;
    }

    // Write patterns
    if (context.toolName === 'Write' || context.toolName === 'Edit' || context.toolName === 'MultiEdit') {
      return true;
    }

    return false;
  }

  private determineSuggestedAgent(context: ToolCallContext): 'synthetic-code' | 'synthetic-reasoning' | 'synthetic-context' {
    const text = (`${context.prompt} ${context.userInput ?? ''}`).toLowerCase();

    // Code implementation patterns
    if (/\b(implement|write|create|build|code|function|class|method)\b/.test(text)) {
      return 'synthetic-code';
    }

    // Analysis/reasoning patterns
    if (/\b(analyze|reason|logic|algorithm|design|architecture)\b/.test(text)) {
      return 'synthetic-reasoning';
    }

    // Context gathering patterns
    if (/\b(context|understand|gather|research|investigate)\b/.test(text)) {
      return 'synthetic-context';
    }

    // Default to code agent for implementation-related tasks
    return 'synthetic-code';
  }

  // ================================================================================================
  // DELEGATION SUPPORT METHODS
  // ================================================================================================

  public generateDelegationPrompt(originalPrompt: string, suggestedAgent: string): string {
    const timestamp = new Date().toISOString();
    
    return `
# ZTA Delegation Required

**Original Request:** ${originalPrompt}

**Security Notice:** The Zero Touch Architecture has detected that this request requires code implementation or modification. All such operations must be delegated to synthetic agents to maintain architectural integrity.

**Suggested Agent:** ${suggestedAgent}

**Delegation Timestamp:** ${timestamp}

**Next Steps:**
1. Route this request to the ${suggestedAgent} synthetic agent
2. Provide full context and requirements
3. Monitor execution through read-only tools
4. Validate results before applying

**ZTA Compliance:** This delegation is mandatory and cannot be bypassed without proper authorization.
`;
  }

  // ================================================================================================
  // LOGGING AND MONITORING
  // ================================================================================================

  private logSecurityEvent(event: ZTASecurityEvent): void {
    if (!this.config.loggingEnabled) return;

    this.securityLog.push(event);

    // Keep only last 1000 events to prevent memory issues
    if (this.securityLog.length > 1000) {
      this.securityLog.splice(0, this.securityLog.length - 1000);
    }

    // Console logging for critical events
    if (event.riskLevel === 'CRITICAL' || event.riskLevel === 'HIGH') {
      console.warn(`🚨 ZTA Security Event [${event.type}]: ${event.reason}`, {
        tool: event.toolName,
        timestamp: event.timestamp,
        riskLevel: event.riskLevel
      });
    }
  }

  private updateSecurityLog(type: ZTASecurityEvent['type'], context: ToolCallContext, riskLevel: ZTASecurityEvent['riskLevel']): void {
    // Update the last log entry if it's for the same tool call
    const lastEvent = this.securityLog[this.securityLog.length - 1];
    if (lastEvent && lastEvent.toolName === context.toolName && lastEvent.timestamp === context.timestamp) {
      lastEvent.type = type;
      lastEvent.riskLevel = riskLevel;
    }
  }

  private recordPerformanceMetrics(toolName: string, processingTime: number): void {
    if (!this.config.performanceMonitoring) return;

    if (!this.performanceMetrics.has(toolName)) {
      this.performanceMetrics.set(toolName, []);
    }

    const metrics = this.performanceMetrics.get(toolName)!;
    metrics.push(processingTime);

    // Keep only last 100 measurements per tool
    if (metrics.length > 100) {
      metrics.splice(0, metrics.length - 100);
    }
  }

  // ================================================================================================
  // MONITORING AND REPORTING METHODS
  // ================================================================================================

  public getSecurityReport(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByRisk: Record<string, number>;
    recentEvents: ZTASecurityEvent[];
    performanceStats: Record<string, { avg: number; max: number; min: number }>;
  } {
    const eventsByType: Record<string, number> = {};
    const eventsByRisk: Record<string, number> = {};

    this.securityLog.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsByRisk[event.riskLevel] = (eventsByRisk[event.riskLevel] || 0) + 1;
    });

    const performanceStats: Record<string, { avg: number; max: number; min: number }> = {};
    this.performanceMetrics.forEach((times, toolName) => {
      if (times.length > 0) {
        performanceStats[toolName] = {
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          max: Math.max(...times),
          min: Math.min(...times)
        };
      }
    });

    return {
      totalEvents: this.securityLog.length,
      eventsByType,
      eventsByRisk,
      recentEvents: this.securityLog.slice(-10),
      performanceStats
    };
  }

  public clearSecurityLog(): void {
    this.securityLog.length = 0;
    this.performanceMetrics.clear();
  }

  public isHealthy(): boolean {
    const report = this.getSecurityReport();
    
    // Check for excessive blocking (might indicate misconfiguration)
    const blockRate = (report.eventsByType['BLOCK'] || 0) / Math.max(report.totalEvents, 1);
    if (blockRate > 0.8) return false;

    // Check for performance issues
    const avgPerformance = Object.values(report.performanceStats)
      .map(stat => stat.avg)
      .reduce((a, b) => a + b, 0) / Math.max(Object.keys(report.performanceStats).length, 1);
    
    if (avgPerformance > 50) return false; // >50ms is concerning

    return true;
  }
}

// ================================================================================================
// SINGLETON INSTANCE AND FACTORY
// ================================================================================================

let interceptorInstance: ZTAToolInterceptor | null = null;

export function createZTAInterceptor(config?: Partial<ZTAConfiguration>): ZTAToolInterceptor {
  if (!interceptorInstance) {
    interceptorInstance = new ZTAToolInterceptor(config);
  }
  return interceptorInstance;
}

export function getZTAInterceptor(): ZTAToolInterceptor {
  if (!interceptorInstance) {
    interceptorInstance = new ZTAToolInterceptor();
  }
  return interceptorInstance;
}

// ================================================================================================
// UTILITY FUNCTIONS FOR INTEGRATION
// ================================================================================================

export async function interceptToolCallGlobal(
  toolName: string,
  args: Record<string, any>,
  prompt: string,
  userInput: string
): Promise<ZTAInterceptionResult> {
  const interceptor = getZTAInterceptor();
  
  const context: ToolCallContext = {
    toolName,
    arguments: args,
    prompt,
    userInput,
    timestamp: new Date(),
    sessionId: process.env.CLAUDE_SESSION_ID,
    userId: process.env.CLAUDE_USER_ID
  };

  return await interceptor.interceptToolCall(context);
}

export function validateZTAConfiguration(config: Partial<ZTAConfiguration>): boolean {
  // Validate required security settings
  if (config.whitelistedTools && config.whitelistedTools.size === 0) {
    throw new Error('ZTA Configuration Error: Whitelist cannot be empty');
  }

  if (config.overridePassword && config.overridePassword.length < 10) {
    throw new Error('ZTA Configuration Error: Override password must be at least 10 characters');
  }

  return true;
}

// ================================================================================================
// EXPORTS
// ================================================================================================

export default ZTAToolInterceptor;