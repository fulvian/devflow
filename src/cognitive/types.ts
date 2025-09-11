/**
 * Core types for the DevFlow Cognitive Memory System
 */

// Memory Storage Levels
export type MemoryLevel = 'hot' | 'warm' | 'cold';

// Exploration Strategies
export type ExplorationStrategy = 'dependency-driven' | 'pattern-based' | 'context-aware';

// Context Types
export type ContextType = 'semantic' | 'procedural' | 'episodic' | 'environmental';

// Abstraction Levels
export type AbstractionLevel = 'file-module' | 'function-class' | 'pattern-architecture' | 'domain-business';

// Weighted Exploration Score Components
export interface WeightedExplorationScore {
  frequency: number;
  recency: number;
  contextualRelevance: number;
  complexity: number;
  totalScore: number;
}

// Memory Element Base
export interface MemoryElement {
  id: string;
  type: string;
  content: any;
  metadata: {
    created: Date;
    accessed: Date;
    frequency: number;
    importance: number;
    tags: string[];
  };
  level: MemoryLevel;
  score: WeightedExplorationScore;
}

// Code Element representation
export interface CodeElement extends MemoryElement {
  type: 'code-element';
  content: {
    filePath: string;
    startLine: number;
    endLine: number;
    elementType: 'function' | 'class' | 'interface' | 'module' | 'variable';
    name: string;
    signature?: string;
    dependencies: string[];
    dependents: string[];
  };
}

// Association Link
export interface AssociationLink {
  from: string;
  to: string;
  type: 'semantic' | 'structural' | 'temporal' | 'causal';
  strength: number;
  context?: string;
}

// Context State
export interface ContextState {
  currentFocus: string | null;
  workingSet: Set<string>;
  historicalContext: string[];
  taskContext: {
    objective: string;
    constraints: string[];
    preferences: Record<string, any>;
  };
}

// Session State
export interface SessionState {
  sessionId: string;
  startTime: Date;
  lastActivity: Date;
  context: ContextState;
  explorationHistory: string[];
  knowledgeGraph: Map<string, AssociationLink[]>;
  memoryElements: Map<string, MemoryElement>;
}

// Performance Metrics
export interface PerformanceMetrics {
  memoryAccessLatency: number;
  sessionRestoreTime: number;
  contextSwitchOverhead: number;
  explorationAccuracy: number;
  userSatisfactionScore: number;
}

// Configuration
export interface CognitiveConfig {
  weights: {
    alpha: number; // frequency weight
    beta: number;  // recency weight
    gamma: number; // contextual relevance weight
    delta: number; // complexity weight (inverse)
  };
  thresholds: {
    hotMemorySize: number;
    warmMemorySize: number;
    contextDecayTime: number;
    associationStrengthThreshold: number;
  };
  features: {
    enablePredictiveLoading: boolean;
    enableContextBlending: boolean;
    enableAutoCorrection: boolean;
  };
}