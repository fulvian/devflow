/**
 * Context Injection Utilities
 * 
 * This module provides utilities for handling agent context formatting,
 * conversion between different context formats, and context enrichment
 * for Codex requests.
 */

// Import required dependencies
import { encode, decode } from 'gpt-3-encoder';

/**
 * Represents a standardized context item
 */
export interface ContextItem {
  id: string;
  type: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

/**
 * Represents a Codex-compatible context item
 */
export interface CodexContextItem {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

/**
 * Context formatting options
 */
export interface ContextFormatOptions {
  maxTokens?: number;
  preserveMetadata?: boolean;
  compress?: boolean;
}

/**
 * Context validation result
 */
export interface ContextValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Token counting utility
 * @param text - Text to count tokens for
 * @returns Number of tokens
 */
export function countTokens(text: string): number {
  try {
    return encode(text).length;
  } catch (error) {
    console.warn('Token counting failed, falling back to word count approximation');
    return Math.ceil(text.split(' ').length * 1.3);
  }
}

/**
 * Compresses context content
 * @param content - Content to compress
 * @returns Compressed content
 */
export function compressContent(content: string): string {
  // Simple compression - remove extra whitespace and normalize
  return content.replace(/\s+/g, ' ').trim();
}

/**
 * Decompresses context content
 * @param content - Content to decompress
 * @returns Decompressed content
 */
export function decompressContent(content: string): string {
  // For this simple implementation, decompression is just returning the content
  return content;
}

/**
 * Validates context items
 * @param context - Array of context items to validate
 * @returns Validation result
 */
export function validateContext(context: ContextItem[]): ContextValidationResult {
  const result: ContextValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!Array.isArray(context)) {
    result.isValid = false;
    result.errors.push('Context must be an array');
    return result;
  }

  for (const [index, item] of context.entries()) {
    if (!item.id) {
      result.errors.push(`Context item at index ${index} missing required 'id' field`);
    }
    
    if (!item.type) {
      result.errors.push(`Context item at index ${index} missing required 'type' field`);
    }
    
    if (typeof item.content !== 'string') {
      result.errors.push(`Context item at index ${index} has invalid 'content' field`);
    }
    
    if (item.metadata && typeof item.metadata !== 'object') {
      result.warnings.push(`Context item at index ${index} has non-object metadata`);
    }
  }

