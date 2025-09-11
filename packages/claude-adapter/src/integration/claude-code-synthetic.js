import { SyntheticGateway } from '@devflow/synthetic';
import { AutonomousCodeModifier } from '../autonomous/code-modifier.js';
import { syntheticCommand } from '../commands/synthetic-command.js';
import { loadSyntheticEnv } from '@devflow/shared';
export class ClaudeCodeSyntheticIntegration {
    gateway = null;
    codeModifier = null;
    config;
    isInitialized = false;
    constructor(config = {}) {
        this.config = {
            autoActivate: true,
            defaultAgent: 'auto',
            autonomousMode: false,
            requireApproval: true,
            costThreshold: 1.0, // $1 max per autonomous operation
            ...config
        };
    }
    /**
     * Initialize Synthetic.new integration for Claude Code
     */
    async initialize() {
        if (this.isInitialized)
            return true;
        try {
            const env = loadSyntheticEnv();
            if (!env.SYNTHETIC_API_KEY) {
                console.log('⚠️ Synthetic.new not configured (SYNTHETIC_API_KEY missing)');
                return false;
            }
            this.gateway = new SyntheticGateway({
                apiKey: env.SYNTHETIC_API_KEY,
                baseUrl: env.SYNTHETIC_BASE_URL,
                timeoutMs: env.SYNTHETIC_TIMEOUT_MS,
            });
            this.codeModifier = new AutonomousCodeModifier(this.gateway);
            this.isInitialized = true;
            console.log('🤖 Synthetic.new integration initialized successfully');
            return true;
        }
        catch (error) {
            console.error('❌ Failed to initialize Synthetic.new:', error);
            return false;
        }
    }
    /**
     * Process a natural language request with Claude Code context
     */
    async processRequest(request, context) {
        if (!await this.initialize() || !this.gateway) {
            return '❌ Synthetic.new not available. Please configure SYNTHETIC_API_KEY.';
        }
        try {
            // Enhance request with context
            const enhancedPrompt = this.enhancePromptWithContext(request, context);
            // Determine if this is a code modification request
            const isCodeModification = this.detectCodeModificationIntent(request);
            if (isCodeModification && this.config.autonomousMode && this.codeModifier) {
                return await this.handleAutonomousModification(enhancedPrompt, context);
            }
            else {
                return await this.handleStandardRequest(enhancedPrompt);
            }
        }
        catch (error) {
            console.error('❌ Request processing failed:', error);
            return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
    /**
     * Handle autonomous code modification requests
     */
    async handleAutonomousModification(request, context) {
        if (!this.codeModifier) {
            return '❌ Autonomous code modifier not available';
        }
        const modificationRequest = {
            task: request,
            files: context?.projectFiles || [context?.currentFile || ''].filter(Boolean),
            constraints: [
                'Maintain existing code style and patterns',
                'Add comprehensive error handling',
                'Include helpful comments',
                'Preserve existing functionality'
            ],
            dryRun: false,
            requireApproval: this.config.requireApproval,
        };
        console.log('🔧 Executing autonomous code modification...');
        const result = await this.codeModifier.modifyCode(modificationRequest);
        if (!result.success) {
            return `❌ Autonomous modification failed: ${result.errors?.join(', ') || 'Unknown error'}`;
        }
        let response = `🤖 **Autonomous Code Modification Completed**\n\n`;
        response += `**Summary**: ${result.summary}\n`;
        response += `**Agent**: ${result.agent}\n`;
        response += `**Files Modified**: ${result.changes.length}\n`;
        response += `**Tokens Used**: ${result.tokensUsed}\n\n`;
        // Detail changes
        result.changes.forEach(change => {
            response += `📄 **${change.filepath}** (${change.action})\n`;
            if (change.changes && change.changes.length > 0) {
                response += `   ${change.changes.length} modifications applied\n`;
            }
        });
        response += `\n✅ **All changes have been applied automatically!**\n`;
        response += `Claude Sonnet can now review the modifications.`;
        return response;
    }
    /**
     * Handle standard AI assistance requests
     */
    async handleStandardRequest(prompt) {
        return await syntheticCommand.execute(prompt, {
            agent: this.config.defaultAgent,
            maxTokens: 1000,
        });
    }
    enhancePromptWithContext(request, context) {
        if (!context)
            return request;
        let enhancedPrompt = request;
        if (context.currentFile) {
            enhancedPrompt += `\n\nCurrent file context: ${context.currentFile}`;
        }
        if (context.projectFiles && context.projectFiles.length > 0) {
            enhancedPrompt += `\n\nProject files available: ${context.projectFiles.slice(0, 10).join(', ')}`;
            if (context.projectFiles.length > 10) {
                enhancedPrompt += ` (and ${context.projectFiles.length - 10} more...)`;
            }
        }
        if (context.workingDirectory) {
            enhancedPrompt += `\n\nWorking directory: ${context.workingDirectory}`;
        }
        return enhancedPrompt;
    }
    detectCodeModificationIntent(request) {
        const modificationKeywords = [
            'create', 'modify', 'update', 'change', 'fix', 'refactor',
            'implement', 'add', 'remove', 'delete', 'write',
            'generate file', 'create function', 'add method',
            'update package.json', 'modify tsconfig'
        ];
        const lowerRequest = request.toLowerCase();
        return modificationKeywords.some(keyword => lowerRequest.includes(keyword));
    }
    /**
     * Get integration status and usage statistics
     */
    async getStatus() {
        if (!this.isInitialized || !this.gateway) {
            return '❌ Synthetic.new integration not initialized';
        }
        const gatewayStatus = await syntheticCommand.getStatus();
        let status = `🔗 **Claude Code + Synthetic.new Integration**\n\n`;
        status += gatewayStatus;
        status += `\n**Configuration**:\n`;
        status += `- Auto-activate: ${this.config.autoActivate ? '✅' : '❌'}\n`;
        status += `- Default agent: ${this.config.defaultAgent}\n`;
        status += `- Autonomous mode: ${this.config.autonomousMode ? '✅' : '❌'}\n`;
        status += `- Require approval: ${this.config.requireApproval ? '✅' : '❌'}\n`;
        return status;
    }
    /**
     * Register Claude Code slash commands
     */
    registerSlashCommands() {
        return {
            '/synthetic': async (args) => {
                return await this.processRequest(args);
            },
            '/synthetic-code': async (args) => {
                return await syntheticCommand.execute(args, { agent: 'code' });
            },
            '/synthetic-reasoning': async (args) => {
                return await syntheticCommand.execute(args, { agent: 'reasoning' });
            },
            '/synthetic-context': async (args) => {
                return await syntheticCommand.execute(args, { agent: 'context' });
            },
            '/synthetic-auto': async (args) => {
                if (!this.config.autonomousMode) {
                    return '⚠️ Autonomous mode disabled. Enable with /synthetic-config autonomous=true';
                }
                const context = this.getCurrentContext();
                return await this.processRequest(args, context);
            },
            '/synthetic-status': async () => {
                return await this.getStatus();
            },
            '/synthetic-help': async () => {
                return await syntheticCommand.getHelp();
            },
            '/synthetic-config': async (args) => {
                return this.updateConfig(args);
            }
        };
    }
    getCurrentContext() {
        // In a real Claude Code integration, this would get actual context
        // For now, return empty context
        return {
            workingDirectory: process.cwd(),
            projectFiles: [],
        };
    }
    updateConfig(args) {
        try {
            const updates = this.parseConfigArgs(args);
            Object.assign(this.config, updates);
            let response = '⚙️ **Configuration Updated**\n';
            Object.entries(updates).forEach(([key, value]) => {
                response += `- ${key}: ${value}\n`;
            });
            return response;
        }
        catch (error) {
            return `❌ Invalid configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
    parseConfigArgs(args) {
        const updates = {};
        const pairs = args.split(' ').filter(Boolean);
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
                updates[key] = value === 'true' ? true : value === 'false' ? false : value;
            }
        });
        return updates;
    }
}
// Export singleton instance for easy use
export const claudeCodeSynthetic = new ClaudeCodeSyntheticIntegration();
//# sourceMappingURL=claude-code-synthetic.js.map