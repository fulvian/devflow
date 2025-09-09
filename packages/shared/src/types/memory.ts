/**
 * DevFlow Memory System Type Definitions
 * Comprehensive types for the 4-layer memory architecture
 */

// ============================================================================
// CORE MEMORY INTERFACES
// ============================================================================

export type Platform = 'claude_code' | 'openai_codex' | 'gemini_cli' | 'cursor' | 'openrouter';
export type TaskPriority = 'h-' | 'm-' | 'l-' | '?-';
export type TaskStatus = 'planning' | 'active' | 'blocked' | 'completed' | 'archived';
export type BlockType = 'architectural' | 'implementation' | 'debugging' | 'maintenance' | 'context' | 'decision' | 'emergency_context' | 'context_snapshot';
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
  
  // AI-powered analysis
  complexityScore?: number; // 0.0-1.0
  estimatedDurationMinutes?: number;
  requiredCapabilities?: string[]; // Array of capability domains
  
  // Platform routing intelligence
  primaryPlatform?: Platform;
  platformRouting?: PlatformRoutingPreferences;
  
  // Specialized memory contexts (optimized per platform)
  architecturalContext: Record<string, unknown>; // For Claude Code
  implementationContext: Record<string, unknown>; // For OpenAI Codex  
  debuggingContext: Record<string, unknown>; // For Gemini CLI
  maintenanceContext: Record<string, unknown>; // For Cursor
  
  // cc-sessions integration
  ccSessionId?: string;
  ccTaskFile?: string; // Path to sessions/tasks/ file
  branchName?: string;
  
  // Relationships
  parentTaskId?: string;
  dependsOn?: string[]; // Array of task IDs
  
  // Lifecycle
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
  
  // Content and classification
  blockType: BlockType;
  label: string; // Human-readable identifier
  content: string;
  
  // Metadata and relationships
  metadata: MemoryBlockMetadata;
  importanceScore: number; // 0.0-1.0
  relationships: string[]; // Related block IDs
  
  // Semantic search capability
  embedding?: Float32Array;
  embeddingModel?: string;
  
  // Lifecycle tracking
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
  
  // Lifecycle
  readonly startTime: Date;
  endTime?: Date;
  readonly durationSeconds?: number; // Computed field
  
  // Resource tracking
  tokensUsed: number;
  apiCalls: number;
  estimatedCostUsd: number;
  modelUsed?: string;
  
  // Context management
  contextSizeStart?: number;
  contextSizeEnd?: number;
  compactionEvents: number;
  
  // Cross-platform handoff tracking
  handoffFromSession?: string;
  handoffToSession?: string;
  handoffContext?: HandoffContext;
  handoffSuccess?: boolean;
  
  // Performance metrics
  userSatisfaction?: number; // 1-5 scale
  taskProgressDelta: number; // -1.0 to 1.0
  errorsEncountered: number;
  
  // Session metadata
  metadata: Record<string, unknown>;
}

export interface HandoffContext {
  preservedDecisions: string[];
  contextSummary: string;
  nextSteps: string[];
  constraints: string[];
  platformSpecificData: Record<Platform, unknown>;
}

// ============================================================================
// PLATFORM COORDINATION TYPES
// ============================================================================

/**
 * Platform Routing Preferences - AI-driven platform selection
 */
export interface PlatformRoutingPreferences {
  [platform: string]: {
    score: number; // 0.0-1.0 routing confidence
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
  complexityScore: number; // 0.0-1.0
  requiredCapabilities: CapabilityDomain[];
  estimatedDuration: number; // minutes
  riskFactors: RiskFactor[];
  decomposition?: TaskDecomposition;
  qualityGates: string[];
}

export type CapabilityDomain = 
  | 'architectural_design'
  | 'complex_reasoning' 
  | 'system_analysis'
  | 'rapid_implementation'
  | 'pattern_following'
  | 'bulk_coding'
  | 'debugging_workflows'
  | 'error_analysis'
  | 'systematic_testing'
  | 'codebase_navigation'
  | 'documentation_maintenance'
  | 'refactoring_tools';

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

// ============================================================================
// MEMORY MANAGEMENT INTERFACES
// ============================================================================

/**
 * Memory Manager - Core interface for the 4-layer memory system
 */
export interface MemoryManager {
  // Memory block operations
  storeMemoryBlock(block: Omit<MemoryBlock, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): Promise<string>;
  retrieveMemoryBlocks(query: MemoryQuery): Promise<MemoryBlock[]>;
  updateMemoryBlock(id: string, updates: Partial<MemoryBlock>): Promise<void>;
  deleteMemoryBlock(id: string): Promise<void>;
  
