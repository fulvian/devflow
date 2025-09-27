export { HookInterceptorManager } from './hook-interceptor-manager';
export { HookRegistry } from './hook-registry';
export { LegacyHookAdapter } from './legacy-hook-adapter';

// Export types
export * from './types/hooks';

// Export singleton instance for easy access
import { HookInterceptorManager } from './hook-interceptor-manager';

const hookInterceptorManager = new HookInterceptorManager();
export { hookInterceptorManager };

// Initialize with default hooks
hookInterceptorManager.registerHook({
  name: 'stop-hook.js',
  type: 'STOP',
  enabled: true,
  description: 'Intercepts Claude Code stop hooks'
});

hookInterceptorManager.registerHook({
  name: 'subagent-stop-hook.js',
  type: 'SUBAGENT_STOP',
  enabled: true,
  description: 'Intercepts Claude Code subagent stop hooks'
});

hookInterceptorManager.registerHook({
  name: 'intelligent-save-hook.mjs',
  type: 'INTELLIGENT_SAVE',
  enabled: true,
  description: 'Intercepts Claude Code intelligent save hooks'
});
