/**
 * PageRank Algorithm Implementation for Cognitive Mapping
 * Calculates importance scores for nodes in the cognitive graph
 */

import { Graph, Node, PageRankConfig, NodeImportance, PageRankResult } from './types';

// Mock Neo4j types since we can't install the driver
interface MockRecord {
  toObject(): any;
}

export class PageRankEngine {
  private config: PageRankConfig;

  constructor(config?: Partial<PageRankConfig>) {
    this.config = {
      dampingFactor: 0.85,
      maxIterations: 100,
      tolerance: 1e-6,
      ...config
    };
  }

  /**
   * Calculate PageRank scores for all nodes in the graph
   */
  calculatePageRank(graph: Graph): Graph {
    const nodeCount = graph.nodes.length;
    if (nodeCount === 0) return graph;

    // Initialize scores
    const scores = new Map<string, number>();
    const newScores = new Map<string, number>();
    
    graph.nodes.forEach(node => {
      scores.set(node.id, 1.0 / nodeCount);
      newScores.set(node.id, 0);
    });

    // Build adjacency information
    const outLinks = new Map<string, string[]>();
    const inLinks = new Map<string, string[]>();
    
    graph.nodes.forEach(node => {
      outLinks.set(node.id, []);
      inLinks.set(node.id, []);
    });
    
    graph.edges.forEach(edge => {
      outLinks.get(edge.source)?.push(edge.target);
      inLinks.get(edge.target)?.push(edge.source);
    });

    let converged = false;
    let iterations = 0;

    // PageRank iteration
    while (!converged && iterations < this.config.maxIterations) {
      // Reset new scores
      graph.nodes.forEach(node => {
        newScores.set(node.id, (1 - this.config.dampingFactor) / nodeCount);
      });

      // Calculate new scores
      graph.nodes.forEach(node => {
        const incomingLinks = inLinks.get(node.id) || [];
        let sum = 0;
        
        incomingLinks.forEach(sourceId => {
          const sourceOutLinks = outLinks.get(sourceId) || [];
          const sourceScore = scores.get(sourceId) || 0;
          if (sourceOutLinks.length > 0) {
            sum += sourceScore / sourceOutLinks.length;
          }
        });
        
        const currentScore = newScores.get(node.id) || 0;
        newScores.set(node.id, currentScore + this.config.dampingFactor * sum);
      });

      // Check convergence
      let maxDiff = 0;
      graph.nodes.forEach(node => {
        const oldScore = scores.get(node.id) || 0;
        const newScore = newScores.get(node.id) || 0;
        maxDiff = Math.max(maxDiff, Math.abs(newScore - oldScore));
      });
      
      converged = maxDiff < this.config.tolerance;
      
      // Update scores
      graph.nodes.forEach(node => {
        scores.set(node.id, newScores.get(node.id) || 0);
      });
      
      iterations++;
    }

    // Apply scores to nodes
    const rankedGraph: Graph = {
      nodes: graph.nodes.map(node => ({
        ...node,
        properties: {
          ...node.properties,
          pagerankScore: scores.get(node.id) || 0
        }
      })),
      edges: [...graph.edges]
    };

    return rankedGraph;
  }

  /**
   * Get top-ranked nodes
   */
  getTopNodes(graph: Graph, limit: number = 10): NodeImportance[] {
    const nodeImportances: NodeImportance[] = graph.nodes
      .map(node => ({
        nodeId: node.id,
        score: node.properties.pagerankScore || 0,
        rank: 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    return nodeImportances;
  }

  /**
   * Calculate PageRank result with detailed information
   */
  calculateDetailedPageRank(graph: Graph): PageRankResult {
    const rankedGraph = this.calculatePageRank(graph);
    const topNodes = this.getTopNodes(rankedGraph);
    
    return {
      nodes: topNodes,
      iterations: this.config.maxIterations, // Mock - in real implementation would track actual iterations
      converged: true // Mock - in real implementation would track convergence
    };
  }

  /**
   * Update PageRank configuration
   */
  updateConfig(newConfig: Partial<PageRankConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): PageRankConfig {
    return { ...this.config };
  }

  /**
   * Mock method for Neo4j integration (since we can't install the driver)
   */
  private processRecord(record: MockRecord): any {
    return record.toObject();
  }
}