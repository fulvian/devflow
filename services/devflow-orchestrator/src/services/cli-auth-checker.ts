/**
 * CLI Authentication Checker
 * DevFlow v3.1 - Verify authentication status for all CLI platforms
 */

import { spawn } from 'child_process';

export interface CLIAuthStatus {
  platform: string;
  authenticated: boolean;
  version?: string;
  error?: string;
  lastChecked: string;
}

export class CLIAuthChecker {
  private authStatus: Map<string, CLIAuthStatus> = new Map();

  public async checkAllPlatforms(): Promise<CLIAuthStatus[]> {
    const platforms = ['claude-code', 'codex', 'gemini', 'qwen'];
    const results: CLIAuthStatus[] = [];

    for (const platform of platforms) {
      const status = await this.checkPlatformAuth(platform);
      this.authStatus.set(platform, status);
      results.push(status);
    }

    return results;
  }

  public async checkPlatformAuth(platform: string): Promise<CLIAuthStatus> {
    const timestamp = new Date().toISOString();

    try {
      switch (platform) {
        case 'claude-code':
          return await this.checkClaudeCode(timestamp);
        case 'codex':
          return await this.checkCodex(timestamp);
        case 'gemini':
          return await this.checkGemini(timestamp);
        case 'qwen':
          return await this.checkQwen(timestamp);
        default:
          return {
            platform,
            authenticated: false,
            error: 'Unknown platform',
            lastChecked: timestamp
          };
      }
    } catch (error) {
      return {
        platform,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Check failed',
        lastChecked: timestamp
      };
    }
  }

  private async checkClaudeCode(timestamp: string): Promise<CLIAuthStatus> {
    try {
      const result = await this.executeCommand('claude-code', ['--version']);
      return {
        platform: 'claude-code',
        authenticated: result.success,
        version: result.output.trim(),
        lastChecked: timestamp
      };
    } catch (error) {
      return {
        platform: 'claude-code',
        authenticated: false,
        error: 'Claude Code CLI not available or not authenticated',
        lastChecked: timestamp
      };
    }
  }

  private async checkCodex(timestamp: string): Promise<CLIAuthStatus> {
    try {
      // Check if codex CLI is installed and authenticated
      const versionResult = await this.executeCommand('codex', ['--version']);

      if (versionResult.success) {
        // Try a simple auth check
        const authResult = await this.executeCommand('codex', ['--help'], 5000);
        return {
          platform: 'codex',
          authenticated: authResult.success,
          version: versionResult.output.trim(),
          error: authResult.success ? undefined : 'Authentication required - run codex to login',
          lastChecked: timestamp
        };
      }

      return {
        platform: 'codex',
        authenticated: false,
        error: 'Codex CLI not installed',
        lastChecked: timestamp
      };
    } catch (error) {
      return {
        platform: 'codex',
        authenticated: false,
        error: 'Codex CLI not available - install with: npm install -g @openai/codex',
        lastChecked: timestamp
      };
    }
  }

  private async checkGemini(timestamp: string): Promise<CLIAuthStatus> {
    try {
      // Check if gemini CLI is available
      const versionResult = await this.executeCommand('gemini', ['--version']);

      if (versionResult.success) {
        // Check Google Cloud authentication
        const authResult = await this.executeCommand('gcloud', ['auth', 'list', '--format=json'], 5000);
        const hasAuth = authResult.success && authResult.output.includes('@');

        return {
          platform: 'gemini',
          authenticated: hasAuth,
          version: versionResult.output.trim(),
          error: hasAuth ? undefined : 'Google Cloud authentication required - run: gcloud auth login',
          lastChecked: timestamp
        };
      }

      return {
        platform: 'gemini',
        authenticated: false,
        error: 'Gemini CLI not installed',
        lastChecked: timestamp
      };
    } catch (error) {
      return {
        platform: 'gemini',
        authenticated: false,
        error: 'Gemini CLI not available - check installation and gcloud auth status',
        lastChecked: timestamp
      };
    }
  }

  private async checkQwen(timestamp: string): Promise<CLIAuthStatus> {
    try {
      // Check if qwen CLI is available
      const versionResult = await this.executeCommand('qwen', ['--version']);

      if (versionResult.success) {
        // Check for authentication by looking for config files or env vars
        const hasApiKey = process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY;
        const configCheck = await this.executeCommand('ls', ['-la', '~/.qwen/', '2>/dev/null'], 2000);
        const hasConfig = configCheck.success && configCheck.output.includes('.env');

        return {
          platform: 'qwen',
          authenticated: !!(hasApiKey || hasConfig),
          version: versionResult.output.trim(),
          error: (hasApiKey || hasConfig) ? undefined : 'Qwen authentication required - set DASHSCOPE_API_KEY or run qwen for OAuth',
          lastChecked: timestamp
        };
      }

      return {
        platform: 'qwen',
        authenticated: false,
        error: 'Qwen CLI not installed',
        lastChecked: timestamp
      };
    } catch (error) {
      return {
        platform: 'qwen',
        authenticated: false,
        error: 'Qwen CLI not available - install from github.com/QwenLM/qwen-code',
        lastChecked: timestamp
      };
    }
  }

  private async executeCommand(command: string, args: string[], timeout: number = 10000): Promise<{success: boolean, output: string, error?: string}> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr || undefined
        });
      });

      process.on('error', (error) => {
        resolve({
          success: false,
          output: '',
          error: error.message
        });
      });

      // Set timeout
      const timer = setTimeout(() => {
        process.kill();
        resolve({
          success: false,
          output: stdout,
          error: 'Command timeout'
        });
      }, timeout);

      process.on('close', () => {
        clearTimeout(timer);
      });
    });
  }

  public getAuthStatus(platform: string): CLIAuthStatus | undefined {
    return this.authStatus.get(platform);
  }

  public getAllAuthStatus(): CLIAuthStatus[] {
    return Array.from(this.authStatus.values());
  }

  public getAuthenticatedPlatforms(): string[] {
    return Array.from(this.authStatus.values())
      .filter(status => status.authenticated)
      .map(status => status.platform);
  }
}