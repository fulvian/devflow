/**
 * Production Error Recovery Protocol for CCR System
 *
 * This module implements a comprehensive error recovery system with automatic healing capabilities
 * for the CCR (Critical Component Recovery) system. It includes service health monitoring,
 * exponential backoff retry strategies, graceful degradation, and circuit breaker recovery.
 */

import { EventEmitter } from 'events';
import { promisify } from 'util';

// Type definitions
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ServiceStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE';
export type RecoveryStrategy = 'RETRY' | 'FALLBACK' | 'CIRCUIT_BREAKER' | 'SERVICE_RESTART' | 'DEGRADE';

export interface ServiceHealth {
  id: string;
  name: string;
  status: ServiceStatus;
  lastCheck: Date;
  failureCount: number;
  lastError?: Error;
}

export interface ErrorInfo {
  id: string;
  serviceId: string;
  severity: ErrorSeverity;
  message: string;
  timestamp: Date;
  recoveryStrategy?: RecoveryStrategy;
  resolved: boolean;
}

export interface RecoveryMetrics {
  totalErrors: number;
  resolvedErrors: number;
  failedRecoveries: number;
  avgRecoveryTime: number;
  uptimePercentage: number;
}

export interface CircuitBreakerState {
  serviceId: string;
  isOpen: boolean;
  failureCount: number;
  lastFailure: Date;
  nextAttempt: Date | null;
}

export interface ServiceDependency {
  id: string;
  name: string;
  required: boolean;
  healthCheckEndpoint: string;
}

// Interfaces for service implementations
export interface DatabaseService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  executeQuery(query: string): Promise<any>;
}

export interface MonitoringService {
  recordError(error: ErrorInfo): void;
  recordRecovery(serviceId: string, recoveryTime: number): void;
  getMetrics(): RecoveryMetrics;
  sendAlert(message: string, severity: ErrorSeverity): void;
}

export interface HealthCheckService {
  checkServiceHealth(serviceId: string): Promise<ServiceHealth>;
  registerService(service: ServiceHealth): void;
  getOverallHealth(): ServiceStatus;
}

/**
 * Main Error Recovery Orchestrator
 * Manages automatic error recovery across all CCR services
 */
export class ErrorRecoveryOrchestrator extends EventEmitter {
  private services: Map<string, ServiceHealth> = new Map();
  private errors: Map<string, ErrorInfo> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private dependencies: Map<string, ServiceDependency[]> = new Map();
  private recoveryMetrics: RecoveryMetrics = {
    totalErrors: 0,
    resolvedErrors: 0,
    failedRecoveries: 0,
    avgRecoveryTime: 0,
    uptimePercentage: 100
  };

  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor(
    private readonly databaseService?: DatabaseService,
    private readonly monitoringService?: MonitoringService,
    private readonly healthCheckService?: HealthCheckService
  ) {
    super();
    this.initializeHealthMonitoring();
  }

