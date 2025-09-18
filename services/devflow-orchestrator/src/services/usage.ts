import { db } from './db';

db.exec(`
  CREATE TABLE IF NOT EXISTS synthetic_usage (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    agent_type TEXT NOT NULL,
    model TEXT,
    duration_ms INTEGER NOT NULL,
    tokens_in INTEGER,
    tokens_out INTEGER,
    cost_usd REAL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_synth_usage_created ON synthetic_usage(created_at);
`);

export type UsageRecord = {
  id: string;
  provider: string;
  agentType: 'code' | 'reasoning';
  model?: string;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  createdAt: string;
};

export function recordUsage(rec: UsageRecord): void {
  const stmt = db.prepare(`INSERT INTO synthetic_usage (id, provider, agent_type, model, duration_ms, tokens_in, tokens_out, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(rec.id, rec.provider, rec.agentType, rec.model ?? null, rec.durationMs, rec.tokensIn ?? null, rec.tokensOut ?? null, rec.costUsd ?? null, rec.createdAt);
}
