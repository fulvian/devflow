/**
 * DevFlow Cognitive Mapping Engine - Phase 2
 * 
 * This module integrates all cognitive mapping components:
 * - Mental Map Construction from codebase AST analysis
 * - Navigation Engine with human-like exploration patterns  
 * - PageRank importance calculation for landmark nodes
 * - Neo4j graph database integration
 * - Activity Registry System for development pattern tracking
 */

// Core Types and Interfaces
export * from './types';

// Database Adapter
export { Neo4jAdapter } from './neo4j-adapter';

// Mental Map Construction
export { 
  MentalMapConstructor, 
  VectorSimilarityEngine, 
  ASTParser, 
  WorkingMemoryCache 
} from './mental-map-constructor';

// Navigation Engine  
export { NavigationEngine } from './navigation-engine';

// PageRank Engine
export { PageRankEngine } from './pagerank-engine';

import { CognitiveMapConfig, Graph, MentalMap, Neo4jConfig } from './types';
import { Neo4jAdapter } from './neo4j-adapter';
import { MentalMapConstructor, VectorSimilarityEngine, ASTParser } from './mental-map-constructor';
import { NavigationEngine } from './navigation-engine';
import { PageRankEngine } from './pagerank-engine';

/**
 * Main Cognitive Mapping System orchestrator
 */
export class CognitiveMappingSystem {
  private neo4jAdapter: Neo4jAdapter;
  private mentalMapConstructor: MentalMapConstructor;
  private navigationEngine: NavigationEngine;
  private pageRankEngine: PageRankEngine;

  constructor(
    neo4jConfig: Neo4jConfig
  ) {
    // Initialize components
    this.neo4jAdapter = new Neo4jAdapter(neo4jConfig);
    
    const vectorEngine = new VectorSimilarityEngine();
    const astParser = new ASTParser();
    this.mentalMapConstructor = new MentalMapConstructor(vectorEngine, astParser);
    
    this.navigationEngine = new NavigationEngine();
    this.pageRankEngine = new PageRankEngine();
  }

  /**
   * Initialize the cognitive mapping system
   */
  async initialize(): Promise<void> {
    await this.neo4jAdapter.connect();
  }

  /**
   * Build cognitive map from source code
   * @param sourceCode - Source code to analyze
   * @param moduleId - Module identifier
   * @returns Constructed mental map
   */
  async buildCognitiveMap(sourceCode: string, moduleId: string): Promise<MentalMap> {
    return await this.mentalMapConstructor.constructMentalMap(sourceCode, moduleId);
  }

  /**
   * Navigate through cognitive map
   * @param mentalMap - Mental map to navigate
   * @param startNodeId - Starting node
   * @param context - Navigation context
   * @returns Navigation path
   */
  async navigateMap(mentalMap: MentalMap, startNodeId: string, context: any) {
    return await this.navigationEngine.associativeTraversal(mentalMap, startNodeId, context);
  }

  /**
   * Shutdown system and close connections
   */
  async shutdown(): Promise<void> {
    await this.neo4jAdapter.disconnect();
  }
}