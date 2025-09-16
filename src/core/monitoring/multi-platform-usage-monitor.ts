/**
 * DevFlow Dream Team - Multi-Platform Usage Monitor
 *
 * Implements atomic thresholds and usage monitoring for various integrated platforms.
 * This system ensures compliance with usage limits and triggers preventive fallbacks.
 *
 * TASK: Implement multi-platform usage monitor with atomic thresholds
 * - Gemini CLI: 100 req/day, Pro→Flash prevention at 60 requests
 * - Qwen CLI: 1000 req/day, conservative fallback at 900
 * - Codex CLI: 150 req/5h, no synthetic fallback
 * - Consensum: 20 req/week for critical decisions
 *
 * INTEGRATION: Must integrate with existing DevFlow agent classification system.
 */

// Note: The 'Agent' enum from devflow-types would need to be extended with Qwen and Consensum
// for full integration with the AgentClassificationEngine.
// As this file only creates the monitor, we define platforms locally.

/**
 * Defines the platforms to be monitored.
 * This should be synchronized with the master Agent enum in a real integration.
 */
export enum MonitoredPlatform {
  GeminiCLI = 'GeminiCLI',
  QwenCLI = 'QwenCLI',
  CodexCLI = 'CodexCLI',
  Consensum = 'Consensum',
}

/**
 * Defines the structure for usage thresholds for a single platform.
 */
export interface UsageThreshold {
  readonly limit: number;
  readonly timeWindow: 'day' | 'week' | 'custom';
  readonly customTimeWindowMs?: number; // For cases like '5 hours'
  readonly fallbackThreshold?: number;
  readonly disableFallback?: boolean;
}

/**
 * Represents the usage state for a single platform.
 */
interface PlatformUsage {
  requests: number;
  windowStart: number; // Timestamp of the start of the current window
}

/**
 * Main usage state for all monitored platforms.
 */
type UsageState = Record<MonitoredPlatform, PlatformUsage>;

/**
 * Multi-Platform Usage Monitor
 *
 * Tracks usage for different platforms and enforces defined thresholds.
 * Designed to integrate with the DevFlow agent classification system.
 */
export class MultiPlatformUsageMonitor {
  private usageState: UsageState;
  private readonly thresholds: Readonly<Record<MonitoredPlatform, UsageThreshold>>;

  constructor() {
    this.thresholds = {
      [MonitoredPlatform.GeminiCLI]: {
        limit: 100,
        timeWindow: 'day',
        fallbackThreshold: 60,
      },
      [MonitoredPlatform.QwenCLI]: {
        limit: 1000,
        timeWindow: 'day',
        fallbackThreshold: 900,
      },
      [MonitoredPlatform.CodexCLI]: {
        limit: 150,
        timeWindow: 'custom',
        customTimeWindowMs: 5 * 60 * 60 * 1000, // 5 hours
        disableFallback: true,
      },
      [MonitoredPlatform.Consensum]: {
        limit: 20,
        timeWindow: 'week',
        disableFallback: true, // Critical decisions should not fallback
      },
    };

    this.usageState = this.initializeUsageState();
  }

  /**
   * Initializes or resets the usage state for all platforms.
   * @returns The initial usage state.
   */
  private initializeUsageState(): UsageState {
    const now = Date.now();
    const initialState = {} as UsageState;
    for (const p in this.thresholds) {
      const platform = p as MonitoredPlatform;
      initialState[platform] = {
        requests: 0,
        windowStart: now,
      };
    }
    return initialState;
  }

  /**
   * Checks if the current usage window for a platform has expired and resets it if so.
   * This is a central part of the logic, ensuring usage is tracked over correct time periods.
   * @param platform The platform to check.
   */
  private checkAndResetWindow(platform: MonitoredPlatform): void {
    const now = Date.now();
    const threshold = this.thresholds[platform];
    const usage = this.usageState[platform];

    let windowDurationMs: number;
    switch (threshold.timeWindow) {
      case 'day':
        windowDurationMs = 24 * 60 * 60 * 1000;
        break;
      case 'week':
        windowDurationMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'custom':
        windowDurationMs = threshold.customTimeWindowMs!;
        break;
    }

    if (now - usage.windowStart > windowDurationMs) {
      this.resetUsage(platform);
    }
  }

  /**
   * Records usage for a specific platform. It's atomic in the sense that it's a single
   * point of entry for incrementing usage.
   * @param platform The platform for which to record usage.
   * @param requestCount The number of requests to add (default: 1).
   */
  public recordUsage(platform: MonitoredPlatform, requestCount: number = 1): void {
    this.checkAndResetWindow(platform);
    this.usageState[platform].requests += requestCount;
  }

  /**
   * Checks if a request is allowed for a given platform based on its current usage.
   * This check is the core of enforcing the atomic thresholds.
   * @param platform The platform to check.
   * @returns An object indicating if the request is allowed, a reason, and if fallback is suggested.
   */
  public checkUsage(platform: MonitoredPlatform): { allow: boolean; reason: string; fallback: boolean } {
    this.checkAndResetWindow(platform);

    const usage = this.usageState[platform];
    const threshold = this.thresholds[platform];
    const currentRequests = usage.requests;

    if (currentRequests >= threshold.limit) {
      return {
        allow: false,
        reason: `${platform} limit of ${threshold.limit} requests exceeded in the current window.`,
        fallback: !threshold.disableFallback,
      };
    }

    if (threshold.fallbackThreshold && currentRequests >= threshold.fallbackThreshold) {
      return {
        allow: true, // Still allowed, but fallback is suggested
        reason: `${platform} is approaching its limit (${currentRequests}/${threshold.limit}). Fallback is recommended to preserve capacity.`,
        fallback: !threshold.disableFallback,
      };
    }

    return {
      allow: true,
      reason: `Usage is within normal limits (${currentRequests}/${threshold.limit}).`,
      fallback: false,
    };
  }

  /**
   * Manually resets the usage statistics for a specific platform.
   * @param platform The platform to reset.
   */
  public resetUsage(platform: MonitoredPlatform): void {
    this.usageState[platform] = {
      requests: 0,
      windowStart: Date.now(),
    };
  }

  /**
   * Retrieves the current usage state for a platform, ensuring the window is current.
   * @param platform The platform to query.
   * @returns The current usage data.
   */
  public getUsage(platform: MonitoredPlatform): Readonly<PlatformUsage> {
    this.checkAndResetWindow(platform);
    return { ...this.usageState[platform] };
  }

  /**
   * Retrieves the defined thresholds for a platform.
   * @param platform The platform to query.
   * @returns The threshold configuration.
   */
  public getThresholds(platform: MonitoredPlatform): Readonly<UsageThreshold> {
    return this.thresholds[platform];
  }
}