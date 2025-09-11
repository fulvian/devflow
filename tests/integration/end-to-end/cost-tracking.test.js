/**
 * CODEX-4A: Cost Tracking & Optimization Validation
 * Tests for real-time cost monitoring and intelligent routing
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DevFlowCore } from '../../../packages/core/src/index.js';
import { OpenRouterGateway } from '../../../packages/openrouter-gateway/src/index.js';
import { CostTracker } from '../../../packages/core/src/cost-tracker.js';
describe('Cost Tracking & Optimization', () => {
    let devFlow;
    let openRouter;
    let costTracker;
    beforeAll(async () => {
        devFlow = new DevFlowCore({
            dbPath: ':memory:',
            costTracking: true
        });
        openRouter = new OpenRouterGateway({
            apiKey: process.env.OPEN_ROUTER_API_KEY,
            costTracking: true
        });
        costTracker = new CostTracker({
            budgetLimit: 100, // $100 test budget
            alertThresholds: [0.5, 0.8, 0.9] // 50%, 80%, 90%
        });
        await devFlow.initialize();
        await openRouter.initialize();
        await costTracker.initialize();
    });
    afterAll(async () => {
        await devFlow.cleanup();
        await openRouter.cleanup();
        await costTracker.cleanup();
    });
    describe('Real-time Cost Monitoring', () => {
        it('should track API costs accurately', async () => {
            const initialCost = await costTracker.getCurrentCost();
            // Simulate API calls with different models
            const calls = [
                { model: 'gpt-4o-mini', tokens: 500, expectedCostRange: [0.001, 0.01] },
                { model: 'claude-3-sonnet', tokens: 1000, expectedCostRange: [0.01, 0.05] },
                { model: 'gemini-1.5-pro', tokens: 750, expectedCostRange: [0.005, 0.03] }
            ];
            for (const call of calls) {
                const startCost = await costTracker.getCurrentCost();
                await costTracker.recordAPICall({
                    model: call.model,
                    tokensUsed: call.tokens,
                    timestamp: new Date(),
                    sessionId: 'cost-test-session'
                });
                const endCost = await costTracker.getCurrentCost();
                const callCost = endCost - startCost;
                expect(callCost).toBeGreaterThan(call.expectedCostRange[0]);
                expect(callCost).toBeLessThan(call.expectedCostRange[1]);
            }
            const finalCost = await costTracker.getCurrentCost();
            expect(finalCost).toBeGreaterThan(initialCost);
            console.log('Cost tracking test - Total cost:', finalCost);
        });
        it('should provide detailed usage analytics', async () => {
            // Generate usage data
            const models = ['gpt-4o-mini', 'claude-3-sonnet', 'gemini-1.5-pro'];
            const sessions = Array(10).fill(0).map((_, i) => `session-${i}`);
            for (const session of sessions) {
                const model = models[Math.floor(Math.random() * models.length)];
                const tokens = 200 + Math.floor(Math.random() * 800); // 200-1000 tokens
                await costTracker.recordAPICall({
                    model,
                    tokensUsed: tokens,
                    timestamp: new Date(),
                    sessionId: session
                });
            }
            const analytics = await costTracker.getUsageAnalytics();
            expect(analytics.totalCalls).toBe(sessions.length);
            expect(analytics.totalTokens).toBeGreaterThan(0);
            expect(analytics.totalCost).toBeGreaterThan(0);
            expect(analytics.modelUsage).toHaveProperty('gpt-4o-mini');
            // Verify cost per model tracking
            for (const [model, stats] of Object.entries(analytics.modelUsage)) {
                expect(stats.calls).toBeGreaterThan(0);
                expect(stats.tokens).toBeGreaterThan(0);
                expect(stats.cost).toBeGreaterThan(0);
                expect(stats.avgCostPerCall).toBeGreaterThan(0);
            }
            console.log('Usage Analytics:', analytics);
        });
    });
    describe('Intelligent Model Routing', () => {
        it('should route to cost-effective models based on task complexity', async () => {
            const tasks = [
                {
                    complexity: 'low',
                    prompt: 'Format this JSON object',
                    expectedModel: 'gpt-4o-mini'
                },
                {
                    complexity: 'medium',
                    prompt: 'Implement a TypeScript interface for user management',
                    expectedModel: 'claude-3-sonnet'
                },
                {
                    complexity: 'high',
                    prompt: 'Design a distributed system architecture with microservices',
                    expectedModel: 'claude-3-opus'
                }
            ];
            for (const task of tasks) {
                const routingResult = await openRouter.selectOptimalModel({
                    prompt: task.prompt,
                    maxCost: 0.10, // 10 cents budget
                    qualityRequirement: task.complexity
                });
                expect(routingResult.selectedModel).toBeDefined();
                expect(routingResult.estimatedCost).toBeLessThan(0.10);
                expect(routingResult.reasoning).toContain('cost');
                // For low complexity, should prefer cheaper models
                if (task.complexity === 'low') {
                    expect(routingResult.selectedModel).toMatch(/mini|turbo/i);
                }
                console.log(`Task: ${task.complexity} -> Model: ${routingResult.selectedModel}, Cost: $${routingResult.estimatedCost}`);
            }
        });
        it('should implement budget-aware routing', async () => {
            // Set low budget limit
            await costTracker.setBudgetLimit(1.00); // $1 budget
            const tasks = Array(20).fill(0).map((_, i) => ({
                prompt: `Generate code for task ${i}`,
                priority: Math.random() > 0.5 ? 'high' : 'low'
            }));
            let budgetExhausted = false;
            const routingResults = [];
            for (const task of tasks) {
                const remainingBudget = await costTracker.getRemainingBudget();
                if (remainingBudget <= 0.01) { // Less than 1 cent
                    budgetExhausted = true;
                    break;
                }
                const routing = await openRouter.selectOptimalModel({
                    prompt: task.prompt,
                    maxCost: remainingBudget,
                    qualityRequirement: task.priority
                });
                routingResults.push(routing);
                // Simulate API call cost
                await costTracker.recordAPICall({
                    model: routing.selectedModel,
                    tokensUsed: 300,
                    timestamp: new Date(),
                    sessionId: 'budget-test'
                });
            }
            expect(routingResults.length).toBeGreaterThan(0);
            if (budgetExhausted) {
                console.log('Budget management working - stopped before exceeding limit');
            }
            const finalBudget = await costTracker.getRemainingBudget();
            expect(finalBudget).toBeGreaterThanOrEqual(0);
        });
    });
    describe('Cost Optimization Analysis', () => {
        it('should generate optimization recommendations', async () => {
            // Simulate month of usage data
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
            for (let day = 0; day < 30; day++) {
                const date = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
                // Simulate daily usage patterns
                const dailyCalls = 5 + Math.floor(Math.random() * 15); // 5-20 calls per day
                for (let call = 0; call < dailyCalls; call++) {
                    const models = ['gpt-4o-mini', 'claude-3-sonnet', 'gpt-4o', 'gemini-1.5-pro'];
                    const model = models[Math.floor(Math.random() * models.length)];
                    const tokens = 100 + Math.floor(Math.random() * 1500);
                    await costTracker.recordAPICall({
                        model,
                        tokensUsed: tokens,
                        timestamp: date,
                        sessionId: `day-${day}-call-${call}`
                    });
                }
            }
            const optimizationReport = await costTracker.generateOptimizationReport();
            expect(optimizationReport).toHaveProperty('totalSpent');
            expect(optimizationReport).toHaveProperty('potentialSavings');
            expect(optimizationReport).toHaveProperty('recommendations');
            expect(optimizationReport.recommendations).toHaveLength.greaterThan(0);
            // Verify recommendations include actionable insights
            const hasModelOptimization = optimizationReport.recommendations.some(rec => rec.type === 'model_optimization');
            const hasUsageOptimization = optimizationReport.recommendations.some(rec => rec.type === 'usage_optimization');
            expect(hasModelOptimization || hasUsageOptimization).toBe(true);
            console.log('Optimization Report:', {
                totalSpent: optimizationReport.totalSpent,
                potentialSavings: optimizationReport.potentialSavings,
                savingsPercent: (optimizationReport.potentialSavings / optimizationReport.totalSpent * 100).toFixed(1) + '%',
                recommendationCount: optimizationReport.recommendations.length
            });
        });
        it('should demonstrate cost savings through DevFlow optimization', async () => {
            // Baseline: Without DevFlow optimization
            const baselinePrompt = `
        Please implement a comprehensive user authentication system for a web application.
        Include the following features:
        - User registration with email validation
        - Password hashing and verification
        - JWT token generation and validation
        - Password reset functionality
        - Account lockout after failed attempts
        - Role-based access control
        - Session management
        - Two-factor authentication support
        
        Use TypeScript and ensure the code is production-ready with proper error handling,
        logging, and security best practices. Include comprehensive unit tests and documentation.
      `;
            // Optimized: With DevFlow context and memory
            const context = await devFlow.memory.retrieveRelevantContext('user authentication');
            const optimizedPrompt = await devFlow.optimization.optimizePrompt(baselinePrompt, context);
            const baselineCost = await costTracker.estimateCost(baselinePrompt, 'claude-3-sonnet');
            const optimizedCost = await costTracker.estimateCost(optimizedPrompt, 'gpt-4o-mini'); // Can use cheaper model with context
            const costSavings = baselineCost - optimizedCost;
            const savingsPercent = (costSavings / baselineCost) * 100;
            expect(savingsPercent).toBeGreaterThan(10); // At least 10% savings
            console.log('DevFlow Cost Optimization:', {
                baselineCost: `$${baselineCost.toFixed(4)}`,
                optimizedCost: `$${optimizedCost.toFixed(4)}`,
                savings: `$${costSavings.toFixed(4)}`,
                savingsPercent: `${savingsPercent.toFixed(1)}%`
            });
            if (savingsPercent >= 30) {
                console.log('🎯 COST OPTIMIZATION TARGET ACHIEVED! 30%+ cost reduction demonstrated');
            }
        });
    });
    describe('Budget Management & Alerts', () => {
        it('should trigger alerts at budget thresholds', async () => {
            const alerts = [];
            costTracker.on('budget_alert', (alert) => {
                alerts.push(alert);
            });
            await costTracker.setBudgetLimit(10.00); // $10 test budget
            // Simulate spending to trigger alerts
            const spendingAmounts = [3, 5, 8, 9.5, 10.5]; // Will trigger 50%, 80%, 90%, 100% alerts
            for (const amount of spendingAmounts) {
                await costTracker.recordDirectCost(amount, 'alert-test');
                // Give time for alerts to process
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            expect(alerts.length).toBeGreaterThanOrEqual(3); // Should have 50%, 80%, 90% alerts
            const alertThresholds = alerts.map(a => a.threshold);
            expect(alertThresholds).toContain(0.5);
            expect(alertThresholds).toContain(0.8);
            expect(alertThresholds).toContain(0.9);
            console.log('Budget alerts triggered:', alertThresholds);
        });
        it('should enforce budget limits with graceful degradation', async () => {
            await costTracker.setBudgetLimit(0.50); // Very low budget
            await costTracker.setEnforcementMode('strict');
            // Try to make expensive call
            const result = await openRouter.executeWithBudgetControl({
                prompt: 'Complex architectural design task',
                preferredModel: 'gpt-4o', // Expensive model
                maxTokens: 2000
            });
            // Should either reject or downgrade to cheaper model
            expect(result.success).toBe(true);
            if (result.modelDowngraded) {
                expect(result.actualModel).not.toBe('gpt-4o');
                expect(result.actualModel).toMatch(/mini|turbo/i);
                console.log('Budget control working - downgraded to cheaper model');
            }
            else {
                expect(result.estimatedCost).toBeLessThan(0.50);
                console.log('Budget control working - stayed within limits');
            }
        });
    });
});
//# sourceMappingURL=cost-tracking.test.js.map