/**
 * DevFlow Memory System Type Definitions
 * Comprehensive types for the 4-layer memory architecture
 */
export type Platform = 'claude_code' | 'openai_codex' | 'gemini_cli' | 'cursor' | 'openrouter';
export type TaskPriority = 'h-' | 'm-' | 'l-' | '?-';
export type TaskStatus = 'planning' | 'active' | 'blocked' | 'completed' | 'archived';
export type BlockType = 'architectural' | 'implementation' | 'debugging' | 'maintenance' | 'context' | 'decision';
export type SessionType = 'development' | 'review' | 'debugging' | 'handoff' | 'planning';
export type EntityType = 'person' | 'technology' | 'pattern' | 'antipattern' | 'rule' | 'preference';
/**
 * Universal Task Context - Central registry for development tasks
 * Integrates with cc-sessions while providing cross-platform coordination
 */
export interface TaskContext {
    readonly id: string;
    title: string;
    description?: string;
    priority: TaskPriority;
    status: TaskStatus;
    complexityScore?: number;
    estimatedDurationMinutes?: number;
    requiredCapabilities?: string[];
    primaryPlatform?: Platform;
    platformRouting?: PlatformRoutingPreferences;
    architecturalContext: Record<string, unknown>;
    implementationContext: Record<string, unknown>;
    debuggingContext: Record<string, unknown>;
    maintenanceContext: Record<string, unknown>;
    ccSessionId?: string;
    ccTaskFile?: string;
    branchName?: string;
    parentTaskId?: string;
    dependsOn?: string[];
    readonly createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}
/**
 * Memory Block - Structured persistent memory with semantic capabilities
 * Core unit of the DevFlow memory system
 */
export interface MemoryBlock {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId: string;
    blockType: BlockType;
    label: string;
    content: string;
    metadata: MemoryBlockMetadata;
    importanceScore: number;
    relationships: string[];
    embedding?: Float32Array;
    embeddingModel?: string;
    readonly createdAt: Date;
    lastAccessed: Date;
    accessCount: number;
}
export interface MemoryBlockMetadata {
    platform: Platform;
    toolsUsed?: string[];
    filePaths?: string[];
    codeLanguage?: string;
    tags?: string[];
    userNotes?: string;
    [key: string]: unknown;
}
/**
 * Coordination Session - Track cross-platform AI interactions
 * Enables handoff tracking and performance optimization
 */
export interface CoordinationSession {
    readonly id: string;
    readonly taskId: string;
    platform: Platform;
    sessionType: SessionType;
    readonly startTime: Date;
    endTime?: Date;
    readonly durationSeconds?: number;
    tokensUsed: number;
    apiCalls: number;
    estimatedCostUsd: number;
    modelUsed?: string;
    contextSizeStart?: number;
    contextSizeEnd?: number;
    compactionEvents: number;
    handoffFromSession?: string;
    handoffToSession?: string;
    handoffContext?: HandoffContext;
    handoffSuccess?: boolean;
    userSatisfaction?: number;
    taskProgressDelta: number;
    errorsEncountered: number;
    metadata: Record<string, unknown>;
}
export interface HandoffContext {
    preservedDecisions: string[];
    contextSummary: string;
    nextSteps: string[];
    constraints: string[];
    platformSpecificData: Record<Platform, unknown>;
}
/**
 * Platform Routing Preferences - AI-driven platform selection
 */
export interface PlatformRoutingPreferences {
    [platform: string]: {
        score: number;
        reasons: string[];
        constraints?: string[];
        lastUsed?: Date;
    };
}
/**
 * Task Analysis - AI-powered task understanding
 */
export interface TaskAnalysis {
    taskType: 'architecture' | 'implementation' | 'debugging' | 'maintenance';
    complexityScore: number;
    requiredCapabilities: CapabilityDomain[];
    estimatedDuration: number;
    riskFactors: RiskFactor[];
    decomposition?: TaskDecomposition;
    qualityGates: string[];
}
export type CapabilityDomain = 'architectural_design' | 'complex_reasoning' | 'system_analysis' | 'rapid_implementation' | 'pattern_following' | 'bulk_coding' | 'debugging_workflows' | 'error_analysis' | 'systematic_testing' | 'codebase_navigation' | 'documentation_maintenance' | 'refactoring_tools';
export interface RiskFactor {
    type: 'complexity' | 'dependency' | 'integration' | 'performance' | 'compatibility';
    description: string;
    severity: 'low' | 'medium' | 'high';
    mitigation?: string;
}
export interface TaskDecomposition {
    subtasks: Array<{
        title: string;
        platform: Platform;
        estimatedDuration: number;
        dependencies: string[];
    }>;
    executionOrder: 'sequential' | 'parallel' | 'flexible';
}
/**
 * Memory Manager - Core interface for the 4-layer memory system
 */
