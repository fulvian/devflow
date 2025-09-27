import OpenAI from 'openai';
export class SyntheticClient {
    openai;
    timeoutMs;
    constructor(config) {
        this.timeoutMs = config.timeoutMs ?? 30000;
        this.openai = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl ?? 'https://api.synthetic.new/v1',
            timeout: this.timeoutMs,
        });
    }
    async chat(params) {
        try {
            const messages = params.messages.map(msg => ({
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
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Synthetic.new API error: ${error.message}`);
            }
            throw error;
        }
    }
}
//# sourceMappingURL=api-client.js.map