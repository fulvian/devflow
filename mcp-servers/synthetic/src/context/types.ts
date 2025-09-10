export interface ContextEntry {
  id: string;
  data: any;
  lastAccessed: number;
  createdAt: number;
  importance: number; // 0-1 scale
  size: number; // in bytes
  accessCount: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface EvictionPolicy {
  strategy: 'lru' | 'importance' | 'size' | 'hybrid';
  threshold: number; // Memory usage threshold (0-1)
  minKeepCount: number; // Minimum contexts to keep
  compressionThreshold?: number; // Size threshold for compression
}

export interface MemoryPressureEvent {
  timestamp: number;
  currentUsage: number;
  predictedUsage: number;
  pressureLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ContextEvictionResult {
  evicted: string[];
  compressed: string[];
  recovered: string[];
  memoryFreed: number;
  timestamp: number;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  contextId: string;
}

export interface ContextRecoveryPoint {
  id: string;
  timestamp: number;
  contextSnapshot: any;
  metadata: Record<string, any>;
}

export interface ContextEvictionConfig {
  policies: EvictionPolicy[];
  enableCompression: boolean;
  enableRecovery: boolean;
  recoveryPointInterval: number; // in milliseconds
  monitoringInterval: number; // in milliseconds
}