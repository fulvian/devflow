/**
 * DevFlow Context Transformer for CCR
 * 
 * Transforms DevFlow context for seamless integration with Claude Code Router
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export class DevFlowContextTransformer {
  constructor(options = {}) {
    this.preserveMemoryBlocks = options.preserveMemoryBlocks ?? true;
    this.compressContext = options.compressContext ?? true;
    this.maxContextSize = options.maxContextSize ?? 200000;
  }

  /**
   * Transform DevFlow context for CCR compatibility
   */
  async transform(context) {
    try {
      // Extract DevFlow-specific context
      const devflowContext = this.extractDevFlowContext(context);
      
      // Compress if needed
      if (this.compressContext && devflowContext.size > this.maxContextSize) {
        devflowContext = await this.compressContext(devflowContext);
      }

      // Preserve memory blocks
      if (this.preserveMemoryBlocks) {
        devflowContext.memoryBlocks = await this.preserveMemoryBlocks(devflowContext);
      }

      return {
        ...context,
        devflow: devflowContext,
        transformed: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('DevFlow Context Transformation Error:', error);
      return context; // Return original context on error
    }
  }

  /**
   * Extract DevFlow-specific context elements
   */
  extractDevFlowContext(context) {
    return {
      memoryBlocks: context.memoryBlocks || [],
      sessionState: context.sessionState || {},
      taskContext: context.taskContext || null,
      platformState: context.platformState || {},
      coordinationData: context.coordinationData || {},
      size: JSON.stringify(context).length
    };
  }

  /**
   * Compress context while preserving critical information
   */
  async compressContext(devflowContext) {
    // Implement intelligent compression
    const compressed = {
      ...devflowContext,
      memoryBlocks: devflowContext.memoryBlocks.slice(-50), // Keep last 50 blocks
      sessionState: this.compressSessionState(devflowContext.sessionState),
      compressionApplied: true,
      originalSize: devflowContext.size
    };

    // Truncate taskContext if it exists and is a string
    if (compressed.taskContext && typeof compressed.taskContext === 'string') {
      const maxTaskContextLength = 500; // Or some other reasonable value
      if (compressed.taskContext.length > maxTaskContextLength) {
        compressed.taskContext = compressed.taskContext.substring(0, maxTaskContextLength) + '\n... (truncated)';
      }
    }

    compressed.size = JSON.stringify(compressed).length;
    return compressed;
  }

  /**
   * Compress session state
   */
  compressSessionState(sessionState) {
    const compressed = {};
    const criticalKeys = ['currentTask', 'activePlatform', 'lastActivity', 'contextSize'];
    
    for (const key of criticalKeys) {
      if (sessionState[key]) {
        compressed[key] = sessionState[key];
      }
    }

    return compressed;
  }

  /**
   * Preserve memory blocks with intelligent filtering
   */
  async preserveMemoryBlocks(devflowContext) {
    if (!devflowContext.memoryBlocks) return [];

    // Sort by importance and recency
    const sortedBlocks = devflowContext.memoryBlocks
      .sort((a, b) => {
        const importanceScore = (a.importance || 0) + (b.recency || 0);
        return importanceScore;
      })
      .slice(0, 100); // Keep top 100 most important blocks

    return sortedBlocks;
  }
}

export default DevFlowContextTransformer;
