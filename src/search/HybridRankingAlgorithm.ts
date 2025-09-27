/**
 * In-Memory Search Service
 * 
 * This module provides search functionality using in-memory data structures
 * as a replacement for SQLite-based implementations.
 * 
 * Task ID: DEVFLOW-BUILD-FIX-005
 */

// Type definitions
export interface SearchableItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'title' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
}

export interface SearchResult {
  items: SearchableItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * In-Memory Search Service
 * Manages searchable items in memory and provides search functionality
 */
export class InMemorySearchService {
  private items: Map<string, SearchableItem> = new Map();
  private index: Map<string, Set<string>> = new Map(); // Term -> Item IDs

  /**
   * Add or update an item in the search index
   * @param item The item to add or update
   */
  public upsertItem(item: SearchableItem): void {
    // Store the item
    this.items.set(item.id, item);
    
    // Update the search index
    this.updateIndex(item);
  }

  /**
   * Remove an item from the search index
   * @param id The ID of the item to remove
   */
  public removeItem(id: string): void {
    const item = this.items.get(id);
    if (item) {
      // Remove from index
      this.removeFromIndex(item);
      // Remove from storage
      this.items.delete(id);
    }
  }

  /**
   * Search for items based on query and options
   * @param query The search query
   * @param options Search options
   * @returns Search results
   */
  public search(query: string, options: SearchOptions = {}): SearchResult {
    const {
      limit = 10,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      tags = []
    } = options;

    // Tokenize the query
    const queryTerms = this.tokenize(query.toLowerCase());
    
    // Find matching item IDs
    let matchingIds: string[] = [];
    
    if (queryTerms.length > 0) {
      // Find items that match all query terms
      const termMatches: Set<string>[] = queryTerms.map(term => 
        this.index.get(term) || new Set()
      );
      
      // Find intersection of all term matches
      matchingIds = termMatches.length > 0 
        ? [...termMatches.reduce((a, b) => 
            new Set([...a].filter(id => b.has(id)))
          )]
        : [];
    } else {
      // If no query terms, return all items
      matchingIds = [...this.items.keys()];
    }
    
    // Filter by tags if specified
    if (tags.length > 0) {
      matchingIds = matchingIds.filter(id => {
        const item = this.items.get(id);
        return item && tags.some(tag => item.tags.includes(tag));
      });
    }
    
    // Get the actual items
    let results = matchingIds
      .map(id => this.items.get(id)!)
      .filter(item => item !== undefined);
    
    // Sort results
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    // Apply pagination
    const total = results.length;
    results = results.slice(offset, offset + limit);
    
    return {
      items: results,
      total,
      limit,
      offset
    };
  }

  /**
   * Get an item by ID
   * @param id The item ID
   * @returns The item or undefined if not found
   */
  public getItem(id: string): SearchableItem | undefined {
    return this.items.get(id);
  }

  /**
   * Get all items
   * @returns Array of all items
   */
  public getAllItems(): SearchableItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Clear all items and index
   */
  public clear(): void {
    this.items.clear();
    this.index.clear();
  }

  /**
   * Update the search index for an item
   * @param item The item to index
   */
  private updateIndex(item: SearchableItem): void {
    // Remove old index entries for this item
    this.removeFromIndex(item);
    
    // Add new index entries
    const text = `${item.title} ${item.content} ${item.tags.join(' ')}`.toLowerCase();
    const terms = this.tokenize(text);
    
    terms.forEach(term => {
      if (!this.index.has(term)) {
        this.index.set(term, new Set());
      }
      this.index.get(term)!.add(item.id);
    });
  }

  /**
   * Remove an item from the search index
   * @param item The item to remove from index
   */
  private removeFromIndex(item: SearchableItem): void {
    // Remove this item from all term indexes
    for (const [term, ids] of this.index.entries()) {
      ids.delete(item.id);
      // Clean up empty term entries
      if (ids.size === 0) {
        this.index.delete(term);
      }
    }
  }

  /**
   * Tokenize text into search terms
   * @param text The text to tokenize
   * @returns Array of terms
   */
  private tokenize(text: string): string[] {
    // Simple tokenization - split by whitespace and remove punctuation
    return text
      .split(/\s+/)
      .map(term => term.replace(/[^\w]/g, ''))
      .filter(term => term.length > 0);
  }
}

// Export a singleton instance for convenience
export const searchService = new InMemorySearchService();

// Export types for external use
export default {
  InMemorySearchService,
  searchService
};