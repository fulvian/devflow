import { EventEmitter } from 'events';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Types
interface CCRConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
}

interface CCRRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface CCRRoutingDecision {
  provider: string;
  model: string;
  reason: string;
  confidence: number;
}

interface CCRResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  routingDecision?: CCRRoutingDecision;
}

interface FallbackOrchestrator {
  routeRequest(request: CCRRequest): Promise<CCRRoutingDecision>;
  handleFailure(provider: string, model: string): Promise<void>;
  getAvailableProviders(): Promise<string[]>;
}

// CCR Integration Class
export class CCRIntegration extends EventEmitter {
  private config: CCRConfig;
  private orchestrator: FallbackOrchestrator;
  private isInitialized: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: CCRConfig, orchestrator: FallbackOrchestrator) {
    super();
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3
    };
    this.orchestrator = orchestrator;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Test connection to CCR service
      await this.healthCheck();
      
      // Start health check interval
      this.healthCheckInterval = setInterval(() => {
        this.healthCheck().catch(err => {
          console.warn('CCR health check failed:', err.message);
          this.emit('healthCheckFailed', err);
        });
      }, 30000); // Every 30 seconds
      
      this.isInitialized = true;
      this.emit('initialized');
      console.log('CCR Integration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize CCR Integration:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/health`, {
        timeout: this.config.timeout
      });
      
      if (response.status === 200 && response.data.status === 'healthy') {
        this.emit('healthCheckPassed');
        return true;
      }
      
      throw new Error(`Health check failed with status: ${response.status}`);
    } catch (error) {
      this.emit('healthCheckFailed', error);
      throw error;
    }
  }

  async routeRequest(request: CCRRequest): Promise<CCRRoutingDecision> {
    if (!this.isInitialized) {
      throw new Error('CCRIntegration not initialized');
    }

    try {
      // First, let the orchestrator make a routing decision
      const routingDecision = await this.orchestrator.routeRequest(request);
      
      // Validate the decision
      if (!routingDecision.provider || !routingDecision.model) {
        throw new Error('Invalid routing decision from orchestrator');
      }
      
      console.log(`Routing request to ${routingDecision.provider}:${routingDecision.model}`);
      this.emit('routingDecision', routingDecision);
      
      return routingDecision;
    } catch (error) {
      console.error('Routing decision failed:', error);
      this.emit('routingError', error);
      throw error;
    }
  }

  async processRequest(request: CCRRequest): Promise<CCRResponse> {
    if (!this.isInitialized) {
      throw new Error('CCRIntegration not initialized');
    }

    let lastError: Error | null = null;
    
    // Try up to maxRetries times
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        // Get routing decision
        const routingDecision = await this.routeRequest(request);
        
        // Prepare the request for the CCR service
        const ccrRequest = {
          ...request,
          provider: routingDecision.provider,
          model: routingDecision.model
        };
        
        // Make the request to CCR service
        const response = await axios.post(`${this.config.baseUrl}/chat`, ccrRequest, {
          timeout: this.config.timeout,
          headers: this.config.apiKey ? {
            'Authorization': `Bearer ${this.config.apiKey}`
          } : {}
        });
        
        if (response.status !== 200) {
          throw new Error(`CCR service returned status ${response.status}`);
        }
        
        const ccrResponse: CCRResponse = {
          id: uuidv4(),
          content: response.data.content,
          model: routingDecision.model,
          provider: routingDecision.provider,
          usage: response.data.usage,
          routingDecision
        };
        
        this.emit('requestProcessed', ccrResponse);
        return ccrResponse;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} failed:`, error.message);
        
        // Notify orchestrator of failure
        if (error.response?.data?.provider) {
          await this.orchestrator.handleFailure(
            error.response.data.provider,
            error.response.data.model
          ).catch(err => {
            console.error('Failed to notify orchestrator of failure:', err);
          });
        }
        
        // If this was the last attempt, don't retry
        if (attempt === this.config.maxRetries!) {
          break;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    // If we get here, all retries failed
    this.emit('requestFailed', lastError);
    throw lastError;
  }

  async getAvailableModels(): Promise<Array<{provider: string, model: string}>> {
    if (!this.isInitialized) {
      throw new Error('CCRIntegration not initialized');
    }

    try {
      const response = await axios.get(`${this.config.baseUrl}/models`, {
        timeout: this.config.timeout
      });
      
      if (response.status === 200) {
        return response.data.models || [];
      }
      
      throw new Error(`Failed to fetch models: ${response.status}`);
    } catch (error) {
      console.error('Failed to fetch available models:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    this.isInitialized = false;
    this.emit('shutdown');
    console.log('CCR Integration shut down');
  }
}

// Default configuration
export const defaultCCRConfig: CCRConfig = {
  baseUrl: process.env.CCR_BASE_URL || 'http://localhost:3001',
  apiKey: process.env.CCR_API_KEY,
  timeout: 30000,
  maxRetries: 3
};

export default CCRIntegration;