  /**
   * Initialize health monitoring with periodic checks
   */
  private initializeHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      for (const [serviceId, service] of this.services) {
        try {
          if (this.healthCheckService) {
            const health = await this.healthCheckService.checkServiceHealth(serviceId);
            this.updateServiceHealth(serviceId, health);
          }
        } catch (error) {
          this.handleServiceHealthFailure(serviceId, error as Error);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Register a service for monitoring
   */
  public registerService(service: ServiceHealth): void {
    this.services.set(service.id, service);
    if (this.healthCheckService) {
      this.healthCheckService.registerService(service);
    }

    this.circuitBreakers.set(service.id, {
      serviceId: service.id,
      isOpen: false,
      failureCount: 0,
      lastFailure: new Date(0),
      nextAttempt: null
    });
  }

  /**
   * Register service dependencies
   */
  public registerDependencies(serviceId: string, dependencies: ServiceDependency[]): void {
    this.dependencies.set(serviceId, dependencies);
  }

  /**
   * Handle an error in the system
   */
  public async handleError(serviceId: string, error: Error, severity: ErrorSeverity): Promise<void> {
    const errorId = this.generateErrorId();
    const errorInfo: ErrorInfo = {
      id: errorId,
      serviceId,
      severity,
      message: error.message,
      timestamp: new Date(),
      resolved: false
    };

    this.errors.set(errorId, errorInfo);
    this.recoveryMetrics.totalErrors++;

    // Record in monitoring system
    if (this.monitoringService) {
      this.monitoringService.recordError(errorInfo);
    }

    // Send alert for critical errors
    if (severity === 'CRITICAL' && this.monitoringService) {
      this.monitoringService.sendAlert(`Critical error in service ${serviceId}: ${error.message}`, severity);
    }

    // Determine and execute recovery strategy
    const strategy = this.determineRecoveryStrategy(serviceId, severity);
    errorInfo.recoveryStrategy = strategy;

    try {
      await this.executeRecoveryStrategy(serviceId, strategy, error);
      errorInfo.resolved = true;
      this.recoveryMetrics.resolvedErrors++;
      this.emit('errorResolved', errorInfo);
    } catch (recoveryError) {
      this.recoveryMetrics.failedRecoveries++;
      if (this.monitoringService) {
        this.monitoringService.sendAlert(
          `Failed to recover service ${serviceId}: ${(recoveryError as Error).message}`,
          'CRITICAL'
        );
      }
      this.emit('recoveryFailed', errorInfo, recoveryError);
    }
  }

  /**
   * Determine the appropriate recovery strategy based on error severity and service state
   */
  private determineRecoveryStrategy(serviceId: string, severity: ErrorSeverity): RecoveryStrategy {
    const circuitBreaker = this.circuitBreakers.get(serviceId);

    // If circuit breaker is open, use fallback or degrade
    if (circuitBreaker?.isOpen) {
      return this.shouldDegrade(serviceId) ? 'DEGRADE' : 'FALLBACK';
    }

    // For critical severity, restart service
    if (severity === 'CRITICAL') {
      return 'SERVICE_RESTART';
    }

    // For database-related services, try connection recovery
    if (serviceId.includes('database')) {
      return 'RETRY';
    }

    // For high severity, use circuit breaker pattern
    if (severity === 'HIGH') {
      return 'CIRCUIT_BREAKER';
    }

    // Default to retry with exponential backoff
    return 'RETRY';
  }

  /**
   * Execute the determined recovery strategy
   */
  private async executeRecoveryStrategy(
    serviceId: string,
    strategy: RecoveryStrategy,
    error: Error
  ): Promise<void> {
    const startTime = Date.now();

    switch (strategy) {
      case 'RETRY':
        await this.retryWithExponentialBackoff(serviceId, error);
        break;
      case 'FALLBACK':
        await this.executeFallbackRecovery(serviceId);
        break;
      case 'CIRCUIT_BREAKER':
        this.openCircuitBreaker(serviceId);
        break;
      case 'SERVICE_RESTART':
        await this.restartService(serviceId);
        break;
      case 'DEGRADE':
        await this.degradeService(serviceId);
        break;
      default:
        throw new Error(`Unknown recovery strategy: ${strategy}`);
    }

    const recoveryTime = Date.now() - startTime;
    if (this.monitoringService) {
      this.monitoringService.recordRecovery(serviceId, recoveryTime);
    }

    // Update average recovery time
    this.recoveryMetrics.avgRecoveryTime =
      (this.recoveryMetrics.avgRecoveryTime * (this.recoveryMetrics.resolvedErrors - 1) + recoveryTime) /
      this.recoveryMetrics.resolvedErrors;
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryWithExponentialBackoff(serviceId: string, error: Error): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    const maxRetries = 5;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Simulate service operation retry
        await this.simulateServiceOperation(serviceId);
        // If successful, reset failure count
        service.failureCount = 0;
        return;
      } catch (retryError) {
        service.failureCount++;

        if (attempt === maxRetries) {
          throw retryError;
        }

        // Exponential backoff: delay = baseDelay * 2^(attempt-1)
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Execute fallback recovery procedure
   */
  private async executeFallbackRecovery(serviceId: string): Promise<void> {
    const dependencies = this.dependencies.get(serviceId) || [];
    const requiredDeps = dependencies.filter(dep => dep.required);

    // Check if required dependencies are available
    for (const dep of requiredDeps) {
      if (this.healthCheckService) {
        const depHealth = await this.healthCheckService.checkServiceHealth(dep.id);
        if (depHealth.status === 'UNHEALTHY' || depHealth.status === 'OFFLINE') {
          throw new Error(`Required dependency ${dep.name} is unavailable`);
        }
      }
    }

    // Implement fallback logic here
    // This would typically involve switching to a backup service or cached data
    this.emit('fallbackActivated', serviceId);
  }

  /**
   * Open circuit breaker for a service
   */
  private openCircuitBreaker(serviceId: string): void {
    const circuitBreaker = this.circuitBreakers.get(serviceId);
    if (!circuitBreaker) return;

    circuitBreaker.isOpen = true;
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailure = new Date();
    // Next attempt in 60 seconds
    circuitBreaker.nextAttempt = new Date(Date.now() + 60000);

    this.emit('circuitBreakerOpened', serviceId);
  }

  /**
   * Attempt to close circuit breaker after timeout
   */
  public async attemptCircuitBreakerReset(serviceId: string): Promise<boolean> {
    const circuitBreaker = this.circuitBreakers.get(serviceId);
    if (!circuitBreaker || !circuitBreaker.isOpen) {
      return false;
    }

    // Check if it's time to attempt reset
    if (circuitBreaker.nextAttempt && circuitBreaker.nextAttempt > new Date()) {
      return false;
    }

    try {
      // Test if service is healthy
      await this.simulateServiceOperation(serviceId);

      // If successful, close circuit breaker
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
      circuitBreaker.nextAttempt = null;

      this.emit('circuitBreakerClosed', serviceId);
      return true;
    } catch (error) {
      // If still failing, extend timeout
      circuitBreaker.nextAttempt = new Date(Date.now() + 120000); // 2 minutes
      return false;
    }
  }

  /**
   * Restart a service
   */
  private async restartService(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    // Mark service as offline during restart
    service.status = 'OFFLINE';

    try {
      // Simulate service restart process
      await this.simulateServiceRestart(serviceId);

      // Verify service is healthy after restart
      if (this.healthCheckService) {
        const health = await this.healthCheckService.checkServiceHealth(serviceId);
        this.updateServiceHealth(serviceId, health);

        if (health.status !== 'HEALTHY') {
          throw new Error(`Service ${serviceId} failed to restart properly`);
        }
      }

      this.emit('serviceRestarted', serviceId);
    } catch (error) {
      service.status = 'UNHEALTHY';
      throw error;
    }
  }

  /**
   * Degrade service functionality gracefully
   */
  private async degradeService(serviceId: string): Promise<void> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    service.status = 'DEGRADED';
    this.emit('serviceDegraded', serviceId);

    // Implement specific degradation logic based on service type
    // For example, reduce functionality, use cached data, etc.
  }

  /**
   * Check if service should be degraded based on dependencies
   */
  private shouldDegrade(serviceId: string): boolean {
    const dependencies = this.dependencies.get(serviceId);
    if (!dependencies || dependencies.length === 0) {
      return false;
    }

    // If more than 50% of dependencies are unhealthy, degrade service
    const unhealthyDeps = dependencies.filter(dep => {
      const depHealth = this.services.get(dep.id);
      return depHealth?.status === 'UNHEALTHY' || depHealth?.status === 'OFFLINE';
    });

    return unhealthyDeps.length > dependencies.length / 2;
  }

  /**
   * Update service health status
   */
  private updateServiceHealth(serviceId: string, health: ServiceHealth): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.status = health.status;
      service.lastCheck = new Date();
      service.lastError = health.lastError || service.lastError;

      if (health.status === 'HEALTHY') {
        service.failureCount = 0;
      }
    }
  }

