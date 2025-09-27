function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function shouldRetry(status) {
    // Retry on 429 and 5xx
    if (status === 429)
        return true;
    if (!status)
        return true; // network errors
    return status >= 500 && status < 600;
}
export async function withRetries(fn, opts, onRetry) {
    let attempt = 0;
    let delay = opts.initialDelayMs;
    let lastError;
    while (attempt <= opts.retries) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            const status = err.status;
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
//# sourceMappingURL=retry.js.map