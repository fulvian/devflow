import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: { branches: 80, functions: 80, lines: 80, statements: 80 }
      }
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 15000
  },
  resolve: {
    alias: {
      '@devflow/core': resolve(__dirname, './packages/core/src'),
      '@devflow/shared': resolve(__dirname, './packages/shared/src'),
      '@devflow/claude-adapter': resolve(
        __dirname,
        './packages/adapters/claude-code/src'
      ),
      '@devflow/openrouter': resolve(
        __dirname,
        './packages/adapters/openrouter/src'
      )
    }
  }
});
