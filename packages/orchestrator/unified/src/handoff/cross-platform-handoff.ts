/**
 * Cross-Platform Handoff System
 * Enables seamless task transfer between Gemini, Codex, and Qwen platforms
 * with context preservation, intelligent fallback chains, and performance tracking
 */

// Interfaces and Types
export interface PlatformContext {
  taskId: string;
  platform: PlatformType;
  taskData: any;
  metadata: Record<string, any>;
  createdAt: Date;
  attemptCount: number;
  previousPlatforms?: PlatformType[];
}

export interface HandoffResult {
  success: boolean;
  newPlatform: PlatformType;
  context: PlatformContext;
  executionTime: number;
  error?: Error;
}

export interface PerformanceMetrics {
  platform: PlatformType;
  avgResponseTime: number;
  successRate: number;
  errorCount: number;
  totalRequests: number;
}

export interface HandoffDecision {
  shouldHandoff: boolean;
  targetPlatform: PlatformType;
  reason: string;
}

export enum PlatformType {
  GEMINI = 'gemini',
  CODEX = 'codex',
  QWEN = 'qwen'
}

export enum HandoffReason {
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  RESOURCE_LIMITATION = 'resource_limitation',
  ERROR_RECOVERY = 'error_recovery',
  CAPABILITY_MISMATCH = 'capability_mismatch',
  LOAD_BALANCING = 'load_balancing'
}

// Event Types
export interface HandoffEvent {
  type: 'handoff_initiated' | 'handoff_completed' | 'handoff_failed' | 'fallback_triggered';
  timestamp: Date;
  context: PlatformContext;
  details?: any;
}

// Main Handoff System Class
export class CrossPlatformHandoffSystem {
  private platformAdapters: Map<PlatformType, PlatformAdapter>;
  private performanceTracker: PerformanceTracker;
  private eventEmitter: EventEmitter;
  private fallbackChains: Map<PlatformType, PlatformType[]>;

  constructor() {
    this.platformAdapters = new Map();
    this.performanceTracker = new PerformanceTracker();
    this.eventEmitter = new EventEmitter();
    this.fallbackChains = new Map([
      [PlatformType.GEMINI, [PlatformType.CODEX, PlatformType.QWEN]],
      [PlatformType.CODEX, [PlatformType.QWEN, PlatformType.GEMINI]],
      [PlatformType.QWEN, [PlatformType.GEMINI, PlatformType.CODEX]]
    ]);
  }

  /**
   * Register a platform adapter
   */
  registerPlatformAdapter(platform: PlatformType, adapter: PlatformAdapter): void {
    this.platformAdapters.set(platform, adapter);
  }

