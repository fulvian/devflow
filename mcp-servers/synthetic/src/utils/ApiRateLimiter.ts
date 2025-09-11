/**
 * Intelligent API Rate Limiter for Synthetic API
 * Manages 135 calls per 5-hour window with adaptive strategies
 */

import { SYNTHETIC_API_LIMITS, RATE_LIMIT_STRATEGIES } from './config/apiLimits.js';

export interface RateLimitStatus {
  canCall: boolean;
  remainingCalls: number;
  resetTime: number;
  windowStart: number;
  usagePercentage: number;
}

export interface CallRecord {
  timestamp: number;
  cost: number;
  success: boolean;
  model: string;
}

export class ApiRateLimiter {
  private callHistory: CallRecord[] = [];
  private windowStart: number = Date.now();
  private burstTokens: number = RATE_LIMIT_STRATEGIES.adaptive.burstAllowance;
  private lastBurstRefill: number = Date.now();

  constructor() {
    // Initialize with current window
    this.resetWindowIfNeeded();
  }

  /**
   * Check if a call can be made within rate limits
   */
  canCall(sessionId?: string): boolean {
    this.resetWindowIfNeeded();
    this.refillBurstTokens();
    
    const currentUsage = this.getCurrentUsage();
    const hasBurstTokens = this.burstTokens > 0;
    const withinLimits = currentUsage < SYNTHETIC_API_LIMITS.maxCalls;
    
    return withinLimits || hasBurstTokens;
  }

  /**
   * Record a successful API call
   */
  recordCall(sessionId?: string, model?: string): void {
    this.resetWindowIfNeeded();
    
    const callRecord: CallRecord = {
      timestamp: Date.now(),
      cost: SYNTHETIC_API_LIMITS.costPerCall,
      success: true,
      model: model || 'unknown',
    };
    
    this.callHistory.push(callRecord);
    
    // Use burst token if we're over the limit
    if (this.getCurrentUsage() > SYNTHETIC_API_LIMITS.maxCalls) {
      this.burstTokens = Math.max(0, this.burstTokens - 1);
    }
    
    this.cleanupOldCalls();
  }

  /**
   * Record a failed API call (doesn't count against limit)
   */
  recordFailedCall(sessionId?: string, model?: string): void {
    const callRecord: CallRecord = {
      timestamp: Date.now(),
      cost: 0,
      success: false,
      model: model || 'unknown',
    };
    
    this.callHistory.push(callRecord);
    this.cleanupOldCalls();
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    this.resetWindowIfNeeded();
    
    const currentUsage = this.getCurrentUsage();
    const remainingCalls = Math.max(0, SYNTHETIC_API_LIMITS.maxCalls - currentUsage);
    const resetTime = this.windowStart + SYNTHETIC_API_LIMITS.windowMs;
    const usagePercentage = currentUsage / SYNTHETIC_API_LIMITS.maxCalls;
    
    return {
      canCall: this.canCall(),
      remainingCalls,
      resetTime,
      windowStart: this.windowStart,
      usagePercentage,
    };
  }

  /**
   * Get estimated time until next call is allowed
   */
  getTimeUntilNextCall(): number {
    const status = this.getStatus();
    
    if (status.canCall) {
      return 0;
    }
    
    // Calculate time based on current usage and recovery rate
    const overLimit = this.getCurrentUsage() - SYNTHETIC_API_LIMITS.maxCalls;
    const recoveryTimeMs = (overLimit / RATE_LIMIT_STRATEGIES.adaptive.recoveryRate) * 60 * 1000;
    
    return Math.min(recoveryTimeMs, status.resetTime - Date.now());
  }

  /**
   * Get usage statistics for monitoring
   */
  getUsageStats(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    currentWindowUsage: number;
    burstTokensRemaining: number;
    averageCallsPerHour: number;
    peakUsageHour: number;
  } {
    this.resetWindowIfNeeded();
    
    const currentWindowCalls = this.callHistory.filter(
      call => call.timestamp >= this.windowStart
    );
    
    const successfulCalls = currentWindowCalls.filter(call => call.success).length;
    const failedCalls = currentWindowCalls.filter(call => !call.success).length;
    
    // Calculate average calls per hour
    const hoursInWindow = SYNTHETIC_API_LIMITS.windowHours;
    const averageCallsPerHour = currentWindowCalls.length / hoursInWindow;
    
    // Find peak usage hour
    const hourlyUsage = this.getHourlyUsage();
    const peakUsageHour = Math.max(...hourlyUsage);
    
    return {
      totalCalls: this.callHistory.length,
      successfulCalls,
      failedCalls,
      currentWindowUsage: currentWindowCalls.length,
      burstTokensRemaining: this.burstTokens,
      averageCallsPerHour,
      peakUsageHour,
    };
  }

  /**
   * Reset rate limiter (for testing or manual reset)
   */
  reset(): void {
    this.callHistory = [];
    this.windowStart = Date.now();
    this.burstTokens = RATE_LIMIT_STRATEGIES.adaptive.burstAllowance;
    this.lastBurstRefill = Date.now();
  }

  private resetWindowIfNeeded(): void {
    const now = Date.now();
    const windowEnd = this.windowStart + SYNTHETIC_API_LIMITS.windowMs;
    
    if (now >= windowEnd) {
      this.windowStart = now;
      this.burstTokens = RATE_LIMIT_STRATEGIES.adaptive.burstAllowance;
      this.lastBurstRefill = now;
    }
  }

  private refillBurstTokens(): void {
    const now = Date.now();
    const timeSinceLastRefill = now - this.lastBurstRefill;
    const refillInterval = 60 * 1000; // 1 minute
    
    if (timeSinceLastRefill >= refillInterval) {
      const tokensToAdd = Math.floor(timeSinceLastRefill / refillInterval) * 
        RATE_LIMIT_STRATEGIES.adaptive.recoveryRate;
      
      this.burstTokens = Math.min(
        RATE_LIMIT_STRATEGIES.adaptive.burstAllowance,
        this.burstTokens + tokensToAdd
      );
      
      this.lastBurstRefill = now;
    }
  }

  private getCurrentUsage(): number {
    const currentWindowCalls = this.callHistory.filter(
      call => call.timestamp >= this.windowStart && call.success
    );
    
    return currentWindowCalls.length;
  }

  private cleanupOldCalls(): void {
    const cutoffTime = Date.now() - (SYNTHETIC_API_LIMITS.windowMs * 2); // Keep 2 windows
    this.callHistory = this.callHistory.filter(call => call.timestamp > cutoffTime);
  }

  private getHourlyUsage(): number[] {
    const hourlyUsage = new Array(SYNTHETIC_API_LIMITS.windowHours).fill(0);
    const hourMs = 60 * 60 * 1000;
    
    for (const call of this.callHistory) {
      if (call.timestamp >= this.windowStart) {
        const hourIndex = Math.floor((call.timestamp - this.windowStart) / hourMs);
        if (hourIndex >= 0 && hourIndex < hourlyUsage.length) {
          hourlyUsage[hourIndex]++;
        }
      }
    }
    
    return hourlyUsage;
  }
}

// Global rate limiter instance
export const apiRateLimiter = new ApiRateLimiter();
