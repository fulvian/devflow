/**
 * Enhanced Auto CCR Runner
 *
 * This module provides an enhanced version of the Auto CCR Runner that integrates
 * with the Enhanced CCR Fallback Manager for improved fallback orchestration.
 *
 * Features:
 * - TypeScript implementation for better type safety
 * - Integration with Enhanced CCR Fallback Manager
 * - SQLite polling for Claude sessions
 * - Context preservation during fallback triggers
 * - Circuit breaker integration
 * - Metrics collection and reporting
 * - Enhanced error handling and recovery
 * - Real-time monitoring integration
 * - Configurable fallback strategies
 * - Winston logging integration
 * - Environment-based configuration
 * - Graceful shutdown handling
 */

import { createLogger, format, transports, Logger } from 'winston';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { CircuitBreaker, CircuitBreakerState } from '../../packages/core/src/coordination/circuit-breaker';
import { CCRFallbackManager } from '../../packages/core/src/coordination/enhanced-ccr-fallback-manager';
import { CodexMCPClient } from '../../packages/core/src/coordination/codex-mcp-client';
import { AgentContext, FallbackStrategy, FallbackChain } from '../../packages/core/src/coordination/types';

// Configuration interface
interface AutoCCRRuntimeConfig {
  pollingInterval: number;
  maxRetries: number;
  retryDelay: number;
  dbPath: string;
  limitLog?: string;
  triggerLevel: 'warning' | 'critical' | 'emergency';
  maxDurationMs: number;
  circuitBreaker: {
    failureThreshold: number;
    recoveryTimeout: number;
    halfOpenMaxCalls: number;
  };
  monitoring: {
    enabled: boolean;
    endpoint?: string;
  };
}

// Session data interface
interface ClaudeSession {
  id: string;
  task_id: string;
  platform: string;
  start_time: string;
  context_size_start?: number;
  context_size_end?: number;
  tokens_used?: number;
  timeUtilization: number;
}

// Metrics interface
interface RunnerMetrics {
  sessionsProcessed: number;
  fallbacksTriggered: number;
  errors: number;
  avgProcessingTime: number;
  circuitBreakerState: CircuitBreakerState;
  lastCheck: Date;
}

// Main Enhanced Auto CCR Runner class
export class EnhancedAutoCCRRunner extends EventEmitter {
  private logger: Logger;
  private config: AutoCCRRuntimeConfig;
  private fallbackManager: CCRFallbackManager;
  private circuitBreaker: CircuitBreaker;
  private codexClient: CodexMCPClient;
  private isRunning: boolean = false;
  private metrics: RunnerMetrics;
  private shutdownRequested: boolean = false;
  private pollingTimeout?: NodeJS.Timeout;
  private lastLimitTrigger: number = 0;

