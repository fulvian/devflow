// Core types for cognitive mapping system
export interface Node {
  id: string;
  label: string;
  properties: Record<string, any>;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  properties: Record<string, any>;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
}

export interface MentalMap {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NavigationPath {
  path: Node[];
  distance: number;
  estimatedTime: number;
}

export interface CognitiveMapConfig {
  maxNodes: number;
  enableClustering: boolean;
  pagerankThreshold: number;
}

// Neo4j specific types
export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

// PageRank types
export interface PageRankConfig {
  dampingFactor: number;
  maxIterations: number;
  tolerance: number;
}

export interface NodeImportance {
  nodeId: string;
  score: number;
  rank: number;
}

export interface PageRankResult {
  nodes: NodeImportance[];
  iterations: number;
  converged: boolean;
}