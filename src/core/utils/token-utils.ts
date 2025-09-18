// Token counting and semantic hashing utilities for CCR Context Bridge

/**
 * Calculates token count for text content using a simple approximation
 * In production, this would use a proper tokenizer
 */
export function calculateTokenCount(content: string): number {
  // Simple approximation: 1 token ≈ 4 characters for English text
  // More accurate would be using tiktoken or similar
  const baseCount = Math.ceil(content.length / 4);
  
  // Adjust for special tokens and formatting
  const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
  const urls = (content.match(/https?:\/\/[^\s]+/g) || []).length;
  const specialTokens = codeBlocks * 2 + urls; // Code and URLs use more tokens
  
  return baseCount + specialTokens;
}

/**
 * Generates a semantic hash for content similarity comparison
 * In production, this would use proper embeddings
 */
export function generateSemanticHash(content: string): string {
  // Normalize content for consistent hashing
  const normalized = content
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Extract key terms (simplified)
  const words = normalized.split(' ');
  const keyWords = words
    .filter(word => word.length > 3) // Filter short words
    .filter(word => !isStopWord(word)) // Filter stop words
    .slice(0, 20); // Take first 20 key words
  
  // Create hash from key words
  const hashSource = keyWords.sort().join('|');
  return simpleHash(hashSource);
}

/**
 * Simple hash function for content
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Check if a word is a common stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'among', 'this', 'that', 'these', 'those', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall'
  ]);
  
  return stopWords.has(word.toLowerCase());
}

/**
 * Estimate token count for an array of context entries
 */
export function calculateContextTokenCount(entries: Array<{ content: string }>): number {
  return entries.reduce((total, entry) => total + calculateTokenCount(entry.content), 0);
}

/**
 * Check if content exceeds token limit
 */
export function exceedsTokenLimit(content: string, limit: number): boolean {
  return calculateTokenCount(content) > limit;
}

/**
 * Truncate content to fit within token limit while preserving meaning
 */
export function truncateToTokenLimit(content: string, tokenLimit: number): string {
  const currentTokens = calculateTokenCount(content);
  if (currentTokens <= tokenLimit) {
    return content;
  }
  
  // Calculate approximate character limit
  const ratio = tokenLimit / currentTokens;
  const charLimit = Math.floor(content.length * ratio * 0.95); // Leave some buffer
  
  // Try to truncate at sentence boundaries
  const sentences = content.split('. ');
  let result = '';
  
  for (const sentence of sentences) {
    const testResult = result + (result ? '. ' : '') + sentence;
    if (testResult.length <= charLimit) {
      result = testResult;
    } else {
      break;
    }
  }
  
  // If no complete sentences fit, truncate at word boundaries
  if (!result) {
    const words = content.split(' ');
    for (const word of words) {
      const testResult = result + (result ? ' ' : '') + word;
      if (testResult.length <= charLimit) {
        result = testResult;
      } else {
        break;
      }
    }
  }
  
  return result + (result.length < content.length ? '...' : '');
}