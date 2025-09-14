// types.ts
export interface AdapterConfig {
  id: string;
  name: string;
  priority: number;
  maxRetries: number;
  timeout: number;
  healthCheckInterval: number;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
}

export interface AdapterHealth {
  id: string;
  isHealthy: boolean;
  lastCheck: Date;
  failureCount: number;
  lastFailure?: Date;
  circuitBreakerOpen: boolean;
  circuitBreakerOpenedAt?: Date;
}

export interface FallbackEvent {
  type: 'FALLBACK_TRIGGERED' | 'ADAPTER_RECOVERY' | 'CIRCUIT_BREAKER_TRIPPED' | 'MANUAL_OVERRIDE';
  timestamp: Date;
  sourceAdapter?: string;
  targetAdapter?: string;
  reason?: string;
  data?: any;
}

export interface FallbackResult {
  success: boolean;
  adapterId: string;
  result?: any;
  error?: Error;
  fallbackChain: string[];
}

export interface EmergencyCCRRequest {
  prompt: string;
  context: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// interfaces.ts
import { AdapterConfig, AdapterHealth, FallbackEvent, FallbackResult, EmergencyCCRRequest } from './types';

export interface AIAdapter {
  readonly id: string;
  readonly config: AdapterConfig;
  initialize(): Promise<void>;
  execute(prompt: string, context?: any): Promise<any>;
  healthCheck(): Promise<AdapterHealth>;
  destroy(): Promise<void>;
}

export interface EmergencyCCRSystem {
  submitRequest(request: EmergencyCCRRequest): Promise<any>;
  getStatus(): Promise<{ operational: boolean; queueLength: number }>;
}

export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface StatePersistence {
  saveState(state: OrchestratorState): Promise<void>;
  loadState(): Promise<OrchestratorState | null>;
  clearState(): Promise<void>;
}

export interface EventPublisher {
  publish(event: FallbackEvent): void;
  subscribe(callback: (event: FallbackEvent) => void): () => void;
}

// state.ts
import { AdapterHealth } from './types';

export interface OrchestratorState {
  activeAdapter: string | null;
  adapterHealth: Record<string, AdapterHealth>;
  fallbackChain: string[];
  lastExecution: {
    timestamp: Date;
    adapter: string;
    success: boolean;
  } | null;
}

export class StateManager {
  constructor(private persistence: StatePersistence) {}

  async loadState(): Promise<OrchestratorState> {
    const savedState = await this.persistence.loadState();
    if (savedState) {
      return savedState;
    }
    
    return {
      activeAdapter: null,
      adapterHealth: {},
      fallbackChain: [],
      lastExecution: null
    };
  }

  async saveState(state: OrchestratorState): Promise<void> {
    await this.persistence.saveState(state);
  }

  async clearState(): Promise<void> {
    await this.persistence.clearState();
  }
}

// circuit-breaker.ts
import { AdapterHealth } from './types';

export class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: Date | null = null;
  private open: boolean = false;
  private openTime: Date | null = null;

  constructor(
    private readonly threshold: number,
    private readonly timeout: number
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.open && this.openTime) {
      const now = new Date();
      if (now.getTime() - this.openTime.getTime() > this.timeout) {
        this.open = false;
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.threshold) {
      this.open = true;
      this.openTime = new Date();
    }
  }

  getHealth(): Omit<AdapterHealth, 'id' | 'lastCheck'> {
    return {
      isHealthy: !this.open,
      failureCount: this.failureCount,
      lastFailure: this.lastFailureTime || undefined,
      circuitBreakerOpen: this.open,
      circuitBreakerOpenedAt: this.openTime || undefined
    };
  }

  reset(): void {
    this.failureCount = 0;
    this.open = false;
    this.openTime = null;
    this.lastFailureTime = null;
  }
}

