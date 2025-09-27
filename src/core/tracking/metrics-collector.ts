import { MetricEvent, PerformanceMetrics, SystemHealthMetrics, UserBehaviorMetrics, FeatureUsageMetrics, ErrorMetrics, ResourceUtilizationMetrics } from './tracking-types';

type MetricsData = {
  performance: PerformanceMetrics[];
  systemHealth: SystemHealthMetrics[];
  userBehavior: UserBehaviorMetrics[];
  featureUsage: FeatureUsageMetrics[];
  errors: ErrorMetrics[];
  resourceUtilization: ResourceUtilizationMetrics[];
};

export class MetricsCollector {
  private metricsData: MetricsData;
  private isInitialized: boolean = false;
  private storage: Storage | null = null;

  constructor() {
    this.metricsData = {
      performance: [],
      systemHealth: [],
      userBehavior: [],
      featureUsage: [],
      errors: [],
      resourceUtilization: []
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    // Initialize storage (could be localStorage, IndexedDB, or remote storage)
    if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    }
    
    // Load existing data if available
    this.loadPersistedData();
    
    this.isInitialized = true;
    console.log('Metrics collector initialized');
  }

  collect(event: MetricEvent): void {
    if (!this.isInitialized) {
      throw new Error('MetricsCollector not initialized');
    }
    
    // Route event to appropriate collector based on type
    switch (event.eventType) {
      case 'performance':
        this.collectPerformanceMetrics(event as PerformanceMetrics);
        break;
      case 'systemHealth':
        this.collectSystemHealthMetrics(event as SystemHealthMetrics);
        break;
      case 'userBehavior':
        this.collectUserBehaviorMetrics(event as UserBehaviorMetrics);
        break;
      case 'featureUsage':
        this.collectFeatureUsageMetrics(event as FeatureUsageMetrics);
        break;
      case 'error':
        this.collectErrorMetrics(event as ErrorMetrics);
        break;
      case 'resourceUtilization':
        this.collectResourceUtilizationMetrics(event as ResourceUtilizationMetrics);
        break;
      default:
        console.warn(`Unknown event type: ${event.eventType}`);
    }
    
    // Persist data
    this.persistData();
  }

  private collectPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.metricsData.performance.push({
      ...metrics,
      timestamp: metrics.timestamp || Date.now()
    });
    
    // Keep only recent data (last 1000 entries)
    if (this.metricsData.performance.length > 1000) {
      this.metricsData.performance = this.metricsData.performance.slice(-1000);
    }
  }

  private collectSystemHealthMetrics(metrics: SystemHealthMetrics): void {
    this.metricsData.systemHealth.push({
      ...metrics,
      timestamp: metrics.timestamp || Date.now()
    });
    
    if (this.metricsData.systemHealth.length > 1000) {
      this.metricsData.systemHealth = this.metricsData.systemHealth.slice(-1000);
    }
  }

  private collectUserBehaviorMetrics(metrics: UserBehaviorMetrics): void {
    this.metricsData.userBehavior.push({
      ...metrics,
      timestamp: metrics.timestamp || Date.now()
    });
    
    if (this.metricsData.userBehavior.length > 1000) {
      this.metricsData.userBehavior = this.metricsData.userBehavior.slice(-1000);
    }
  }

  private collectFeatureUsageMetrics(metrics: FeatureUsageMetrics): void {
    this.metricsData.featureUsage.push({
      ...metrics,
      timestamp: metrics.timestamp || Date.now()
    });
    
    if (this.metricsData.featureUsage.length > 1000) {
      this.metricsData.featureUsage = this.metricsData.featureUsage.slice(-1000);
    }
  }

  private collectErrorMetrics(metrics: ErrorMetrics): void {
    this.metricsData.errors.push({
      ...metrics,
      timestamp: metrics.timestamp || Date.now()
    });
    
    if (this.metricsData.errors.length > 1000) {
      this.metricsData.errors = this.metricsData.errors.slice(-1000);
    }
  }

  private collectResourceUtilizationMetrics(metrics: ResourceUtilizationMetrics): void {
    this.metricsData.resourceUtilization.push({
      ...metrics,
      timestamp: metrics.timestamp || Date.now()
    });
    
    if (this.metricsData.resourceUtilization.length > 1000) {
      this.metricsData.resourceUtilization = this.metricsData.resourceUtilization.slice(-1000);
    }
  }

  private persistData(): void {
    if (!this.storage) return;
    
    try {
      const dataToStore = JSON.stringify(this.metricsData);
      this.storage.setItem('devflow_metrics', dataToStore);
    } catch (error) {
      console.error('Failed to persist metrics data:', error);
    }
  }

  private loadPersistedData(): void {
    if (!this.storage) return;
    
    try {
      const storedData = this.storage.getItem('devflow_metrics');
      if (storedData) {
        this.metricsData = JSON.parse(storedData);
      }
    } catch (error) {
      console.error('Failed to load persisted metrics data:', error);
      // Reset to empty state on error
      this.metricsData = {
        performance: [],
        systemHealth: [],
        userBehavior: [],
        featureUsage: [],
        errors: [],
        resourceUtilization: []
      };
    }
  }

  getMetricsData(): MetricsData {
    return { ...this.metricsData };
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    // Persist final data
    this.persistData();
    
    // Clear in-memory data
    this.metricsData = {
      performance: [],
      systemHealth: [],
      userBehavior: [],
      featureUsage: [],
      errors: [],
      resourceUtilization: []
    };
    
    this.isInitialized = false;
  }
}
