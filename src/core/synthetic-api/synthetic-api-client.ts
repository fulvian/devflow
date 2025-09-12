/**
 * Synthetic API Client for DevFlow System Integration
 * 
 * This client provides production-ready integration with Synthetic API endpoints,
 * including authentication, rate limiting, retry logic, and batch optimization.
 * 
 * @author DevFlow Team
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimit?: number; // requests per second
}

interface AuthToken {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface ApiRequest {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  headers?: Record<string, string>;
  timestamp: number;
}

interface BatchRequest {
  requests: ApiRequest[];
  timestamp: number;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  requestId: string;
}

interface ApiError extends Error {
  code: string;
  status?: number;
  requestId?: string;
  retryable: boolean;
}

// DevFlow Error Patterns
class DevFlowApiError extends Error implements ApiError {
  constructor(
    public code: string,
    message: string,
    public status?: number,
    public requestId?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'DevFlowApiError';
  }
}

class AuthenticationError extends DevFlowApiError {
  constructor(message: string, requestId?: string) {
    super('AUTH_FAILED', message, 401, requestId, false);
  }
}

class RateLimitError extends DevFlowApiError {
  constructor(message: string, requestId?: string) {
    super('RATE_LIMIT_EXCEEDED', message, 429, requestId, true);
  }
}

class NetworkError extends DevFlowApiError {
  constructor(message: string, requestId?: string) {
    super('NETWORK_ERROR', message, undefined, requestId, true);
  }
}

// Logger interface
interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

// Simple logger implementation
class ConsoleLogger implements Logger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta || '');
  }
  
  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || '');
  }
  
  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta || '');
  }
  
  debug(message: string, meta?: any): void {
    console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta || '');
  }
}

/**
 * Synthetic API Client with authentication, retry logic, and batch optimization
 */
export class SyntheticApiClient extends EventEmitter {
  private config: ApiConfig;
  private token: AuthToken | null = null;
  private tokenExpiry: number | null = null;
  private rateLimiter: RateLimiter;
  private batchProcessor: BatchProcessor;
  private logger: Logger;
  private isInitialized = false;

  constructor(config: ApiConfig, logger?: Logger) {
    super();
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: 10,
      ...config
    };
    
    this.logger = logger || new ConsoleLogger();
    this.rateLimiter = new RateLimiter(this.config.rateLimit!, this.logger);
    this.batchProcessor = new BatchProcessor(this, this.logger);
    
