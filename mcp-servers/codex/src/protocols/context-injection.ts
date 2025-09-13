// context-injection-protocol.ts

/**
 * Context Injection Protocol for Agent Handoff
 * 
 * This module provides a robust framework for seamless context transfer between agents,
 * including compression, validation, and standardization mechanisms.
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES AND TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents the context data being transferred between agents
 */
export interface AgentContext {
  /** Unique identifier for the context */
  id: string;
  
  /** Timestamp when context was created */
  createdAt: Date;
  
  /** Agent that generated this context */
  sourceAgent: string;
  
  /** Agent that will receive this context */
  targetAgent?: string;
  
  /** Core context data */
  data: Record<string, unknown>;
  
  /** Metadata about the context */
  metadata: {
    /** Priority level of the context */
    priority: 'low' | 'medium' | 'high' | 'critical';
    
    /** Estimated token count */
    tokenCount?: number;
    
    /** Security classification */
    classification: 'public' | 'internal' | 'confidential' | 'secret';
    
    /** Tags for categorization */
    tags: string[];
    
    /** Expiration time for context validity */
    expiresAt?: Date;
  };
  
  /** Context lineage tracking */
  lineage: {
    /** Previous context IDs in the chain */
    ancestors: string[];
    
    /** Version of the context */
    version: number;
  };
}

/**
 * Configuration for the context injection protocol
 */
export interface ContextInjectionConfig {
  /** Maximum token budget for context */
  maxTokenBudget: number;
  
  /** Compression strategy to use */
  compressionStrategy: 'none' | 'gzip' | 'lz-string' | 'custom';
  
  /** Validation rules */
  validationRules: {
    /** Required fields in context data */
    requiredFields: string[];
    
    /** Maximum depth of nested objects */
    maxDepth: number;
    
    /** Maximum size in bytes */
    maxSizeBytes: number;
  };
  
  /** Emergency protocols */
  emergencyProtocols: {
    /** Enable emergency context mode */
    enabled: boolean;
    
    /** Token threshold to trigger emergency mode */
    tokenThreshold: number;
    
    /** Fields to preserve in emergency mode */
    preserveFields: string[];
  };
  
  /** Cross-agent compatibility settings */
  compatibility: {
    /** Target agent version compatibility */
    targetVersions: string[];
    
    /** Format standardization rules */
    formatStandards: Record<string, string>;
  };
}

/**
 * Result of context injection operation
 */
export interface ContextInjectionResult {
  /** Success status */
  success: boolean;
  
  /** Processed context */
  context?: AgentContext;
  
  /** Any warnings encountered */
  warnings: string[];
  
  /** Any errors encountered */
  errors: string[];
  
  /** Token usage statistics */
  tokenUsage: {
    /** Original token count */
    original: number;
    
    /** Compressed token count */
    compressed: number;
    
    /** Budget remaining */
    remaining: number;
  };
}

/**
 * Interface for compression algorithms
 */
export interface CompressionStrategy {
  /**
   * Compress context data
   * @param data Context data to compress
   * @returns Compressed data as string
   */
  compress(data: Record<string, unknown>): string;
  
  /**
   * Decompress context data
   * @param compressedData Compressed data string
   * @returns Decompressed context data
   */
  decompress(compressedData: string): Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPRESSION STRATEGIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * No compression strategy - returns JSON string
 */
class NoCompressionStrategy implements CompressionStrategy {
  compress(data: Record<string, unknown>): string {
    return JSON.stringify(data);
  }
  
  decompress(compressedData: string): Record<string, unknown> {
    return JSON.parse(compressedData);
  }
}

/**
 * GZIP compression strategy
 */
class GzipCompressionStrategy implements CompressionStrategy {
  compress(data: Record<string, unknown>): string {
    // In a real implementation, this would use a gzip library
    // For this example, we'll simulate compression
    const jsonString = JSON.stringify(data);
    // Simulate compression by truncating (not real compression)
    return jsonString; // Placeholder
  }
  
  decompress(compressedData: string): Record<string, unknown> {
    // In a real implementation, this would decompress gzip data
    return JSON.parse(compressedData);
  }
}

/**
 * LZ-String compression strategy
 */
class LzStringCompressionStrategy implements CompressionStrategy {
  compress(data: Record<string, unknown>): string {
    // In a real implementation, this would use lz-string library
    const jsonString = JSON.stringify(data);
    // Simulate compression
    return jsonString; // Placeholder
  }
  
