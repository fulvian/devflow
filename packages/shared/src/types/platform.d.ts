/**
 * DevFlow Platform Coordination Type Definitions
 * Types for cross-platform AI coordination and task routing
 */
import type { Platform, TaskContext, MemoryBlock, CoordinationSession, TaskAnalysis, CapabilityDomain, HandoffContext } from './memory.js';
/**
 * Universal Platform Adapter - Base interface for all AI platform integrations
 */
export interface PlatformAdapter {
    readonly platform: Platform;
    readonly capabilities: PlatformCapabilities;
    initialize(config: AdapterConfig): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<HealthStatus>;
    createSession(task: UniversalTask): Promise<SessionInfo>;
    resumeSession(sessionId: string): Promise<SessionInfo>;
    endSession(sessionId: string, reason?: string): Promise<void>;
    injectContext(context: TaskContext): Promise<ContextInjectionResult>;
    extractContext(): Promise<ExtractedContext>;
    compactContext(strategy: CompactionStrategy): Promise<CompactedContext>;
    executeTask(execution: TaskExecution): Promise<TaskResult>;
    pauseTask(taskId: string): Promise<void>;
    resumeTask(taskId: string): Promise<void>;
    syncMemory(memory: TaskMemory): Promise<SyncResult>;
    getMemorySnapshot(): Promise<MemorySnapshot>;
}
/**
 * Platform Capabilities - Define what each platform excels at
 */
export interface PlatformCapabilities {
    platform: Platform;
    strengths: CapabilityDomain[];
    optimalTaskTypes: TaskType[];
    performance: PerformanceProfile;
    constraints: PlatformConstraints;
    integration: IntegrationProfile;
}
export interface PerformanceProfile {
    contextWindow: number;
    reasoningDepth: 'low' | 'moderate' | 'good' | 'high' | 'excellent';
    codeQuality: 'basic' | 'good' | 'excellent';
    speed: 'slow' | 'moderate' | 'high' | 'very_high';
    costPerToken: number;
}
export interface PlatformConstraints {
    rateLimits: {
        requestsPerMinute: number;
        tokensPerMinute: number;
    };
    concurrency: number;
    sessionTimeout: number;
}
export interface IntegrationProfile {
    nativeFeatures: string[];
    setupComplexity: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
    maintenanceEffort: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
}
export type TaskType = 'system_design' | 'architecture_review' | 'complex_debugging' | 'refactoring_planning' | 'technical_documentation' | 'implementation' | 'refactoring' | 'test_writing' | 'api_integration' | 'utility_functions' | 'debugging' | 'testing' | 'performance_analysis' | 'error_investigation' | 'quality_assurance' | 'maintenance' | 'documentation' | 'project_overview' | 'codebase_analysis' | 'team_coordination';
/**
 * Task Router - Intelligent platform selection system
 */
export interface TaskRouter {
    analyzeTask(task: TaskDescription): Promise<TaskAnalysis>;
    routeTask(analysis: TaskAnalysis): Promise<TaskRoutingPlan>;
    calculateOptimalRouting(analysis: TaskAnalysis, metrics: PlatformMetrics): Promise<PlatformRouting>;
    validateRouting(routing: PlatformRouting): Promise<ValidationResult>;
}
export interface TaskDescription {
    title: string;
    description: string;
    context?: string;
    priority: 'h-' | 'm-' | 'l-' | '?-';
    estimatedComplexity?: number;
    requiredCapabilities?: CapabilityDomain[];
    constraints?: string[];
}
export interface TaskRoutingPlan {
    primaryPlatform: Platform;
    confidence: number;
    reasoning: string[];
    alternatives: Array<{
        platform: Platform;
        score: number;
        pros: string[];
        cons: string[];
    }>;
    executionPlan: ExecutionPhase[];
    estimatedCost: number;
    estimatedDuration: number;
}
export interface ExecutionPhase {
    id: string;
    platform: Platform;
    phaseType: 'analysis' | 'planning' | 'implementation' | 'review' | 'testing';
    description: string;
    execution: TaskExecution;
    dependencies: string[];
    estimatedDuration: number;
    estimatedCost: number;
}
export interface PlatformRouting {
    [platform: string]: RoutingScore;
}
export interface RoutingScore {
    compatibility: number;
    performance: number;
    costEfficiency: number;
    availability: number;
    overall: number;
}
export interface UniversalTask {
    id: string;
    title: string;
    description: string;
    priority: 'h-' | 'm-' | 'l-' | '?-';
    context: TaskContext;
    memory: TaskMemory;
    requirements: TaskRequirements;
}
export interface TaskMemory {
    architectural: Record<string, unknown>;
    implementation: Record<string, unknown>;
    debugging: Record<string, unknown>;
    maintenance: Record<string, unknown>;
    blocks: MemoryBlock[];
}
export interface TaskRequirements {
    capabilities: CapabilityDomain[];
    constraints: string[];
    qualityGates: string[];
    timeLimit?: number;
    budgetLimit?: number;
}
export interface TaskExecution {
    taskId: string;
    executionId: string;
    platform: Platform;
    phaseType: ExecutionPhase['phaseType'];
    instructions: string;
    context: TaskContext;
    expectations: ExecutionExpectations;
}
export interface ExecutionExpectations {
    deliverables: string[];
    successCriteria: string[];
    qualityStandards: string[];
    timeEstimate: number;
    budgetEstimate: number;
}
export interface TaskResult {
    taskId: string;
    executionId: string;
    platform: Platform;
    status: 'completed' | 'failed' | 'partial' | 'needs_review';
    outputs: TaskOutput[];
    metrics: ExecutionMetrics;
    nextRecommendations: string[];
    memory: ExtractedMemory;
}
export interface TaskOutput {
    type: 'code' | 'documentation' | 'analysis' | 'decision' | 'artifact';
    content: string;
    metadata: {
        filePath?: string;
        language?: string;
        confidence: number;
        reviewRequired?: boolean;
    };
}
export interface ExecutionMetrics {
    duration: number;
    tokensUsed: number;
    apiCalls: number;
    cost: number;
    qualityScore: number;
    userSatisfaction?: number;
}
export interface ExtractedMemory {
    keyDecisions: string[];
    patterns: string[];
    lessons: string[];
    context: string;
}
export interface SessionInfo {
    id: string;
    taskId: string;
    platform: Platform;
    status: 'active' | 'paused' | 'completed' | 'failed';
    startTime: Date;
    context: CurrentContext;
    branch?: string;
    metadata: Record<string, unknown>;
}
export interface CurrentContext {
    size: number;
    utilization: number;
    importantBlocks: string[];
    recentActivity: ContextActivity[];
}
export interface ContextActivity {
    timestamp: Date;
    action: 'added' | 'modified' | 'removed' | 'accessed';
    blockId?: string;
    description: string;
}
export interface ContextInjectionResult {
    success: boolean;
    injectedBlocks: string[];
    contextSizeAfter: number;
    warnings: string[];
    errors: string[];
}
export interface ExtractedContext {
    sessionId: string;
    platform: Platform;
    blocks: MemoryBlock[];
    summary: string;
    keyPoints: string[];
    nextSteps: string[];
}
export interface CompactedContext {
    originalSize: number;
    compactedSize: number;
    compressionRatio: number;
    strategy: CompactionStrategy;
    preservedElements: string[];
    summary: string;
}
export type CompactionStrategy = 'remove_redundant' | 'summarize_old' | 'preserve_recent' | 'importance_based' | 'platform_optimized';
/**
 * Coordination Engine - Orchestrates multi-platform task execution
 */
