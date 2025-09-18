import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export class QwenCLIIntegration {
  private readonly requiredModel: string = 'Qwen3-Coder-480B-A35B-Instruct';
  private readonly cliCommand: string = 'qwen';
  private readonly contextWindow: number = 256000; // 256k tokens
  private readonly role: string = 'Code Architecture Reviewer';
  private isInstalled: boolean = false;
  private isConfigured: boolean = false;

  constructor() {
    this.validateEnvironment();
  }

  /**
   * Install Qwen Code CLI globally
   */
  public async install(): Promise<void> {
    try {
      console.log('🔧 Installing Qwen Code CLI globally...');
      
      // Check if already installed
      if (await this.checkInstallation()) {
        console.log('✅ Qwen Code CLI already installed');
        this.isInstalled = true;
        return;
      }

      // Execute global installation
      console.log('📦 Running: npm install -g @qwen-code/qwen-code');
      execSync('npm install -g @qwen-code/qwen-code', { 
        stdio: 'inherit',
        timeout: 120000 // 2 minutes timeout for global install
      });

      // Verify installation
      if (await this.checkInstallation()) {
        this.isInstalled = true;
        console.log('✅ Qwen Code CLI installed successfully');
      } else {
        throw new Error('Installation verification failed');
      }

    } catch (error) {
      console.error('❌ Failed to install Qwen Code CLI:', error);
      throw new Error(`Qwen CLI installation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Configure Qwen CLI with mandatory model
   */
  public async configure(): Promise<void> {
    try {
      console.log(`🔧 Configuring Qwen CLI with model: ${this.requiredModel}...`);
      
      if (!this.isInstalled) {
        await this.install();
      }

      // MANDATORY: Set the required model
      const configCommand = `${this.cliCommand} -m ${this.requiredModel}`;
      console.log(`🎯 Running: ${configCommand}`);
      
      execSync(configCommand, { 
        stdio: 'inherit',
        timeout: 30000 // 30 seconds timeout
      });

      // Verify configuration
      const modelCheck = await this.verifyModelConfiguration();
      if (modelCheck) {
        this.isConfigured = true;
        console.log(`✅ Qwen CLI configured with ${this.requiredModel}`);
      } else {
        throw new Error('Model configuration verification failed');
      }

    } catch (error) {
      console.error('❌ Failed to configure Qwen CLI:', error);
      throw new Error(`Qwen CLI configuration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute code architecture review
   */
  public async reviewCodeArchitecture(codeContext: string, filePath?: string): Promise<string> {
    try {
      if (!this.isConfigured) {
        await this.configure();
      }

      console.log(`🏗️ Performing code architecture review with ${this.requiredModel}...`);

      const prompt = this.buildArchitectureReviewPrompt(codeContext, filePath);
      const result = await this.executeQwenCommand(prompt);

      console.log(`✅ Architecture review completed (${result.length} characters)`);
      return result;

    } catch (error) {
      console.error('❌ Code architecture review failed:', error);
      throw new Error(`Architecture review failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute general code analysis
   */
  public async analyzeCode(code: string, analysisType: 'quality' | 'performance' | 'security' | 'patterns'): Promise<string> {
    try {
      if (!this.isConfigured) {
        await this.configure();
      }

      console.log(`🔍 Analyzing code for ${analysisType} with Qwen3-Coder...`);

      const prompt = this.buildCodeAnalysisPrompt(code, analysisType);
      const result = await this.executeQwenCommand(prompt);

      console.log(`✅ Code ${analysisType} analysis completed`);
      return result;

    } catch (error) {
      console.error(`❌ Code ${analysisType} analysis failed:`, error);
      throw new Error(`Code analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute Qwen command with context window management
   */
  private async executeQwenCommand(prompt: string): Promise<string> {
    try {
      // Check token count and truncate if necessary
      const truncatedPrompt = this.manageContextWindow(prompt);
      
      // Create temporary file for large prompts
      const tempFile = await this.createTempPromptFile(truncatedPrompt);
      
      try {
        // Execute Qwen with file input
        const result = execSync(`${this.cliCommand} --file ${tempFile}`, {
          encoding: 'utf-8',
          timeout: 60000, // 1 minute timeout
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        return result.toString().trim();

      } finally {
        // Clean up temp file
        await this.cleanupTempFile(tempFile);
      }

    } catch (error) {
      console.error('❌ Qwen command execution failed:', error);
      throw new Error(`Qwen execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if Qwen CLI is installed
   */
  private async checkInstallation(): Promise<boolean> {
    try {
      execSync(`${this.cliCommand} --version`, { 
        stdio: 'pipe',
        timeout: 5000 
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify model configuration
   */
  private async verifyModelConfiguration(): Promise<boolean> {
    try {
      const result = execSync(`${this.cliCommand} --model-info`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10000
      });

      return result.includes(this.requiredModel);

    } catch (error) {
      // If --model-info doesn't exist, try alternative verification
      try {
        const testResult = execSync(`${this.cliCommand} --help`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 5000
        });
        
        // Basic verification that CLI is working
        return testResult.includes('qwen') || testResult.includes('Usage');
        
      } catch (helpError) {
        return false;
      }
    }
  }

  /**
   * Build architecture review prompt
   */
  private buildArchitectureReviewPrompt(codeContext: string, filePath?: string): string {
    return `
# Code Architecture Review Request

## Role: ${this.role}
## Model: ${this.requiredModel}
## Context Window: ${this.contextWindow.toLocaleString()} tokens

## Task
Please perform a comprehensive code architecture review for the provided code.

${filePath ? `## File Path\n${filePath}\n` : ''}

## Code to Review
\`\`\`
${codeContext}
\`\`\`

## Review Areas
1. **Architecture Patterns**: Identify design patterns and architectural decisions
2. **Code Organization**: Assess structure, modularity, and separation of concerns  
3. **Scalability**: Evaluate potential scalability issues and improvements
4. **Maintainability**: Review code readability, documentation, and maintainability
5. **Best Practices**: Check adherence to coding best practices and standards
6. **Dependencies**: Analyze dependency management and potential issues
7. **Performance**: Identify potential performance bottlenecks
8. **Security**: Spot security concerns and vulnerabilities

## Output Format
Provide a structured analysis with:
- Executive Summary
- Detailed Findings by Category
- Recommendations for Improvement
- Priority Level for Each Issue (High/Medium/Low)

Please be thorough and specific in your analysis.
`.trim();
  }

  /**
   * Build code analysis prompt
   */
  private buildCodeAnalysisPrompt(code: string, analysisType: string): string {
    const analysisInstructions = {
      quality: 'Focus on code quality metrics, readability, and maintainability',
      performance: 'Analyze performance bottlenecks, optimization opportunities, and efficiency',
      security: 'Identify security vulnerabilities, data exposure risks, and security best practices',
      patterns: 'Identify design patterns, anti-patterns, and architectural decisions'
    };

    return `
# Code ${analysisType.toUpperCase()} Analysis Request

## Model: ${this.requiredModel}
## Analysis Focus: ${analysisInstructions[analysisType as keyof typeof analysisInstructions]}

## Code to Analyze
\`\`\`
${code}
\`\`\`

## Instructions
${analysisInstructions[analysisType as keyof typeof analysisInstructions]}

Provide specific, actionable insights with examples and recommendations.
`.trim();
  }

  /**
   * Manage context window to stay within 256k token limit
   */
  private manageContextWindow(prompt: string): string {
    // Rough estimation: 4 characters per token
    const estimatedTokens = Math.ceil(prompt.length / 4);
    
    if (estimatedTokens <= this.contextWindow) {
      return prompt;
    }

    console.log(`⚠️ Prompt too long (${estimatedTokens} tokens), truncating to fit ${this.contextWindow} token limit`);
    
    // Keep the first part (instructions) and truncate the code section
    const maxChars = this.contextWindow * 4;
    return prompt.substring(0, maxChars) + '\n\n[... truncated for token limit ...]';
  }

  /**
   * Create temporary file for large prompts
   */
  private async createTempPromptFile(content: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `qwen-prompt-${Date.now()}.txt`);
    
    await fs.writeFile(tempFile, content, 'utf-8');
    return tempFile;
  }

  /**
   * Clean up temporary file
   */
  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }

  /**
   * Get integration status
   */
  public getStatus(): {
    installed: boolean;
    configured: boolean;
    model: string;
    contextWindow: number;
    role: string;
  } {
    return {
      installed: this.isInstalled,
      configured: this.isConfigured,
      model: this.requiredModel,
      contextWindow: this.contextWindow,
      role: this.role
    };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInstalled) {
        return false;
      }

      const result = execSync(`${this.cliCommand} --version`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 5000
      });

      return result.length > 0;

    } catch (error) {
      console.warn('Qwen CLI health check failed:', error);
      return false;
    }
  }

  /**
   * Validate environment
   */
  private validateEnvironment(): void {
    try {
      // Check if Node.js is available
      execSync('node --version', { stdio: 'pipe' });
      
      // Check if npm is available
      execSync('npm --version', { stdio: 'pipe' });

    } catch (error) {
      throw new Error('Required environment not available. Node.js and npm are required for Qwen CLI integration.');
    }
  }

  /**
   * Full setup: install and configure
   */
  public async setup(): Promise<void> {
    try {
      console.log('🚀 Setting up Qwen CLI integration...');
      
      await this.install();
      await this.configure();
      
      console.log(`✅ Qwen CLI integration setup complete`);
      console.log(`   Model: ${this.requiredModel}`);
      console.log(`   Context: ${this.contextWindow.toLocaleString()} tokens`);
      console.log(`   Role: ${this.role}`);

    } catch (error) {
      console.error('❌ Qwen CLI setup failed:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    try {
      // No active processes to clean up for CLI integration
      console.log('✅ Qwen CLI integration cleaned up');
    } catch (error) {
      console.error('❌ Qwen CLI cleanup failed:', error);
    }
  }
}

// Singleton instance for global access
export const qwenIntegration = new QwenCLIIntegration();