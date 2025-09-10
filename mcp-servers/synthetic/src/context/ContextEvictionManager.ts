import { ContextEntry, EvictionPolicy, ContextEvictionResult, MemoryPressureEvent, ContextRecoveryPoint, ContextEvictionConfig } from './types';
import { EvictionStrategies } from './strategies';
import { ContextCompressor } from './compression';

export class ContextEvictionManager {
  private contexts: Map<string, ContextEntry> = new Map();
  private recoveryPoints: Map<string, ContextRecoveryPoint> = new Map();
  private config: ContextEvictionConfig;
  private evictionHistory: ContextEvictionResult[] = [];
  private memoryPressureHistory: MemoryPressureEvent[] = [];
  
  constructor(config: ContextEvictionConfig) {
    this.config = config;
    this.startMonitoring();
  }

  // Add context to management
  addContext(context: ContextEntry): void {
    this.contexts.set(context.id, context);
  }

  // Remove context
  removeContext(id: string): boolean {
    return this.contexts.delete(id);
  }

  // Get context (updates access time)
  getContext(id: string): ContextEntry | undefined {
    const context = this.contexts.get(id);
    if (context) {
      context.lastAccessed = Date.now();
      context.accessCount++;
    }
    return context;
  }

  // Update context importance
  updateContextImportance(id: string, importance: number): void {
    const context = this.contexts.get(id);
    if (context) {
      context.importance = Math.max(0, Math.min(1, importance));
    }
  }

  // Create recovery point
  createRecoveryPoint(id: string): void {
    if (!this.config.enableRecovery) return;
    
    const context = this.contexts.get(id);
    if (context) {
      const recoveryPoint: ContextRecoveryPoint = {
        id: `${id}-${Date.now()}`,
        timestamp: Date.now(),
        contextSnapshot: JSON.parse(JSON.stringify(context)),
        metadata: {
          reason: 'manual_checkpoint',
          contextId: id
        }
      };
      this.recoveryPoints.set(recoveryPoint.id, recoveryPoint);
    }
  }

  // Restore context from recovery point
  restoreContext(recoveryPointId: string): boolean {
    if (!this.config.enableRecovery) return false;
    
    const recoveryPoint = this.recoveryPoints.get(recoveryPointId);
    if (recoveryPoint) {
      this.contexts.set(recoveryPoint.metadata.contextId, recoveryPoint.contextSnapshot);
      return true;
    }
    return false;
  }

  // Handle memory pressure
  handleMemoryPressure(event: MemoryPressureEvent): ContextEvictionResult {
    this.memoryPressureHistory.push(event);
    
    // Keep only recent history
    if (this.memoryPressureHistory.length > 100) {
      this.memoryPressureHistory.shift();
    }

    const result: ContextEvictionResult = {
      evicted: [],
      compressed: [],
      recovered: [],
      memoryFreed: 0,
      timestamp: Date.now()
    };

    // Find applicable policy based on pressure level
    const policy = this.getApplicablePolicy(event);
    if (!policy) {
      return result;
    }

    // Get all contexts as array
    const contextArray = Array.from(this.contexts.values());
    
    // Select contexts for eviction
    const toEvict = EvictionStrategies.selectForEviction(contextArray, policy);
    
    // Evict selected contexts
    for (const context of toEvict) {
      result.evicted.push(context.id);
      result.memoryFreed += context.size;
      this.contexts.delete(context.id);
    }

    // Apply compression if enabled
    if (this.config.enableCompression) {
      const toCompress = contextArray.filter(ctx => 
        !toEvict.includes(ctx) && 
        ctx.size > (policy.compressionThreshold || 10000)
      );
      
      for (const context of toCompress) {
        const originalSize = context.size;
        const compressionResult = ContextCompressor.compress(context);
        result.compressed.push(context.id);
        result.memoryFreed += (originalSize - compressionResult.compressedSize);
        
        // Update context in map
        this.contexts.set(context.id, context);
      }
    }

    this.evictionHistory.push(result);
    
    // Keep only recent history
    if (this.evictionHistory.length > 50) {
      this.evictionHistory.shift();
    }

    return result;
  }

  // Predict memory usage based on history
  predictMemoryUsage(): number {
    if (this.memoryPressureHistory.length === 0) return 0;
    
    // Simple prediction based on recent trends
    const recent = this.memoryPressureHistory.slice(-5);
    const trend = recent.length > 1 
      ? (recent[recent.length - 1].currentUsage - recent[0].currentUsage) / recent.length
      : 0;
      
    return Math.max(0, Math.min(1, recent[recent.length - 1].currentUsage + trend));
  }

  // Get current memory pressure level
  getMemoryPressureLevel(): 'low' | 'medium' | 'high' | 'critical' {
    const currentUsage = this.getCurrentMemoryUsage();
    if (currentUsage > 0.9) return 'critical';
    if (currentUsage > 0.75) return 'high';
    if (currentUsage > 0.5) return 'medium';
    return 'low';
  }

  // Get current memory usage (placeholder - implement based on actual metrics)
  private getCurrentMemoryUsage(): number {
    // In a real implementation, this would get actual memory usage
    // For now, we'll simulate based on context count and sizes
    let totalSize = 0;
    let maxSize = 1000000; // 1MB placeholder
    
    for (const context of this.contexts.values()) {
      totalSize += context.size;
    }
    
    return Math.min(1, totalSize / maxSize);
  }

  // Get applicable policy for current pressure
  private getApplicablePolicy(event: MemoryPressureEvent): EvictionPolicy | null {
    // Find policy with threshold closest to but below current usage
    const applicablePolicies = this.config.policies
      .filter(policy => event.currentUsage >= policy.threshold)
      .sort((a, b) => b.threshold - a.threshold);
      
    return applicablePolicies[0] || null;
  }

  // Start monitoring memory pressure
  private startMonitoring(): void {
    setInterval(() => {
      const pressureLevel = this.getMemoryPressureLevel();
      const currentUsage = this.getCurrentMemoryUsage();
      const predictedUsage = this.predictMemoryUsage();
      
      // Trigger eviction if under pressure
      if (pressureLevel !== 'low') {
        this.handleMemoryPressure({
          timestamp: Date.now(),
          currentUsage,
          predictedUsage,
          pressureLevel
        });
      }
      
      // Create recovery points periodically
      if (this.config.enableRecovery && 
          Date.now() % this.config.recoveryPointInterval < this.config.monitoringInterval) {
        this.createPeriodicRecoveryPoints();
      }
    }, this.config.monitoringInterval);
  }

  // Create recovery points for important contexts
  private createPeriodicRecoveryPoints(): void {
    if (!this.config.enableRecovery) return;
    
    // Create recovery points for high importance contexts
    for (const context of this.contexts.values()) {
      if (context.importance > 0.7) {
        this.createRecoveryPoint(context.id);
      }
    }
  }

  // Get statistics
  getStats(): {
    totalContexts: number;
    totalSize: number;
    evictionCount: number;
    compressionCount: number;
    recoveryPointCount: number;
  } {
    let totalSize = 0;
    for (const context of this.contexts.values()) {
      totalSize += context.size;
    }
    
    const evictionCount = this.evictionHistory.reduce((sum, result) => sum + result.evicted.length, 0);
    const compressionCount = this.evictionHistory.reduce((sum, result) => sum + result.compressed.length, 0);
    
    return {
      totalContexts: this.contexts.size,
      totalSize,
      evictionCount,
      compressionCount,
      recoveryPointCount: this.recoveryPoints.size
    };
  }
}