  /**
   * Handle service health check failure
   */
  private handleServiceHealthFailure(serviceId: string, error: Error): void {
    const service = this.services.get(serviceId);
    if (service) {
      service.status = 'UNHEALTHY';
      service.failureCount++;
      service.lastError = error;
      service.lastCheck = new Date();

      // Automatically try to handle the failure
      this.handleError(serviceId, error, 'HIGH');
    }
  }

  /**
   * Get current recovery metrics
   */
  public getRecoveryMetrics(): RecoveryMetrics {
    return { ...this.recoveryMetrics };
  }

  /**
   * Get service health information
   */
  public getServiceHealth(serviceId: string): ServiceHealth | undefined {
    return this.services.get(serviceId);
  }

  /**
   * Get all services health
   */
  public getAllServicesHealth(): ServiceHealth[] {
    return Array.from(this.services.values());
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close any open circuit breakers
    for (const [serviceId, circuitBreaker] of this.circuitBreakers) {
      if (circuitBreaker.isOpen) {
        circuitBreaker.isOpen = false;
      }
    }

    this.emit('shutdown');
  }

  // Helper methods
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Simulated methods - would be replaced with actual service implementations
  private async simulateServiceOperation(serviceId: string): Promise<void> {
    // Simulate service operation
    await promisify(setTimeout)(100);

    // Randomly fail for demonstration
    if (Math.random() < 0.3) {
      throw new Error(`Simulated failure for service ${serviceId}`);
    }
  }

  private async simulateServiceRestart(serviceId: string): Promise<void> {
    // Simulate service restart process
    await promisify(setTimeout)(2000);
  }
}

export default ErrorRecoveryOrchestrator;