    this.logger.info('Synthetic API Client initialized', { 
      baseUrl: this.config.baseUrl,
      rateLimit: this.config.rateLimit
    });
  }

  /**
   * Initialize the client by authenticating with the API
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.authenticate();
      this.isInitialized = true;
      this.logger.info('Synthetic API Client successfully initialized');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Synthetic API Client', { error });
      throw error;
    }
  }

  /**
   * Authenticate with the Synthetic API using client credentials
   */
  private async authenticate(): Promise<void> {
    const authEndpoint = `${this.config.baseUrl}/oauth/token`;
    const authData = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    });

    try {
      const response = await fetch(authEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: authData.toString()
      });

      if (!response.ok) {
        throw new AuthenticationError(
          `Authentication failed with status ${response.status}`,
          response.headers.get('x-request-id') || undefined
        );
      }

      this.token = await response.json();
      this.tokenExpiry = Date.now() + (this.token.expires_in * 1000);
      
      this.logger.info('Authentication successful', {
        expiresIn: this.token.expires_in,
        tokenType: this.token.token_type
      });
    } catch (error) {
      if (error instanceof DevFlowApiError) {
        throw error;
      }
      throw new AuthenticationError(
        `Authentication request failed: ${error.message}`,
        undefined
      );
    }
  }

  /**
   * Ensure we have a valid authentication token
   */
  private async ensureAuthentication(): Promise<void> {
    // Refresh token if it's expired or will expire in the next minute
    if (!this.token || !this.tokenExpiry || 
        this.tokenExpiry < Date.now() + 60000) {
      await this.authenticate();
    }
  }

  /**
   * Make a single API request
   */
  async request<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const requestId = uuidv4();
    const request: ApiRequest = {
      id: requestId,
      endpoint,
      method,
      data,
      headers,
      timestamp: Date.now()
    };

    this.logger.debug('Making API request', { requestId, endpoint, method });
    
    // Add to batch processor for optimization
    return this.batchProcessor.addRequest<T>(request);
  }

  /**
   * Execute a request directly (bypassing batch optimization)
   */
  async executeRequest<T = any>(request: ApiRequest): Promise<ApiResponse<T>> {
    await this.ensureAuthentication();
    await this.rateLimiter.wait();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const response = await this.makeHttpRequest<T>(request);
        this.logger.debug('API request successful', { 
          requestId: request.id, 
          endpoint: request.endpoint,
          status: response.status
        });
        return response;
      } catch (error) {
        lastError = error;
        
        // If it's not retryable or we've exhausted retries, throw the error
        if (!(error instanceof DevFlowApiError) || 
            !error.retryable || 
            attempt === this.config.maxRetries!) {
          this.logger.error('API request failed', {
            requestId: request.id,
            endpoint: request.endpoint,
            error: error.message,
            attempt
          });
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.min(
          this.config.retryDelay! * Math.pow(2, attempt),
          30000 // Max 30 seconds
        );
        
        this.logger.warn('API request failed, retrying', {
          requestId: request.id,
          endpoint: request.endpoint,
          attempt: attempt + 1,
          delay,
          error: error.message
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Make HTTP request to the API
   */
  private async makeHttpRequest<T>(request: ApiRequest): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${request.endpoint}`;
    const controller = new AbortController();
    
    // Set timeout
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: {
          'Authorization': `Bearer ${this.token!.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-ID': request.id,
          ...request.headers
        },
        signal: controller.signal
      };

      if (request.data && ['POST', 'PUT'].includes(request.method)) {
        fetchOptions.body = JSON.stringify(request.data);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        this.handleErrorResponse(response, responseData, request.id);
      }

      return {
        data: responseData as T,
        status: response.status,
        headers: this.flattenHeaders(response.headers),
        requestId: request.id
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout', request.id);
      }
      
      throw new NetworkError(`Network error: ${error.message}`, request.id);
    }
  }

  /**
   * Handle API error responses
   */
  private handleErrorResponse(
    response: Response, 
    data: any, 
    requestId: string
  ): void {
    const status = response.status;
    const message = data.message || response.statusText || 'Unknown error';
    
    switch (status) {
      case 401:
        throw new AuthenticationError(message, requestId);
      case 429:
        throw new RateLimitError(message, requestId);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new DevFlowApiError(
          'SERVER_ERROR', 
          message, 
          status, 
          requestId, 
          true
        );
      default:
        throw new DevFlowApiError(
          'API_ERROR', 
          message, 
          status, 
          requestId, 
          false
        );
    }
  }

  /**
   * Convert Headers object to plain object
   */
  private flattenHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Batch multiple requests for cost optimization
   */
  async batch<T extends any[]>(
    requests: Array<{
      endpoint: string;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      data?: any;
      headers?: Record<string, string>;
    }>
  ): Promise<ApiResponse<T[number]>[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const batchRequests: ApiRequest[] = requests.map((req, index) => ({
      id: uuidv4(),
      endpoint: req.endpoint,
      method: req.method || 'GET',
      data: req.data,
      headers: req.headers,
      timestamp: Date.now()
    }));

    this.logger.debug('Creating batch request', { 
      batchSize: batchRequests.length 
    });

    return this.batchProcessor.addBatch<T>(batchRequests);
  }

  /**
   * Get current rate limit information
   */
  getRateLimitInfo(): { 
    limit: number; 
    remaining: number; 
    resetTime?: number 
  } {
    return this.rateLimiter.getInfo();
  }
}

/**
 * Rate limiter to prevent exceeding API rate limits
 */
