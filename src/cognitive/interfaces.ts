// Cognitive Memory System Interfaces

export interface MemoryNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'concept' | 'relationship';
  content: string;
  metadata: {
    createdAt: Date;
    lastAccessed: Date;
    strength: number; // 0-1 value representing memory strength
    accessCount: number;
    tags?: string[];
    filePath?: string;
    lineNumber?: number;
    [key: string]: any; // Additional metadata
  };
  connections: {
    [nodeId: string]: {
      strength: number; // Connection strength 0-1
      type: 'related' | 'depends' | 'calls' | 'contains' | 'similar';
      lastTraversed: Date;
    };
  };
}

export interface MemoryGraph {
  nodes: Map<string, MemoryNode>;
  metadata: {
    createdAt: Date;
    lastModified: Date;
    version: string;
    nodeCount: number;
    connectionCount: number;
  };
}

export interface CognitiveSession {
  id: string;
  userId: string;
  createdAt: Date;
  lastActive: Date;
  isActive: boolean;
  context: {
    currentFocus: string[]; // Node IDs of current focus
    explorationPath: string[]; // Historical path of exploration
    workingMemory: string[]; // Recently accessed nodes
    goals: string[]; // Current exploration goals
  };
  memoryGraph: MemoryGraph;
  explorationStrategy: ExplorationStrategy;
}

export interface ExplorationStrategy {
  id: string;
  name: string;
  description: string;
  parameters: {
    [key: string]: any;
  };
  calculateNodeScore(node: MemoryNode, context: CognitiveSession['context']): number;
  getNextNodes(graph: MemoryGraph, context: CognitiveSession['context']): string[];
}

export interface SessionPersistenceAdapter {
  saveSession(session: CognitiveSession): Promise<void>;
  loadSession(sessionId: string): Promise<CognitiveSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(userId: string): Promise<CognitiveSession[]>;
  updateSessionActivity(sessionId: string): Promise<void>;
}

export type WeightedExplorationScore = {
  nodeId: string;
  score: number;
  factors: {
    relevance: number;
    recency: number;
    strength: number;
    context: number;
    [key: string]: number; // Additional factors
  };
};
