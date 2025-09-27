export interface RetryOptions {
  readonly retries: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(status?: number): boolean {
  // Retry on 429 and 5xx
  if (status === 429) return true;
  if (!status) return true; // network errors
  return status >= 500 && status < 600;
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
  onRetry?: (info: { attempt: number; delayMs: number; error?: unknown; status?: number }) => void,
): Promise<T> {
  let attempt = 0;
  let delay = opts.initialDelayMs;
  let lastError: unknown;

  while (attempt <= opts.retries) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (attempt === opts.retries || !shouldRetry(status)) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * (delay / 2));
      const wait = Math.min(delay + jitter, opts.maxDelayMs);
      onRetry?.({
        attempt: attempt + 1,
        delayMs: wait,
        ...(err !== undefined ? { error: err } : {}),
        ...(status !== undefined ? { status } : {}),
      });
      await sleep(wait);
      delay = Math.min(delay * 2, opts.maxDelayMs);
      attempt += 1;
    }
  }

  throw lastError ?? new Error('Retry failed');
}
