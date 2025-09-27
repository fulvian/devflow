import { SyntheticClient } from './client/api-client.js';
import { SyntheticCodeAgent, SyntheticReasoningAgent, SyntheticContextAgent } from './agents/specialized-agents.js';
import { SyntheticCostTracker } from './analytics/cost-tracker.js';
export class SyntheticGateway {
    client;
    codeAgent;
    reasoningAgent;
    contextAgent;
    costTracker;
    constructor(config = {}) {
        const env = {
            SYNTHETIC_API_KEY: process.env['SYNTHETIC_API_KEY'],
            SYNTHETIC_BASE_URL: process.env['SYNTHETIC_BASE_URL'] || 'https://api.synthetic.new/v1',
            SYNTHETIC_TIMEOUT_MS: parseInt(process.env['SYNTHETIC_TIMEOUT_MS'] || '30000'),
        };
        const clientConfig = {
            apiKey: config.apiKey ?? env.SYNTHETIC_API_KEY ?? '',
            baseUrl: config.baseUrl ?? env.SYNTHETIC_BASE_URL,
            timeoutMs: config.timeoutMs ?? env.SYNTHETIC_TIMEOUT_MS ?? 30000,
        };
        this.client = new SyntheticClient(clientConfig);
        this.codeAgent = new SyntheticCodeAgent(this.client);
        this.reasoningAgent = new SyntheticReasoningAgent(this.client);
        this.contextAgent = new SyntheticContextAgent(this.client);
        this.costTracker = new SyntheticCostTracker();
    }
    /**
     * Classify task to determine which specialized agent should handle it
     */
    classifyTask(request) {
        const { title = '', description } = request;
        const text = `${title} ${description}`.toLowerCase();
        // Code implementation patterns
        const codePatterns = [
            /implement|code|function|class|api|refactor|fix|bug/,
            /typescript|javascript|python|rust|go|java/,
            /\bpackage\.json\b|\btsconfig\b|\bapi\s*client\b/,
            /write.*code|create.*function|add.*method/,
        ];
        // Reasoning patterns  
        const reasoningPatterns = [
            /analyze|design|architecture|strategy|plan/,
            /decision|choice|trade.*off|compare|evaluate/,
            /problem.*solv|debug.*logic|root.*cause/,
            /why|how.*should|what.*approach|which.*option/,
        ];
        // Large context patterns
        const contextPatterns = [
            /entire|whole|complete|full.*project|across.*codebase/,
            /documentation|migrate|overview|comprehensive/,
            /large.*file|many.*file|multiple.*module/,
            /\d+k|\d+.*thousand|massive|extensive/,
        ];
        let codeScore = 0;
        let reasoningScore = 0;
        let contextScore = 0;
        // Score each category
        codePatterns.forEach(pattern => {
            if (pattern.test(text))
                codeScore++;
        });
        reasoningPatterns.forEach(pattern => {
            if (pattern.test(text))
                reasoningScore++;
        });
        contextPatterns.forEach(pattern => {
            if (pattern.test(text))
                contextScore++;
        });
        // Additional heuristics
        if (request.messages.some(m => m.content.length > 2000)) {
            contextScore += 2; // Large messages suggest need for context agent
        }
        if (text.includes('implement') && codeScore > 0) {
            codeScore += 2; // Boost code score for implementation tasks
        }
        // Determine best agent
        const maxScore = Math.max(codeScore, reasoningScore, contextScore);
        if (maxScore === 0) {
            // Default to reasoning agent for unclear cases
            return {
                type: 'reasoning',
                confidence: 0.3,
                reasoning: 'No clear patterns detected, using reasoning agent as default'
            };
        }
        let type;
        let confidence;
        if (codeScore === maxScore) {
            type = 'code';
            confidence = Math.min(0.9, 0.4 + (codeScore * 0.15));
        }
        else if (contextScore === maxScore) {
            type = 'context';
            confidence = Math.min(0.9, 0.4 + (contextScore * 0.15));
        }
        else {
            type = 'reasoning';
            confidence = Math.min(0.9, 0.4 + (reasoningScore * 0.15));
        }
        return {
            type,
            confidence,
            reasoning: `Detected ${type} task (score: ${maxScore})`
        };
    }
    /**
     * Process request with automatically selected agent
     */
    async process(request) {
        const classification = this.classifyTask(request);
        const response = await this.processWithAgent(classification.type, request);
        return {
            ...response,
            classification
        };
    }
    /**
     * Process request with specific agent
     */
    async processWithAgent(agentType, request) {
        let response;
        switch (agentType) {
            case 'code':
                response = await this.codeAgent.process(request);
                break;
            case 'reasoning':
                response = await this.reasoningAgent.process(request);
                break;
            case 'context':
                response = await this.contextAgent.process(request);
                break;
            default:
                throw new Error(`Unknown agent type: ${agentType}`);
        }
        // Track cost/usage
        if (response.raw.usage) {
            this.costTracker.add({
                agent: response.agent,
                model: response.model,
                inputTokens: response.raw.usage.prompt_tokens,
                outputTokens: response.raw.usage.completion_tokens,
            });
        }
        return response;
    }
    /**
     * Get available agents info
     */
    getAvailableAgents() {
        return {
            code: {
                name: 'Code Implementation Agent',
                model: this.codeAgent.getPreferredModel(),
                specialties: ['implementation', 'api_integration', 'refactoring']
            },
            reasoning: {
                name: 'Reasoning & Analysis Agent',
                model: this.reasoningAgent.getPreferredModel(),
                specialties: ['technical_decisions', 'problem_solving', 'architecture']
            },
            context: {
                name: 'Large Context Agent',
                model: this.contextAgent.getPreferredModel(),
                specialties: ['comprehensive_analysis', 'documentation', 'migration']
            }
        };
    }
    /**
     * Get cost and usage statistics
     */
    getCostStats(rangeMs) {
        return this.costTracker.getStats(rangeMs);
    }
    /**
     * Get agent breakdown
     */
    getAgentBreakdown(rangeMs) {
        return this.costTracker.getAgentBreakdown(rangeMs);
    }
    /**
     * Get cost comparison with pay-per-use models
     */
    getPayPerUseSavings(payPerTokenRate) {
        return this.costTracker.getPayPerUseSavings(payPerTokenRate);
    }
    /**
     * Check if we're getting good value from flat fee
     */
    isGoodValue(minTokensForValue) {
        return this.costTracker.isGoodValue(minTokensForValue);
    }
}
//# sourceMappingURL=gateway.js.map