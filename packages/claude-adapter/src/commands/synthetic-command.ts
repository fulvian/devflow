import { SyntheticGateway } from '@devflow/synthetic';
import { loadSyntheticEnv } from '@devflow/shared';
import * as fs from 'fs';
import * as path from 'path';

interface SyntheticCommandOptions {
  agent?: 'code' | 'reasoning' | 'context' | 'auto';
  maxTokens?: number;
  temperature?: number;
  output?: 'chat' | 'file';
  filename?: string;
}

export class SyntheticCommand {
  private gateway: SyntheticGateway | null = null;
  private isInitialized = false;

  private async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Load environment and check if Synthetic.new is configured
      const env = loadSyntheticEnv();
      if (!env.SYNTHETIC_API_KEY) {
        console.error('❌ SYNTHETIC_API_KEY not found in environment variables');
        return false;
      }

      this.gateway = new SyntheticGateway({
        apiKey: env.SYNTHETIC_API_KEY,
        baseUrl: env.SYNTHETIC_BASE_URL ?? '',
        timeoutMs: env.SYNTHETIC_TIMEOUT_MS ?? 30000,
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Synthetic.new:', error);
      return false;
    }
  }

  async execute(prompt: string, options: SyntheticCommandOptions = {}): Promise<string> {
    if (!await this.initialize()) {
      return '❌ Synthetic.new is not properly configured. Please check your SYNTHETIC_API_KEY environment variable.';
    }

    if (!this.gateway) {
      return '❌ Synthetic.new gateway not available.';
    }

    try {
      console.log('🧠 Synthetic.new Processing...');
      console.log(`   Agent: ${options.agent || 'auto'}`);
      console.log(`   Max Tokens: ${options.maxTokens || 'default'}`);
      
      const startTime = Date.now();

      const request = {
        title: 'Claude Code Request',
        description: prompt,
        messages: [{
          role: 'user' as const,
          content: prompt,
        }],
        maxTokens: options.maxTokens ?? 1500,
        temperature: options.temperature ?? 0.1,
      };

      let result;
      if (options.agent && options.agent !== 'auto') {
        // Use specific agent
        result = await this.gateway.processWithAgent(options.agent, request);
      } else {
        // Auto-select agent
        result = await this.gateway.process(request);
      }

      const executionTime = Date.now() - startTime;

      // Format response
      let response = `🤖 **Synthetic.new Response**\n`;
      response += `**Agent**: ${result.agent} (${result.model})\n`;
      response += `**Time**: ${executionTime}ms | **Tokens**: ${result.tokensUsed}\n`;
      
      if ((result as any).classification) {
        const cls = (result as any).classification;
        response += `**Classification**: ${cls.type} (${(cls.confidence * 100).toFixed(0)}% confidence)\n`;
      }
      
      response += `\n---\n\n${result.text}`;

      // Handle output options
      if (options.output === 'file' && options.filename) {
        await this.writeToFile(result.text, options.filename);
        response += `\n\n📁 **Output written to**: ${options.filename}`;
      }

      // Log cost information
      const costStats = this.gateway.getCostStats();
      if (costStats.totalRequests > 0) {
        response += `\n\n💰 **Cost Info**: ${costStats.totalRequests} requests, $${costStats.monthlyCostUsd}/month flat fee`;
      }

      return response;

    } catch (error) {
      console.error('❌ Synthetic.new execution failed:', error);
      return `❌ Synthetic.new error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async getStatus(): Promise<string> {
    if (!await this.initialize()) {
      return '❌ Synthetic.new not configured';
    }

    if (!this.gateway) {
      return '❌ Gateway unavailable';
    }

    const agents = this.gateway.getAvailableAgents();
    const costStats = this.gateway.getCostStats();

    let status = `🤖 **Synthetic.new Status**\n`;
    status += `**Status**: ✅ Operational\n`;
    status += `**Agents**: ${Object.keys(agents).join(', ')}\n`;
    status += `**Requests**: ${costStats.totalRequests}\n`;
    status += `**Tokens**: ${costStats.totalTokens.toLocaleString()}\n`;
    status += `**Cost**: $${costStats.monthlyCostUsd}/month (flat fee)\n`;

    return status;
  }

  async getHelp(): Promise<string> {
    return `🤖 **Synthetic.new Commands**

**Basic Usage**:
\`/synthetic <prompt>\` - Auto-select best agent
\`/synthetic-code <prompt>\` - Use code generation agent  
\`/synthetic-reasoning <prompt>\` - Use reasoning agent
\`/synthetic-context <prompt>\` - Use large context agent

**Advanced Options**:
\`/synthetic <prompt> --agent=code --maxTokens=500\`
\`/synthetic <prompt> --output=file --filename=result.md\`

**Available Agents**:
- **code**: Specialized in implementation, APIs, refactoring
- **reasoning**: Specialized in analysis, decisions, architecture  
- **context**: Specialized in large codebase analysis, documentation
- **auto**: Automatically selects the best agent (default)

**Examples**:
\`/synthetic "Create a TypeScript function to validate email addresses"\`
\`/synthetic-reasoning "Compare microservices vs monolith for e-commerce"\`
\`/synthetic-code "Implement JWT authentication middleware" --maxTokens=800\`
\`/synthetic "Analyze this codebase for performance issues" --agent=context\`

**Status Commands**:
\`/synthetic-status\` - Show current status and usage
\`/synthetic-cost\` - Show cost breakdown and savings`;
  }

  private async writeToFile(content: string, filename: string): Promise<void> {
    try {
      const fullPath = path.resolve(filename);
      await fs.promises.writeFile(fullPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const syntheticCommand = new SyntheticCommand();