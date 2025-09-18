export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  halfOpenMaxCalls: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttempt: number = 0;
  
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly halfOpenMaxCalls: number;
  
  private stateChangeListeners: Array<(state: CircuitBreakerState) => void> = [];

  constructor(config: CircuitBreakerConfig) {
    this.failureThreshold = config.failureThreshold;
    this.recoveryTimeout = config.recoveryTimeout;
    this.halfOpenMaxCalls = config.halfOpenMaxCalls;
  }

  canExecute(): boolean {
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        return true;
      case CircuitBreakerState.OPEN:
        return Date.now() >= this.nextAttempt;
      case CircuitBreakerState.HALF_OPEN:
        return this.successCount + this.failureCount < this.halfOpenMaxCalls;
      default:
        return false;
    }
  }

  onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenMaxCalls) {
        this.setState(CircuitBreakerState.CLOSED);
        this.successCount = 0;
      }
    }
  }

  onFailure(): void {
    this.failureCount++;
    
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.setState(CircuitBreakerState.OPEN);
      this.nextAttempt = Date.now() + this.recoveryTimeout;
      this.successCount = 0;
    } else if (this.failureCount >= this.failureThreshold) {
      this.setState(CircuitBreakerState.OPEN);
      this.nextAttempt = Date.now() + this.recoveryTimeout;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  private setState(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.notifyStateChange(newState);
    }
  }

  private notifyStateChange(state: CircuitBreakerState): void {
    for (const listener of this.stateChangeListeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in circuit breaker state change listener:', error);
      }
    }
  }

  onStateChange(listener: (state: CircuitBreakerState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * EventEmitter-compatible method for enhanced CCR fallback manager
   * @param event The event name to listen for ('stateChange')
   * @param listener The callback function
   */
  on(event: string, listener: (state: CircuitBreakerState) => void): void {
    if (event === 'stateChange') {
      this.onStateChange(listener);
    }
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
  }
}
