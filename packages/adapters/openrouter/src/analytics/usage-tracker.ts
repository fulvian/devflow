export interface UsageRecord {
  readonly timestamp: number;
  readonly model: string;
}

export class UsageTracker {
  private readonly records: UsageRecord[] = [];

  record(model: string): void {
    this.records.push({ model, timestamp: Date.now() });
    if (this.records.length > 10_000) this.records.shift();
  }

  counts(windowMs = 24 * 60 * 60 * 1000): Record<string, number> {
    const now = Date.now();
    const recent = this.records.filter((r) => now - r.timestamp <= windowMs);
    return recent.reduce<Record<string, number>>((acc, r) => {
      acc[r.model] = (acc[r.model] ?? 0) + 1;
      return acc;
    }, {});
  }
}

