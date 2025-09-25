import { MetricEvent, TrackingConfig, UsageStatistics } from './tracking-types';
import { MetricsCollector } from './metrics-collector';
import { AnalyticsAggregator } from './analytics-aggregator';

export class UsageTrackingService {
  private config: TrackingConfig;
  private collector: MetricsCollector;
  private aggregator: AnalyticsAggregator;
  private isInitialized: boolean = false;

  constructor(config: TrackingConfig) {
    this.config = config;
    this.collector = new MetricsCollector();
    this.aggregator = new AnalyticsAggregator();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    // Initialize subsystems
    await this.collector.initialize();
    await this.aggregator.initialize();
    
    this.isInitialized = true;
    console.log('Usage tracking service initialized');
  }

  trackEvent(event: MetricEvent): void {
    if (!this.isInitialized) {
      throw new Error('UsageTrackingService not initialized');
    }
    
    // Anonymize data if required
    const anonymizedEvent = this.anonymizeEvent(event);
    
    // Send to collector
    this.collector.collect(anonymizedEvent);
    
    // Process for real-time metrics
    this.processRealTimeMetrics(anonymizedEvent);
  }

  getUsageStatistics(): UsageStatistics {
    if (!this.isInitialized) {
      throw new Error('UsageTrackingService not initialized');
    }
    
    return this.aggregator.getAggregatedData();
  }

  private anonymizeEvent(event: MetricEvent): MetricEvent {
    if (!this.config.privacySettings.dataAnonymization) {
      return event;
    }
    
    // Remove or hash personally identifiable information
    const anonymizedEvent = { ...event };
    
    if (anonymizedEvent.userId) {
      anonymizedEvent.userId = this.hashUserId(anonymizedEvent.userId);
    }
    
    // Remove other PII fields as needed
    delete anonymizedEvent.userEmail;
    delete anonymizedEvent.userLocation;
    
    return anonymizedEvent;
  }

  private hashUserId(userId: string): string {
    // Simple hash function for demonstration
    // In production, use a proper cryptographic hash
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private processRealTimeMetrics(event: MetricEvent): void {
    // Process event for real-time dashboards
    // This could involve sending to a real-time analytics service
    console.log(`Processing real-time event: ${event.eventType}`);
  }

  async exportData(format: 'json' | 'csv'): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('UsageTrackingService not initialized');
    }
    
    const data = this.aggregator.getAggregatedData();
    return this.aggregator.exportData(data, format);
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    await this.collector.cleanup();
    await this.aggregator.cleanup();
    this.isInitialized = false;
  }
}
