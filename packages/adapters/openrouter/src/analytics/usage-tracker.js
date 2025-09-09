export class UsageTracker {
    records = [];
    record(model) {
        this.records.push({ model, timestamp: Date.now() });
        if (this.records.length > 10_000)
            this.records.shift();
    }
    counts(windowMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        const recent = this.records.filter((r) => now - r.timestamp <= windowMs);
        return recent.reduce((acc, r) => {
            acc[r.model] = (acc[r.model] ?? 0) + 1;
            return acc;
        }, {});
    }
}
//# sourceMappingURL=usage-tracker.js.map