import type { AdapterConfig as ClaudeAdapterConfig } from '@devflow/shared';
import { PlatformHandoffEngine } from './handoff-engine.js';
import { ContextManager } from './context/manager.js';
import { MCPService } from './mcp-server.js';
import { SQLiteMemoryManager } from '@devflow/core';
import * as fs from 'fs';
import * as path from 'path';

export class ClaudeCodeAdapter {
  private config: ClaudeAdapterConfig;
  // SQLite/Embedding disabilitati in produzione: usa solo cc-sessions store
  private handoffEngine: PlatformHandoffEngine | null = null;
  private contextManager: ContextManager | null = null;
  private mcpService: MCPService | null = null;

  private readonly stateDir = path.resolve(process.cwd(), '.claude/state');
  private readonly sessionsDir = path.resolve(process.cwd(), 'sessions');

  constructor(config: ClaudeAdapterConfig) {
    this.config = config;
    // no local memory/embedding in questa configurazione
    
    if ((config as any).enableHandoff) {
      this.handoffEngine = new PlatformHandoffEngine();
    }
    
    if ((config as any).contextDir) {
      const memoryManager = new SQLiteMemoryManager();
      this.contextManager = new ContextManager(memoryManager, (config as any).contextDir);
    }
    
    if ((config as any).enableMCP) {
      this.mcpService = new MCPService();
    }
  }

  async processMessage(message: { content: string; role: 'user' | 'assistant' }): Promise<{ content: string; role: 'assistant' }> {
    return { content: 'Response content', role: 'assistant' };
  }

  async searchContext(query: string) {
    if (!this.contextManager) return null;
    return await (this.contextManager as any).search?.(query);
  }

  async saveToMemory(_key: string, _data: unknown) {
    // Disabilitato: demandare a cc-sessions
    return null;
  }

  async retrieveFromMemory(_key: string) {
    // Disabilitato: demandare a cc-sessions
    return null;
  }

  async generateEmbedding(_text: string) {
    // Disabilitato: nessun embedding locale
    return null;
  }

  async executeHandoff(task: any) {
    if (!this.handoffEngine) return null;
    // handoff-engine espone generateHandoffCommand, non execute
    return await (this.handoffEngine as any).generateHandoffCommand?.(task);
  }

  async startMCP() {
    if (!this.mcpService) return null;
    return await (this.mcpService as any).start?.();
  }

  // =========================
  // cc-sessions integration
  // =========================

  async onSessionStart(e: { sessionId: string; taskId?: string }): Promise<void> {
    await this.ensureDir(this.stateDir);
    const currentTaskPath = path.join(this.stateDir, 'current_task.json');
    const daicPath = path.join(this.stateDir, 'daic-mode.json');
    const now = new Date().toISOString();
    const branch = (this.config as any)?.branch || 'feature/' + (e.taskId || 'unknown');
    await this.writeJSON(currentTaskPath, {
      task: e.taskId || 'unknown',
      branch,
      services: ['claude-code'],
      updated: now
    });
    // Mode: discussion di default
    await this.writeJSON(daicPath, { mode: 'discussion', updated: now });
    await this.appendAudit({ type: 'session_start', ...e, ts: now });
  }

  async onSessionEnd(e: { sessionId: string; taskId: string }): Promise<void> {
    const now = new Date().toISOString();
    await this.appendAudit({ type: 'session_end', ...e, ts: now });
  }

  async onToolUsed(e: { sessionId: string; taskId: string; tool: string; payload?: unknown }): Promise<void> {
    // DAIC enforcement: blocca tool di scrittura in discussion
    const mode = await this.readDAICMode();
    const blocked = await this.getBlockedToolsDiscussion();
    if (mode === 'discussion' && blocked.includes(e.tool)) {
      await this.appendAudit({ type: 'policy_block', reason: 'DAIC_discussion', ...e, ts: new Date().toISOString() });
      throw new Error(`Operazione bloccata in modalità Discussion (tool: ${e.tool}). Dì "go ahead" per entrare in Implementation.`);
    }
    // Branch enforcement (solo auditing minimale qui; verifica git può essere aggiunta)
    await this.appendAudit({ type: 'tool_used', ...e, ts: new Date().toISOString() });
  }

  // =========================
  // Helpers
  // =========================

  private async ensureDir(dir: string): Promise<void> {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  private async writeJSON(file: string, data: unknown): Promise<void> {
    await fs.promises.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
  }

  private async readJSON<T = any>(file: string): Promise<T | null> {
    try {
      const raw = await fs.promises.readFile(file, 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private async appendAudit(event: Record<string, unknown>): Promise<void> {
    await this.ensureDir(this.stateDir);
    const auditPath = path.join(this.stateDir, 'tool-audit.jsonl');
    const line = JSON.stringify(event) + '\n';
    await fs.promises.appendFile(auditPath, line, 'utf-8');
  }

  private async readDAICMode(): Promise<'discussion' | 'implementation'> {
    const daicPath = path.join(this.stateDir, 'daic-mode.json');
    const data = await this.readJSON<{ mode?: string }>(daicPath);
    return (data?.mode === 'implementation' ? 'implementation' : 'discussion');
    }

  private async getBlockedToolsDiscussion(): Promise<string[]> {
    // sessions-config.json opzionale; fallback a lista standard cc-sessions
    const cfgPath = path.join(this.sessionsDir, 'sessions-config.json');
    const cfg = await this.readJSON<{ blocked_tools_discussion?: string[] }>(cfgPath);
    return cfg?.blocked_tools_discussion ?? ['Edit', 'Write', 'MultiEdit'];
  }
}