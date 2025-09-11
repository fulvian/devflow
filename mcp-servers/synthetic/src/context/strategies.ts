import { ContextEntry, EvictionPolicy } from './types';

export class EvictionStrategies {
  static lru(contexts: ContextEntry[], policy: EvictionPolicy): ContextEntry[] {
    return [...contexts]
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .slice(0, Math.max(0, contexts.length - policy.minKeepCount));
  }

  static importance(contexts: ContextEntry[], policy: EvictionPolicy): ContextEntry[] {
    return [...contexts]
      .sort((a, b) => a.importance - b.importance)
      .slice(0, Math.max(0, contexts.length - policy.minKeepCount));
  }

  static size(contexts: ContextEntry[], policy: EvictionPolicy): ContextEntry[] {
    return [...contexts]
      .sort((a, b) => a.size - b.size)
      .slice(0, Math.max(0, contexts.length - policy.minKeepCount));
  }

  static hybrid(contexts: ContextEntry[], policy: EvictionPolicy): ContextEntry[] {
    // Combine multiple strategies with weighted scoring
    const scored = contexts.map(ctx => {
      const lruScore = ctx.lastAccessed;
      const importanceScore = ctx.importance * 1000000000; // Scale to differentiate
      const sizeScore = ctx.size / 1000; // Scale down size impact
      
      // Lower score means higher eviction priority
      const score = lruScore + importanceScore + sizeScore;
      return { ...ctx, score };
    });

    return scored
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.max(0, contexts.length - policy.minKeepCount));
  }

  static selectForEviction(contexts: ContextEntry[], policy: EvictionPolicy): ContextEntry[] {
    switch (policy.strategy) {
      case 'lru':
        return this.lru(contexts, policy);
      case 'importance':
        return this.importance(contexts, policy);
      case 'size':
        return this.size(contexts, policy);
      case 'hybrid':
        return this.hybrid(contexts, policy);
      default:
        return [];
    }
  }
}