  result.isValid = result.errors.length === 0;
  return result;
}

/**
 * Converts standard context items to Codex format
 * @param context - Standard context items
 * @param options - Formatting options
 * @returns Codex-compatible context items
 */
export function toCodexFormat(
  context: ContextItem[], 
  options: ContextFormatOptions = {}
): CodexContextItem[] {
  const { preserveMetadata = true, compress = false } = options;
  
  const validation = validateContext(context);
  if (!validation.isValid) {
    throw new Error(`Invalid context: ${validation.errors.join(', ')}`);
  }

  return context.map(item => {
    let content = item.content;
    
    if (compress) {
      content = compressContent(content);
    }
    
    if (preserveMetadata && item.metadata) {
      try {
        content = `${content}\n\n[Metadata: ${JSON.stringify(item.metadata)}]`;
      } catch (error) {
        console.warn(`Failed to serialize metadata for item ${item.id}`);
      }
    }
    
    // Map types to roles
    let role: 'system' | 'user' | 'assistant' = 'system';
    if (item.type === 'user') {
      role = 'user';
    } else if (item.type === 'assistant') {
      role = 'assistant';
    }
    
    const codexItem: CodexContextItem = {
      role,
      content
    };
    
    if (item.id) {
      codexItem.name = item.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
    
    return codexItem;
  });
}

/**
 * Converts Codex format context items to standard format
 * @param context - Codex context items
 * @returns Standard context items
 */
export function fromCodexFormat(context: CodexContextItem[]): ContextItem[] {
  return context.map((item, index) => {
    // Extract metadata if present
    let content = item.content;
    let metadata: Record<string, any> | undefined;
    
    const metadataMatch = content.match(/\n\n\[Metadata: (.*?)\]$/);
    if (metadataMatch) {
      try {
        metadata = JSON.parse(metadataMatch[1]);
        content = content.substring(0, metadataMatch.index);
      } catch (error) {
        console.warn('Failed to parse metadata from Codex context item');
      }
    }
    
    // Map roles to types
    let type = 'system';
    if (item.role === 'user') {
      type = 'user';
    } else if (item.role === 'assistant') {
      type = 'assistant';
    }
    
    const standardItem: ContextItem = {
      id: item.name || `codex_item_${index}`,
      type,
      content: decompressContent(content),
      timestamp: Date.now()
    };
    
    if (metadata) {
      standardItem.metadata = metadata;
    }
    
    return standardItem;
  });
}

/**
 * Enriches context for Codex requests
 * @param context - Base context items
 * @param additionalContext - Additional context to merge
 * @param options - Formatting options
 * @returns Enriched context in Codex format
 */
export function enrichContextForCodex(
  context: ContextItem[],
  additionalContext: ContextItem[] = [],
  options: ContextFormatOptions = {}
): CodexContextItem[] {
  const { maxTokens = 4096 } = options;
  
  // Merge contexts
  const mergedContext = [...context, ...additionalContext];
  
  // Sort by timestamp if available (newest first)
  mergedContext.sort((a, b) => {
    const timeA = a.timestamp || 0;
    const timeB = b.timestamp || 0;
    return timeB - timeA;
  });
  
  // Convert to Codex format
  let codexContext = toCodexFormat(mergedContext, options);
  
  // Trim to token limit if specified
  if (maxTokens > 0) {
    let tokenCount = 0;
    const trimmedContext: CodexContextItem[] = [];
    
    for (const item of codexContext) {
      const itemTokens = countTokens(item.content);
      if (tokenCount + itemTokens <= maxTokens) {
        trimmedContext.push(item);
        tokenCount += itemTokens;
      } else {
        // Try to add a partial item if there's space
        const remainingTokens = maxTokens - tokenCount;
        if (remainingTokens > 10) { // Only add if we have meaningful space
          // Simplified approach: truncate content
          const truncatedContent = item.content.substring(0, Math.floor(remainingTokens * 4));
          trimmedContext.push({
            ...item,
            content: truncatedContent
          });
        }
        break;
      }
    }
    
    codexContext = trimmedContext;
  }
  
  return codexContext;
}

/**
 * Standardizes context format
 * @param context - Context items in any supported format
 * @returns Standardized context items
 */
export function standardizeContext(context: any[]): ContextItem[] {
  if (context.length === 0) {
    return [];
  }
  
  // Check if already in standard format
  if (isStandardContext(context)) {
    return context as ContextItem[];
  }
  
  // Check if in Codex format
  if (isCodexContext(context)) {
    return fromCodexFormat(context as CodexContextItem[]);
  }
  
  // Try to convert generic objects
  return context.map((item: any, index: number): ContextItem => {
    return {
      id: item.id || `item_${index}`,
      type: item.type || 'system',
      content: item.content || item.text || JSON.stringify(item),
      metadata: item.metadata || {},
      timestamp: item.timestamp || Date.now()
    };
  });
}

/**
 * Checks if context is in standard format
 * @param context - Context to check
 * @returns True if context is in standard format
 */
function isStandardContext(context: any[]): context is ContextItem[] {
  return context.every(item => 
    typeof item === 'object' && 
    item !== null && 
    'id' in item && 
    'type' in item && 
    'content' in item
  );
}

/**
 * Checks if context is in Codex format
 * @param context - Context to check
 * @returns True if context is in Codex format
 */
function isCodexContext(context: any[]): context is CodexContextItem[] {
  return context.every(item => 
    typeof item === 'object' && 
    item !== null && 
    'role' in item && 
    'content' in item
  );
}

// Export all utilities
export default {
  countTokens,
  compressContent,
  decompressContent,
  validateContext,
  toCodexFormat,
  fromCodexFormat,
  enrichContextForCodex,
  standardizeContext
};