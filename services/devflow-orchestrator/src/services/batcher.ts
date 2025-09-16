import { SyntheticService } from './synthetic';

type CodeJob = {
  id: string;
  prompt: string;
  context?: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export type BatcherConfig = {
  enabled: boolean;
  windowMs: number;
  maxBatchSize: number;
};

export class SyntheticCodeBatcher {
  private readonly cfg: BatcherConfig;
  private queue: CodeJob[] = [];
  private timer: NodeJS.Timeout | null = null;
  private readonly service: SyntheticService;

  constructor(service: SyntheticService, cfg?: Partial<BatcherConfig>) {
    this.service = service;
    this.cfg = {
      enabled: (process.env.DEVFLOW_SYNTHETIC_BATCH ?? '0') === '1',
      windowMs: Number(process.env.DEVFLOW_SYNTHETIC_BATCH_WINDOW_MS ?? 120),
      maxBatchSize: Number(process.env.DEVFLOW_SYNTHETIC_MAX_BATCH_SIZE ?? 8),
      ...cfg,
    } as BatcherConfig;
  }

  public isEnabled(): boolean {
    return this.cfg.enabled;
  }

  enqueue(job: Omit<CodeJob, 'resolve' | 'reject'>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.cfg.enabled) {
        // Fallback: bypass batching
        void this.service
          .code({ prompt: job.prompt, context: job.context })
          .then(resolve)
          .catch(reject);
        return;
      }

      this.queue.push({ ...job, resolve, reject });
      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.cfg.windowMs);
      }
      if (this.queue.length >= this.cfg.maxBatchSize) {
        this.flush();
      }
    });
  }

  private async flush(): Promise<void> {
    const batch = this.queue.splice(0, this.cfg.maxBatchSize);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (batch.length === 0) return;

    // Costruzione prompt composito (protocollo semplice con marcatori)
    const header = `You will receive multiple coding tasks. For each TASK[i], produce OUTPUT[i] delimited by <OUT i>...</OUT i>.`;
    const body = batch
      .map((j, i) => `TASK[${i}]: ${j.prompt}`)
      .join('\n');
    const composite = `${header}\n${body}`;

    try {
      const resp = await this.service.code({ prompt: composite });
      const text = String((resp as any)?.result ?? '');
      // Split semplice sugli output numerati
      const outputs: string[] = [];
      for (let i = 0; i < batch.length; i++) {
        const pattern = new RegExp(`<OUT ${i}>([\s\S]*?)<\/OUT ${i}>`, 'm');
        const m = text.match(pattern);
        outputs.push(m ? m[1].trim() : text);
      }
      // Risolvi ogni promessa con un payload SyntheticResponse-like
      outputs.forEach((out, i) => {
        batch[i].resolve({
          result: out,
          metadata: { agentType: 'code', provider: (resp as any)?.metadata?.provider, model: (resp as any)?.metadata?.model, batched: true },
        });
      });
    } catch (err) {
      batch.forEach((j) => j.reject(err));
    }
  }
}

