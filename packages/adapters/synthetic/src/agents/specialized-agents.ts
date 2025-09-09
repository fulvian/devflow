import { SyntheticClient, type ChatMessage, type ChatResponse } from '../client/api-client.js';
import { DEFAULT_SYNTHETIC_MODELS } from '../models/model-config.js';

export interface AgentRequest {
  readonly title?: string;
  readonly description: string;
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly context?: { injected?: string };
}

export interface AgentResponse {
  readonly agent: string;
  readonly model: string;
  readonly text: string;
  readonly raw: ChatResponse;
  readonly tokensUsed?: number;
}

export abstract class BaseSyntheticAgent {
  protected readonly client: SyntheticClient;
  protected readonly agentName: string;

  constructor(client: SyntheticClient, agentName: string) {
    this.client = client;
    this.agentName = agentName;
  }

  abstract getPreferredModel(): string;
  abstract getSystemPrompt(): string;

  async process(request: AgentRequest): Promise<AgentResponse> {
    const model = this.getPreferredModel();
    
    // Prepare messages with system prompt
    const messages: ChatMessage[] = [
      { role: 'system', content: this.getSystemPrompt() }
    ];

    // Add context if provided
    if (request.context?.injected) {
      messages.push({
        role: 'system',
        content: `Context: ${request.context.injected}`
      });
    }

    // Add user messages
    messages.push(...request.messages);

    const response = await this.client.chat({
      model,
      messages,
      maxTokens: request.maxTokens ?? undefined,
      temperature: request.temperature ?? 0.1,
    });

    return {
      agent: this.agentName,
      model: response.model,
      text: response.choices[0]?.message.content ?? '',
      raw: response,
      tokensUsed: response.usage?.total_tokens ?? 0,
    };
  }
}

export class SyntheticCodeAgent extends BaseSyntheticAgent {
  constructor(client: SyntheticClient) {
    super(client, 'synthetic-code');
  }

  getPreferredModel(): string {
    return DEFAULT_SYNTHETIC_MODELS.code;
  }

  getSystemPrompt(): string {
    return `You are a specialized code implementation agent. Your primary role is:

1. **Rapid Code Implementation**: Generate production-ready code following established patterns
2. **API Integration**: Implement API clients, wrappers, and integration patterns
3. **Refactoring**: Improve existing code while maintaining functionality
4. **Pattern Following**: Adhere to existing project conventions and architecture

Focus on:
- Clean, readable, maintainable code
- Following existing patterns in the codebase
- TypeScript best practices with strict typing
- Error handling and edge cases
- Performance considerations

Keep responses concise and code-focused. Avoid lengthy explanations unless requested.`;
  }
}

export class SyntheticReasoningAgent extends BaseSyntheticAgent {
  constructor(client: SyntheticClient) {
    super(client, 'synthetic-reasoning');
  }

  getPreferredModel(): string {
    return DEFAULT_SYNTHETIC_MODELS.reasoning;
  }

  getSystemPrompt(): string {
    return `You are a specialized reasoning and analysis agent. Your primary role is:

1. **Technical Decision Making**: Analyze architectural choices and trade-offs
2. **Problem Solving**: Break down complex problems into manageable components
3. **System Analysis**: Evaluate system design, performance, and scalability
4. **Debugging Logic**: Identify root causes and systematic solutions

Focus on:
- Clear logical reasoning and analysis
- Weighing pros and cons of different approaches
- Identifying potential issues and risks
- Providing actionable recommendations
- Strategic thinking over implementation details

Provide thorough analysis while remaining concise and actionable.`;
  }
}

export class SyntheticContextAgent extends BaseSyntheticAgent {
  constructor(client: SyntheticClient) {
    super(client, 'synthetic-context');
  }

  getPreferredModel(): string {
    return DEFAULT_SYNTHETIC_MODELS.context;
  }

  getSystemPrompt(): string {
    return `You are a specialized large-context analysis agent. Your primary role is:

1. **Comprehensive Analysis**: Process and understand large codebases and documents
2. **Documentation Generation**: Create thorough documentation from extensive code
3. **Cross-Reference Analysis**: Find relationships and dependencies across large projects
4. **Migration Planning**: Analyze entire systems for refactoring or migration

Focus on:
- Handling large amounts of context efficiently
- Identifying patterns and relationships across the entire codebase
- Providing comprehensive summaries and documentation
- Strategic overview rather than implementation details
- Maintaining context awareness throughout long conversations

Use your large context window to provide insights that shorter-context models cannot.`;
  }
}