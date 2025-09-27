/**
 * DevFlow Claude Code Adapter
 * Main entry point for Claude Code integration with hook system support
 */

// Export ClaudeAdapter for hook system integration
export { ClaudeAdapter } from './claude-adapter.js';
export type { MemorySearchResult, SearchOptions } from './claude-adapter.js';

// Export command registry
export type { CommandRegistry, CommandHandler } from './command-registry.js';
export { commandRegistry } from './command-registry.js';

// Export synthetic commands
export { SyntheticCommand, syntheticCommand } from './commands/synthetic-command.js';
export { registerSyntheticCommands } from './commands/synthetic-command-registry.js';

// Auto-initialize synthetic commands
import './commands/synthetic-command-registry.js';

console.log('🚀 DevFlow Claude Code Adapter initialized with hook system support');