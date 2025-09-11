/**
 * Calculates cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same dimensions');
  }
  
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Optimized batch cosine similarity for performance
 */
export function batchCosineSimilarity(query: number[], vectors: number[][]): number[] {
  const queryMagnitude = Math.sqrt(query.reduce((sum, val) => sum + val * val, 0));
  
  return vectors.map(vec => {
    const dotProduct = query.reduce((sum, q, i) => sum + q * vec[i], 0);
    const vecMagnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    
    if (queryMagnitude === 0 || vecMagnitude === 0) return 0;
    
    return dotProduct / (queryMagnitude * vecMagnitude);
  });
}