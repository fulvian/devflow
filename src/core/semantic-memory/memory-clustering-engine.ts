/**
 * MemoryClusteringEngine - Semantic content organization using K-means clustering
 * Automatically organizes project memories into semantic clusters
 * Provides optimal cluster detection and dynamic re-clustering capabilities
 */

import { SemanticMemoryEngine, MemoryRecord } from './semantic-memory-engine';
import { OllamaEmbeddingService } from './ollama-embedding-service';
import { DatabaseAdapter } from './database-adapter';

export interface MemoryCluster {
  id: number;
  projectId: number;
  clusterName: string;
  centroid: number[];
  memoryIds: number[];
  relevanceScore: number;
  clusterSize: number;
  lastUpdated: Date;
  createdAt: Date;
}

export interface ClusterAnalysis {
  optimalClusterCount: number;
  silhouetteScore: number;
  intraClusterVariance: number;
  interClusterDistance: number;
}

export interface ClusteringOptions {
  minClusters?: number;
  maxClusters?: number;
  maxIterations?: number;
  convergenceThreshold?: number;
  minClusterSize?: number;
}

export class MemoryClusteringEngine {
  private memoryEngine: SemanticMemoryEngine;
  private embedding: OllamaEmbeddingService;
  private db: DatabaseAdapter;

  constructor() {
    this.memoryEngine = new SemanticMemoryEngine();
    this.embedding = new OllamaEmbeddingService();
    this.db = new DatabaseAdapter();
  }

