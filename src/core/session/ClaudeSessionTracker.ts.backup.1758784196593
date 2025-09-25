/**
 * ClaudeSessionTracker - Core session tracking for smart retry system
 * Monitors Claude Code sessions, records messages, and detects rate limit events
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

interface SessionData {
  id: string;
  status: 'active' | 'limited' | 'completed' | 'error';
  messageCount: number;
  startTime: string;
  lastActivity: string;
  limitInfo?: {
    message: string;
    timeRemaining: number; // minutes
    resetTime: string;
  };
}

interface LimitParseResult {
  hours: number;
  minutes: number;
  totalMinutes: number;
}

export class ClaudeSessionTracker {
  private sessionsDir: string;
  private sessions: Map<string, SessionData> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.sessionsDir = path.join(process.cwd(), '.devflow', 'sessions');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure sessions directory exists
      if (!existsSync(this.sessionsDir)) {
        await fs.mkdir(this.sessionsDir, { recursive: true });
      }

      // Load existing sessions
      await this.loadExistingSessions();

      this.initialized = true;
      console.log('🔧 ClaudeSessionTracker initialized');
    } catch (error) {
      console.error('❌ Failed to initialize ClaudeSessionTracker:', error);
      throw error;
    }
  }

  async startSession(sessionNumber: number): Promise<string> {
    if (!this.initialized) {
      throw new Error('ClaudeSessionTracker not initialized');
    }

    const sessionId = `session_${sessionNumber}_${Date.now()}`;
    const sessionData: SessionData = {
      id: sessionId,
      status: 'active',
      messageCount: 0,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    this.sessions.set(sessionId, sessionData);
    await this.saveSession(sessionData);

    console.log(`📝 Session ${sessionId} started`);
    return sessionId;
  }

  async recordMessage(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.messageCount++;
    session.lastActivity = new Date().toISOString();

    await this.saveSession(session);
    console.log(`📊 Message recorded for ${sessionId} (count: ${session.messageCount})`);
  }

  async recordLimitEvent(sessionId: string, limitMessage: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const limitInfo = this.parseLimitMessage(limitMessage);

    session.status = 'limited';
    session.lastActivity = new Date().toISOString();
    session.limitInfo = {
      message: limitMessage,
      timeRemaining: limitInfo.totalMinutes,
      resetTime: this.calculateResetTime(limitInfo.totalMinutes)
    };

    await this.saveSession(session);

    console.log(`⏰ Limit event recorded for ${sessionId}: ${limitInfo.hours}h ${limitInfo.minutes}m remaining`);
  }

  async getActiveSessions(): Promise<Array<{id: string, status: string}>> {
    await this.loadExistingSessions();

    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      status: session.status
    }));
  }

  private parseLimitMessage(message: string): LimitParseResult {
    // Parse messages like "5-hour limit reached ∙ resets 3am"
    const resetTimeRegex = /resets\s*(\d+)(?::(\d+))?\s*(am|pm)/i;
    const resetMatch = message.match(resetTimeRegex);

    if (resetMatch) {
      const hour = parseInt(resetMatch[1], 10);
      const minute = resetMatch[2] ? parseInt(resetMatch[2], 10) : 0;
      const period = resetMatch[3].toLowerCase();
      
      // Convert to 24-hour format
      let hour24 = hour;
      if (period === 'pm' && hour !== 12) {
        hour24 += 12;
      } else if (period === 'am' && hour === 12) {
        hour24 = 0;
      }
      
      // Calculate time until reset
      const now = new Date();
      const resetTime = new Date(now);
      resetTime.setHours(hour24, minute, 0, 0);
      
      // If reset time is in the past, it's for tomorrow
      if (resetTime <= now) {
        resetTime.setDate(resetTime.getDate() + 1);
      }
      
      const minutesUntilReset = Math.ceil((resetTime.getTime() - now.getTime()) / 60000);
      
      return {
        hours: Math.floor(minutesUntilReset / 60),
        minutes: minutesUntilReset % 60,
        totalMinutes: minutesUntilReset
      };
    }

    // Parse messages like "You've reached the limit. 3h 25m remaining until reset."
    const timeRegex = /(\d+)h\s*(\d+)m\s*remaining/i;
    const match = message.match(timeRegex);

    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      return {
        hours,
        minutes,
        totalMinutes: hours * 60 + minutes
      };
    }

    // Fallback: try to parse hours only
    const hoursOnlyRegex = /(\d+)h\s*remaining/i;
    const hoursMatch = message.match(hoursOnlyRegex);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1], 10);
      return {
        hours,
        minutes: 0,
        totalMinutes: hours * 60
      };
    }

    // Default fallback
    console.warn(`⚠️ Could not parse limit message: ${message}`);
    return {
      hours: 3,
      minutes: 0,
      totalMinutes: 180 // 3 hours default
    };
  }

  private calculateResetTime(minutesFromNow: number): string {
    const resetTime = new Date();
    resetTime.setMinutes(resetTime.getMinutes() + minutesFromNow);
    return resetTime.toISOString();
  }

  private async saveSession(sessionData: SessionData): Promise<void> {
    try {
      const sessionFile = path.join(this.sessionsDir, `${sessionData.id}.json`);
      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));

      // Also update the current session file used by monitoring
      const currentSessionFile = path.join(this.sessionsDir, 'current_session.json');
      const currentSessionData = {
        last_activity: sessionData.lastActivity,
        task: sessionData.id,
        progress: sessionData.messageCount,
        status: sessionData.status,
        auto_resume_enabled: true,
        session_data: sessionData
      };

      await fs.writeFile(currentSessionFile, JSON.stringify(currentSessionData, null, 2));
    } catch (error) {
      console.error(`❌ Failed to save session ${sessionData.id}:`, error);
      throw error;
    }
  }

  private async loadExistingSessions(): Promise<void> {
    try {
      if (!existsSync(this.sessionsDir)) {
        return;
      }

      const files = await fs.readdir(this.sessionsDir);
      const sessionFiles = files.filter(file => file.endsWith('.json') && file !== 'current_session.json');

      for (const file of sessionFiles) {
        try {
          const filePath = path.join(this.sessionsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const sessionData: SessionData = JSON.parse(content);
          this.sessions.set(sessionData.id, sessionData);
        } catch (error) {
          console.warn(`⚠️ Failed to load session file ${file}:`, error);
        }
      }

      console.log(`📂 Loaded ${this.sessions.size} existing sessions`);
    } catch (error) {
      console.error('❌ Failed to load existing sessions:', error);
    }
  }
}