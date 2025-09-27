/**
 * DevFlow Platform Coordination Type Definitions
 * Types for cross-platform AI coordination and task routing
 */

import type { 
  Platform, 
  TaskContext, 
  MemoryBlock, 
  CoordinationSession,
  TaskAnalysis,
  CapabilityDomain,
  HandoffContext
} from './memory.js';

// ============================================================================
// PLATFORM ADAPTER INTERFACES
// ============================================================================

/**
 * Universal Platform Adapter - Base interface for all AI platform integrations
 */
export interface PlatformAdapter {
  readonly platform: Platform;
  readonly capabilities: PlatformCapabilities;
  
  // Lifecycle management
  initialize(config: AdapterConfig): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  
  // Session management
  createSession(task: UniversalTask): Promise<SessionInfo>;
  resumeSession(sessionId: string): Promise<SessionInfo>;
  endSession(sessionId: string, reason?: string): Promise<void>;
  
  // Context management
  injectContext(context: TaskContext): Promise<ContextInjectionResult>;
  extractContext(): Promise<ExtractedContext>;
  compactContext(strategy: CompactionStrategy): Promise<CompactedContext>;
  
  // Task execution
  executeTask(execution: TaskExecution): Promise<TaskResult>;
  pauseTask(taskId: string): Promise<void>;
  resumeTask(taskId: string): Promise<void>;
  
  // Memory synchronization
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
  contextWindow: number; // Maximum context size in tokens
  reasoningDepth: 'low' | 'moderate' | 'good' | 'high' | 'excellent';
  codeQuality: 'basic' | 'good' | 'excellent';
  speed: 'slow' | 'moderate' | 'high' | 'very_high';
  costPerToken: number; // USD per token
}

export interface PlatformConstraints {
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  concurrency: number; // Max parallel sessions
  sessionTimeout: number; // Seconds
}

export interface IntegrationProfile {
  nativeFeatures: string[]; // Built-in capabilities
  setupComplexity: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  maintenanceEffort: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
}

// ============================================================================
// TASK ROUTING AND ANALYSIS
// ============================================================================

export type TaskType = 
  | 'system_design'
  | 'architecture_review'
  | 'complex_debugging'
  | 'refactoring_planning'
  | 'technical_documentation'
  | 'implementation'
  | 'refactoring'
  | 'test_writing'
  | 'api_integration'
  | 'utility_functions'
  | 'debugging'
  | 'testing'
  | 'performance_analysis'
  | 'error_investigation'
  | 'quality_assurance'
  | 'maintenance'
  | 'documentation'
  | 'project_overview'
  | 'codebase_analysis'
  | 'team_coordination';

/**
 * Task Router - Intelligent platform selection system
 */
export interface TaskRouter {
  analyzeTask(task: TaskDescription): Promise<TaskAnalysis>;
  routeTask(analysis: TaskAnalysis): Promise<TaskRoutingPlan>;
  calculateOptimalRouting(
    analysis: TaskAnalysis,
    metrics: PlatformMetrics
  ): Promise<PlatformRouting>;
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
  confidence: number; // 0.0-1.0
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
  dependencies: string[]; // Phase IDs this depends on
  estimatedDuration: number;
  estimatedCost: number;
}

export interface PlatformRouting {
  [platform: string]: RoutingScore;
}

export interface RoutingScore {
  compatibility: number; // 0.0-1.0
  performance: number; // 0.0-1.0
  costEfficiency: number; // 0.0-1.0
  availability: number; // 0.0-1.0
  overall: number; // Weighted combination
}

// ============================================================================
// TASK EXECUTION INTERFACES
// ============================================================================

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
  duration: number; // seconds
  tokensUsed: number;
  apiCalls: number;
  cost: number;
  qualityScore: number; // 0.0-1.0
  userSatisfaction?: number; // 1-5
}

export interface ExtractedMemory {
  keyDecisions: string[];
  patterns: string[];
  lessons: string[];
  context: string;
}

// ============================================================================
// SESSION AND CONTEXT MANAGEMENT
// ============================================================================

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
  size: number; // Current context size in tokens
  utilization: number; // 0.0-1.0 of max context window
  importantBlocks: string[]; // Memory block IDs
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

export type CompactionStrategy = 
  | 'remove_redundant'
  | 'summarize_old'
  | 'preserve_recent'
  | 'importance_based'
  | 'platform_optimized';

// ============================================================================
// COORDINATION ENGINE INTERFACES
// ============================================================================

/**
 * Coordination Engine - Orchestrates multi-platform task execution
 */
export interface CoordinationEngine {
  orchestrateTask(task: UniversalTask): Promise<OrchestrationResult>;
  createExecutionPlan(task: UniversalTask, routing: TaskRoutingPlan): Promise<ExecutionPlan>;
  executeCoordinatedPlan(plan: ExecutionPlan): Promise<PhaseResult[]>;
  handlePlatformHandoff(
    fromSession: CoordinationSession,
    toSession: CoordinationSession,
    context: HandoffContext
  ): Promise<HandoffResult>;
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
  overallQuality: number; // 0.0-1.0
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
  contextPreserved: number; // 0.0-1.0 percentage
  warnings: string[];
  errors: string[];
  handoffData: HandoffContext;
}

// ============================================================================
// CONFIGURATION AND ADAPTER INTERFACES
// ============================================================================

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
  latency: number; // milliseconds
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

// ============================================================================
// PERFORMANCE MONITORING TYPES
// ============================================================================

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
  recordExecution(
    platform: Platform,
    taskType: TaskType,
    metrics: ExecutionMetrics
  ): Promise<void>;
  
  getMetrics(
    platform?: Platform,
    timeRange?: { start: Date; end: Date }
  ): Promise<PlatformMetrics>;
  
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

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class PlatformError extends Error {
  constructor(
    message: string,
    public readonly platform: Platform,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

export class CoordinationError extends Error {
  constructor(
    message: string,
    public readonly phase: string,
    public readonly platforms: Platform[],
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CoordinationError';
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}