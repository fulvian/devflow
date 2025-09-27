/**
 * DAICResumeCommand - DAIC integration for manual session resume control
 * Provides CLI interface for managing session resumption
 */

import { ClaudeSessionTracker } from '../core/session/ClaudeSessionTracker';
import { AutoResumeManager } from '../core/session/AutoResumeManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

interface ResumeCommandOptions {
  sessionId?: string;
  force?: boolean;
  list?: boolean;
  cancel?: string;
  status?: boolean;
}

interface SessionSummary {
  id: string;
  status: string;
  messageCount: number;
  lastActivity: string;
  limitInfo?: string;
  autoResumeScheduled?: string;
}

export class DAICResumeCommand {
  private sessionTracker: ClaudeSessionTracker;
  private autoResumeManager: AutoResumeManager;
  private initialized: boolean = false;

  constructor() {
    this.sessionTracker = new ClaudeSessionTracker();
    this.autoResumeManager = new AutoResumeManager();

    // Initialize components
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.sessionTracker.initialize();
      this.autoResumeManager.initialize();
      this.autoResumeManager.setSessionTracker(this.sessionTracker);

      this.initialized = true;
      console.log('🛠️ DAIC Resume Command initialized');
    } catch (error) {
      console.error('❌ Failed to initialize DAIC Resume Command:', error);
    }
  }

  async execute(options: ResumeCommandOptions = {}): Promise<void> {
    if (!this.initialized) {
      console.error('❌ DAIC Resume Command not initialized');
      return;
    }

    try {
      if (options.list) {
        await this.listSessions();
      } else if (options.status) {
        await this.showStatus();
      } else if (options.cancel) {
        await this.cancelAutoResume(options.cancel);
      } else if (options.sessionId) {
        await this.resumeSession(options.sessionId, options.force || false);
      } else {
        this.showHelp();
      }
    } catch (error) {
      console.error('❌ Command execution failed:', error);
    }
  }

  async listSessions(): Promise<void> {
    console.log('📋 Available Sessions for Resume:\n');

    try {
      const sessions = await this.sessionTracker.getActiveSessions();
      const sessionDetails = await this.getSessionDetails();

      if (sessions.length === 0) {
        console.log('   No sessions found.');
        return;
      }

      console.log('   ID                           Status      Messages  Last Activity');
      console.log('   ' + '-'.repeat(70));

      for (const session of sessions) {
        const details = sessionDetails.find(d => d.id === session.id);
        if (details) {
          const id = details.id.substring(0, 28).padEnd(28);
          const status = details.status.padEnd(10);
          const messages = details.messageCount.toString().padEnd(8);
          const lastActivity = new Date(details.lastActivity).toLocaleString();

          console.log(`   ${id} ${status} ${messages} ${lastActivity}`);

          if (details.limitInfo) {
            console.log(`      ⏰ Limit: ${details.limitInfo}`);
          }

          if (details.autoResumeScheduled) {
            console.log(`      🔄 Auto-resume: ${details.autoResumeScheduled}`);
          }
        }
      }

      console.log('\n💡 Usage:');
      console.log('   daic resume --session <session_id>           # Resume specific session');
      console.log('   daic resume --session <session_id> --force   # Force resume (ignore timing)');
      console.log('   daic resume --cancel <session_id>            # Cancel auto-resume');

    } catch (error) {
      console.error('❌ Failed to list sessions:', error);
    }
  }

  async showStatus(): Promise<void> {
    console.log('📊 Session Retry System Status:\n');

    try {
      const sessions = await this.sessionTracker.getActiveSessions();
      const schedules = await this.getResumeSchedules();

      console.log(`   Active Sessions: ${sessions.length}`);
      console.log(`   Scheduled Resumes: ${schedules.filter(s => s.status === 'scheduled').length}`);
      console.log(`   Completed Resumes: ${schedules.filter(s => s.status === 'completed').length}`);
      console.log(`   Failed Resumes: ${schedules.filter(s => s.status === 'failed').length}`);

      // Show recent activity
      const recentLog = await this.getRecentLogEntries();
      if (recentLog.length > 0) {
        console.log('\n📝 Recent Resume Activity:');
        recentLog.forEach(entry => {
          console.log(`   ${entry}`);
        });
      }

    } catch (error) {
      console.error('❌ Failed to show status:', error);
    }
  }

  async resumeSession(sessionId: string, force: boolean = false): Promise<void> {
    try {
      console.log(`🚀 Attempting to resume session: ${sessionId}`);

      if (!force) {
        // Check if session is in a valid state for resume
        const sessions = await this.sessionTracker.getActiveSessions();
        const session = sessions.find(s => s.id === sessionId);

        if (!session) {
          console.error(`❌ Session ${sessionId} not found`);
          return;
        }

        if (session.status === 'active') {
          console.log(`⚠️ Session ${sessionId} is already active. Use --force to override.`);
          return;
        }
      }

      // Trigger resume (this would integrate with Claude Code)
      await this.triggerSessionResume(sessionId);

      console.log(`✅ Session ${sessionId} resume triggered`);

    } catch (error) {
      console.error(`❌ Failed to resume session ${sessionId}:`, error);
    }
  }

  async cancelAutoResume(sessionId: string): Promise<void> {
    try {
      console.log(`🛑 Cancelling auto-resume for session: ${sessionId}`);

      // This would call AutoResumeManager to cancel the schedule
      // For now, we just update the schedule file
      const scheduleFile = path.join(process.cwd(), '.devflow', 'sessions', 'resume_schedule.json');

      if (existsSync(scheduleFile)) {
        const content = await fs.readFile(scheduleFile, 'utf-8');
        const data = JSON.parse(content);

        if (data.schedules) {
          const schedule = data.schedules.find((s: any) => s.sessionId === sessionId);
          if (schedule) {
            schedule.status = 'cancelled';
            await fs.writeFile(scheduleFile, JSON.stringify(data, null, 2));
            console.log(`✅ Auto-resume cancelled for session ${sessionId}`);
          } else {
            console.log(`⚠️ No auto-resume schedule found for session ${sessionId}`);
          }
        }
      }

    } catch (error) {
      console.error(`❌ Failed to cancel auto-resume for ${sessionId}:`, error);
    }
  }

  private async getSessionDetails(): Promise<SessionSummary[]> {
    const sessionsDir = path.join(process.cwd(), '.devflow', 'sessions');
    const details: SessionSummary[] = [];

    try {
      if (!existsSync(sessionsDir)) {
        return details;
      }

      const files = await fs.readdir(sessionsDir);
      const sessionFiles = files.filter(file => file.endsWith('.json') && file !== 'current_session.json' && file !== 'resume_schedule.json');

      for (const file of sessionFiles) {
        try {
          const filePath = path.join(sessionsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const sessionData = JSON.parse(content);

          const summary: SessionSummary = {
            id: sessionData.id,
            status: sessionData.status,
            messageCount: sessionData.messageCount,
            lastActivity: sessionData.lastActivity
          };

          if (sessionData.limitInfo) {
            summary.limitInfo = `${sessionData.limitInfo.message}`;
          }

          details.push(summary);
        } catch (error) {
          console.warn(`⚠️ Failed to read session file ${file}`);
        }
      }

      // Add auto-resume schedule info
      const schedules = await this.getResumeSchedules();
      details.forEach(detail => {
        const schedule = schedules.find(s => s.sessionId === detail.id && s.status === 'scheduled');
        if (schedule) {
          detail.autoResumeScheduled = new Date(schedule.scheduledTime).toLocaleString();
        }
      });

    } catch (error) {
      console.error('❌ Failed to get session details:', error);
    }

    return details;
  }

  private async getResumeSchedules(): Promise<any[]> {
    try {
      const scheduleFile = path.join(process.cwd(), '.devflow', 'sessions', 'resume_schedule.json');

      if (existsSync(scheduleFile)) {
        const content = await fs.readFile(scheduleFile, 'utf-8');
        const data = JSON.parse(content);
        return data.schedules || [];
      }
    } catch (error) {
      console.warn('⚠️ Could not read resume schedules');
    }

    return [];
  }

  private async getRecentLogEntries(): Promise<string[]> {
    try {
      const logFile = path.join(process.cwd(), 'logs', 'session-retry.log');

      if (existsSync(logFile)) {
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        return lines.slice(-5); // Last 5 entries
      }
    } catch (error) {
      console.warn('⚠️ Could not read log file');
    }

    return [];
  }

  private async triggerSessionResume(sessionId: string): Promise<void> {
    // This is where you would integrate with Claude Code to actually resume the session
    // For now, we'll just log the event and update the session status

    const logFile = path.join(process.cwd(), 'logs', 'session-retry.log');
    const logEntry = `[${new Date().toISOString()}] MANUAL-RESUME: Session ${sessionId} resumed via DAIC command\n`;

    try {
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.warn('⚠️ Could not write to log file');
    }

    console.log('📝 Resume event logged');
  }

  private showHelp(): void {
    console.log('🛠️ DAIC Resume Command - Smart Session Retry System\n');
    console.log('Usage:');
    console.log('  daic resume --list                           # List all sessions');
    console.log('  daic resume --status                         # Show system status');
    console.log('  daic resume --session <id>                   # Resume specific session');
    console.log('  daic resume --session <id> --force           # Force resume');
    console.log('  daic resume --cancel <id>                    # Cancel auto-resume');
    console.log('');
    console.log('Examples:');
    console.log('  daic resume --list');
    console.log('  daic resume --session session_1_1694123456789');
    console.log('  daic resume --cancel session_1_1694123456789');
  }
}