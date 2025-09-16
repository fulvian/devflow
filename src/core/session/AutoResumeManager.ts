/**
 * AutoResumeManager - Intelligent session resumption manager
 * Handles session limit events and schedules smart resumption timing
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { ClaudeSessionTracker } from './ClaudeSessionTracker';

interface ResumeSchedule {
  sessionId: string;
  scheduledTime: string;
  originalLimitTime: string;
  bufferMinutes: number;
  status: 'scheduled' | 'completed' | 'failed' | 'cancelled';
  retryCount: number;
}

interface AutoResumeConfig {
  bufferMinutes: number; // Extra minutes to wait beyond limit reset
  maxRetries: number;
  retryIntervalMinutes: number;
  enabledTimeRanges: Array<{start: string, end: string}>; // e.g., ["09:00", "18:00"]
}

export class AutoResumeManager {
  private scheduleFile: string;
  private configFile: string;
  private schedules: Map<string, ResumeSchedule> = new Map();
  private config: AutoResumeConfig;
  private sessionTracker?: ClaudeSessionTracker;
  private resumeTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    const baseDir = path.join(process.cwd(), '.devflow', 'sessions');
    this.scheduleFile = path.join(baseDir, 'resume_schedule.json');
    this.configFile = path.join(baseDir, 'autoresume_config.json');

    // Default configuration
    this.config = {
      bufferMinutes: 5, // Wait 5 extra minutes beyond reset time
      maxRetries: 3,
      retryIntervalMinutes: 10,
      enabledTimeRanges: [
        {start: "08:00", end: "22:00"} // Only auto-resume between 8 AM and 10 PM
      ]
    };
  }

  initialize(): void {
    try {
      // Load existing configuration and schedules
      this.loadConfiguration();
      this.loadExistingSchedules();

      // Restore any pending resume timers
      this.restorePendingTimers();

      console.log('🔄 AutoResumeManager initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AutoResumeManager:', error);
      throw error;
    }
  }

  setSessionTracker(tracker: ClaudeSessionTracker): void {
    this.sessionTracker = tracker;
  }

  async handleSessionLimitReached(sessionId: string): Promise<void> {
    try {
      console.log(`⏰ Handling session limit reached for ${sessionId}`);

      // Cancel any existing schedule for this session
      await this.cancelSchedule(sessionId);

      // Get session info to determine resume time
      const sessionInfo = await this.getSessionInfo(sessionId);
      if (!sessionInfo || !sessionInfo.limitInfo) {
        throw new Error(`No limit info found for session ${sessionId}`);
      }

      // Calculate intelligent resume time
      const resumeTime = this.calculateIntelligentResumeTime(
        sessionInfo.limitInfo.resetTime,
        sessionInfo.limitInfo.timeRemaining
      );

      // Create resume schedule
      const schedule: ResumeSchedule = {
        sessionId,
        scheduledTime: resumeTime.toISOString(),
        originalLimitTime: sessionInfo.limitInfo.resetTime,
        bufferMinutes: this.config.bufferMinutes,
        status: 'scheduled',
        retryCount: 0
      };

      // Save schedule
      this.schedules.set(sessionId, schedule);
      await this.saveSchedules();

      // Set timer for resume
      const delayMs = resumeTime.getTime() - Date.now();
      if (delayMs > 0) {
        const timer = setTimeout(() => {
          this.executeResume(sessionId);
        }, delayMs);

        this.resumeTimers.set(sessionId, timer);

        console.log(`📅 Auto-resume scheduled for ${sessionId} at ${resumeTime.toISOString()}`);
        console.log(`⏱️ Will wait ${Math.round(delayMs / 60000)} minutes before resuming`);
      } else {
        console.log(`⚡ Resume time already passed, executing immediately for ${sessionId}`);
        await this.executeResume(sessionId);
      }

    } catch (error) {
      console.error(`❌ Failed to handle session limit for ${sessionId}:`, error);
      throw error;
    }
  }

  private calculateIntelligentResumeTime(resetTime: string, timeRemainingMinutes: number): Date {
    const baseResetTime = new Date(resetTime);

    // Add buffer minutes to avoid immediate re-limiting
    const bufferTime = new Date(baseResetTime.getTime() + (this.config.bufferMinutes * 60 * 1000));

    // Check if the resume time falls within allowed hours
    const resumeTimeAdjusted = this.adjustForAllowedHours(bufferTime);

    return resumeTimeAdjusted;
  }

  private adjustForAllowedHours(proposedTime: Date): Date {
    const hour = proposedTime.getHours();
    const timeStr = `${hour.toString().padStart(2, '0')}:${proposedTime.getMinutes().toString().padStart(2, '0')}`;

    // Check if time is within any allowed range
    const isAllowed = this.config.enabledTimeRanges.some(range => {
      return timeStr >= range.start && timeStr <= range.end;
    });

    if (isAllowed) {
      return proposedTime;
    }

    // If not allowed, schedule for next morning at 8 AM
    const nextMorning = new Date(proposedTime);
    nextMorning.setDate(nextMorning.getDate() + 1);
    nextMorning.setHours(8, 0, 0, 0);

    console.log(`🌙 Resume time ${proposedTime.toISOString()} outside allowed hours, rescheduled to ${nextMorning.toISOString()}`);
    return nextMorning;
  }

  private async executeResume(sessionId: string): Promise<void> {
    try {
      const schedule = this.schedules.get(sessionId);
      if (!schedule) {
        console.warn(`⚠️ No schedule found for session ${sessionId}`);
        return;
      }

      console.log(`🚀 Executing auto-resume for session ${sessionId}`);

      // Mark as completed
      schedule.status = 'completed';
      this.schedules.set(sessionId, schedule);
      await this.saveSchedules();

      // Clear timer
      const timer = this.resumeTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.resumeTimers.delete(sessionId);
      }

      // Here you would integrate with Claude Code to actually resume the session
      // For now, we just log the event and could trigger a notification
      await this.logResumeEvent(sessionId);

      console.log(`✅ Auto-resume executed for session ${sessionId}`);

    } catch (error) {
      console.error(`❌ Failed to execute resume for ${sessionId}:`, error);

      // Handle retry logic
      const schedule = this.schedules.get(sessionId);
      if (schedule && schedule.retryCount < this.config.maxRetries) {
        schedule.retryCount++;
        schedule.status = 'scheduled';

        // Retry after interval
        const retryTime = new Date(Date.now() + (this.config.retryIntervalMinutes * 60 * 1000));
        schedule.scheduledTime = retryTime.toISOString();

        this.schedules.set(sessionId, schedule);
        await this.saveSchedules();

        console.log(`🔄 Retry ${schedule.retryCount}/${this.config.maxRetries} scheduled for ${sessionId}`);
      } else {
        // Mark as failed
        if (schedule) {
          schedule.status = 'failed';
          this.schedules.set(sessionId, schedule);
          await this.saveSchedules();
        }
      }
    }
  }

  private async cancelSchedule(sessionId: string): Promise<void> {
    const schedule = this.schedules.get(sessionId);
    if (schedule) {
      schedule.status = 'cancelled';
      this.schedules.set(sessionId, schedule);
      await this.saveSchedules();
    }

    // Clear any existing timer
    const timer = this.resumeTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.resumeTimers.delete(sessionId);
    }
  }

  private async getSessionInfo(sessionId: string): Promise<any> {
    // This would normally get session info from ClaudeSessionTracker
    // For now, we'll try to read from the session file
    try {
      const sessionFile = path.join(path.dirname(this.scheduleFile), `${sessionId}.json`);
      if (existsSync(sessionFile)) {
        const content = await fs.readFile(sessionFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`⚠️ Could not load session info for ${sessionId}:`, error);
    }
    return null;
  }

  private loadConfiguration(): void {
    try {
      if (existsSync(this.configFile)) {
        const content = require(this.configFile);
        this.config = { ...this.config, ...content };
      }
    } catch (error) {
      console.warn('⚠️ Using default AutoResume configuration');
    }
  }

  private loadExistingSchedules(): void {
    try {
      if (existsSync(this.scheduleFile)) {
        const content = require(this.scheduleFile);
        if (Array.isArray(content.schedules)) {
          content.schedules.forEach((schedule: ResumeSchedule) => {
            this.schedules.set(schedule.sessionId, schedule);
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not load existing schedules');
    }
  }

  private restorePendingTimers(): void {
    const now = Date.now();

    this.schedules.forEach((schedule, sessionId) => {
      if (schedule.status === 'scheduled') {
        const scheduledTime = new Date(schedule.scheduledTime).getTime();
        const delayMs = scheduledTime - now;

        if (delayMs > 0) {
          const timer = setTimeout(() => {
            this.executeResume(sessionId);
          }, delayMs);

          this.resumeTimers.set(sessionId, timer);
          console.log(`🔄 Restored timer for session ${sessionId}, resuming in ${Math.round(delayMs / 60000)} minutes`);
        } else {
          // Schedule is overdue, execute immediately
          this.executeResume(sessionId);
        }
      }
    });
  }

  private async saveSchedules(): Promise<void> {
    try {
      const scheduleData = {
        updated: new Date().toISOString(),
        schedules: Array.from(this.schedules.values())
      };

      await fs.writeFile(this.scheduleFile, JSON.stringify(scheduleData, null, 2));
    } catch (error) {
      console.error('❌ Failed to save schedules:', error);
    }
  }

  private async logResumeEvent(sessionId: string): Promise<void> {
    try {
      const logFile = path.join(process.cwd(), 'logs', 'session-retry.log');
      const logEntry = `[${new Date().toISOString()}] AUTO-RESUME: Session ${sessionId} resumed successfully\n`;

      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.warn('⚠️ Could not write to resume log:', error);
    }
  }
}