// orchestrator.ts
import { 
  AIAdapter, 
  EmergencyCCRSystem, 
  Logger, 
  StatePersistence, 
  EventPublisher 
} from './interfaces';
import { 
  AdapterConfig, 
  AdapterHealth, 
  FallbackEvent, 
  FallbackResult,
  EmergencyCCRRequest,
  OrchestratorState
} from './types';
import { StateManager } from './state';
import { CircuitBreaker } from './circuit-breaker';

export class FallbackOrchestrator {
  private adapters: Map<string, AIAdapter> = new Map();
  private adapterConfigs: Map<string, AdapterConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private stateManager: StateManager;
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private subscribers: Array<(event: FallbackEvent) => void> = [];
  private isInitialized: boolean = false;

  constructor(
    private readonly emergencyCCR: EmergencyCCRSystem,
    private readonly logger: Logger,
    private readonly statePersistence: StatePersistence,
    private readonly eventPublisher: EventPublisher
  ) {
    this.stateManager = new StateManager(statePersistence);
    this.eventPublisher.subscribe((event) => this.handleEvent(event));
  }

  async initialize(adapterConfigs: AdapterConfig[]): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Orchestrator already initialized');
    }

    // Load previous state
    const state = await this.stateManager.loadState();
    
    // Initialize adapters
    for (const config of adapterConfigs) {
      this.adapterConfigs.set(config.id, config);
      this.circuitBreakers.set(
        config.id, 
        new CircuitBreaker(config.circuitBreakerThreshold, config.circuitBreakerTimeout)
      );
      
      // Schedule health checks
      this.scheduleHealthCheck(config.id);
    }

    this.isInitialized = true;
    this.logger.info('Fallback Orchestrator initialized', { adapterCount: adapterConfigs.length });
  }

  registerAdapter(adapter: AIAdapter): void {
    if (!this.adapterConfigs.has(adapter.id)) {
      throw new Error(`Adapter ${adapter.id} not configured`);
    }
    
    this.adapters.set(adapter.id, adapter);
    this.logger.info(`Adapter registered: ${adapter.id}`);
  }

  async execute(prompt: string, context?: any): Promise<FallbackResult> {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized');
    }

    const state = await this.stateManager.loadState();
    const sortedAdapters = this.getSortedAdapters();
    const fallbackChain: string[] = [];
    
    for (const adapter of sortedAdapters) {
      const config = this.adapterConfigs.get(adapter.id)!;
      const circuitBreaker = this.circuitBreakers.get(adapter.id)!;
      
      fallbackChain.push(adapter.id);
      
      // Skip if circuit breaker is open
      if (circuitBreaker.getHealth().circuitBreakerOpen) {
        this.logger.warn(`Skipping adapter ${adapter.id} - circuit breaker open`);
        continue;
      }

      try {
        const result = await circuitBreaker.execute(async () => {
          return await this.executeWithTimeout(
            () => adapter.execute(prompt, context),
            config.timeout
          );
        });

        // Update state on success
        state.activeAdapter = adapter.id;
        state.lastExecution = {
          timestamp: new Date(),
          adapter: adapter.id,
          success: true
        };
        await this.stateManager.saveState(state);

        this.logger.info(`Execution successful with adapter: ${adapter.id}`);
        return {
          success: true,
          adapterId: adapter.id,
          result,
          fallbackChain
        };
      } catch (error) {
        this.logger.warn(`Adapter ${adapter.id} failed: ${error.message}`);
        
        // Update failure state
        const health = await this.checkAdapterHealth(adapter.id);
        state.adapterHealth[adapter.id] = health;
        await this.stateManager.saveState(state);
        
        // Publish fallback event
        this.eventPublisher.publish({
          type: 'FALLBACK_TRIGGERED',
          timestamp: new Date(),
          sourceAdapter: state.activeAdapter || undefined,
          targetAdapter: adapter.id,
          reason: error.message,
          data: { fallbackChain: [...fallbackChain] }
        });
      }
    }

    // All adapters failed - fallback to Emergency CCR
    this.logger.warn('All adapters failed, falling back to Emergency CCR');
    return await this.executeEmergencyCCR(prompt, context, fallbackChain);
  }

  async manualOverride(adapterId: string): Promise<void> {
    if (!this.adapters.has(adapterId)) {
      throw new Error(`Adapter ${adapterId} not found`);
    }

    const state = await this.stateManager.loadState();
    const previousAdapter = state.activeAdapter;
    state.activeAdapter = adapterId;
    await this.stateManager.saveState(state);

    this.eventPublisher.publish({
      type: 'MANUAL_OVERRIDE',
      timestamp: new Date(),
      sourceAdapter: previousAdapter || undefined,
      targetAdapter: adapterId,
      reason: 'Manual override requested'
    });

    this.logger.info(`Manual override to adapter: ${adapterId}`);
  }

  async getAdapterHealth(): Promise<Record<string, AdapterHealth>> {
    const health: Record<string, AdapterHealth> = {};
    
    for (const [id] of this.adapters) {
      health[id] = await this.checkAdapterHealth(id);
    }
    
    return health;
  }

  async destroy(): Promise<void> {
    // Clear all timers
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();

    // Destroy all adapters
    for (const adapter of this.adapters.values()) {
      await adapter.destroy();
    }
    this.adapters.clear();

    this.isInitialized = false;
    this.logger.info('Fallback Orchestrator destroyed');
  }

  private getSortedAdapters(): AIAdapter[] {
    return Array.from(this.adapters.values()).sort((a, b) => {
      const configA = this.adapterConfigs.get(a.id)!;
      const configB = this.adapterConfigs.get(b.id)!;
      return configA.priority - configB.priority;
    });
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeEmergencyCCR(
    prompt: string,
    context: any,
    fallbackChain: string[]
  ): Promise<FallbackResult> {
    try {
      const ccrStatus = await this.emergencyCCR.getStatus();
      
      if (!ccrStatus.operational) {
        throw new Error('Emergency CCR system is not operational');
      }

      const result = await this.emergencyCCR.submitRequest({
        prompt,
        context,
        priority: 'high'
      });

      this.logger.info('Emergency CCR execution successful');
      
      return {
        success: true,
        adapterId: 'emergency-ccr',
        result,
        fallbackChain
      };
    } catch (error) {
      this.logger.error('Emergency CCR execution failed', error);
      
      return {
        success: false,
        adapterId: 'emergency-ccr',
        error,
        fallbackChain
      };
    }
  }

  private async checkAdapterHealth(adapterId: string): Promise<AdapterHealth> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      throw new Error(`Adapter ${adapterId} not found`);
    }

    try {
      const health = await adapter.healthCheck();
      const circuitBreakerHealth = this.circuitBreakers.get(adapterId)!.getHealth();
      
      return {
        ...health,
        ...circuitBreakerHealth
      };
    } catch (error) {
      this.logger.error(`Health check failed for adapter ${adapterId}`, error);
      
      return {
        id: adapterId,
        isHealthy: false,
        lastCheck: new Date(),
        failureCount: 1,
        lastFailure: new Date(),
        circuitBreakerOpen: false
      };
    }
  }

  private scheduleHealthCheck(adapterId: string): void {
    const config = this.adapterConfigs.get(adapterId);
    if (!config) return;

    const timer = setInterval(async () => {
      try {
        const health = await this.checkAdapterHealth(adapterId);
        const state = await this.stateManager.loadState();
        state.adapterHealth[adapterId] = health;
        await this.stateManager.saveState(state);
        
        this.logger.debug(`Health check completed for ${adapterId}`, health);
      } catch (error) {
        this.logger.error(`Scheduled health check failed for ${adapterId}`, error);
      }
    }, config.healthCheckInterval);

    this.healthCheckTimers.set(adapterId, timer);
  }

  private handleEvent(event: FallbackEvent): void {
    this.logger.info(`Event: ${event.type}`, event);
    
    // Notify subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        this.logger.error('Error in event subscriber', error);
      }
    }
  }

  subscribe(callback: (event: FallbackEvent) => void): () => void {
    this.subscribers.push(callback);
    
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }
}