  /**
   * Perform K-means clustering on project memories
   */
  async clusterProjectMemories(projectId: number, options?: ClusteringOptions): Promise<MemoryCluster[]> {
    try {
      const memories = await this.memoryEngine.getProjectMemories(projectId);

      if (memories.length < 2) {
        return []; // Need at least 2 memories to cluster
      }

      const embeddings = memories.map(m => m.embeddingVector);
      const optimalK = await this.findOptimalClusterCount(embeddings, options);

      const clusterAssignments = await this.performKMeansClustering(
        embeddings,
        optimalK,
        options
      );

      return await this.createClustersFromAssignments(
        projectId,
        memories,
        clusterAssignments,
        optimalK
      );

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Memory clustering failed: ${message}`);
    }
  }

  /**
   * Find optimal number of clusters using elbow method
   */
  private async findOptimalClusterCount(
    embeddings: number[][],
    options?: ClusteringOptions
  ): Promise<number> {
    const minK = options?.minClusters || 2;
    const maxK = Math.min(options?.maxClusters || 8, Math.floor(embeddings.length / 2));

    const inertias: number[] = [];

    for (let k = minK; k <= maxK; k++) {
      const assignments = await this.performKMeansClustering(embeddings, k, options);
      const inertia = this.calculateInertia(embeddings, assignments.centroids, assignments.assignments);
      inertias.push(inertia);
    }

    return this.findElbowPoint(inertias) + minK;
  }

  /**
   * Perform K-means clustering algorithm
   */
  private async performKMeansClustering(
    embeddings: number[][],
    k: number,
    options?: ClusteringOptions
  ): Promise<{ centroids: number[][], assignments: number[] }> {
    const maxIterations = options?.maxIterations || 100;
    const convergenceThreshold = options?.convergenceThreshold || 0.001;

    // Initialize centroids randomly
    let centroids = this.initializeRandomCentroids(embeddings, k);
    let assignments = new Array(embeddings.length).fill(0);
    let previousCentroids = centroids.map(c => [...c]);

    for (let iter = 0; iter < maxIterations; iter++) {
      // Assign points to nearest centroid
      for (let i = 0; i < embeddings.length; i++) {
        assignments[i] = await this.findNearestCentroid(embeddings[i], centroids);
      }

      // Update centroids
      centroids = this.updateCentroids(embeddings, assignments, k);

      // Check for convergence
      const centroidDistance = this.calculateCentroidDistance(centroids, previousCentroids);
      if (centroidDistance < convergenceThreshold) {
        break;
      }

      previousCentroids = centroids.map(c => [...c]);
    }

    return { centroids, assignments };
  }

  /**
   * Initialize random centroids
   */
  private initializeRandomCentroids(embeddings: number[][], k: number): number[][] {
    const centroids: number[][] = [];
    const used = new Set<number>();

    while (centroids.length < k && used.size < embeddings.length) {
      const randomIndex = Math.floor(Math.random() * embeddings.length);
      if (!used.has(randomIndex)) {
        centroids.push([...embeddings[randomIndex]]);
        used.add(randomIndex);
      }
    }

    return centroids;
  }

  /**
   * Find nearest centroid for a point
   */
  private async findNearestCentroid(point: number[], centroids: number[][]): Promise<number> {
    let minDistance = Infinity;
    let nearestCentroid = 0;

    for (let i = 0; i < centroids.length; i++) {
      const similarity = await this.embedding.calculateSimilarity(point, centroids[i]);
      const distance = 1 - similarity; // Convert similarity to distance

      if (distance < minDistance) {
        minDistance = distance;
        nearestCentroid = i;
      }
    }

    return nearestCentroid;
  }

  /**
   * Update centroids based on assignments
   */
  private updateCentroids(embeddings: number[][], assignments: number[], k: number): number[][] {
    const newCentroids: number[][] = [];

    for (let i = 0; i < k; i++) {
      const clusterPoints = embeddings.filter((_, index) => assignments[index] === i);

      if (clusterPoints.length === 0) {
        // Empty cluster, keep previous centroid or reinitialize
        newCentroids.push(new Array(embeddings[0].length).fill(0));
        continue;
      }

      // Calculate mean of cluster points
      const centroid = new Array(embeddings[0].length).fill(0);
      for (const point of clusterPoints) {
        for (let j = 0; j < point.length; j++) {
          centroid[j] += point[j];
        }
      }

      for (let j = 0; j < centroid.length; j++) {
        centroid[j] /= clusterPoints.length;
      }

      newCentroids.push(centroid);
    }

    return newCentroids;
  }

  /**
   * Calculate inertia (within-cluster sum of squared distances)
   */
  private calculateInertia(
    embeddings: number[][],
    centroids: number[][],
    assignments: number[]
  ): number {
    let inertia = 0;

    for (let i = 0; i < embeddings.length; i++) {
      const centroid = centroids[assignments[i]];
      const distance = this.calculateEuclideanDistance(embeddings[i], centroid);
      inertia += distance * distance;
    }

    return inertia;
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private calculateEuclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }

  /**
   * Find elbow point in inertia curve
   */
  private findElbowPoint(inertias: number[]): number {
    if (inertias.length < 3) return 0;

    let maxImprovement = 0;
    let elbowIndex = 0;

    for (let i = 1; i < inertias.length - 1; i++) {
      const improvement = inertias[i - 1] - inertias[i];
      const nextImprovement = inertias[i] - inertias[i + 1];
      const improvementDrop = improvement - nextImprovement;

      if (improvementDrop > maxImprovement) {
        maxImprovement = improvementDrop;
        elbowIndex = i;
      }
    }

    return elbowIndex;
  }

  /**
   * Calculate distance between centroid sets
   */
  private calculateCentroidDistance(centroids1: number[][], centroids2: number[][]): number {
    let totalDistance = 0;

    for (let i = 0; i < centroids1.length; i++) {
      totalDistance += this.calculateEuclideanDistance(centroids1[i], centroids2[i]);
    }

    return totalDistance / centroids1.length;
  }

  /**
   * Create cluster records from assignments
   */
  private async createClustersFromAssignments(
    projectId: number,
    memories: MemoryRecord[],
    clusterResult: { centroids: number[][], assignments: number[] },
    k: number
  ): Promise<MemoryCluster[]> {
    const clusters: MemoryCluster[] = [];

    for (let i = 0; i < k; i++) {
      const clusterMemories = memories.filter((_, index) => clusterResult.assignments[index] === i);

      if (clusterMemories.length === 0) continue;

      const clusterName = this.generateClusterName(clusterMemories, i);
      const relevanceScore = this.calculateClusterRelevance(clusterMemories);

      // Store cluster in database
      const clusterId = await this.storeClustersInDatabase(
        projectId,
        clusterName,
        clusterResult.centroids[i],
        clusterMemories.map(m => m.id),
        relevanceScore
      );

      clusters.push({
        id: clusterId,
        projectId,
        clusterName,
        centroid: clusterResult.centroids[i],
        memoryIds: clusterMemories.map(m => m.id),
        relevanceScore,
        clusterSize: clusterMemories.length,
        lastUpdated: new Date(),
        createdAt: new Date()
      });
    }

    return clusters;
  }

  /**
   * Generate meaningful cluster name based on content
   */
  private generateClusterName(memories: MemoryRecord[], clusterIndex: number): string {
    const contentTypes = Array.from(new Set(memories.map(m => m.contentType)));
    const primaryType = contentTypes[0] || 'general';

    if (contentTypes.length === 1) {
      return `${primaryType}-cluster-${clusterIndex + 1}`;
    }

    return `mixed-${primaryType}-cluster-${clusterIndex + 1}`;
  }

  /**
   * Calculate cluster relevance based on memory characteristics
   */
  private calculateClusterRelevance(memories: MemoryRecord[]): number {
    // Simple relevance calculation based on recency and content diversity
    const recencyScore = memories.reduce((sum, m) => {
      const ageInDays = (Date.now() - m.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return sum + Math.max(0, 1 - ageInDays / 30); // Decay over 30 days
    }, 0) / memories.length;

    return Math.min(recencyScore, 1.0);
  }

  /**
   * Store cluster in database
   */
  private async storeClustersInDatabase(
    projectId: number,
    clusterName: string,
    centroid: number[],
    memoryIds: number[],
    relevanceScore: number
  ): Promise<number> {
    const query = `
      INSERT INTO project_memory_clusters
      (project_id, cluster_name, cluster_centroid, memory_ids,
       relevance_score, cluster_size)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const centroidBuffer = Buffer.alloc(centroid.length * 4);
    for (let i = 0; i < centroid.length; i++) {
      centroidBuffer.writeFloatBE(centroid[i], i * 4);
    }

    const params = [
      projectId,
      clusterName,
      centroidBuffer,
      JSON.stringify(memoryIds),
      relevanceScore,
      memoryIds.length
    ];

    const result = await this.db.run(query, params);
    return result.lastID!;
  }
}