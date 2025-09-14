/**
 * Metrics Collection System for CCR Fallback Operations
 * Task ID: CCR-010-METRICS-COLLECTION
 * 
 * This module provides comprehensive metrics collection capabilities for CCR fallback operations,
 * including performance tracking, error monitoring, and data aggregation services.
 */

// Interfaces for type safety
interface MetricsConfig {
  serviceName: string;
  collectionInterval?: number;
  bufferSize?: number;
  enableStreaming?: boolean;
}

interface MetricData {
  timestamp: number;
  operation: string;
  duration: number;
  success: boolean;
  context: Record<string, any>;
  error?: string;
}

interface AggregatedMetrics {
  totalOperations: number;
  successRate: number;
  averageDuration: number;
  errorRate: number;
  errorBreakdown: Record<string, number>;
  timestamp: number;
}

interface StreamingEvent {
  type: 'metric' | 'aggregation' | 'error';
  data: MetricData | AggregatedMetrics | ErrorEvent;
  timestamp: number;
}

interface ErrorEvent {
  operation: string;
  error: string;
  context: Record<string, any>;
  timestamp: number;
}

// Main Metrics Collection Class
class MetricsCollector {
  private config: MetricsConfig;
  private metricsBuffer: MetricData[] = [];
  private aggregatedMetrics: AggregatedMetrics | null = null;
  private streamingCallbacks: Array<(event: StreamingEvent) => void> = [];
  private collectionTimer: NodeJS.Timeout | null = null;
  private isCollecting: boolean = false;

  constructor(config: MetricsConfig) {
    this.config = {
      collectionInterval: 60000, // 1 minute default
      bufferSize: 1000,
      enableStreaming: false,
      ...config
    };
  }

  /**
   * Start metrics collection process
   */
  public start(): void {
    if (this.isCollecting) {
      console.warn('Metrics collection is already running');
      return;
    }

    this.isCollecting = true;
    this.collectionTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.config.collectionInterval);

    console.log(`Metrics collection started for service: ${this.config.serviceName}`);
  }

  /**
   * Stop metrics collection process
   */
  public stop(): void {
    if (!this.isCollecting) {
      console.warn('Metrics collection is not running');
      return;
    }

    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    this.isCollecting = false;
    console.log(`Metrics collection stopped for service: ${this.config.serviceName}`);
  }

  /**
   * Record a metric for an operation
   * @param operation Name of the operation
   * @param duration Duration in milliseconds
   * @param success Whether the operation was successful
   * @param context Additional context information
   * @param error Error message if operation failed
   */
  public recordMetric(
    operation: string,
    duration: number,
    success: boolean,
    context: Record<string, any> = {},
    error?: string
  ): void {
    const metric: MetricData = {
      timestamp: Date.now(),
      operation,
      duration,
      success,
      context,
      ...(error && { error })
    };

    // Add to buffer
    this.metricsBuffer.push(metric);

    // Trim buffer if it exceeds size limit
    if (this.metricsBuffer.length > this.config.bufferSize) {
      this.metricsBuffer.shift();
    }

    // Stream if enabled
    if (this.config.enableStreaming) {
      this.streamEvent({
        type: 'metric',
        data: metric,
        timestamp: metric.timestamp
      });
    }

    // Stream error events separately
    if (!success && error) {
      this.streamEvent({
        type: 'error',
        data: {
          operation,
          error,
          context,
          timestamp: metric.timestamp
        } as ErrorEvent,
        timestamp: metric.timestamp
      });
    }
  }

  /**
   * Register a callback for real-time metrics streaming
   * @param callback Function to call when events are streamed
   */
  public onStream(callback: (event: StreamingEvent) => void): void {
    this.streamingCallbacks.push(callback);
  }

  /**
   * Get current aggregated metrics
   */
  public getAggregatedMetrics(): AggregatedMetrics | null {
    return this.aggregatedMetrics;
  }

  /**
   * Get raw metrics data
   */
  public getRawMetrics(): MetricData[] {
    return [...this.metricsBuffer];
  }

  /**
   * Clear all collected metrics
   */
  public clearMetrics(): void {
    this.metricsBuffer = [];
    this.aggregatedMetrics = null;
  }

  /**
   * Aggregate metrics from the buffer
   */
  private aggregateMetrics(): void {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const now = Date.now();
    const totalOperations = this.metricsBuffer.length;
    const successfulOperations = this.metricsBuffer.filter(m => m.success).length;
    const failedOperations = totalOperations - successfulOperations;
    
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;
    const errorRate = totalOperations > 0 ? (failedOperations / totalOperations) * 100 : 0;
    
    const totalDuration = this.metricsBuffer.reduce((sum, metric) => sum + metric.duration, 0);
    const averageDuration = totalOperations > 0 ? totalDuration / totalOperations : 0;

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    this.metricsBuffer
      .filter(m => !m.success && m.error)
      .forEach(m => {
        const errorKey = m.error || 'unknown';
        errorBreakdown[errorKey] = (errorBreakdown[errorKey] || 0) + 1;
      });

    this.aggregatedMetrics = {
      totalOperations,
      successRate,
      averageDuration,
      errorRate,
      errorBreakdown,
      timestamp: now
    };

    // Stream aggregation event
    if (this.config.enableStreaming) {
      this.streamEvent({
        type: 'aggregation',
        data: this.aggregatedMetrics,
        timestamp: now
      });
    }

    console.log(`Aggregated metrics for ${this.config.serviceName}:`, this.aggregatedMetrics);
  }

  /**
   * Stream event to all registered callbacks
   * @param event Event to stream
   */
  private streamEvent(event: StreamingEvent): void {
    this.streamingCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in metrics streaming callback:', error);
      }
    });
  }
}

