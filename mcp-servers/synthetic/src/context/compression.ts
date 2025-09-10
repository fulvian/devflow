import { ContextEntry, CompressionResult } from './types';

export class ContextCompressor {
  static compress(context: ContextEntry): CompressionResult {
    try {
      // Simple JSON compression - in production, use actual compression algorithm
      const originalData = JSON.stringify(context.data);
      const originalSize = Buffer.byteLength(originalData, 'utf8');
      
      // Simulate compression (in real implementation, use zlib or similar)
      const compressedData = this.simpleCompress(context.data);
      const compressedString = JSON.stringify(compressedData);
      const compressedSize = Buffer.byteLength(compressedString, 'utf8');
      
      // Update context with compressed data
      context.data = compressedData;
      context.size = compressedSize;
      
      return {
        originalSize,
        compressedSize,
        compressionRatio: compressedSize / originalSize,
        contextId: context.id
      };
    } catch (error) {
      console.error(`Compression failed for context ${context.id}:`, error);
      return {
        originalSize: context.size,
        compressedSize: context.size,
        compressionRatio: 1,
        contextId: context.id
      };
    }
  }

  static decompress(context: ContextEntry): ContextEntry {
    try {
      // Decompress if data was compressed
      if (context.data && typeof context.data === 'object' && context.data._compressed) {
        const decompressedData = this.simpleDecompress(context.data);
        const decompressedSize = Buffer.byteLength(JSON.stringify(decompressedData), 'utf8');
        
        return {
          ...context,
          data: decompressedData,
          size: decompressedSize
        };
      }
      return context;
    } catch (error) {
      console.error(`Decompression failed for context ${context.id}:`, error);
      return context;
    }
  }

  // Simple compression simulation - replace with actual implementation
  private static simpleCompress(data: any): any {
    // In a real implementation, use zlib or similar
    // This is just a placeholder that reduces size slightly
    if (typeof data === 'string') {
      return { _compressed: true, data: data.replace(/\s+/g, ' ') };
    } else if (typeof data === 'object' && data !== null) {
      const jsonString = JSON.stringify(data);
      return { _compressed: true, data: jsonString.replace(/\s+/g, ' ') };
    }
    return data;
  }

  private static simpleDecompress(compressedData: any): any {
    if (compressedData._compressed) {
      try {
        // If it's a compressed JSON string, parse it
        if (typeof compressedData.data === 'string' && compressedData.data.startsWith('{')) {
          return JSON.parse(compressedData.data);
        }
        return compressedData.data;
      } catch {
        return compressedData.data;
      }
    }
    return compressedData;
  }
}