import { Graph, Node, MentalMap } from './types';

export interface NavigationOptions {
  avoidNodes?: string[];
  preferredPaths?: string[];
  maxHops?: number;
}

export interface NavigationPath {
  path: Node[];
  distance: number;
  estimatedTime: number;
}

export interface PathfindingResult {
  success: boolean;
  path?: NavigationPath;
  error?: string;
}

export class NavigationEngine {
  private normalizeId(id: string): string {
    return id.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  async associativeTraversal(mentalMap: MentalMap, startNodeId: string, context: any): Promise<NavigationPath> {
    const normalizedId = this.normalizeId(startNodeId);
    const startNode = mentalMap.nodes.find(n => 
      this.normalizeId(n.id) === normalizedId || 
      this.normalizeId(n.label) === normalizedId
    );
    
    if (!startNode) {
      throw new Error(`Start node ${startNodeId} not found (tried normalized: ${normalizedId})`);
    }

    return {
      path: [startNode],
      distance: 0,
      estimatedTime: 0
    };
  }

  async findPath(
    graph: Graph,
    startNodeId: string,
    endNodeId: string,
    options: NavigationOptions = {}
  ): Promise<PathfindingResult> {
    const path = this.bfs(graph, startNodeId, endNodeId, options);
    
    if (path) {
      return {
        success: true,
        path: {
          path,
          distance: path.length - 1,
          estimatedTime: (path.length - 1) * 2
        }
      };
    } else {
      return {
        success: false,
        error: 'No path found between nodes'
      };
    }
  }

  private bfs(
    graph: Graph,
    startId: string,
    endId: string,
    options: NavigationOptions
  ): Node[] | null {
    const visited = new Set<string>();
    const queue: { node: Node; path: Node[] }[] = [];
    
    const startNode = graph.nodes.find(n => n.id === startId);
    if (!startNode) return null;
    
    queue.push({ node: startNode, path: [startNode] });
    visited.add(startId);
    
    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      
      if (node.id === endId) {
        return path;
      }
      
      const neighbors = this.getNeighbors(graph, node.id, options);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push({ node: neighbor, path: [...path, neighbor] });
        }
      }
    }
    
    return null;
  }

  private getNeighbors(graph: Graph, nodeId: string, options: NavigationOptions): Node[] {
    const avoidNodes = new Set(options.avoidNodes || []);
    
    return graph.edges
      .filter(edge => edge.source === nodeId && !avoidNodes.has(edge.target))
      .map(edge => graph.nodes.find(n => n.id === edge.target))
      .filter((node): node is Node => node !== undefined);
  }
}