export interface MemoryManager {
    storeMemoryBlock(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): Promise<string>;
    retrieveMemoryBlocks(query: MemoryQuery): Promise<MemoryBlock[]>;
    updateMemoryBlock(id: string, updates: Partial<MemoryBlock>): Promise<void>;
    deleteMemoryBlock(id: string): Promise<void>;
    createTaskContext(context: Omit<TaskContext, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
    getTaskContext(id: string): Promise<TaskContext | null>;
    updateTaskContext(id: string, updates: Partial<TaskContext>): Promise<void>;
    searchTaskContexts(query: string): Promise<TaskContext[]>;
    startSession(session: Omit<CoordinationSession, 'id' | 'startTime' | 'durationSeconds'>): Promise<string>;
    endSession(sessionId: string, metrics: SessionEndMetrics): Promise<void>;
    getActiveSession(taskId: string): Promise<CoordinationSession | null>;
    compactContext(taskId: string, strategy: CompactionStrategy): Promise<CompactionResult>;
    extractContext(sessionId: string): Promise<ExtractedContext>;
    semanticSearch(query: string, options?: SemanticSearchOptions): Promise<SemanticSearchResult[]>;
}
export interface MemoryQuery {
    taskId?: string;
    blockTypes?: BlockType[];
    platforms?: Platform[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    importanceThreshold?: number;
    limit?: number;
    semanticQuery?: string;
}
export interface SessionEndMetrics {
    tokensUsed: number;
    apiCalls: number;
    estimatedCostUsd: number;
    contextSizeEnd?: number;
    compactionEvents?: number;
    userSatisfaction?: number;
    taskProgressDelta?: number;
    errorsEncountered?: number;
    metadata?: Record<string, unknown>;
}
export type CompactionStrategy = 'importance_based' | 'recency_based' | 'platform_optimized' | 'ml_powered' | 'hybrid';
export interface CompactionResult {
    originalSize: number;
    compactedSize: number;
    compressionRatio: number;
    preservedBlocks: string[];
    removedBlocks: string[];
    strategy: CompactionStrategy;
    qualityScore: number;
}
export interface ExtractedContext {
    sessionId: string;
    platform: Platform;
    extractedBlocks: MemoryBlock[];
    contextSummary: string;
    keyDecisions: string[];
    nextSteps: string[];
}
export interface SemanticSearchOptions {
    threshold?: number;
    maxResults?: number;
    platforms?: Platform[];
    blockTypes?: BlockType[];
    taskIds?: string[];
}
export interface SemanticSearchResult {
    block: MemoryBlock;
    similarity: number;
    relevanceScore: number;
    context: string;
}
/**
 * Knowledge Entity - Long-term learning from development patterns
 */
export interface KnowledgeEntity {
    readonly id: string;
    entityType: EntityType;
    name: string;
    description?: string;
    confidenceScore: number;
    extractionSource: ExtractionSource;
    learnedFromTaskId?: string;
    readonly firstSeen: Date;
    lastConfirmed: Date;
    usageCount: number;
    validationStatus: 'pending' | 'confirmed' | 'rejected';
    embedding?: Float32Array;
    tags: string[];
}
export interface ExtractionSource {
    sessionId: string;
    platform: Platform;
    extractionMethod: 'manual' | 'pattern_recognition' | 'ml_inference';
    confidence: number;
    sourceContext: string;
}
export interface EntityRelationship {
    readonly id: string;
    sourceEntityId: string;
    targetEntityId: string;
    relationshipType: string;
    relationshipStrength: number;
    contextDescription?: string;
    readonly discoveredAt: Date;
    confirmedCount: number;
    lastConfirmed: Date;
}
export interface PlatformPerformance {
    platform: Platform;
    capabilityDomain: CapabilityDomain;
    taskType: string;
    successRate: number;
    averageDurationSeconds?: number;
    averageTokenUsage?: number;
    averageCostUsd?: number;
    userSatisfactionAvg?: number;
    totalTasks: number;
    measurementPeriodStart: Date;
    measurementPeriodEnd?: Date;
    confidenceScore: number;
    readonly lastUpdated: Date;
}
export interface CostAnalytics {
    readonly id: string;
    date: string;
    platform: Platform;
    model: string;
    totalRequests: number;
    totalTokens: number;
    totalCostUsd: number;
    inputTokens: number;
    outputTokens: number;
    averageTokensPerRequest?: number;
    costPerToken?: number;
    tasksCompleted: number;
    costPerTask?: number;
    readonly createdAt: Date;
}
export declare class MemoryError extends Error {
    readonly code: string;
    readonly context?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, context?: Record<string, unknown> | undefined);
}
export interface ValidationResult {
    isValid: boolean;
    errors: Array<{
        field: string;
        message: string;
        code: string;
    }>;
    warnings: Array<{
        field: string;
        message: string;
        code: string;
    }>;
}
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type DatabaseEntity<T> = T & {
    readonly createdAt: Date;
    updatedAt: Date;
};
//# sourceMappingURL=memory.d.ts.map