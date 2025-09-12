import { MemoryNode, MemoryGraph, WeightedExplorationScore } from './interfaces';

export class MemoryCore {
  private graph: MemoryGraph;
  private decayRate: number; // Rate at which memory strength decays

  constructor(decayRate: number = 0.01) {
    this.graph = {
      nodes: new Map(),
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        version: '1.0.0',
        nodeCount: 0,
        connectionCount: 0
      }
    };
    this.decayRate = decayRate;
  }

  addNode(node: MemoryNode): void {
    this.graph.nodes.set(node.id, node);
    this.graph.metadata.nodeCount++;
    this.graph.metadata.lastModified = new Date();
  }

  getNode(nodeId: string): MemoryNode | undefined {
    const node = this.graph.nodes.get(nodeId);
    if (node) {
      this.updateNodeAccess(node);
    }
    return node;
  }

  connectNodes(sourceId: string, targetId: string, connectionType: string, strength: number = 1.0): void {
    const sourceNode = this.graph.nodes.get(sourceId);
    const targetNode = this.graph.nodes.get(targetId);
    
    if (!sourceNode || !targetNode) {
      throw new Error('One or both nodes not found');
    }

    if (!sourceNode.connections[targetId]) {
      sourceNode.connections[targetId] = {
        strength,
        type: connectionType as any,
        lastTraversed: new Date()
      };
      this.graph.metadata.connectionCount++;
    } else {
      // Update existing connection
      sourceNode.connections[targetId].strength = strength;
      sourceNode.connections[targetId].lastTraversed = new Date();
    }
    
    this.graph.metadata.lastModified = new Date();
  }

  removeNode(nodeId: string): boolean {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return false;
    
    // Remove all connections to this node
    for (const [id, n] of this.graph.nodes.entries()) {
      if (n.connections[nodeId]) {
        delete n.connections[nodeId];
        this.graph.metadata.connectionCount--;
      }
    }
    
    // Remove the node itself
    this.graph.nodes.delete(nodeId);
    this.graph.metadata.nodeCount--;
    this.graph.metadata.lastModified = new Date();
    
    return true;
  }

  breadthFirstExploration(startNodeId: string, maxDepth: number = 3): string[] {
    const visited = new Set<string>();
    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startNodeId, depth: 0 }];
    const result: string[] = [];
    
    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;
      
      if (visited.has(nodeId) || depth > maxDepth) continue;
      visited.add(nodeId);
      
      if (depth > 0) { // Don't include the start node
        result.push(nodeId);
      }
      
      const node = this.graph.nodes.get(nodeId);
      if (node) {
        for (const connectedNodeId of Object.keys(node.connections)) {
          if (!visited.has(connectedNodeId)) {
            queue.push({ nodeId: connectedNodeId, depth: depth + 1 });
          }
        }
      }
    }
    
    return result;
  }

  strengthBasedExploration(contextNodes: string[]): WeightedExplorationScore[] {
    const scores: WeightedExplorationScore[] = [];
    
    for (const [nodeId, node] of this.graph.nodes.entries()) {
      if (contextNodes.includes(nodeId)) continue; // Skip context nodes
      
      let totalConnectionStrength = 0;
      let connectionCount = 0;
      
      // Calculate connection strength to context nodes
      for (const contextNodeId of contextNodes) {
        const contextNode = this.graph.nodes.get(contextNodeId);
        if (contextNode && contextNode.connections[nodeId]) {
          totalConnectionStrength += contextNode.connections[nodeId].strength;
          connectionCount++;
        }
      }
      
      const avgConnectionStrength = connectionCount > 0 ? totalConnectionStrength / connectionCount : 0;
      
      scores.push({
        nodeId,
        score: avgConnectionStrength * node.metadata.strength,
        factors: {
          relevance: avgConnectionStrength,
          strength: node.metadata.strength,
          recency: this.calculateRecencyScore(node),
          context: connectionCount
        }
      });
    }
    
    return scores.sort((a, b) => b.score - a.score);
  }

  recencyBasedExploration(): string[] {
    return Array.from(this.graph.nodes.values())
      .sort((a, b) => b.metadata.lastAccessed.getTime() - a.metadata.lastAccessed.getTime())
      .map(node => node.id);
  }

  applyTemporalDecay(): void {
    const now = Date.now();
    
    for (const node of this.graph.nodes.values()) {
      const timeDiffHours = (now - node.metadata.lastAccessed.getTime()) / (1000 * 60 * 60);
      const decayAmount = this.decayRate * timeDiffHours;
      
      node.metadata.strength = Math.max(0, node.metadata.strength - decayAmount);
      
      // Also decay connection strengths
      for (const connectionId in node.connections) {
        const timeDiffConnHours = (now - node.connections[connectionId].lastTraversed.getTime()) / (1000 * 60 * 60);
        const connectionDecayAmount = this.decayRate * timeDiffConnHours * 0.5; // Connections decay slower
        
        node.connections[connectionId].strength = Math.max(
          0, 
          node.connections[connectionId].strength - connectionDecayAmount
        );
      }
    }
    
    this.graph.metadata.lastModified = new Date();
  }

  private updateNodeAccess(node: MemoryNode): void {
    node.metadata.lastAccessed = new Date();
    node.metadata.accessCount++;
    
    // Strengthen the node slightly with each access
    node.metadata.strength = Math.min(1, node.metadata.strength + 0.05);
  }

  private calculateRecencyScore(node: MemoryNode): number {
    const hoursSinceAccess = (Date.now() - node.metadata.lastAccessed.getTime()) / (1000 * 60 * 60);
    // More recent = higher score (closer to 1)
    return Math.max(0, 1 - (hoursSinceAccess / 168)); // 168 hours = 1 week
  }

  getGraph(): MemoryGraph {
    return { ...this.graph, nodes: new Map(this.graph.nodes) };
  }
}
