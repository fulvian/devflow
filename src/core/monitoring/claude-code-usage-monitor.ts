/**
 * Claude Code Pro Account Usage Monitor
 *
 * Tracks actual prompt usage for Claude Code Pro accounts based on:
 * - 5-hour rolling windows
 * - 10-40 prompt limit per window
 * - Real prompt counting (not tokens)
 * - Session-based resets
 */

interface PromptRecord {
  timestamp: Date;
  promptId: string;
}

interface UsageWindow {
  startTime: Date;
  endTime: Date;
  promptCount: number;
  prompts: PromptRecord[];
}

class ClaudeCodeProUsageMonitor {
  private usageWindows: UsageWindow[] = [];
  private readonly WINDOW_DURATION_HOURS = 5;
  private readonly MIN_PROMPTS_PER_WINDOW = 10;
  private readonly MAX_PROMPTS_PER_WINDOW = 40;

  /**
   * Records a prompt usage and returns current usage statistics
   * @param promptId Unique identifier for the prompt
   * @returns Usage statistics including percentage and remaining prompts
   */
  public recordPrompt(promptId: string): {
    usagePercentage: number;
    promptsUsed: number;
    promptsRemaining: number;
    isLimitExceeded: boolean;
    nextResetTime: Date | null;
  } {
    try {
      const now = new Date();

      // Clean up old windows first
      this.cleanupExpiredWindows(now);

      // Add current prompt to active window
      this.addPromptToCurrentWindow(promptId, now);

      // Calculate usage statistics
      const currentWindow = this.getCurrentWindow(now);
      const usagePercentage = this.calculateUsagePercentage(currentWindow.promptCount);
      const isLimitExceeded = currentWindow.promptCount >= this.MAX_PROMPTS_PER_WINDOW;
      const nextResetTime = currentWindow ? currentWindow.endTime : null;

      return {
        usagePercentage,
        promptsUsed: currentWindow.promptCount,
        promptsRemaining: Math.max(0, this.MAX_PROMPTS_PER_WINDOW - currentWindow.promptCount),
        isLimitExceeded,
        nextResetTime
      };
    } catch (error) {
      throw new Error(`Failed to record prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets current usage statistics without recording a new prompt
   */
  public getCurrentUsage(): {
    usagePercentage: number;
    promptsUsed: number;
    promptsRemaining: number;
    isLimitExceeded: boolean;
    nextResetTime: Date | null;
  } {
    try {
      const now = new Date();
      this.cleanupExpiredWindows(now);

      const currentWindow = this.getCurrentWindow(now);
      const usagePercentage = this.calculateUsagePercentage(currentWindow.promptCount);
      const isLimitExceeded = currentWindow.promptCount >= this.MAX_PROMPTS_PER_WINDOW;
      const nextResetTime = currentWindow ? currentWindow.endTime : null;

      return {
        usagePercentage,
        promptsUsed: currentWindow.promptCount,
        promptsRemaining: Math.max(0, this.MAX_PROMPTS_PER_WINDOW - currentWindow.promptCount),
        isLimitExceeded,
        nextResetTime
      };
    } catch (error) {
      throw new Error(`Failed to get current usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Gets detailed usage history
   */
  public getUsageHistory(): UsageWindow[] {
    try {
      const now = new Date();
      this.cleanupExpiredWindows(now);
      return [...this.usageWindows];
    } catch (error) {
      throw new Error(`Failed to get usage history: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resets all usage data (useful for testing or manual resets)
   */
  public resetUsage(): void {
    this.usageWindows = [];
  }

  /**
   * Removes expired windows and returns current active window
   */
  private cleanupExpiredWindows(currentTime: Date): void {
    const cutoffTime = new Date(currentTime.getTime() - (this.WINDOW_DURATION_HOURS * 60 * 60 * 1000));
    this.usageWindows = this.usageWindows.filter(window => window.endTime > cutoffTime);
  }

  /**
   * Gets or creates the current 5-hour window
   */
  private getCurrentWindow(currentTime: Date): UsageWindow {
    // Find existing window that includes current time
    let currentWindow = this.usageWindows.find(window =>
      window.startTime <= currentTime && window.endTime > currentTime
    );

    // If no current window exists, create a new one
    if (!currentWindow) {
      const startTime = new Date(currentTime);
      const endTime = new Date(startTime.getTime() + (this.WINDOW_DURATION_HOURS * 60 * 60 * 1000));

      currentWindow = {
        startTime,
        endTime,
        promptCount: 0,
        prompts: []
      };

      this.usageWindows.push(currentWindow);
    }

    return currentWindow;
  }

  /**
   * Adds a prompt to the current window
   */
  private addPromptToCurrentWindow(promptId: string, timestamp: Date): void {
    const currentWindow = this.getCurrentWindow(timestamp);

    currentWindow.prompts.push({
      timestamp,
      promptId
    });

    currentWindow.promptCount = currentWindow.prompts.length;
  }

  /**
   * Calculates usage percentage based on prompt count
   * Uses MAX_PROMPTS_PER_WINDOW as the baseline (conservative approach)
   */
  private calculateUsagePercentage(promptCount: number): number {
    if (promptCount <= 0) return 0;
    const percentage = (promptCount / this.MAX_PROMPTS_PER_WINDOW) * 100;
    return Math.min(100, Math.max(0, percentage));
  }
}

// Export the main monitor class
export { ClaudeCodeProUsageMonitor };

// Export types for external use
export type { PromptRecord, UsageWindow };