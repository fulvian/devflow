/**
 * CODEX-4A: Performance Benchmarking Tools
 * Comprehensive performance analysis and reporting utilities
 */
import { DevFlowCore } from '../packages/core/src/index.js';
import type { PerformanceStats, PerformanceTargets, BenchmarkConfig } from '../packages/shared/src/types.js';
export declare class PerformanceBenchmark {
    private devFlow;
    private results;
    constructor(devFlow: DevFlowCore);
    /**
     * Calculate statistical performance metrics
     */
    calculateStats(durations: number[]): PerformanceStats;
    /**
     * Estimate token count for prompts (simplified estimation)
     */
    estimateTokens(text: string): number;
    /**
     * Run comprehensive benchmark suite
     */
    runBenchmarkSuite(config: BenchmarkConfig): Promise<Map<string, PerformanceStats>>;
    /**
     * Benchmark context extraction and injection operations
     */
    private benchmarkContextOperations;
    /**
     * Benchmark memory storage and retrieval operations
     */
    private benchmarkMemoryOperations;
    /**
     * Benchmark complete end-to-end workflows
     */
    private benchmarkEndToEndWorkflow;
    /**
     * Benchmark concurrent operations under load
     */
    private benchmarkConcurrentOperations;
    /**
     * Benchmark token optimization effectiveness
     */
    private benchmarkTokenOptimization;
    /**
     * Generate comprehensive performance report
     */
    generateReport(benchmarkResults: Map<string, PerformanceStats>, targets: PerformanceTargets): string;
    private getPercentile;
    private calculateStandardDeviation;
    private analyzeComplexity;
    private simulateHandoff;
    private getTargetForCategory;
    private countPassedTests;
}
//# sourceMappingURL=performance-benchmark.d.ts.map