  decompress(compressedData: string): Record<string, unknown> {
    // In a real implementation, this would decompress lz-string data
    return JSON.parse(compressedData);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT INJECTION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Context Injection Middleware for agent handoff
 */
export class ContextInjectionMiddleware {
  private config: ContextInjectionConfig;
  private compressionStrategies: Map<string, CompressionStrategy>;
  
  constructor(config: ContextInjectionConfig) {
    this.config = config;
    this.compressionStrategies = new Map();
    
    // Register compression strategies
    this.compressionStrategies.set('none', new NoCompressionStrategy());
    this.compressionStrategies.set('gzip', new GzipCompressionStrategy());
    this.compressionStrategies.set('lz-string', new LzStringCompressionStrategy());
  }
  
  /**
   * Register a custom compression strategy
   * @param name Strategy name
   * @param strategy Compression strategy implementation
   */
  registerCompressionStrategy(name: string, strategy: CompressionStrategy): void {
    this.compressionStrategies.set(name, strategy);
  }
  
  /**
   * Inject context from source to target agent
   * @param context Context to inject
   * @param targetAgent Target agent identifier
   * @returns Result of injection operation
   */
  async injectContext(context: AgentContext, targetAgent: string): Promise<ContextInjectionResult> {
    const result: ContextInjectionResult = {
      success: false,
      warnings: [],
      errors: [],
      tokenUsage: {
        original: context.metadata.tokenCount || 0,
        compressed: 0,
        remaining: this.config.maxTokenBudget
      }
    };
    
    try {
      // 1. Validate context
      const validation = this.validateContext(context);
      if (!validation.isValid) {
        result.errors.push(...validation.errors);
        return result;
      }
      
      // 2. Apply format standardization
      const standardizedContext = this.standardizeFormat(context);
      
      // 3. Check token budget
      const tokenCheck = this.checkTokenBudget(standardizedContext);
      if (!tokenCheck.withinBudget) {
        if (this.config.emergencyProtocols.enabled) {
          result.warnings.push('Token budget exceeded, applying emergency protocol');
          const emergencyContext = this.applyEmergencyProtocol(standardizedContext);
          standardizedContext.data = emergencyContext.data;
        } else {
          result.errors.push('Token budget exceeded and emergency protocols disabled');
          return result;
        }
      }
      
      // 4. Compress context
      const compressedContext = await this.compressContext(standardizedContext);
      result.tokenUsage.compressed = compressedContext.metadata.tokenCount || 0;
      result.tokenUsage.remaining = this.config.maxTokenBudget - result.tokenUsage.compressed;
      
      // 5. Set target agent
      compressedContext.targetAgent = targetAgent;
      
      // 6. Check cross-agent compatibility
      const compatibility = this.checkCompatibility(compressedContext);
      if (!compatibility.compatible) {
        result.warnings.push(...compatibility.warnings);
      }
      
      result.context = compressedContext;
      result.success = true;
    } catch (error) {
      result.errors.push(`Context injection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return result;
  }
  
  /**
   * Validate context against configured rules
   * @param context Context to validate
   * @returns Validation result
   */
  private validateContext(context: AgentContext): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required fields
    for (const field of this.config.validationRules.requiredFields) {
      if (!(field in context.data)) {
        errors.push(`Required field missing: ${field}`);
      }
    }
    
    // Check depth
    const checkDepth = (obj: Record<string, unknown>, currentDepth: number): number => {
      if (currentDepth > this.config.validationRules.maxDepth) {
        return currentDepth;
      }
      
      let maxDepth = currentDepth;
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          const depth = checkDepth(obj[key] as Record<string, unknown>, currentDepth + 1);
          maxDepth = Math.max(maxDepth, depth);
        }
      }
      return maxDepth;
    };
    
    const actualDepth = checkDepth(context.data, 1);
    if (actualDepth > this.config.validationRules.maxDepth) {
      errors.push(`Context exceeds maximum depth of ${this.config.validationRules.maxDepth}`);
    }
    
    // Check size
    const size = new Blob([JSON.stringify(context)]).size;
    if (size > this.config.validationRules.maxSizeBytes) {
      errors.push(`Context exceeds maximum size of ${this.config.validationRules.maxSizeBytes} bytes`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Standardize context format according to compatibility rules
   * @param context Context to standardize
   * @returns Standardized context
   */
  private standardizeFormat(context: AgentContext): AgentContext {
    // Apply format standardization rules
    const standardized = { ...context };
    
    // Apply field mappings if defined
    for (const [sourceField, targetField] of Object.entries(this.config.compatibility.formatStandards)) {
      if (sourceField in standardized.data) {
        standardized.data[targetField] = standardized.data[sourceField];
        if (sourceField !== targetField) {
          delete standardized.data[sourceField];
        }
      }
    }
    
    return standardized;
  }
  
  /**
   * Check if context is within token budget
   * @param context Context to check
   * @returns Budget check result
   */
  private checkTokenBudget(context: AgentContext): { withinBudget: boolean; used: number } {
    const tokenCount = context.metadata.tokenCount || 0;
    return {
      withinBudget: tokenCount <= this.config.maxTokenBudget,
      used: tokenCount
    };
  }
  
  /**
   * Apply emergency protocol when token budget is exceeded
   * @param context Context to process
   * @returns Processed context with emergency protocol applied
   */
  private applyEmergencyProtocol(context: AgentContext): AgentContext {
    const emergencyContext = { ...context };
    
    // Preserve only specified fields
    const preservedData: Record<string, unknown> = {};
    for (const field of this.config.emergencyProtocols.preserveFields) {
      if (field in emergencyContext.data) {
        preservedData[field] = emergencyContext.data[field];
      }
    }
    
    emergencyContext.data = preservedData;
    
    // Update token count
    emergencyContext.metadata.tokenCount = Object.keys(preservedData).length * 10; // Simplified estimation
    
    return emergencyContext;
  }
  
  /**
   * Compress context using configured strategy
   * @param context Context to compress
   * @returns Compressed context
   */
  private async compressContext(context: AgentContext): Promise<AgentContext> {
    const strategy = this.compressionStrategies.get(this.config.compressionStrategy);
    if (!strategy) {
      throw new Error(`Compression strategy '${this.config.compressionStrategy}' not found`);
    }
    
    const compressedData = strategy.compress(context.data);
    
    // Create compressed context
    const compressedContext = { ...context };
    compressedContext.data = { compressed: compressedData };
    
    // Update token count
    compressedContext.metadata.tokenCount = compressedData.length / 4; // Simplified estimation
    
    return compressedContext;
  }
  
  /**
   * Check cross-agent compatibility
   * @param context Context to check
   * @returns Compatibility result
   */
  private checkCompatibility(context: AgentContext): { compatible: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // In a real implementation, this would check version compatibility
    // For this example, we'll just return a placeholder result
    return {
      compatible: true,
      warnings
    };
  }
  
  /**
   * Decompress context data
   * @param context Compressed context
   * @returns Decompressed context
   */
  async decompressContext(context: AgentContext): Promise<AgentContext> {
    const strategy = this.compressionStrategies.get(this.config.compressionStrategy);
    if (!strategy) {
      throw new Error(`Compression strategy '${this.config.compressionStrategy}' not found`);
    }
    
    if (!context.data.compressed) {
      throw new Error('Context is not compressed');
    }
    
    const decompressedData = strategy.decompress(context.data.compressed as string);
    
    // Create decompressed context
    const decompressedContext = { ...context };
    decompressedContext.data = decompressedData;
    
    // Update token count
    decompressedContext.metadata.tokenCount = Object.keys(decompressedData).length * 10; // Simplified estimation
    
    return decompressedContext;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default configuration for context injection
 */
export const DEFAULT_CONTEXT_INJECTION_CONFIG: ContextInjectionConfig = {
  maxTokenBudget: 4096,
  compressionStrategy: 'gzip',
  validationRules: {
    requiredFields: ['task', 'user'],
    maxDepth: 5,
    maxSizeBytes: 1024 * 1024 // 1MB
  },
  emergencyProtocols: {
    enabled: true,
    tokenThreshold: 3000,
    preserveFields: ['task', 'user', 'priority']
  },
  compatibility: {
    targetVersions: ['1.0.0', '1.1.0', '2.0.0'],
    formatStandards: {
      'user_id': 'userId',
      'task_id': 'taskId',
      'created_at': 'createdAt'
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export {
  NoCompressionStrategy,
  GzipCompressionStrategy,
  LzStringCompressionStrategy
};

export type {
  AgentContext,
  ContextInjectionConfig,
  ContextInjectionResult,
  CompressionStrategy
};