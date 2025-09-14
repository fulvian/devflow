/**
 * OpenAI Service Wrapper for Codex MCP Integration
 * 
 * This module provides a robust wrapper around the OpenAI API with advanced features:
 * - Exponential backoff retry logic
 * - Rate limit handling
 * - Response validation and parsing
 * - Context-aware prompting
 * - Token usage tracking
 * - Streaming support for large responses
 */

import OpenAI from 'openai';
import {
  ChatCompletionCreateParams,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions';
import { APIError, RateLimitError } from 'openai/error';
import { Stream } from 'openai/streaming';

// Types and interfaces
interface OpenAIServiceConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  defaultModel?: string;
}

interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  exponentialBase: number;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface PromptContext {
  systemMessage?: string;
  conversationHistory?: ChatCompletionMessageParam[];
  userId?: string;
}

interface ProcessedResponse {
  content: string;
  usage: TokenUsage;
  finishReason: string | null;
}

// Default configuration
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  exponentialBase: 2
};

const DEFAULT_MODEL = 'gpt-4-turbo';

export class OpenAIService {
  private client: OpenAI;
  private retryOptions: RetryOptions;
  private defaultModel: string;

  constructor(config: OpenAIServiceConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      baseURL: config.baseURL,
      timeout: config.timeout,
      maxRetries: 0 // We handle retries ourselves
    });

    this.retryOptions = {
      ...DEFAULT_RETRY_OPTIONS,
      maxRetries: config.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries
    };

    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
  }

  /**
   * Creates a chat completion with retry logic and error handling
   */
  async createChatCompletion(
    params: Omit<ChatCompletionCreateParams, 'model'> & { model?: string },
    context?: PromptContext
  ): Promise<ProcessedResponse> {
    const fullParams = this.prepareChatCompletionParams(params, context);
    
    try {
      const response = await this.withRetry(() => 
        this.client.chat.completions.create(fullParams)
      );
      
      return this.processResponse(response);
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Creates a streaming chat completion
   */
  async createChatCompletionStream(
    params: Omit<ChatCompletionCreateParams, 'model'> & { model?: string },
    context?: PromptContext
  ): Promise<Stream<ChatCompletionChunk>> {
    const fullParams = this.prepareChatCompletionParams(params, context);
    
    try {
      return await this.withRetry(() => 
        this.client.chat.completions.create({
          ...fullParams,
          stream: true
        })
      );
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  /**
   * Processes and validates the OpenAI response
   */
  private processResponse(response: ChatCompletion): ProcessedResponse {
    const choice = response.choices[0];
    
    if (!choice) {
      throw new Error('No completion choices returned from OpenAI');
    }

    const usage: TokenUsage = {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0
    };

    return {
      content: choice.message?.content ?? '',
      usage,
      finishReason: choice.finish_reason ?? null
    };
  }

  /**
   * Prepares chat completion parameters with context
   */
  private prepareChatCompletionParams(
    params: Omit<ChatCompletionCreateParams, 'model'> & { model?: string },
    context?: PromptContext
  ): ChatCompletionCreateParams {
    const messages: ChatCompletionMessageParam[] = [];

    // Add system message if provided
    if (context?.systemMessage) {
      messages.push({
        role: 'system',
        content: context.systemMessage
      });
    }

    // Add conversation history
    if (context?.conversationHistory) {
      messages.push(...context.conversationHistory);
    }

    // Add current user message
    messages.push(...(params.messages || []));

    return {
      model: params.model ?? this.defaultModel,
      messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      frequency_penalty: params.frequency_penalty,
      presence_penalty: params.presence_penalty,
      user: context?.userId ?? params.user
    };
  }

  /**
   * Implements exponential backoff retry logic
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // If it's not a retryable error, throw immediately
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // If we've exhausted retries, throw the error
        if (attempt === this.retryOptions.maxRetries) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Determines if an error should be retried
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof RateLimitError) {
      return true;
    }

    if (error instanceof APIError) {
      // Retry on server errors (5xx) and rate limit errors (429)
      return error.status === 429 || (error.status >= 500 && error.status <= 599);
    }

    // Retry on network errors
    if (error instanceof Error) {
      return error.message.includes('ECONNRESET') || 
             error.message.includes('ETIMEDOUT') || 
             error.message.includes('ENOTFOUND');
    }

    return false;
  }

  /**
   * Calculates delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    const { initialDelay, maxDelay, exponentialBase } = this.retryOptions;
    const exponentialDelay = initialDelay * Math.pow(exponentialBase, attempt);
    const jitter = Math.random() * 0.5 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  /**
   * Handles OpenAI-specific errors and converts them to application errors
   */
  private handleOpenAIError(error: unknown): Error {
    if (error instanceof RateLimitError) {
      return new Error(`OpenAI rate limit exceeded. ${error.message}`);
    }

    if (error instanceof APIError) {
      return new Error(`OpenAI API error (${error.status}): ${error.message}`);
    }

    if (error instanceof Error) {
      return new Error(`OpenAI service error: ${error.message}`);
    }

    return new Error('Unknown OpenAI service error');
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets current token usage statistics
   */
  getTokenUsage(): TokenUsage {
    // Note: This is a simplified implementation. In a production system,
    // you might want to track usage across requests in a more sophisticated way.
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
  }
}

// Export types for external use
export type {
  OpenAIServiceConfig,
  RetryOptions,
  TokenUsage,
  PromptContext,
  ProcessedResponse,
  ChatCompletionCreateParams,
  ChatCompletionMessageParam
};