class RateLimiter {
  private limit: number;
  private requests: number[] = []; // Timestamps of requests
  private logger: Logger;

  constructor(limit: number, logger: Logger) {
    this.limit = limit;
    this.logger = logger;
  }

  /**
   * Wait until we can make another request
   */
  async wait(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 1000; // 1 second window

    // Remove old requests outside the window
    this.requests = this.requests.filter(timestamp => timestamp > windowStart);

    if (this.requests.length >= this.limit) {
      const oldestRequest = this.requests[0];
      const delay = 1000 - (now - oldestRequest) + 10; // Add 10ms buffer
      
      this.logger.debug('Rate limit reached, waiting', { delay });
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.wait(); // Recursively check again
    }

    this.requests.push(now);
  }

  /**
   * Get current rate limit information
   */
  getInfo(): { 
    limit: number; 
    remaining: number; 
    resetTime?: number 
  } {
    const now = Date.now();
    const windowStart = now - 1000;
    this.requests = this.requests.filter(timestamp => timestamp > windowStart);
    
    return {
      limit: this.limit,
      remaining: this.limit - this.requests.length,
      resetTime: this.requests.length > 0 ? this.requests[0] + 1000 : undefined
    };
  }
}

/**
 * Batch processor for optimizing multiple requests
 */
class BatchProcessor {
  private client: SyntheticApiClient;
  private logger: Logger;
  private batchQueue: ApiRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_WINDOW = 50; // ms
  private readonly MAX_BATCH_SIZE = 10;

  constructor(client: SyntheticApiClient, logger: Logger) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Add a single request to the batch processor
   */
  async addRequest<T>(request: ApiRequest): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({
        ...request,
        headers: {
          ...request.headers,
          'X-Batch-Callback': 'true'
        }
      });

      // Set up batch processing timeout
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(
          () => this.processBatch(),
          this.BATCH_WINDOW
        );
      }

      // Process immediately if batch is full
      if (this.batchQueue.length >= this.MAX_BATCH_SIZE) {
        if (this.batchTimeout) {
          clearTimeout(this.batchTimeout);
          this.batchTimeout = null;
        }
        this.processBatch();
      }

      // Store callback for later resolution
      const callback = (result: ApiResponse<T> | Error) => {
        if (result instanceof Error) {
          reject(result);
        } else {
          resolve(result);
        }
      };

      // Use a unique property to store the callback
      (request as any).__callback = callback;
    });
  }

  /**
   * Add multiple requests as a batch
   */
  async addBatch<T extends any[]>(requests: ApiRequest[]): Promise<ApiResponse<T[number]>[]> {
    return Promise.all(
      requests.map(request => this.addRequest<T[number]>(request))
    );
  }

  /**
   * Process all queued requests in batches
   */
  private async processBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchQueue.length === 0) {
      return;
    }

    const batch = this.batchQueue.splice(0, this.MAX_BATCH_SIZE);
    this.logger.debug('Processing batch', { batchSize: batch.length });

    try {
      // Execute requests in parallel for better performance
      const results = await Promise.allSettled(
        batch.map(request => this.client.executeRequest(request))
      );

      // Resolve individual promises
      results.forEach((result, index) => {
        const request = batch[index];
        const callback = (request as any).__callback;
        
        if (callback) {
          if (result.status === 'fulfilled') {
            callback(result.value);
          } else {
            callback(result.reason);
          }
        }
      });
    } catch (error) {
      // Reject all pending requests in case of batch failure
      batch.forEach(request => {
        const callback = (request as any).__callback;
        if (callback) {
          callback(error);
        }
      });
    }

    // Process remaining requests if any
    if (this.batchQueue.length > 0) {
      this.batchTimeout = setTimeout(
        () => this.processBatch(),
        this.BATCH_WINDOW
      );
    }
  }
}

// Export types and errors for external use
export {
  ApiConfig,
  ApiResponse,
  ApiError,
  DevFlowApiError,
  AuthenticationError,
  RateLimitError,
  NetworkError
};

// Export logger interface for custom implementations
export { Logger };