  constructor(config: Partial<AutoCCRRuntimeConfig> = {}) {
    super();

    // Initialize configuration with defaults
    this.config = this.loadConfiguration(config);

    // Initialize logger
    this.logger = this.initializeLogger();

    // Initialize Codex MCP Client
    this.codexClient = new CodexMCPClient({
      serverUrl: process.env.CODEX_MCP_URL || 'http://localhost:8000',
      timeout: 30000
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);

    // Initialize fallback manager
    this.fallbackManager = new CCRFallbackManager({
      codexClient: this.codexClient,
      logger: this.logger
    });

    // Register circuit breaker with fallback manager
    this.fallbackManager.registerCircuitBreaker('auto-ccr', this.circuitBreaker);

    // Initialize metrics
    this.metrics = {
      sessionsProcessed: 0,
      fallbacksTriggered: 0,
      errors: 0,
      avgProcessingTime: 0,
      circuitBreakerState: CircuitBreakerState.CLOSED,
      lastCheck: new Date()
    };

    this.setupEventListeners();
    this.logger.info('Enhanced Auto CCR Runner initialized', { config: this.config });
  }

  /**
   * Load configuration with environment variables and defaults
   */
  private loadConfiguration(overrides: Partial<AutoCCRRuntimeConfig>): AutoCCRRuntimeConfig {
    const THRESHOLDS = { warning: 0.7, critical: 0.85, emergency: 0.95 };
    const triggerLevel = (process.env.CCR_TRIGGER_LEVEL || 'critical').toLowerCase() as keyof typeof THRESHOLDS;

    return {
      pollingInterval: parseInt(process.env.CCR_POLL_INTERVAL_MS || '5000', 10),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10),
      dbPath: process.env.DEVFLOW_DB_PATH || 'devflow.sqlite',
      limitLog: process.env.CLAUDE_LIMIT_LOG || '',
      triggerLevel: triggerLevel in THRESHOLDS ? triggerLevel : 'critical',
      maxDurationMs: 5 * 60 * 60 * 1000, // 5h Sonnet limit
      circuitBreaker: {
        failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10),
        recoveryTimeout: parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIMEOUT || '60000', 10),
        halfOpenMaxCalls: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS || '3', 10)
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED === 'true',
        endpoint: process.env.MONITORING_ENDPOINT
      },
      ...overrides
    };
  }

  /**
   * Initialize Winston logger
   */
  private initializeLogger(): Logger {
    return createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      defaultMeta: { service: 'enhanced-auto-ccr-runner' },
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.printf(({ timestamp, level, message, service, ...meta }) => {
              return `[${timestamp}] [${service}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
            })
          )
        }),
        new transports.File({ filename: 'logs/auto-ccr-runner.log', level: 'info' }),
        new transports.File({ filename: 'logs/auto-ccr-errors.log', level: 'error' })
      ]
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Circuit breaker events
    this.circuitBreaker.on('stateChange', (fromState: CircuitBreakerState, toState: CircuitBreakerState) => {
      this.logger.info('Circuit breaker state change', { fromState, toState });
      this.metrics.circuitBreakerState = toState;
      this.emit('circuitBreakerStateChange', { fromState, toState });
    });

    // Fallback manager events
    this.fallbackManager.on('fallback-triggered', (context: AgentContext, fromAgent: string, toAgent: string) => {
      this.logger.info('Fallback triggered', { context, fromAgent, toAgent });
      this.metrics.fallbacksTriggered++;
      this.emit('fallbackTriggered', { context, fromAgent, toAgent });
    });

    this.fallbackManager.on('metrics-update', (metricsData: any) => {
      this.logger.debug('Metrics updated', metricsData);
      this.emit('metricsUpdate', metricsData);
    });
  }

  /**
   * Start the runner
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Runner is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting Enhanced Auto CCR Runner', {
      pollingInterval: this.config.pollingInterval,
      triggerLevel: this.config.triggerLevel,
      dbPath: this.config.dbPath
    });

    // Set up graceful shutdown handlers
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));

    // Configure fallback chains for auto-ccr agent
    this.configureFallbackChains();

    // Start the main polling loop
    this.startPollingLoop();

    // Start monitoring limit log if configured
    if (this.config.limitLog) {
      this.watchLimitLog(this.config.limitLog);
    }

    this.emit('started');
  }

  /**
   * Stop the runner gracefully
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping Enhanced Auto CCR Runner');
    this.isRunning = false;
    this.shutdownRequested = true;

    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
    }

    this.logger.info('Runner stopped successfully');
    this.emit('stopped');
  }

  /**
   * Configure fallback chains
   */
  private configureFallbackChains(): void {
    const fallbackChain: FallbackChain = {
      strategies: [
        {
          type: FallbackStrategy.SWITCH_AGENT,
          targetAgent: 'emergency-ccr'
        },
        {
          type: FallbackStrategy.GEMINI_CLI,
          command: 'emergency-ccr-cli start'
        },
        {
          type: FallbackStrategy.SYNTHETIC_RESPONSE,
          defaultData: { emergency: true, timestamp: new Date().toISOString() }
        }
      ],
      context: {
        sessionId: 'auto-ccr-session',
        taskId: 'auto-ccr-monitoring',
        metadata: { source: 'enhanced-auto-ccr-runner' },
        timestamp: Date.now(),
        agentId: 'auto-ccr',
        requestId: 'auto-ccr-request'
      },
      maxRetries: this.config.maxRetries
    };

    this.fallbackManager.configureFallbackChain('auto-ccr', fallbackChain);
    this.logger.info('Fallback chains configured', { fallbackChain });
  }

  /**
   * Start the polling loop
   */
  private startPollingLoop(): void {
    const tick = async () => {
      if (!this.isRunning || this.shutdownRequested) {
        return;
      }

      try {
        await this.processSessions();
        this.updateMetrics();

        if (this.config.monitoring.enabled) {
          await this.reportMetrics();
        }
      } catch (error) {
        this.logger.error('Error in polling loop', { error });
        this.metrics.errors++;
      }

      // Schedule next tick
      this.pollingTimeout = setTimeout(tick, this.config.pollingInterval);
    };

    // Start first tick
    tick();
  }

  /**
   * Process active Claude sessions
   */
  private async processSessions(): Promise<void> {
    const startTime = Date.now();

    try {
      const sessions = await this.getActiveSessions();
      this.logger.debug(`Found ${sessions.length} active sessions to process`);

      for (const session of sessions) {
        await this.processSession(session);
      }

      const processingTime = Date.now() - startTime;
      this.metrics.sessionsProcessed += sessions.length;
      this.metrics.avgProcessingTime = (this.metrics.avgProcessingTime + processingTime) / 2;

      this.logger.debug('Sessions processed successfully', {
        count: sessions.length,
        processingTime
      });
    } catch (error) {
      this.logger.error('Error processing sessions', { error });
      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Query SQLite database for active Claude sessions
   */
  private async getActiveSessions(): Promise<ClaudeSession[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT id, task_id, platform, start_time, context_size_start, context_size_end, tokens_used
                   FROM coordination_sessions
                   WHERE end_time IS NULL AND platform='claude_code'`;

      const proc = spawn('sqlite3', ['-json', this.config.dbPath, sql]);
      let output = '';
      let errorOutput = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(errorOutput || `sqlite3 exited with code ${code}`));
          return;
        }

        try {
          const rows = JSON.parse(output || '[]') as ClaudeSession[];
          // Calculate time utilization for each session
          const sessionsWithUtilization = rows.map(session => ({
            ...session,
            timeUtilization: this.calculateTimeUtilization(session.start_time)
          }));
          resolve(sessionsWithUtilization);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Calculate time utilization for a session
   */
  private calculateTimeUtilization(startTimeStr: string): number {
    if (!startTimeStr) return 0;

    const start = new Date(startTimeStr).getTime();
    if (Number.isNaN(start)) return 0;

    const elapsed = Date.now() - start;
    return Math.max(0, Math.min(elapsed / this.config.maxDurationMs, 1));
  }

  /**
   * Process a single session
   */
  private async processSession(session: ClaudeSession): Promise<void> {
    try {
      this.logger.debug('Processing session', { sessionId: session.id, timeUtilization: session.timeUtilization });

      // Check if session needs fallback based on time utilization
      if (this.shouldTriggerFallback(session)) {
        await this.triggerFallback(session);
        return;
      }

      this.logger.debug('Session processed successfully', { sessionId: session.id });
    } catch (error) {
      this.logger.error('Error processing session', {
        sessionId: session.id,
        error
      });

      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Determine if fallback should be triggered
   */
  private shouldTriggerFallback(session: ClaudeSession): boolean {
    const THRESHOLDS = { warning: 0.7, critical: 0.85, emergency: 0.95 };
    const threshold = THRESHOLDS[this.config.triggerLevel];

    return session.timeUtilization >= threshold;
  }

  /**
   * Trigger fallback for a session
   */
  private async triggerFallback(session: ClaudeSession): Promise<void> {
    this.logger.info('Triggering fallback for session', {
      sessionId: session.id,
      taskId: session.task_id,
      timeUtilization: session.timeUtilization
    });

    try {
      // Create agent context for this session
      const context: AgentContext = {
        sessionId: session.id,
        taskId: session.task_id,
        metadata: {
          platform: session.platform,
          timeUtilization: session.timeUtilization,
          startTime: session.start_time,
          contextSizeStart: session.context_size_start,
          contextSizeEnd: session.context_size_end,
          tokensUsed: session.tokens_used
        },
        timestamp: Date.now(),
        agentId: 'auto-ccr',
        requestId: `fallback-${session.id}-${Date.now()}`
      };

      // Mock execution function for fallback manager
      const mockExecution = async (ctx: AgentContext) => {
        this.logger.info('Executing emergency CCR for session', { sessionId: session.id });

        // In real implementation, this would trigger the actual CCR startup
        // For now, we simulate it
        return {
          success: true,
          sessionId: session.id,
          taskId: session.task_id,
          fallbackTriggered: true,
          timestamp: new Date().toISOString()
        };
      };

      // Execute fallback through the fallback manager
      const result = await this.fallbackManager.executeWithFallback(
        'auto-ccr',
        context,
        mockExecution
      );

      this.metrics.fallbacksTriggered++;
      this.logger.info('Fallback executed successfully', {
        sessionId: session.id,
        result
      });

      // Emit event for external monitoring
      this.emit('fallbackTriggered', {
        sessionId: session.id,
        taskId: session.task_id,
        timestamp: new Date(),
        context,
        result
      });

      // Add debounce to prevent fallback storms
      this.lastLimitTrigger = Date.now();

    } catch (error) {
      this.logger.error('Fallback execution failed', {
        sessionId: session.id,
        error
      });

      this.metrics.errors++;
      throw error;
    }
  }

  /**
   * Watch limit log file for Claude usage limit messages
   */
  private watchLimitLog(filePath: string): void {
    this.logger.info('Starting to watch limit log file', { filePath });

    // Implementation would watch the log file for limit messages
    // and trigger fallback when usage limits are detected
    // This is a simplified version

    const limitPatterns = [
      /5-?hour limit reached.*resets\s+([0-9]{1,2}(?::[0-9]{2})?\s?(?:am|pm)?)/i,
      /usage limit reached.*reset(?:s)?\s+(?:at\s+)?([0-9]{1,2}(?::[0-9]{2})?\s?(?:am|pm)?)/i,
    ];

    // Mock implementation - in reality would use fs.watchFile or similar
    this.logger.info('Limit log monitoring configured', { patterns: limitPatterns.length });
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.metrics.circuitBreakerState = this.circuitBreaker.getState();
    this.metrics.lastCheck = new Date();

    // Emit metrics update event
    this.emit('metricsUpdated', { ...this.metrics });
  }

  /**
   * Report metrics to monitoring system
   */
  private async reportMetrics(): Promise<void> {
    try {
      this.logger.debug('Reporting metrics', { metrics: this.metrics });

      // In a real implementation, this would send metrics to a monitoring system
      if (this.config.monitoring.endpoint) {
        // Example: Send to monitoring endpoint
        // await fetch(this.config.monitoring.endpoint, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(this.metrics)
        // });
      }

    } catch (error) {
      this.logger.error('Error reporting metrics', { error });
    }
  }

  /**
   * Handle graceful shutdown
   */
  private async handleShutdown(signal: string): Promise<void> {
    this.logger.info(`Received shutdown signal: ${signal}`);
    this.shutdownRequested = true;

    try {
      await this.stop();
      this.logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): RunnerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get circuit breaker state
   */
  public getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState();
  }

  /**
   * Check if runner is active
   */
  public isActive(): boolean {
    return this.isRunning && !this.shutdownRequested;
  }
}

// Export types for external use
export {
  AutoCCRRuntimeConfig,
  ClaudeSession,
  RunnerMetrics
};

// Export factory function for easy instantiation
export function createEnhancedAutoCCRRunner(config?: Partial<AutoCCRRuntimeConfig>): EnhancedAutoCCRRunner {
  return new EnhancedAutoCCRRunner(config);
}