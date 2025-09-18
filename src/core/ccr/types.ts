// Core types for CCR Context Bridge

export interface ContextEntry {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  relevanceScore: number;
  tokenCount: number;
  semanticHash: string;
  metadata?: Record<string, any>;
  turnId?: string; // For multi-turn conversation tracking
}

export interface ConversationState {
  sessionId: string;
  contextWindow: ContextEntry[];
  turnHistory: TurnEntry[];
  currentTurnId: string;
  tokenUsage: {
    total: number;
    perRole: Record<string, number>;
  };
  compressionStats: {
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
  };
}

export interface TurnEntry {
  turnId: string;
  startTime: number;
  endTime?: number;
  contextEntries: string[]; // IDs of context entries in this turn
  summary?: string;
  topics: string[];
}

export interface SessionMetadata {
  sessionId: string;
  createdAt: number;
  lastAccessed: number;
  turnCount: number;
  totalTokens: number;
  compressionHistory: CompressionRecord[];
  topics: string[];
  embedding?: number[]; // For semantic similarity
}

export interface CompressionRecord {
  timestamp: number;
  originalSize: number;
  compressedSize: number;
  strategy: CompressionStrategy;
  contextPreserved: number; // 0-1 ratio
}

export type CompressionStrategy = 
  | 'semantic-chunking'
  | 'turn-boundary'
  | 'relevance-ranking'
  | 'adaptive-ratio'
  | 'multi-strategy';

export interface MemoryPersistenceConfig {
  ttl: number; // Time to live in milliseconds
  maxSessions: number;
  compressionThreshold: number; // Auto-compress when tokens exceed this
  persistenceStrategy: 'eager' | 'lazy' | 'periodic';
  garbageCollection: {
    enabled: boolean;
    interval: number;
    retentionPolicy: 'lru' | 'topic-based' | 'relevance-based';
  };
}

export interface CrossSessionBridge {
  sourceSessionId: string;
  targetSessionId: string;
  sharedContext: ContextEntry[];
  similarityScore: number;
  bridgedAt: number;
  topics: string[];
}
