/**
 * Synthetic API Rate Limiter - Intelligent rate limiting with adaptive throttling
 * DevFlow Dream Team Component
 */

export interface SyntheticRateConfig {
  maxCallsPer5Hours: number; // 135 calls per 5 hours
  resetTime: Date; // Next reset time (every 5 hours)
  adaptiveThreshold: number; // Start throttling at 80% capacity
  emergencyThreshold: number; // Switch to fallback at 95% capacity
}

export interface RateLimitStatus {
  currentCalls: number;
  maxCalls: number;
  remainingCalls: number;
  resetTime: Date;
  isThrottled: boolean;
  isBlocked: boolean;
  throttleLevel: number; // 0.0-1.0 (1.0 = full speed, 0.0 = blocked)
}

export class SyntheticRateLimiter {
  private callHistory: Date[] = [];
  private config: SyntheticRateConfig;
  private isInitialized = false;

  constructor(config?: Partial<SyntheticRateConfig>) {
    // Set next reset to 2:30 AM
    const now = new Date();
    const nextReset = new Date();
    nextReset.setHours(2, 30, 0, 0);

    // If we're past 2:30 today, set for tomorrow
    if (now.getTime() > nextReset.getTime()) {
      nextReset.setDate(nextReset.getDate() + 1);
    }

    this.config = {
      maxCallsPer5Hours: 135,
      resetTime: nextReset,
      adaptiveThreshold: 0.8, // 80% = 108 calls
      emergencyThreshold: 0.95, // 95% = 128 calls
      ...config
    };

    this.initialize();
  }

  private initialize(): void {
    // Load existing call history from persistent storage
    this.loadCallHistory();

    // Schedule automatic reset
    this.scheduleReset();

    console.log(`[SYNTHETIC-RATE-LIMITER] Initialized - Next reset: ${this.config.resetTime.toLocaleString()}`);
    this.isInitialized = true;
  }

  private loadCallHistory(): void {
    try {
      // In production, this would load from persistent storage (Redis/SQLite)
      // For now, simulate current usage based on 135 calls reached
      const hoursUntilReset = (this.config.resetTime.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilReset > 0) {
        // Simulate that we've reached the limit with calls distributed over 5 hours
        const now = Date.now();
        // Reset to 0 calls since Synthetic is now operational again (post 2:30 reset)
        console.log('[SYNTHETIC-RATE-LIMITER] Synthetic API now operational - starting fresh');
      }

      this.cleanupExpiredCalls();
      console.log(`[SYNTHETIC-RATE-LIMITER] Loaded ${this.callHistory.length} recent calls`);
    } catch (error) {
      console.warn('[SYNTHETIC-RATE-LIMITER] Failed to load call history:', error);
      this.callHistory = [];
    }
  }

  private saveCallHistory(): void {
    try {
      // In production, persist to Redis/SQLite
      // For now, just log the current state
      console.log(`[SYNTHETIC-RATE-LIMITER] Call history updated: ${this.callHistory.length} calls`);
    } catch (error) {
      console.warn('[SYNTHETIC-RATE-LIMITER] Failed to save call history:', error);
    }
  }

  private scheduleReset(): void {
    const timeUntilReset = this.config.resetTime.getTime() - Date.now();

    if (timeUntilReset > 0) {
      setTimeout(() => {
        this.resetCalls();
        // Schedule next reset (24 hours later)
        this.config.resetTime = new Date(this.config.resetTime.getTime() + 24 * 60 * 60 * 1000);
        this.scheduleReset();
      }, timeUntilReset);

      console.log(`[SYNTHETIC-RATE-LIMITER] Reset scheduled in ${Math.round(timeUntilReset / 1000 / 60)} minutes`);
    }
  }

  private cleanupExpiredCalls(): void {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    this.callHistory = this.callHistory.filter(call => call.getTime() > fiveHoursAgo.getTime());
  }

  /**
   * Check if a call can be made and record it
   */
  async requestCall(): Promise<{ allowed: boolean; delay?: number; reason?: string }> {
    this.cleanupExpiredCalls();

    const status = this.getStatus();

    // Blocked - no calls allowed
    if (status.isBlocked) {
      return {
        allowed: false,
        reason: `Rate limit exceeded (${status.currentCalls}/${status.maxCalls}). Reset at ${status.resetTime.toLocaleTimeString()}`
      };
    }

    // Throttled - add delay
    if (status.isThrottled) {
      const delay = this.calculateAdaptiveDelay(status.throttleLevel);
      return {
        allowed: true,
        delay,
        reason: `Throttled (${status.currentCalls}/${status.maxCalls}). Delay: ${delay}ms`
      };
    }

    // Normal operation
    this.recordCall();
    return { allowed: true };
  }

