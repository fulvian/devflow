import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionLimitDetector, type SessionMetrics } from './session-limit-detector';
import type { SQLiteMemoryManager } from '../memory/manager';

class TestMemory implements Partial<SQLiteMemoryManager> {
  private sessions: any[] = [];
  setActiveSessions(rows: any[]): void { this.sessions = rows; }
  async getActiveSessions(): Promise<any[]> { return this.sessions; }
  async storeEmergencyContext(): Promise<void> { /* no-op */ }
}

describe('SessionLimitDetector - Sonnet 5h time limit', () => {
  let memory: TestMemory;

  beforeEach(() => {
    memory = new TestMemory();
  });

  function makeClaudeSession(hoursElapsed: number): any {
    const start = new Date(Date.now() - hoursElapsed * 60 * 60 * 1000).toISOString();
    return {
      id: 's1',
      task_id: 't1',
      platform: 'claude_code',
      start_time: start,
      tokens_used: 1000,
      context_size_start: 0,
      end_time: null
    };
  }

  it('emits warning when elapsed >= 70% of 5h (~3.5h)', async () => {
    memory.setActiveSessions([makeClaudeSession(4.0)]); // 80% of 5h
    const detector = new SessionLimitDetector(memory as unknown as SQLiteMemoryManager);
    const warnings: SessionMetrics[] = [];
    detector.on('warning', m => warnings.push(m));

    // call private method via any cast to avoid waiting timers
    await (detector as any).checkAllSessions();

    expect(warnings.length).toBe(1);
    expect(warnings[0].platform).toBe('claude_code');
    expect(warnings[0].timeUtilization).toBeGreaterThan(0.75);
  });

  it('emits critical when elapsed >= 85% of 5h (~4.25h)', async () => {
    memory.setActiveSessions([makeClaudeSession(4.3)]); // ~86%
    const detector = new SessionLimitDetector(memory as unknown as SQLiteMemoryManager);
    const criticals: SessionMetrics[] = [];
    detector.on('critical', m => criticals.push(m));
    await (detector as any).checkAllSessions();

    expect(criticals.length).toBe(1);
    expect(criticals[0].warningLevel).toBe('critical');
  });

  it('emits emergency when elapsed >= 95% of 5h (~4.75h)', async () => {
    memory.setActiveSessions([makeClaudeSession(4.9)]); // 98%
    const detector = new SessionLimitDetector(memory as unknown as SQLiteMemoryManager);
    const emergencies: SessionMetrics[] = [];
    detector.on('emergency', m => emergencies.push(m));
    await (detector as any).checkAllSessions();

    expect(emergencies.length).toBe(1);
    expect(emergencies[0].warningLevel).toBe('emergency');
  });
});

