import { EventEmitter } from 'events';

interface Context7Config {
  rateLimitRpm: number;
  rateLimitBurst: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  enableAutoTrigger: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

interface RateLimitState {
  tokens: number;
  lastRefill: number;
  requests: Array<{ timestamp: number; identifier: string }>;
}

interface Context7Request {
  id: string;
  type: 'resolve' | 'docs';
  timestamp: number;
  params: any;
  priority: 'low' | 'medium' | 'high';
}

export class Context7Integration extends EventEmitter {
  private config: Context7Config;
  private rateLimiter: RateLimitState;
  private requestQueue: Context7Request[] = [];
  private isProcessing: boolean = false;
  private mcpTools: any;

  constructor(config: Partial<Context7Config> = {}, mcpTools?: any) {
    super();

    this.config = {
      rateLimitRpm: 30,
      rateLimitBurst: 5,
      timeoutMs: 10000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      enableAutoTrigger: true,
      logLevel: 'info',
      ...config
    };

    this.rateLimiter = {
      tokens: this.config.rateLimitBurst,
      lastRefill: Date.now(),
      requests: []
    };

    this.mcpTools = mcpTools;
    this.startRateLimiterRefill();
  }

  private startRateLimiterRefill(): void {
    setInterval(() => {
      const now = Date.now();
      const timePassed = now - this.rateLimiter.lastRefill;
      const tokensToAdd = Math.floor(timePassed / (60000 / this.config.rateLimitRpm));

      if (tokensToAdd > 0) {
        this.rateLimiter.tokens = Math.min(
          this.config.rateLimitBurst,
          this.rateLimiter.tokens + tokensToAdd
        );
        this.rateLimiter.lastRefill = now;
        this.emit('rateLimitRefill', { tokens: this.rateLimiter.tokens });
      }

      // Clean old requests (keep last hour)
      const oneHourAgo = now - 3600000;
      this.rateLimiter.requests = this.rateLimiter.requests.filter(
        req => req.timestamp > oneHourAgo
      );
    }, 1000);
  }

  private async waitForRateLimit(priority: 'low' | 'medium' | 'high'): Promise<void> {
    const priorityMultiplier = { low: 1, medium: 0.8, high: 0.6 }[priority];

    while (this.rateLimiter.tokens < 1) {
      await new Promise(resolve => setTimeout(resolve, 100 * priorityMultiplier));
    }

    this.rateLimiter.tokens--;
    this.rateLimiter.requests.push({
      timestamp: Date.now(),
      identifier: `${priority}-${Date.now()}`
    });
  }

  async resolveLibraryId(libraryName: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<any> {
    const requestId = `resolve-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      await this.waitForRateLimit(priority);
      this.emit('requestStart', { id: requestId, type: 'resolve', libraryName });

      if (!this.mcpTools?.mcp__context7__resolve_library_id) {
        throw new Error('Context7 MCP tools not available - resolve-library-id');
      }

      const result = await Promise.race([
        this.mcpTools.mcp__context7__resolve_library_id({ libraryName }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), this.config.timeoutMs)
        )
      ]);

      this.emit('requestSuccess', { id: requestId, result });
      this.log('info', `Successfully resolved library ID for: ${libraryName}`);
      return result;

    } catch (error) {
      this.emit('requestError', { id: requestId, error: error.message });
      this.log('error', `Failed to resolve library ID for ${libraryName}: ${error.message}`);
      throw error;
    }
  }

  async getLibraryDocs(
    context7CompatibleLibraryID: string,
    options: { tokens?: number; topic?: string; priority?: 'low' | 'medium' | 'high' } = {}
  ): Promise<any> {
    const { tokens = 5000, topic, priority = 'medium' } = options;
    const requestId = `docs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      await this.waitForRateLimit(priority);
      this.emit('requestStart', { id: requestId, type: 'docs', libraryID: context7CompatibleLibraryID });

      if (!this.mcpTools?.mcp__context7__get_library_docs) {
        throw new Error('Context7 MCP tools not available - get-library-docs');
      }

      const params: any = { context7CompatibleLibraryID, tokens };
      if (topic) params.topic = topic;

      const result = await Promise.race([
        this.mcpTools.mcp__context7__get_library_docs(params),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), this.config.timeoutMs)
        )
      ]);

      this.emit('requestSuccess', { id: requestId, result });
      this.log('info', `Successfully retrieved docs for: ${context7CompatibleLibraryID}`);
      return result;

    } catch (error) {
      this.emit('requestError', { id: requestId, error: error.message });
      this.log('error', `Failed to get library docs for ${context7CompatibleLibraryID}: ${error.message}`);
      throw error;
    }
  }

  async autoResolveAndGetDocs(
    libraryName: string,
    options: { tokens?: number; topic?: string; priority?: 'low' | 'medium' | 'high' } = {}
  ): Promise<{ libraryId: string; docs: any }> {
    const { priority = 'medium' } = options;

    try {
      this.log('info', `Auto-resolving and fetching docs for: ${libraryName}`);

      const resolveResult = await this.resolveLibraryId(libraryName, priority);

      if (!resolveResult?.libraryId) {
        throw new Error(`Could not resolve library ID for: ${libraryName}`);
      }

      const docs = await this.getLibraryDocs(resolveResult.libraryId, options);

      return {
        libraryId: resolveResult.libraryId,
        docs
      };
    } catch (error) {
      this.log('error', `Auto-resolve failed for ${libraryName}: ${error.message}`);
      throw error;
    }
  }

  getRateLimitStatus(): {
    tokens: number;
    rpm: number;
    requestsLastHour: number;
    nextRefill: number
  } {
    const now = Date.now();
    const nextRefillMs = (60000 / this.config.rateLimitRpm) - (now - this.rateLimiter.lastRefill);

    return {
      tokens: this.rateLimiter.tokens,
      rpm: this.config.rateLimitRpm,
      requestsLastHour: this.rateLimiter.requests.length,
      nextRefill: Math.max(0, nextRefillMs)
    };
  }

  private log(level: string, message: string, data?: any): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel];
    const messageLevel = levels[level];

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const logData = data ? ` ${JSON.stringify(data)}` : '';
      console.log(`[${timestamp}] Context7Integration [${level.toUpperCase()}] ${message}${logData}`);
    }
  }

  updateConfig(newConfig: Partial<Context7Config>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('info', 'Configuration updated', newConfig);
    this.emit('configUpdate', this.config);
  }

  destroy(): void {
    this.removeAllListeners();
    this.log('info', 'Context7Integration instance destroyed');
  }
}