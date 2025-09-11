import { beforeAll, afterAll } from 'vitest';
beforeAll(async () => {
    // Global test setup (mocks, env vars, etc.)
    process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
});
afterAll(async () => {
    // Global teardown if needed
});
//# sourceMappingURL=setup.js.map