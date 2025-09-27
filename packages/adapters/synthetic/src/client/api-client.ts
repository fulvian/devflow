import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface ChatResponse {
  readonly id: string;
  readonly model: string;
  readonly choices: ReadonlyArray<{
    readonly message: {
      readonly role: string;
      readonly content: string;
    };
    readonly finish_reason: string;
  }>;
  readonly usage: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
}

export interface SyntheticClientConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

export class SyntheticClient {
  private readonly openai: OpenAI;
  private readonly timeoutMs: number;

  constructor(config: SyntheticClientConfig) {
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl ?? 'https://api.synthetic.new/v1',
      timeout: this.timeoutMs,
    });
  }

  async chat(params: {
    readonly model: string;
    readonly messages: ReadonlyArray<ChatMessage>;
    readonly maxTokens?: number;
    readonly temperature?: number;
  }): Promise<ChatResponse> {
    try {
      const messages: ChatCompletionMessageParam[] = params.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await this.openai.chat.completions.create({
        model: params.model,
        messages,
        max_tokens: params.maxTokens ?? null,
        temperature: params.temperature ?? 0.1,
      });

      // Transform OpenAI response to our ChatResponse format
      return {
        id: response.id,
        model: response.model,
        choices: response.choices.map(choice => ({
          message: {
            role: choice.message.role,
            content: choice.message.content ?? '',
          },
          finish_reason: choice.finish_reason ?? 'stop',
        })),
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Synthetic.new API error: ${error.message}`);
      }
      throw error;
    }
  }
}