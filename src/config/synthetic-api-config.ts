import { z } from 'zod';

// Environment validation schema
const EnvironmentSchema = z.object({
  SYNTHETIC_API_KEY: z.string().min(1, 'API key is required'),
  SYNTHETIC_API_BASE_URL: z.string().url().default('https://api.synthetic.io/v1'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

// Validate and parse environment variables
const getValidatedEnvironment = () => {
  try {
    return EnvironmentSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => err.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
};

const env = getValidatedEnvironment();

// Configuration types
export interface SyntheticApiConfig {
  apiKey: string;
  baseUrl: string;
  environment: 'development' | 'staging' | 'production';
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Production-ready configuration
export const syntheticApiConfig: SyntheticApiConfig = {
  apiKey: env.SYNTHETIC_API_KEY,
  baseUrl: env.SYNTHETIC_API_BASE_URL,
  environment: env.NODE_ENV,
  timeout: env.NODE_ENV === 'production' ? 10000 : 15000, // 10s in prod, 15s elsewhere
  retryAttempts: env.NODE_ENV === 'production' ? 3 : 1,
  retryDelay: 1000, // 1 second base delay
  rateLimit: {
    maxRequests: 135, // As per requirements
    windowMs: 5 * 60 * 60 * 1000, // 5 hours in milliseconds
  },
  logging: {
    enabled: true,
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
};

// Rate limiting state (in production, this would be stored in Redis or similar)
class RateLimitState {
  private requestCount: number = 0;
  private windowStart: number = Date.now();
  private config: SyntheticApiConfig;

  constructor(config: SyntheticApiConfig) {
    this.config = config;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    const windowEnd = this.windowStart + this.config.rateLimit.windowMs;

    // Reset window if expired
    if (now > windowEnd) {
      this.requestCount = 0;
      this.windowStart = now;
      return true;
    }

    // Check if we're within rate limit
    return this.requestCount < this.config.rateLimit.maxRequests;
  }

  incrementRequest(): void {
    this.requestCount++;
  }

  getRemainingRequests(): number {
    const windowEnd = this.windowStart + this.config.rateLimit.windowMs;
    const timeLeft = windowEnd - Date.now();
    
    if (timeLeft <= 0) {
      return this.config.rateLimit.maxRequests;
    }
    
    return Math.max(0, this.config.rateLimit.maxRequests - this.requestCount);
  }
}

// Export rate limiter instance
export const rateLimiter = new RateLimitState(syntheticApiConfig);

// Logging utility
export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (syntheticApiConfig.logging.enabled && syntheticApiConfig.logging.level === 'debug') {
      console.debug(`[SyntheticAPI] DEBUG: ${message}`, meta);
    }
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    if (syntheticApiConfig.logging.enabled && ['debug', 'info'].includes(syntheticApiConfig.logging.level)) {
      console.info(`[SyntheticAPI] INFO: ${message}`, meta);
    }
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (syntheticApiConfig.logging.enabled && ['debug', 'info', 'warn'].includes(syntheticApiConfig.logging.level)) {
      console.warn(`[SyntheticAPI] WARN: ${message}`, meta);
    }
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    if (syntheticApiConfig.logging.enabled) {
      console.error(`[SyntheticAPI] ERROR: ${message}`, meta);
    }
  }
};