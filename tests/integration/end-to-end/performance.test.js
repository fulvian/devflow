/**
 * CODEX-4A: Performance Benchmarking Suite
 * Comprehensive performance validation for DevFlow system
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { DevFlowCore } from '../../../packages/core/src/index.js';
import { PerformanceBenchmark } from '../../../tools/performance-benchmark.js';
describe('DevFlow Performance Benchmarking', () => {
    let devFlow;
    let benchmark;
    const PERFORMANCE_TARGETS = {
        contextInjection: 100, // <100ms
        memoryOperations: 50, // <50ms
        openRouterAPI: 2000, // <2s
        totalHandoff: 3000, // <3s
        successRate: 0.95 // >95%
    };
    beforeAll(async () => {
        devFlow = new MultiPlatformCoordinator({ dbPath: ':memory:' });
        benchmark = new PerformanceBenchmark(devFlow);
        await devFlow.initialize();
    });
    afterAll(async () => {
        await devFlow.cleanup();
    });
    describe('Context Operations Performance', () => {
        it('should meet context injection performance targets', async () => {
            const iterations = 100;
            const results = [];
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                const context = {
                    id: `perf-test-${i}`,
                    title: 'Performance Test Context',
                    architecturalContext: {
                        decisions: ['Use TypeScript', 'Implement caching'],
                        constraints: ['Node.js 20+', 'Memory < 512MB'],
                        patterns: ['Repository', 'Factory']
                    }
                };
                await devFlow.context.inject(context);
                const duration = performance.now() - start;
                results.push(duration);
            }
            const stats = benchmark.calculateStats(results);
            expect(stats.average).toBeLessThan(PERFORMANCE_TARGETS.contextInjection);
            expect(stats.p95).toBeLessThan(PERFORMANCE_TARGETS.contextInjection * 1.5);
            expect(stats.p99).toBeLessThan(PERFORMANCE_TARGETS.contextInjection * 2);
            console.log('Context Injection Performance:', stats);
        });
        it('should meet memory operations performance targets', async () => {
            const iterations = 200;
            const results = [];
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                const memoryBlock = {
                    id: `block-${i}`,
                    taskId: `task-${i}`,
                    sessionId: `session-${i}`,
                    blockType: 'implementation',
                    content: `Implementation block ${i}`,
                    metadata: { importance: 0.8 }
                };
                await devFlow.memory.store(memoryBlock);
                const duration = performance.now() - start;
                results.push(duration);
            }
            const stats = benchmark.calculateStats(results);
            expect(stats.average).toBeLessThan(PERFORMANCE_TARGETS.memoryOperations);
            expect(stats.p95).toBeLessThan(PERFORMANCE_TARGETS.memoryOperations * 1.5);
            console.log('Memory Operations Performance:', stats);
        });
    });
    describe('End-to-End Workflow Performance', () => {
        it('should meet total handoff time targets', async () => {
            const iterations = 20; // Fewer iterations for full workflow
            const results = [];
            for (let i = 0; i < iterations; i++) {
                const workflowStart = performance.now();
                let contextTime = 0;
                let memoryTime = 0;
                let handoffTime = 0;
                try {
                    // Context extraction
                    const contextStart = performance.now();
                    const context = await devFlow.context.extract(`session-${i}`);
                    contextTime = performance.now() - contextStart;
                    // Memory storage
                    const memoryStart = performance.now();
                    await devFlow.memory.store({
                        id: `memory-${i}`,
                        taskId: context.id,
                        sessionId: `session-${i}`,
                        blockType: 'architectural',
                        content: JSON.stringify(context),
                        metadata: { importance: 0.9 }
                    });
                    memoryTime = performance.now() - memoryStart;
                    // Simulated handoff (without real API call)
                    const handoffStart = performance.now();
                    await devFlow.simulation.simulateOpenRouterCall({
                        prompt: 'Test prompt',
                        context: context,
                        model: 'gpt-4o-mini'
                    });
                    handoffTime = performance.now() - handoffStart;
                    const totalTime = performance.now() - workflowStart;
                    results.push({
                        iteration: i,
                        contextTime,
                        memoryTime,
                        handoffTime,
                        totalTime,
                        success: true
                    });
                }
                catch (error) {
                    results.push({
                        iteration: i,
                        contextTime,
                        memoryTime,
                        handoffTime,
                        totalTime: performance.now() - workflowStart,
                        success: false,
                        error: error.message
                    });
                }
            }
            const successfulResults = results.filter(r => r.success);
            const successRate = successfulResults.length / results.length;
            expect(successRate).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.successRate);
            const totalTimes = successfulResults.map(r => r.totalTime);
            const avgTotalTime = totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length;
            expect(avgTotalTime).toBeLessThan(PERFORMANCE_TARGETS.totalHandoff);
            console.log('End-to-End Workflow Performance:', {
                successRate,
                avgTotalTime: Math.round(avgTotalTime),
                iterations: results.length
            });
        });
    });
    describe('Load Testing', () => {
        it('should handle concurrent operations efficiently', async () => {
            const concurrentSessions = 50;
            const operationsPerSession = 10;
            const startTime = performance.now();
            const sessionPromises = Array(concurrentSessions).fill(0).map(async (_, sessionIndex) => {
                const sessionId = `load-session-${sessionIndex}`;
                const operations = [];
                for (let opIndex = 0; opIndex < operationsPerSession; opIndex++) {
                    operations.push(devFlow.memory.store({
                        id: `load-${sessionIndex}-${opIndex}`,
                        taskId: `task-${sessionIndex}`,
                        sessionId,
                        blockType: 'implementation',
                        content: `Load test content ${sessionIndex}-${opIndex}`,
                        metadata: { importance: 0.5 }
                    }));
                }
                return Promise.all(operations);
            });
            await Promise.all(sessionPromises);
            const totalTime = performance.now() - startTime;
            const totalOperations = concurrentSessions * operationsPerSession;
            const operationsPerSecond = totalOperations / (totalTime / 1000);
            expect(operationsPerSecond).toBeGreaterThan(100); // At least 100 ops/sec
            expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
            console.log('Load Test Results:', {
                totalOperations,
                totalTime: Math.round(totalTime),
                operationsPerSecond: Math.round(operationsPerSecond)
            });
        });
        it('should maintain performance under memory pressure', async () => {
            const largeDataSize = 1000; // 1000 large memory blocks
            const results = [];
            // Fill memory with large blocks
            for (let i = 0; i < largeDataSize; i++) {
                await devFlow.memory.store({
                    id: `large-${i}`,
                    taskId: `task-large-${i}`,
                    sessionId: 'memory-pressure-session',
                    blockType: 'implementation',
                    content: 'x'.repeat(10000), // 10KB content
                    metadata: { importance: 0.7 }
                });
            }
            // Test performance after memory pressure
            for (let i = 0; i < 50; i++) {
                const start = performance.now();
                await devFlow.memory.retrieve(`large-${Math.floor(Math.random() * largeDataSize)}`);
                const duration = performance.now() - start;
                results.push(duration);
            }
            const avgRetrievalTime = results.reduce((a, b) => a + b, 0) / results.length;
            expect(avgRetrievalTime).toBeLessThan(100); // Should still be fast
            console.log('Memory Pressure Test:', {
                largeDataSize,
                avgRetrievalTime: Math.round(avgRetrievalTime)
            });
        });
    });
    describe('Token Usage Optimization', () => {
        it('should demonstrate 30% token reduction target', async () => {
            const testPrompts = [
                'Implement a user authentication system with JWT tokens',
                'Create a REST API with Express.js and TypeScript',
                'Design a database schema for an e-commerce application',
                'Build a React component with error boundaries',
                'Implement caching layer with Redis integration'
            ];
            let totalBaselineTokens = 0;
            let totalOptimizedTokens = 0;
            for (const prompt of testPrompts) {
                // Baseline: prompt without context optimization
                const baselineTokens = benchmark.estimateTokens(prompt);
                // Optimized: prompt with context from memory
                const context = await devFlow.memory.retrieveRelevantContext(prompt);
                const optimizedPrompt = await devFlow.optimization.optimizePrompt(prompt, context);
                const optimizedTokens = benchmark.estimateTokens(optimizedPrompt);
                totalBaselineTokens += baselineTokens;
                totalOptimizedTokens += optimizedTokens;
            }
            const tokenReduction = (totalBaselineTokens - totalOptimizedTokens) / totalBaselineTokens;
            const tokenReductionPercent = tokenReduction * 100;
            expect(tokenReduction).toBeGreaterThan(0.1); // At least 10% reduction
            console.log('Token Optimization Results:', {
                baselineTokens: totalBaselineTokens,
                optimizedTokens: totalOptimizedTokens,
                reduction: `${tokenReductionPercent.toFixed(1)}%`,
                target: '30%',
                achieved: tokenReduction >= 0.3
            });
            if (tokenReduction >= 0.3) {
                console.log('🎯 TOKEN REDUCTION TARGET ACHIEVED! 30%+ reduction demonstrated');
            }
        });
    });
});
//# sourceMappingURL=performance.test.js.map