// Performance Tracking Utilities
class PerformanceTracker {
  private startTime: number | null = null;
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Start tracking performance for an operation
   */
  public start(): void {
    this.startTime = performance.now();
  }

  /**
   * End tracking and record the metric
   * @param operation Name of the operation
   * @param success Whether the operation was successful
   * @param context Additional context information
   * @param error Error message if operation failed
   */
  public end(
    operation: string,
    success: boolean,
    context: Record<string, any> = {},
    error?: string
  ): void {
    if (this.startTime === null) {
      console.warn('Performance tracking not started for operation:', operation);
      return;
    }

    const duration = performance.now() - this.startTime;
    this.metricsCollector.recordMetric(operation, duration, success, context, error);
    this.startTime = null;
  }
}

// Event Logging Framework
class EventLogger {
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Log a custom event
   * @param eventName Name of the event
   * @param properties Event properties
   */
  public logEvent(eventName: string, properties: Record<string, any> = {}): void {
    this.metricsCollector.recordMetric(
      eventName,
      0, // Duration not applicable for events
      true, // Events are considered successful
      properties
    );
  }

  /**
   * Log an error event
   * @param operation Operation that failed
   * @param error Error message
   * @param context Additional context
   */
  public logError(operation: string, error: string, context: Record<string, any> = {}): void {
    this.metricsCollector.recordMetric(
      operation,
      0, // Duration not applicable for error logging
      false,
      context,
      error
    );
  }
}

// Data Aggregation Services
class DataAggregator {
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Get operation success rate
   */
  public getSuccessRate(): number {
    const metrics = this.metricsCollector.getAggregatedMetrics();
    return metrics ? metrics.successRate : 0;
  }

  /**
   * Get average operation duration
   */
  public getAverageDuration(): number {
    const metrics = this.metricsCollector.getAggregatedMetrics();
    return metrics ? metrics.averageDuration : 0;
  }

  /**
   * Get error rate
   */
  public getErrorRate(): number {
    const metrics = this.metricsCollector.getAggregatedMetrics();
    return metrics ? metrics.errorRate : 0;
  }

  /**
   * Get error breakdown
   */
  public getErrorBreakdown(): Record<string, number> {
    const metrics = this.metricsCollector.getAggregatedMetrics();
    return metrics ? metrics.errorBreakdown : {};
  }

  /**
   * Get context preservation metrics
   * This measures how well context is maintained across operations
   */
  public getContextPreservationMetrics(): Record<string, any> {
    const rawMetrics = this.metricsCollector.getRawMetrics();
    
    if (rawMetrics.length === 0) {
      return {};
    }

    // Count operations with context
    const operationsWithContext = rawMetrics.filter(m => 
      m.context && Object.keys(m.context).length > 0
    ).length;

    // Calculate context preservation rate
    const contextPreservationRate = (operationsWithContext / rawMetrics.length) * 100;

    return {
      totalOperations: rawMetrics.length,
      operationsWithContext,
      contextPreservationRate,
      timestamp: Date.now()
    };
  }
}

// Export main components
export {
  MetricsCollector,
  PerformanceTracker,
  EventLogger,
  DataAggregator,
  MetricsConfig,
  MetricData,
  AggregatedMetrics,
  StreamingEvent,
  ErrorEvent
};

// Example usage:
/*
const metricsConfig: MetricsConfig = {
  serviceName: 'CCR-Fallback-Service',
  collectionInterval: 30000, // 30 seconds
  bufferSize: 5000,
  enableStreaming: true
};

const metricsCollector = new MetricsCollector(metricsConfig);
const performanceTracker = new PerformanceTracker(metricsCollector);
const eventLogger = new EventLogger(metricsCollector);
const dataAggregator = new DataAggregator(metricsCollector);

// Start collection
metricsCollector.start();

// Register streaming callback
metricsCollector.onStream((event) => {
  console.log('Streamed event:', event);
});

// Record a metric
performanceTracker.start();
// ... operation code ...
performanceTracker.end('data-fetch', true, { userId: '12345' });

// Log an error
eventLogger.logError('data-fetch', 'Network timeout', { endpoint: '/api/data' });

// Get aggregated metrics
const successRate = dataAggregator.getSuccessRate();
const errorRate = dataAggregator.getErrorRate();
const contextMetrics = dataAggregator.getContextPreservationMetrics();

console.log('Success Rate:', successRate);
console.log('Error Rate:', errorRate);
console.log('Context Metrics:', contextMetrics);
*/