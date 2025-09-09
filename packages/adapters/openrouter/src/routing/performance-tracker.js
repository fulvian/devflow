export class PerformanceTracker {
    samples = [];
    record(sample) {
        this.samples.push(sample);
        if (this.samples.length > 5000) {
            this.samples.shift();
        }
    }
    getAverages(windowMs = 60 * 60 * 1000) {
        const now = Date.now();
        const recent = this.samples.filter((s) => now - s.timestamp <= windowMs);
        const grouped = {};
        for (const s of recent) {
            const bucket = grouped[s.model] ?? (grouped[s.model] = []);
            bucket.push(s);
        }
        const out = {};
        for (const [model, arr] of Object.entries(grouped)) {
            const avgLatency = arr.length > 0 ? arr.reduce((a, b) => a + b.latencyMs, 0) / arr.length : 0;
            const successRate = arr.length > 0 ? arr.filter((s) => s.success).length / arr.length : 0;
            out[model] = { avgLatency, successRate, count: arr.length };
        }
        return out;
    }
}
//# sourceMappingURL=performance-tracker.js.map