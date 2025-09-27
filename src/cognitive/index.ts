/**
 * Cognitive System - Main Module
 * Orchestrates cognitive mapping, exploration, and memory systems
 */

// Import all cognitive components
import { CognitiveMapper } from './cognitive-mapper';
import { ExplorationEngine } from './exploration-engine'; 
import { ContextEngine } from './context-engine';
import { PersistenceLayer } from './persistence-layer';
import { CognitiveMemorySystem } from './cognitive-memory-system';

// Export all components
export { CognitiveMapper } from './cognitive-mapper';
export { ExplorationEngine } from './exploration-engine';
export { ContextEngine } from './context-engine';
export { PersistenceLayer } from './persistence-layer';
export { CognitiveMemorySystem } from './cognitive-memory-system';

// Export types from other modules
export * from './types';

// Main cognitive system orchestrator
export class CognitiveSystem {
  private mapper: CognitiveMapper;
  private explorer: ExplorationEngine;
  private contextEngine: ContextEngine;
  private persistence: PersistenceLayer;
  private memory: CognitiveMemorySystem;

  constructor() {
    this.mapper = new CognitiveMapper();
    this.explorer = new ExplorationEngine();
    this.contextEngine = new ContextEngine();
    this.persistence = new PersistenceLayer();
    this.memory = new CognitiveMemorySystem();
  }

  async process(input: any): Promise<any> {
    const mapped = this.mapper.map(input);
    const explored = this.explorer.explore(mapped);
    const context = this.contextEngine.analyzeContext(explored);
    
    // Store in memory
    const key = `process-${Date.now()}`;
    this.memory.store(key, context);
    
    // Persist if needed
    await this.persistence.save(context);
    
    return context;
  }

  getMemory(): CognitiveMemorySystem {
    return this.memory;
  }
}