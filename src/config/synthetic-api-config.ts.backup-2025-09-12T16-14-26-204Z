/**
 * Production Configuration for Synthetic API Integration
 * Task ID: DEVFLOW-PROD-002-IMPL-E
 * 
 * This module provides environment-specific configuration for the Synthetic API integration,
 * including endpoints, authentication, batch processing, rate limiting, and error handling.
 */

// Environment types
export type Environment = 'development' | 'staging' | 'production';

// Authentication configuration
export interface AuthConfig {
  /** API key for authentication */
  apiKey: string;
  /** Authentication header name */
  headerName: string;
  /** Token refresh interval in milliseconds */
  refreshInterval: number;
}

// Rate limiting configuration
export interface RateLimitConfig {
  /** Maximum requests per time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Delay between requests in milliseconds */
  delayMs: number;
}

// Retry policy configuration
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay between retries in milliseconds */
  baseDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  /** Exponential backoff factor */
  backoffFactor: number;
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes: number[];
}

// Batch processing configuration
export interface BatchConfig {
  /** Maximum number of items per batch */
  maxBatchSize: number;
  /** Maximum time to wait before sending a batch (milliseconds) */
  maxBatchWaitTimeMs: number;
  /** Concurrent batch processing limit */
  maxConcurrentBatches: number;
}

// API endpoint configuration
export interface ApiEndpointConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** Health check endpoint */
  healthCheckPath: string;
  /** Data submission endpoint */
  submitPath: string;
  /** Query endpoint */
  queryPath: string;
  /** Timeout for API requests in milliseconds */
  timeoutMs: number;
}

// Complete configuration structure
export interface SyntheticApiConfig {
  /** Current environment */
  environment: Environment;
  /** API endpoint configuration */
  endpoints: ApiEndpointConfig;
  /** Authentication configuration */
  auth: AuthConfig;
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
  /** Retry policy configuration */
  retryPolicy: RetryPolicy;
  /** Batch processing configuration */
  batch: BatchConfig;
  /** Enable detailed logging */
  enableLogging: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Omit<SyntheticApiConfig, 'environment' | 'auth'> = {
  endpoints: {
    baseUrl: '',
    healthCheckPath: '/health',
    submitPath: '/submit',
    queryPath: '/query',
    timeoutMs: 30000
  },
  rateLimit: {
    maxRequests: 100,
    windowMs: 60000,
    delayMs: 100
  },
  retryPolicy: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffFactor: 2,
    retryableStatusCodes: [429, 500, 502, 503, 504]
  },
  batch: {
    maxBatchSize: 100,
    maxBatchWaitTimeMs: 5000,
    maxConcurrentBatches: 5
  },
  enableLogging: false
};

/**
 * Environment-specific configuration overrides
 */
const ENVIRONMENT_CONFIGS: Record<Environment, Partial<SyntheticApiConfig>> = {
  development: {
    endpoints: {
      baseUrl: 'http://localhost:8080/api/v1'
    },
    rateLimit: {
      maxRequests: 50,
      windowMs: 60000
    },
    enableLogging: true
  },
  staging: {
    endpoints: {
      baseUrl: 'https://staging-api.devflow.com/v1'
    },
    rateLimit: {
      maxRequests: 200,
      windowMs: 60000
    },
    enableLogging: true
  },
  production: {
    endpoints: {
      baseUrl: 'https://api.devflow.com/v1'
    },
    rateLimit: {
      maxRequests: 1000,
      windowMs: 60000
    },
    enableLogging: false
  }
};

/**
 * Validates that required environment variables are present
 * @throws {Error} If required environment variables are missing
 */
function validateEnvironment(): void {
  const requiredVars = ['SYNTHETIC_API_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
}

/**
 * Gets the current environment from environment variables
 * @returns The current environment
 */
function getEnvironment(): Environment {
  const env = process.env.NODE_ENV as Environment | undefined;
  return env && ['development', 'staging', 'production'].includes(env) 
    ? env 
    : 'production';
}

/**
 * Creates a complete Synthetic API configuration by merging defaults with environment-specific values
 * @param environment The target environment
 * @returns Complete configuration object
 */
function createConfig(environment: Environment): SyntheticApiConfig {
  validateEnvironment();
  
  const envConfig = ENVIRONMENT_CONFIGS[environment];
  
  // Merge configurations with proper typing
  const config: SyntheticApiConfig = {
    environment,
    endpoints: {
      ...DEFAULT_CONFIG.endpoints,
      ...envConfig.endpoints
    },
    auth: {
      apiKey: process.env.SYNTHETIC_API_KEY!,
      headerName: 'X-API-Key',
      refreshInterval: 3600000 // 1 hour
    },
    rateLimit: {
      ...DEFAULT_CONFIG.rateLimit,
      ...envConfig.rateLimit
    },
    retryPolicy: {
      ...DEFAULT_CONFIG.retryPolicy,
      ...envConfig.retryPolicy
    },
    batch: {
      ...DEFAULT_CONFIG.batch,
      ...envConfig.batch
    },
    enableLogging: envConfig.enableLogging ?? DEFAULT_CONFIG.enableLogging
  };

  return config;
}

/**
 * Production configuration for Synthetic API integration
 */
export const SYNTHETIC_API_CONFIG: SyntheticApiConfig = createConfig(getEnvironment());

/**
 * Helper function to get the full URL for a specific endpoint
 * @param path The endpoint path
 * @returns The complete URL
 */
export function getFullUrl(path: string): string {
  return `${SYNTHETIC_API_CONFIG.endpoints.baseUrl}${path}`;
}

/**
 * Helper function to get authentication headers
 * @returns Authentication headers object
 */
export function getAuthHeaders(): Record<string, string> {
  return {
    [SYNTHETIC_API_CONFIG.auth.headerName]: SYNTHETIC_API_CONFIG.auth.apiKey
  };
}

// Export for testing purposes
export { validateEnvironment, getEnvironment, createConfig };