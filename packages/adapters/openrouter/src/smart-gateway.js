/**
 * Smart OpenRouter Gateway with Cost Monitoring and DeepSeek Fallback
 * Integrates cost tracking, budget enforcement, and intelligent model selection
 */
import {} from './gateway.js';
import { CostMonitor } from './cost-monitor.js';
import { OpenRouterClient } from './client/api-client.js';
export class SmartOpenRouterGateway {
    client;
    costMonitor;
    config;
    constructor(config) {
        this.config = config;
        this.client = new OpenRouterClient({
            apiKey: config.apiKey || process.env['OPENROUTER_API_KEY'] || '',
            baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
            timeoutMs: config.timeoutMs || 30000
        });
        this.costMonitor = config.enableCostMonitoring
            ? new CostMonitor(config.budget)
            : null;
    }
    /**
     * Generate with smart model selection and cost control
     */
    async smartGenerate(input) {
        const taskComplexity = input.taskComplexity || this.classifyTaskComplexity(input.description);
        const estimatedTokens = this.estimateTokens(input.description + (input.messages?.map(m => m.content).join(' ') || ''));
        // Get recommended model based on budget and complexity
        let selectedModel = this.getOptimalModel(taskComplexity, estimatedTokens);
        let fallbackUsed = false;
        // Check budget before proceeding
        if (this.costMonitor) {
            const estimatedCost = this.costMonitor.estimateRequestCost(selectedModel, estimatedTokens);
            const budgetCheck = this.costMonitor.canMakeRequest(estimatedCost);
            if (!budgetCheck.allowed) {
                // Try free model as last resort
                selectedModel = 'deepseek/deepseek-chat-v3.1:free';
                fallbackUsed = true;
                if (input.maxCost && estimatedCost > input.maxCost) {
                    throw new Error(`Estimated cost $${estimatedCost.toFixed(4)} exceeds max cost $${input.maxCost.toFixed(4)}`);
                }
            }
        }
        // Try primary model
        try {
            const result = await this.executeWithModel(selectedModel, input);
            const actualCost = this.calculateActualCost(selectedModel, result.raw.usage?.total_tokens || 0);
            // Record usage
            if (this.costMonitor) {
                const alerts = await this.costMonitor.recordUsage(selectedModel, result.raw.usage?.total_tokens || 0, actualCost);
                if (alerts.length > 0 && this.config.alertCallback) {
                    this.config.alertCallback(alerts);
                }
            }
            return {
                ...result,
                actualCost,
                budgetRemaining: this.costMonitor ? this.getBudgetRemaining() : -1,
                modelSelected: selectedModel,
                fallbackUsed
            };
        }
        catch (error) {
            // If primary model fails, try DeepSeek fallback
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Model ${selectedModel} failed, trying DeepSeek fallback:`, errorMessage);
            return await this.tryDeepSeekFallback(input, error instanceof Error ? error : new Error(String(error)));
        }
    }
    /**
     * DeepSeek fallback strategy: free -> paid
     */
    async tryDeepSeekFallback(input, originalError) {
        const fallbackModels = [
            'deepseek/deepseek-chat-v3.1:free',
            'deepseek/deepseek-chat-v3.1'
        ];
        for (const model of fallbackModels) {
            try {
                console.log(`🔄 Trying DeepSeek fallback: ${model}`);
                // Check budget for paid model
                if (model.includes(':free') === false && this.costMonitor) {
                    const estimatedTokens = this.estimateTokens(input.description);
                    const estimatedCost = this.costMonitor.estimateRequestCost(model, estimatedTokens);
                    const budgetCheck = this.costMonitor.canMakeRequest(estimatedCost);
                    if (!budgetCheck.allowed) {
                        console.warn(`Budget check failed for ${model}: ${budgetCheck.reason}`);
                        continue;
                    }
                }
                const result = await this.executeWithModel(model, input);
                const actualCost = this.calculateActualCost(model, result.raw.usage?.total_tokens || 0);
                // Record usage
                if (this.costMonitor && actualCost > 0) {
                    await this.costMonitor.recordUsage(model, result.raw.usage?.total_tokens || 0, actualCost);
                }
                console.log(`✅ DeepSeek fallback succeeded with ${model}`);
                return {
                    ...result,
                    actualCost,
                    budgetRemaining: this.costMonitor ? this.getBudgetRemaining() : -1,
                    modelSelected: model,
                    fallbackUsed: true
                };
            }
            catch (fallbackError) {
                const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
                console.warn(`DeepSeek fallback ${model} failed:`, errorMessage);
                continue;
            }
        }
        // All fallbacks failed
        throw new Error(`All models failed. Original error: ${originalError.message}`);
    }
    /**
     * Execute request with specific model
     */
    async executeWithModel(model, input) {
        const response = await this.client.chat({
            model,
            messages: input.messages,
            max_tokens: input.maxTokens || 300,
            temperature: input.temperature || 0.7
        });
        return {
            model,
            text: response.choices[0]?.message?.content || '',
            raw: response
        };
    }
    /**
     * Classify task complexity for model selection
     */
    classifyTaskComplexity(description) {
        const simpleKeywords = ['simple', 'basic', 'hello', 'format', 'validate', 'capitalize'];
        const complexKeywords = ['architecture', 'system', 'design', 'algorithm', 'optimize', 'complex'];
        const lowerDesc = description.toLowerCase();
        if (complexKeywords.some(keyword => lowerDesc.includes(keyword))) {
            return 'complex';
        }
        if (simpleKeywords.some(keyword => lowerDesc.includes(keyword))) {
            return 'simple';
        }
        return 'medium';
    }
    /**
     * Get optimal model based on task complexity and budget
     */
    getOptimalModel(complexity, _estimatedTokens) {
        if (this.costMonitor) {
            return this.costMonitor.getRecommendedModel(complexity);
        }
        // Default model selection without cost monitoring
        const modelsByComplexity = {
            simple: 'deepseek/deepseek-chat-v3.1:free',
            medium: 'deepseek/deepseek-chat-v3.1',
            complex: 'gpt-4o-mini'
        };
        return modelsByComplexity[complexity];
    }
    /**
     * Estimate tokens for a text input
     */
    estimateTokens(text) {
        // Rough estimation: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }
    /**
     * Calculate actual cost based on model and tokens
     */
    calculateActualCost(model, tokens) {
        if (this.costMonitor) {
            return this.costMonitor.estimateRequestCost(model, tokens);
        }
        return 0;
    }
    /**
     * Get remaining budget
     */
    getBudgetRemaining() {
        if (!this.costMonitor)
            return -1;
        const usage = this.costMonitor.getCurrentUsage();
        return Math.max(0, usage.budget.daily - usage.daily.totalCost);
    }
    /**
     * Generate cost report
     */
    generateCostReport() {
        return this.costMonitor?.generateReport() || 'Cost monitoring disabled';
    }
    /**
     * Update budget limits
     */
    updateBudget(newBudget) {
        this.costMonitor?.updateBudget(newBudget);
    }
    /**
     * Get current usage statistics
     */
    getUsageStats() {
        return this.costMonitor?.getCurrentUsage() || null;
    }
    /**
     * Test model connectivity
     */
    async testModels() {
        const testModels = [
            'deepseek/deepseek-chat-v3.1:free',
            'deepseek/deepseek-chat-v3.1',
            'gpt-4o-mini'
        ];
        const results = {};
        for (const model of testModels) {
            const startTime = Date.now();
            try {
                await this.client.chat({
                    model,
                    messages: [{ role: 'user', content: 'Test connection - respond with "OK"' }],
                    max_tokens: 10
                });
                results[model] = {
                    success: true,
                    responseTime: Date.now() - startTime
                };
            }
            catch (error) {
                results[model] = {
                    success: false,
                    responseTime: Date.now() - startTime,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
        return results;
    }
}
//# sourceMappingURL=smart-gateway.js.map