export interface CoordinationEngine {
    orchestrateTask(task: UniversalTask): Promise<OrchestrationResult>;
    createExecutionPlan(task: UniversalTask, routing: TaskRoutingPlan): Promise<ExecutionPlan>;
    executeCoordinatedPlan(plan: ExecutionPlan): Promise<PhaseResult[]>;
    handlePlatformHandoff(fromSession: CoordinationSession, toSession: CoordinationSession, context: HandoffContext): Promise<HandoffResult>;
}
export interface ExecutionPlan {
    id: string;
    taskId: string;
    phases: ExecutionPhase[];
    dependencies: PhaseDependency[];
    parallelizable: boolean;
    estimatedTotalDuration: number;
    estimatedTotalCost: number;
}
export interface PhaseDependency {
    phaseId: string;
    dependsOn: string[];
    type: 'blocking' | 'informational';
}
export interface PhaseResult {
    phase: ExecutionPhase;
    result: TaskResult;
    duration: number;
    success: boolean;
    handoffData?: HandoffContext;
}
export interface OrchestrationResult {
    taskId: string;
    status: 'completed' | 'failed' | 'partial';
    phases: PhaseResult[];
    totalDuration: number;
    totalCost: number;
    overallQuality: number;
    memory: CombinedMemory;
}
export interface CombinedMemory {
    architecturalDecisions: string[];
    implementationPatterns: string[];
    debuggingInsights: string[];
    maintenanceNotes: string[];
    crossPlatformLearnings: string[];
}
export interface HandoffResult {
    success: boolean;
    contextPreserved: number;
    warnings: string[];
    errors: string[];
    handoffData: HandoffContext;
}
export interface AdapterConfig {
    platform: Platform;
    apiKey?: string;
    baseUrl?: string;
    timeout: number;
    retries: number;
    rateLimiting: boolean;
    customSettings: Record<string, unknown>;
}
export interface HealthStatus {
    platform: Platform;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    lastCheck: Date;
    issues: string[];
    capabilities: string[];
}
export interface SyncResult {
    success: boolean;
    syncedBlocks: number;
    conflicts: Array<{
        blockId: string;
        description: string;
        resolution: 'local' | 'remote' | 'manual';
    }>;
    warnings: string[];
}
export interface MemorySnapshot {
    timestamp: Date;
    platform: Platform;
    taskId: string;
    blocks: MemoryBlock[];
    context: string;
    metadata: Record<string, unknown>;
}
export interface PlatformMetrics {
    [platform: string]: {
        averageResponseTime: number;
        successRate: number;
        costPerToken: number;
        userSatisfaction: number;
        availability: number;
        lastUpdated: Date;
    };
}
export interface PerformanceTracker {
    recordExecution(platform: Platform, taskType: TaskType, metrics: ExecutionMetrics): Promise<void>;
    getMetrics(platform?: Platform, timeRange?: {
        start: Date;
        end: Date;
    }): Promise<PlatformMetrics>;
    generateRecommendations(): Promise<PlatformRecommendations>;
}
export interface PlatformRecommendations {
    recommendations: Array<{
        platform: Platform;
        overallScore: number;
        strengths: string[];
        improvements: string[];
        optimalUseCases: TaskType[];
    }>;
    generatedAt: Date;
}
export declare class PlatformError extends Error {
    readonly platform: Platform;
    readonly code: string;
    readonly context?: Record<string, unknown> | undefined;
    constructor(message: string, platform: Platform, code: string, context?: Record<string, unknown> | undefined);
}
export declare class CoordinationError extends Error {
    readonly phase: string;
    readonly platforms: Platform[];
    readonly context?: Record<string, unknown> | undefined;
    constructor(message: string, phase: string, platforms: Platform[], context?: Record<string, unknown> | undefined);
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
//# sourceMappingURL=platform.d.ts.map