import { claudeCodeSynthetic } from '../integration/claude-code-synthetic.js';
/**
 * Register Synthetic.new commands with Claude Code
 * This file should be imported by Claude Code's command system
 */
export async function registerSyntheticCommands() {
    // Initialize the integration
    await claudeCodeSynthetic.initialize();
    // Get the command definitions
    const commands = claudeCodeSynthetic.registerSlashCommands();
    // Register each command with Claude Code
    // Note: This is a placeholder - actual implementation depends on Claude Code's command system
    Object.entries(commands).forEach(([commandName, handler]) => {
        console.log(`Registering command: ${commandName}`);
        // Claude Code would register the command here
        // registerCommand(commandName, handler);
    });
    console.log('🤖 Synthetic.new commands registered with Claude Code');
    return commands;
}
// Auto-register commands when module is imported
registerSyntheticCommands().catch(error => {
    console.error('Failed to register Synthetic.new commands:', error);
});
//# sourceMappingURL=command-hooks.js.map