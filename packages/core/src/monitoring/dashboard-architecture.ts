// src/data-collection/collector.ts
import { EventEmitter } from 'events';
import { PerformanceMetrics, ErrorData, SystemStatus } from '../types';

/**
 * DataCollector - Collects metrics from the CCR fallback system
 */
export class DataCollector extends EventEmitter {
  private collectionInterval: NodeJS.Timeout | null = null;
  private isCollecting: boolean = false;

  constructor() {
    super();
  }

  /**
   * Start collecting metrics at specified interval
   * @param interval Collection interval in milliseconds
   */
  startCollection(interval: number = 5000): void {
    if (this.isCollecting) return;
    
    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);
  }

  /**
   * Stop collecting metrics
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      this.isCollecting = false;
    }
  }

  /**
   * Collect metrics from the system
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Simulate collecting performance metrics
      const performanceMetrics: PerformanceMetrics = {
        timestamp: Date.now(),
        responseTime: Math.random() * 200, // ms
        throughput: Math.floor(Math.random() * 1000), // requests/sec
        errorRate: Math.random() * 5, // percentage
        cpuUsage: Math.random() * 100, // percentage
        memoryUsage: Math.random() * 100, // percentage
        activeConnections: Math.floor(Math.random() * 1000)
      };

      // Simulate collecting error data
      const errorData: ErrorData = {
        timestamp: Date.now(),
        errorCode: Math.floor(Math.random() * 1000),
        errorMessage: `Error ${Math.floor(Math.random() * 1000)}`,
        severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
        source: ['primary', 'fallback'][Math.floor(Math.random() * 2)] as 'primary' | 'fallback'
      };

      // Simulate collecting system status
      const systemStatus: SystemStatus = {
        timestamp: Date.now(),
        primarySystem: Math.random() > 0.1 ? 'operational' : 'degraded',
        fallbackSystem: Math.random() > 0.05 ? 'operational' : 'degraded',
        lastFailover: Math.random() > 0.8 ? Date.now() - Math.floor(Math.random() * 3600000) : null
      };

      // Emit collected data
      this.emit('metrics', performanceMetrics);
      this.emit('error', errorData);
      this.emit('status', systemStatus);
    } catch (error) {
      this.emit('collectionError', error);
    }
  }

  /**
   * Force immediate collection of metrics
   */
  collectNow(): void {
    this.collectMetrics();
  }
}