  /**
   * Execute a handoff between platforms
   */
  async executeHandoff(context: PlatformContext, targetPlatform: PlatformType): Promise<HandoffResult> {
    const startTime = Date.now();

    // Emit handoff initiation event
    this.eventEmitter.emit('handoff_initiated', {
      type: 'handoff_initiated',
      timestamp: new Date(),
      context
    });

    try {
      // Validate target platform
      if (!this.platformAdapters.has(targetPlatform)) {
        throw new Error(`No adapter registered for platform: ${targetPlatform}`);
      }

      // Preserve context
      const preservedContext = this.preserveContext(context);

      // Transform context for target platform
      const transformedContext = await this.transformContext(preservedContext, targetPlatform);

      // Execute on target platform
      const adapter = this.platformAdapters.get(targetPlatform)!;
      const result = await adapter.execute(transformedContext);

      // Update performance metrics
      const executionTime = Date.now() - startTime;
      this.performanceTracker.recordSuccess(targetPlatform, executionTime);

      // Emit completion event
      this.eventEmitter.emit('handoff_completed', {
        type: 'handoff_completed',
        timestamp: new Date(),
        context: transformedContext,
        details: { executionTime, result }
      });

      return {
        success: true,
        newPlatform: targetPlatform,
        context: transformedContext,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.performanceTracker.recordError(context.platform, executionTime);

      // Emit failure event
      this.eventEmitter.emit('handoff_failed', {
        type: 'handoff_failed',
        timestamp: new Date(),
        context,
        details: { error: error instanceof Error ? error : new Error(String(error)) }
      });

      return {
        success: false,
        newPlatform: context.platform,
        context,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Execute intelligent handoff with fallback chain
   */
  async executeIntelligentHandoff(context: PlatformContext): Promise<HandoffResult> {
    const decision = this.shouldHandoff(context);

    if (!decision.shouldHandoff) {
      // No handoff needed, execute on current platform
      return this.executeHandoff(context, context.platform);
    }

    // Try primary target platform
    let result = await this.executeHandoff(context, decision.targetPlatform);

    if (result.success) {
      return result;
    }

    // If failed, try fallback chain
    const fallbackChain = this.fallbackChains.get(context.platform) || [];

    for (const fallbackPlatform of fallbackChain) {
      // Emit fallback event
      this.eventEmitter.emit('fallback_triggered', {
        type: 'fallback_triggered',
        timestamp: new Date(),
        context,
        details: { from: result.newPlatform, to: fallbackPlatform }
      });

      result = await this.executeHandoff(context, fallbackPlatform);

      if (result.success) {
        return result;
      }
    }

    // All platforms failed
    return result;
  }

  /**
   * Determine if handoff is needed based on performance and context
   */
  shouldHandoff(context: PlatformContext): HandoffDecision {
    const currentMetrics = this.performanceTracker.getMetrics(context.platform);

    // Check for performance degradation
    if (currentMetrics.avgResponseTime > 5000 || currentMetrics.successRate < 0.8) {
      const bestPlatform = this.performanceTracker.getBestPerformingPlatform();
      if (bestPlatform !== context.platform) {
        return {
          shouldHandoff: true,
          targetPlatform: bestPlatform,
          reason: HandoffReason.PERFORMANCE_DEGRADATION
        };
      }
    }

    // Check for error patterns
    if (context.attemptCount > 2) {
      const fallbackChain = this.fallbackChains.get(context.platform) || [];
      if (fallbackChain.length > 0) {
        return {
          shouldHandoff: true,
          targetPlatform: fallbackChain[0],
          reason: HandoffReason.ERROR_RECOVERY
        };
      }
    }

    // Check for capability mismatch (simplified)
    if (this.requiresSpecializedCapability(context)) {
      const specializedPlatform = this.getSpecializedPlatform(context);
      if (specializedPlatform && specializedPlatform !== context.platform) {
        return {
          shouldHandoff: true,
          targetPlatform: specializedPlatform,
          reason: HandoffReason.CAPABILITY_MISMATCH
        };
      }
    }

    return {
      shouldHandoff: false,
      targetPlatform: context.platform,
      reason: 'no_handoff_needed'
    };
  }

  /**
   * Preserve context during handoff
   */
  private preserveContext(context: PlatformContext): PlatformContext {
    return {
      ...context,
      previousPlatforms: [
        ...(context.previousPlatforms || []),
        context.platform
      ],
      attemptCount: context.attemptCount + 1
    };
  }

  /**
   * Transform context for target platform
   */
  private async transformContext(context: PlatformContext, targetPlatform: PlatformType): Promise<PlatformContext> {
    const adapter = this.platformAdapters.get(targetPlatform);
    if (!adapter || !adapter.transformContext) {
      return context; // No transformation needed
    }

    return adapter.transformContext(context);
  }

  /**
   * Check if task requires specialized capability
   */
  private requiresSpecializedCapability(context: PlatformContext): boolean {
    // Simplified capability detection logic
    const { taskData } = context;

    // Example: Code tasks might need Codex
    if (taskData.type === 'code_generation' || taskData.type === 'code_review') {
      return true;
    }

    // Example: Multimodal tasks might need Gemini
    if (taskData.hasImages || taskData.hasAudio) {
      return true;
    }

    return false;
  }

  /**
   * Get platform specialized for task
   */
  private getSpecializedPlatform(context: PlatformContext): PlatformType | null {
    const { taskData } = context;

    if (taskData.type === 'code_generation' || taskData.type === 'code_review') {
      return PlatformType.CODEX;
    }

    if (taskData.hasImages || taskData.hasAudio) {
      return PlatformType.GEMINI;
    }

    if (taskData.requiresMultilingualSupport) {
      return PlatformType.QWEN;
    }

    return null;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): Record<PlatformType, PerformanceMetrics> {
    const metrics: Record<PlatformType, PerformanceMetrics> = {
      [PlatformType.GEMINI]: this.performanceTracker.getMetrics(PlatformType.GEMINI),
      [PlatformType.CODEX]: this.performanceTracker.getMetrics(PlatformType.CODEX),
      [PlatformType.QWEN]: this.performanceTracker.getMetrics(PlatformType.QWEN)
    };

    return metrics;
  }

  /**
   * Subscribe to handoff events
   */
  on(event: string, listener: (event: HandoffEvent) => void): void {
    this.eventEmitter.on(event, listener);
  }
}

// Platform Adapter Interface
export interface PlatformAdapter {
  execute(context: PlatformContext): Promise<any>;
  transformContext?(context: PlatformContext): Promise<PlatformContext>;
}

// Performance Tracker
class PerformanceTracker {
  private metrics: Map<PlatformType, PerformanceMetrics>;

  constructor() {
    this.metrics = new Map([
      [PlatformType.GEMINI, this.initializeMetrics(PlatformType.GEMINI)],
      [PlatformType.CODEX, this.initializeMetrics(PlatformType.CODEX)],
      [PlatformType.QWEN, this.initializeMetrics(PlatformType.QWEN)]
    ]);
  }

  private initializeMetrics(platform: PlatformType): PerformanceMetrics {
    return {
      platform,
      avgResponseTime: 0,
      successRate: 1.0,
      errorCount: 0,
      totalRequests: 0
    };
  }

  recordSuccess(platform: PlatformType, responseTime: number): void {
    const metrics = this.metrics.get(platform)!;
    metrics.totalRequests++;

    // Update average response time
    metrics.avgResponseTime = (
      (metrics.avgResponseTime * (metrics.totalRequests - 1)) + responseTime
    ) / metrics.totalRequests;

    // Update success rate
    const successfulRequests = metrics.totalRequests - metrics.errorCount;
    metrics.successRate = successfulRequests / metrics.totalRequests;
  }

  recordError(platform: PlatformType, responseTime: number): void {
    const metrics = this.metrics.get(platform)!;
    metrics.totalRequests++;
    metrics.errorCount++;

    // Update average response time
    metrics.avgResponseTime = (
      (metrics.avgResponseTime * (metrics.totalRequests - 1)) + responseTime
    ) / metrics.totalRequests;

    // Update success rate
    const successfulRequests = metrics.totalRequests - metrics.errorCount;
    metrics.successRate = successfulRequests / metrics.totalRequests;
  }

  getMetrics(platform: PlatformType): PerformanceMetrics {
    return this.metrics.get(platform) || this.initializeMetrics(platform);
  }

  getBestPerformingPlatform(): PlatformType {
    let bestPlatform = PlatformType.GEMINI;
    let bestScore = 0;

    for (const [platform, metrics] of this.metrics.entries()) {
      // Simple scoring: higher success rate and lower response time is better
      const score = metrics.successRate * (10000 / (metrics.avgResponseTime + 1));
      if (score > bestScore) {
        bestScore = score;
        bestPlatform = platform;
      }
    }

    return bestPlatform;
  }
}

// Event Emitter
class EventEmitter {
  private listeners: Map<string, Array<(event: HandoffEvent) => void>>;

  constructor() {
    this.listeners = new Map();
  }

  on(event: string, listener: (event: HandoffEvent) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  emit(event: string, handoffEvent: HandoffEvent): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(handoffEvent));
    }
  }
}

// Export main components
export { PerformanceTracker, EventEmitter };
export default CrossPlatformHandoffSystem;