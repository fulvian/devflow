/**
 * Pro Plan Usage Monitoring System for Claude Code
 *
 * This module monitors Claude Code Pro Plan usage by parsing the /status command output,
 * tracking usage against 5-hour rolling windows and weekly limits, persisting data locally,
 * and triggering fallback mechanisms when approaching usage limits.
 */

import * as fs from 'fs';
import * as path from 'path';

// Interfaces for type safety
interface UsageWindow {
  timestamp: number; // Unix timestamp in milliseconds
  promptCount: number;
}

interface UsageData {
  windows: UsageWindow[];
  weeklyUsage: {
    startDate: number; // Unix timestamp in milliseconds
    totalHours: number;
  };
  lastUpdated: number; // Unix timestamp in milliseconds
}

interface UsageLimits {
  maxPromptsPerWindow: number; // Default: 40
  windowDurationMs: number; // 5 hours in milliseconds
  maxWeeklyHours: { min: number; max: number }; // 40-80 hours
  fallbackThreshold: number; // 90%
}

interface UsageStatus {
  currentWindowUsage: number;
  weeklyUsage: number;
  windowUtilization: number;
  weeklyUtilization: number;
  shouldFallback: boolean;
  nextWindowReset: number; // Unix timestamp in milliseconds
}

class ProPlanMonitor {
  private readonly dataFilePath: string;
  private readonly limits: UsageLimits;
  private usageData: UsageData;

  constructor(dataDirectory: string = './data') {
    this.dataFilePath = path.join(dataDirectory, 'claude_usage.json');

    // Define usage limits according to Pro Plan specifications
    this.limits = {
      maxPromptsPerWindow: 40,
      windowDurationMs: 5 * 60 * 60 * 1000, // 5 hours
      maxWeeklyHours: { min: 40, max: 80 },
      fallbackThreshold: 0.9 // 90%
    };

    // Ensure data directory exists
    if (!fs.existsSync(dataDirectory)) {
      fs.mkdirSync(dataDirectory, { recursive: true });
    }

    // Load existing usage data or initialize new
    this.usageData = this.loadUsageData();
  }

  /**
   * Parse the /status command output to extract current usage information
   * @param statusOutput - Raw output from Claude Code's /status command
   * @returns Parsed usage metrics
   */
  public parseStatusOutput(statusOutput: string): { promptCount: number } {
    // Example status output parsing (implementation depends on actual format)
    // This is a simplified example - actual implementation would depend on real output format
    const promptMatch = statusOutput.match(/Prompts used this window: (\d+)/);
    const promptCount = promptMatch ? parseInt(promptMatch[1], 10) : 0;

    return { promptCount };
  }

  /**
   * Record a new prompt usage
   */
  public recordPrompt(): void {
    const now = Date.now();

    // Clean up expired windows
    this.cleanupExpiredWindows(now);

    // Update current window
    const currentWindow = this.getCurrentWindow(now);
    currentWindow.promptCount += 1;

    // Update weekly usage
    this.updateWeeklyUsage(now);

    // Update last modified timestamp
    this.usageData.lastUpdated = now;

    // Persist data
    this.saveUsageData();
  }

  /**
   * Get current usage status and limits
   * @returns Current usage status including utilization and fallback triggers
   */
  public getUsageStatus(): UsageStatus {
    const now = Date.now();

    // Clean up expired data
    this.cleanupExpiredWindows(now);

    // Calculate current window usage
    const currentWindow = this.getCurrentWindow(now);
    const windowUtilization = currentWindow.promptCount / this.limits.maxPromptsPerWindow;

    // Calculate weekly usage
    const weeklyHours = this.calculateWeeklyHours(now);
    const maxWeeklyHours = this.limits.maxWeeklyHours.max;
    const weeklyUtilization = weeklyHours / maxWeeklyHours;

    // Determine if fallback should be triggered
    const shouldFallback =
      windowUtilization >= this.limits.fallbackThreshold ||
      weeklyUtilization >= this.limits.fallbackThreshold;

    // Calculate when next window resets
    const nextWindowReset = currentWindow.timestamp + this.limits.windowDurationMs;

    return {
      currentWindowUsage: currentWindow.promptCount,
      weeklyUsage: weeklyHours,
      windowUtilization,
      weeklyUtilization,
      shouldFallback,
      nextWindowReset
    };
  }

  /**
   * Reset all usage data (for testing or manual reset)
   */
  public resetUsageData(): void {
    this.usageData = {
      windows: [],
      weeklyUsage: {
        startDate: Date.now(),
        totalHours: 0
      },
      lastUpdated: Date.now()
    };
    this.saveUsageData();
  }

  /**
   * Load usage data from local persistence
   */
  private loadUsageData(): UsageData {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const data = fs.readFileSync(this.dataFilePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load usage data, initializing new data store', error);
    }

    // Return default data structure
    return {
      windows: [],
      weeklyUsage: {
        startDate: Date.now(),
        totalHours: 0
      },
      lastUpdated: Date.now()
    };
  }

  /**
   * Save usage data to local persistence
   */
  private saveUsageData(): void {
    try {
      fs.writeFileSync(this.dataFilePath, JSON.stringify(this.usageData, null, 2));
    } catch (error) {
      console.error('Failed to save usage data', error);
    }
  }

  /**
   * Get or create current usage window
   */
  private getCurrentWindow(now: number): UsageWindow {
    // Find existing window that includes current time
    let currentWindow = this.usageData.windows.find(window =>
      now >= window.timestamp &&
      now < window.timestamp + this.limits.windowDurationMs
    );

    // If no current window exists, create a new one
    if (!currentWindow) {
      currentWindow = {
        timestamp: now,
        promptCount: 0
      };
      this.usageData.windows.push(currentWindow);
    }

    return currentWindow;
  }

  /**
   * Remove expired windows from tracking
   */
  private cleanupExpiredWindows(now: number): void {
    // Remove windows that are older than the window duration
    this.usageData.windows = this.usageData.windows.filter(window =>
      now < window.timestamp + this.limits.windowDurationMs
    );
  }

  /**
   * Update weekly usage tracking
   */
  private updateWeeklyUsage(now: number): void {
    // Check if we need to reset weekly tracking (new week)
    const weekDuration = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

    if (now >= this.usageData.weeklyUsage.startDate + weekDuration) {
      // Reset weekly tracking for new week
      this.usageData.weeklyUsage = {
        startDate: now,
        totalHours: 0
      };
    }

    // Increment usage (approximating prompt usage as time usage)
    // In a real implementation, this would be more sophisticated
    this.usageData.weeklyUsage.totalHours += 0.01; // Small increment per prompt
  }

  /**
   * Calculate current weekly hours usage
   */
  private calculateWeeklyHours(now: number): number {
    // If weekly tracking is outdated, return 0
    const weekDuration = 7 * 24 * 60 * 60 * 1000;
    if (now >= this.usageData.weeklyUsage.startDate + weekDuration) {
      return 0;
    }

    return this.usageData.weeklyUsage.totalHours;
  }
}

export { ProPlanMonitor, UsageStatus, UsageLimits };
export default ProPlanMonitor;