import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

/**
 * Synthetic API Client for DevFlow real-world testing
 * Implements authentication, rate limiting, and error handling
 */

// Rate limiting constants
const REQUESTS_PER_WINDOW = 135;
const WINDOW_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

interface RateLimitState {
  requests: number[];
  windowStart: number;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface SyntheticAPIConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

interface BatchRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: any;
  headers?: Record<string, string>;
}

export class SyntheticAPIClient extends EventEmitter {
  private axiosInstance: AxiosInstance;
  private config: SyntheticAPIConfig;
  private rateLimitState: RateLimitState;

  constructor() {
    super();
    
    // Load configuration from environment variables
    this.config = this.loadConfig();
    
    // Initialize axios instance
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Initialize rate limiting
    this.rateLimitState = {
      requests: [],
      windowStart: Date.now(),
    };
    
    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => this.handleResponseError(error)
    );
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): SyntheticAPIConfig {
    const apiKey = process.env.SYNTHETIC_API_KEY;
    const baseUrl = process.env.SYNTHETIC_API_BASE_URL || 'https://api.synthetic.new';
    const timeout = parseInt(process.env.SYNTHETIC_API_TIMEOUT || '30000');

    if (!apiKey) {
      throw new Error('SYNTHETIC_API_KEY environment variable is required');
    }

    return {
      baseUrl,
      apiKey,
      timeout
    };
  }

  /**
   * Check if we're within rate limits
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset window if it's been more than 5 hours
    if (now - this.rateLimitState.windowStart > WINDOW_DURATION_MS) {
      this.rateLimitState = {
        requests: [],
        windowStart: now
      };
    }
    
    // Remove requests older than the window
    const windowStart = now - WINDOW_DURATION_MS;
    this.rateLimitState.requests = this.rateLimitState.requests.filter(
      timestamp => timestamp > windowStart
    );
    
    // Check if we're at the limit
    return this.rateLimitState.requests.length < REQUESTS_PER_WINDOW;
  }

  /**
   * Record a request for rate limiting
   */
  private recordRequest(): void {
    this.rateLimitState.requests.push(Date.now());
  }

  /**
   * Wait for rate limit to reset if needed
   */
  private async waitForRateLimit(): Promise<void> {
    if (this.checkRateLimit()) {
      return;
    }
    
    const oldestRequest = Math.min(...this.rateLimitState.requests);
    const windowReset = oldestRequest + WINDOW_DURATION_MS;
    const waitTime = windowReset - Date.now() + 1000; // Add 1 second buffer
    
    console.warn(`Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds`);
    
    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Handle API response errors
   */
  private async handleResponseError(error: any): Promise<any> {
    const { response, config } = error;
    
    if (response?.status === 429) {
      // Rate limited, wait and retry
      console.warn('Rate limited by Synthetic API');
      await this.waitForRateLimit();
      return this.axiosInstance.request(config);
    } else if (response?.status >= 500) {
      // Server error, implement exponential backoff
      const retryCount = config.retryCount || 0;
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
        console.warn(`Server error, retrying in ${delay}ms (attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.axiosInstance.request({
          ...config,
          retryCount: retryCount + 1
        });
      }
    }
    
    // For all other errors, re-throw
    throw error;
  }

  /**
   * Make a request to the Synthetic API
   */
  private async makeRequest<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await this.waitForRateLimit();
    this.recordRequest();
    return this.axiosInstance.request<T>(config);
  }

  /**
   * Execute a batch of requests
   */
  public async executeBatch<T>(requests: BatchRequest[]): Promise<AxiosResponse<T>[]> {
    console.log(`Executing batch of ${requests.length} requests`);
    
    // Process in smaller batches to avoid hitting rate limits
    const batchSize = 10;
    const results: AxiosResponse<T>[] = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      
      // Execute batch in parallel
      const batchPromises = batch.map(req => 
        this.makeRequest<T>({
          method: req.method,
          url: req.url,
          data: req.data,
          headers: req.headers
        })
      );
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        console.log(`Completed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(requests.length/batchSize)}`);
      } catch (error) {
        console.error(`Batch execution failed at batch ${Math.floor(i/batchSize) + 1}`, error);
        throw error;
      }
    }
    
    console.log(`Batch execution completed with ${results.length} results`);
    return results;
  }

  /**
   * Get data from the Synthetic API
   */
  public async get<T>(endpoint: string, params?: Record<string, any>): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>({
      method: 'GET',
      url: endpoint,
      params
    });
  }

  /**
   * Post data to the Synthetic API
   */
  public async post<T>(endpoint: string, data?: any): Promise<AxiosResponse<T>> {
    return this.makeRequest<T>({
      method: 'POST',
      url: endpoint,
      data
    });
  }

  /**
   * Get current rate limit status
   */
  public getRateLimitStatus(): { 
    remaining: number; 
    used: number; 
    resetTime: number | null 
  } {
    const now = Date.now();
    const windowReset = this.rateLimitState.windowStart + WINDOW_DURATION_MS;
    
    return {
      remaining: REQUESTS_PER_WINDOW - this.rateLimitState.requests.length,
      used: this.rateLimitState.requests.length,
      resetTime: windowReset > now ? windowReset : null
    };
  }

  /**
   * Generate embeddings for semantic memory
   */
  public async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.post('/embeddings', {
      texts,
      model: 'text-embedding-ada-002'
    });
    
    return response.data.embeddings;
  }
}