  // Task context operations
  createTaskContext(context: Omit<TaskContext, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  getTaskContext(id: string): Promise<TaskContext | null>;
  updateTaskContext(id: string, updates: Partial<TaskContext>): Promise<void>;
  searchTaskContexts(query: string): Promise<TaskContext[]>;
  
  // Session tracking
  startSession(session: Omit<CoordinationSession, 'id' | 'startTime' | 'durationSeconds'>): Promise<string>;
  endSession(sessionId: string, metrics: SessionEndMetrics): Promise<void>;
  getActiveSession(taskId: string): Promise<CoordinationSession | null>;
  
  // Context management
  compactContext(taskId: string, strategy: CompactionStrategy): Promise<CompactionResult>;
  extractContext(sessionId: string): Promise<ExtractedContext>;
  
  // Semantic search
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

// ============================================================================
// CONTEXT MANAGEMENT TYPES
// ============================================================================

export type CompactionStrategy = 
  | 'importance_based'
  | 'recency_based' 
  | 'platform_optimized'
  | 'ml_powered'
  | 'hybrid';

export interface CompactionResult {
  originalSize: number;
  compactedSize: number;
  compressionRatio: number;
  preservedBlocks: string[]; // Block IDs that were kept
  removedBlocks: string[]; // Block IDs that were removed/compressed
  strategy: CompactionStrategy;
  qualityScore: number; // 0.0-1.0 estimated quality retention
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
  threshold?: number; // 0.0-1.0 similarity threshold
  maxResults?: number;
  platforms?: Platform[];
  blockTypes?: BlockType[];
  taskIds?: string[];
  // Hybrid search options
  mode?: 'keyword-only' | 'vector-only' | 'hybrid';
  weights?: { keyword: number; semantic: number };
  fusionMethod?: 'weighted' | 'harmonic' | 'geometric';
}

export interface SemanticSearchResult {
  block: MemoryBlock;
  similarity: number;
  relevanceScore: number;
  context: string; // Surrounding context for the match
}

// Alias for hybrid search compatibility
export type HybridSearchOptions = SemanticSearchOptions;
export interface HybridSearchResult extends SemanticSearchResult {
  scores: {
    keyword: number;
    semantic: number;
    hybrid: number;
    importance: number;
  };
  matchType: 'keyword' | 'semantic' | 'both';
  keywordMatches: string[];
  semanticContext: string;
  explanation: string;
}

// ============================================================================
// KNOWLEDGE ENTITIES AND LEARNING
// ============================================================================

/**
 * Knowledge Entity - Long-term learning from development patterns
 */
export interface KnowledgeEntity {
  readonly id: string;
  entityType: EntityType;
  name: string;
  description?: string;
  confidenceScore: number; // 0.0-1.0
  
  // Source attribution
  extractionSource: ExtractionSource;
  learnedFromTaskId?: string;
  
  // Lifecycle and validation
  readonly firstSeen: Date;
  lastConfirmed: Date;
  usageCount: number;
  validationStatus: 'pending' | 'confirmed' | 'rejected';
  
  // Search optimization
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
  relationshipType: string; // 'depends_on', 'conflicts_with', 'enhances', etc.
  relationshipStrength: number; // 0.0-1.0
  contextDescription?: string;
  
  // Lifecycle tracking
  readonly discoveredAt: Date;
  confirmedCount: number;
  lastConfirmed: Date;
}

// ============================================================================
// PERFORMANCE AND ANALYTICS TYPES
// ============================================================================

export interface PlatformPerformance {
  platform: Platform;
  capabilityDomain: CapabilityDomain;
  taskType: string;
  
  // Performance metrics
  successRate: number; // 0.0-1.0
  averageDurationSeconds?: number;
  averageTokenUsage?: number;
  averageCostUsd?: number;
  userSatisfactionAvg?: number; // 1.0-5.0
  
  // Statistical confidence
  totalTasks: number;
  measurementPeriodStart: Date;
  measurementPeriodEnd?: Date;
  confidenceScore: number; // 0.0-1.0
  
  readonly lastUpdated: Date;
}

export interface CostAnalytics {
  readonly id: string;
  date: string; // YYYY-MM-DD
  platform: Platform;
  model: string;
  
  // Daily aggregated costs
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  
  // Token breakdown
  inputTokens: number;
  outputTokens: number;
  
  // Efficiency metrics
  averageTokensPerRequest?: number;
  costPerToken?: number;
  tasksCompleted: number;
  costPerTask?: number;
  
  readonly createdAt: Date;
}

// ============================================================================
// ERROR AND VALIDATION TYPES
// ============================================================================

export class MemoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MemoryError';
  }
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

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Helper type for database operations
export type DatabaseEntity<T> = T & {
  readonly createdAt: Date;
  updatedAt: Date;
};