  /**
   * Record a successful API call
   */
  private recordCall(): void {
    this.callHistory.push(new Date());
    this.saveCallHistory();

    const status = this.getStatus();
    console.log(`[SYNTHETIC-RATE-LIMITER] Call recorded: ${status.currentCalls}/${status.maxCalls} (${status.remainingCalls} remaining)`);
  }

  /**
   * Calculate adaptive delay based on usage
   */
  private calculateAdaptiveDelay(throttleLevel: number): number {
    // Exponential backoff based on how close we are to the limit
    // throttleLevel: 1.0 = no delay, 0.0 = maximum delay
    const maxDelay = 30000; // 30 seconds maximum delay
    const minDelay = 1000;  // 1 second minimum delay

    const delayFactor = 1 - throttleLevel;
    const delay = minDelay + (maxDelay - minDelay) * Math.pow(delayFactor, 2);

    return Math.round(delay);
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    this.cleanupExpiredCalls();

    const currentCalls = this.callHistory.length;
    const remainingCalls = Math.max(0, this.config.maxCallsPer5Hours - currentCalls);
    const usageRatio = currentCalls / this.config.maxCallsPer5Hours;

    const isBlocked = usageRatio >= this.config.emergencyThreshold;
    const isThrottled = usageRatio >= this.config.adaptiveThreshold && !isBlocked;

    // Calculate throttle level (1.0 = full speed, 0.0 = blocked)
    let throttleLevel = 1.0;
    if (isBlocked) {
      throttleLevel = 0.0;
    } else if (isThrottled) {
      // Linear reduction from adaptive threshold to emergency threshold
      const throttleRange = this.config.emergencyThreshold - this.config.adaptiveThreshold;
      const excessUsage = usageRatio - this.config.adaptiveThreshold;
      throttleLevel = 1.0 - (excessUsage / throttleRange);
    }

    return {
      currentCalls,
      maxCalls: this.config.maxCallsPer5Hours,
      remainingCalls,
      resetTime: this.config.resetTime,
      isThrottled,
      isBlocked,
      throttleLevel
    };
  }

  /**
   * Reset call counter (called automatically at reset time)
   */
  resetCalls(): void {
    this.callHistory = [];
    this.saveCallHistory();
    console.log(`[SYNTHETIC-RATE-LIMITER] Rate limit reset - ${this.config.maxCallsPer5Hours} calls available for next 5 hours`);
  }

  /**
   * Get detailed metrics for dashboard
   */
  getMetrics(): {
    status: RateLimitStatus;
    config: SyntheticRateConfig;
    recentCalls: { timestamp: Date; count: number }[];
    predictions: {
      timeToLimit: number | null; // minutes until limit reached
      recommendedAction: 'normal' | 'throttle' | 'fallback';
    };
  } {
    const status = this.getStatus();

    // Calculate recent call distribution (last 15 minutes in 5-minute buckets)
    const now = Date.now();
    const recentCalls = [];
    for (let i = 0; i < 3; i++) {
      const bucketStart = now - ((i + 1) * 5 * 60 * 1000);
      const bucketEnd = now - (i * 5 * 60 * 1000);
      const callsInBucket = this.callHistory.filter(call =>
        call.getTime() >= bucketStart && call.getTime() < bucketEnd
      ).length;

      recentCalls.unshift({
        timestamp: new Date(bucketEnd),
        count: callsInBucket
      });
    }

    // Predict time to limit based on recent call rate
    let timeToLimit: number | null = null;
    let recommendedAction: 'normal' | 'throttle' | 'fallback' = 'normal';

    if (status.remainingCalls > 0) {
      const recentCallRate = recentCalls.reduce((sum, bucket) => sum + bucket.count, 0) / 15; // calls per minute
      if (recentCallRate > 0) {
        timeToLimit = status.remainingCalls / recentCallRate; // minutes
      }
    }

    // Determine recommended action
    if (status.isBlocked) {
      recommendedAction = 'fallback';
    } else if (status.isThrottled || (timeToLimit && timeToLimit < 30)) {
      recommendedAction = 'throttle';
    }

    return {
      status,
      config: this.config,
      recentCalls,
      predictions: {
        timeToLimit,
        recommendedAction
      }
    };
  }

  /**
   * Check if synthetic should be used or fallback to other agents
   */
  shouldUseSynthetic(): boolean {
    const status = this.getStatus();
    return !status.isBlocked;
  }

  /**
   * Get recommended delay before next call
   */
  getRecommendedDelay(): number {
    const status = this.getStatus();

    if (status.isBlocked) {
      // Return time until reset
      return this.config.resetTime.getTime() - Date.now();
    }

    if (status.isThrottled) {
      return this.calculateAdaptiveDelay(status.throttleLevel);
    }

    return 0; // No delay needed
  }
}

// Global instance for use across the application
export const syntheticRateLimiter = new SyntheticRateLimiter();