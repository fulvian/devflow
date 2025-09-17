import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

dotenv.config();

/**
 * Service for handling Gemini CLI OAuth authentication
 */
export class GeminiAuthService {
  private static instance: GeminiAuthService;
  private tokenFilePath: string;
  private refreshToken: string | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  private constructor() {
    this.tokenFilePath = path.join(process.cwd(), '.gemini-tokens.json');
    this.loadTokensFromFile();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): GeminiAuthService {
    if (!GeminiAuthService.instance) {
      GeminiAuthService.instance = new GeminiAuthService();
    }
    return GeminiAuthService.instance;
  }

  /**
   * Load tokens from file if they exist
   */
  private async loadTokensFromFile(): Promise<void> {
    try {
      const data = await readFile(this.tokenFilePath, 'utf8');
      const tokens = JSON.parse(data);
      
      this.refreshToken = tokens.refreshToken || null;
      this.accessToken = tokens.accessToken || null;
      this.tokenExpiry = tokens.tokenExpiry || null;
    } catch (error) {
      // File doesn't exist or is invalid, continue with null tokens
      console.debug('No existing tokens found or file is invalid');
    }
  }

  /**
   * Save tokens to file
   */
  private async saveTokensToFile(): Promise<void> {
    try {
      const tokens = {
        refreshToken: this.refreshToken,
        accessToken: this.accessToken,
        tokenExpiry: this.tokenExpiry
      };
      
      await writeFile(this.tokenFilePath, JSON.stringify(tokens, null, 2));
    } catch (error) {
      console.error('Failed to save tokens to file:', error);
    }
  }

  /**
   * Check if we have a valid access token
   */
  public hasValidAccessToken(): boolean {
    if (!this.accessToken || !this.tokenExpiry) {
      return false;
    }
    
    // Check if token is still valid (with 5 minute buffer)
    const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() < (this.tokenExpiry - buffer);
  }

  /**
   * Get the current access token
   */
  public getAccessToken(): string | null {
    return this.hasValidAccessToken() ? this.accessToken : null;
  }

  /**
   * Initialize OAuth-personal authentication for Gemini CLI
   */
  public async login(): Promise<void> {
    try {
      // Create oauth-personal configuration file
      const configDir = path.join(process.env.HOME || '~', '.config', 'gemini-cli');
      await this.ensureConfigDirectory(configDir);

      // Create basic oauth-personal config
      const authConfig = {
        authType: 'oauth-personal',
        personalAuth: {
          configured: true,
          type: 'google-oauth'
        }
      };

      const configPath = path.join(configDir, 'auth.json');
      await writeFile(configPath, JSON.stringify(authConfig, null, 2));

      console.log('OAuth-personal configuration initialized for Gemini CLI');

      // Set initial tokens to simulate authentication
      this.accessToken = 'gemini-oauth-personal-token';
      this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

      await this.saveTokensToFile();

    } catch (error) {
      throw new Error(`Failed to initialize OAuth-personal authentication: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure configuration directory exists
   */
  private async ensureConfigDirectory(configDir: string): Promise<void> {
    try {
      const { mkdir } = await import('fs/promises');
      await mkdir(configDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, continue
    }
  }

  /**
   * Refresh the access token using the refresh token
   */
  public async refreshTokenIfNeeded(): Promise<void> {
    if (this.hasValidAccessToken()) {
      return;
    }

    if (!this.refreshToken) {
      throw new Error('No refresh token available. Please authenticate first.');
    }

    try {
      // In a real implementation, this would make an HTTP request to refresh the token
      // For now, we'll simulate the refresh process
      console.log('Refreshing Gemini access token...');
      
      // Simulate API call to refresh token
      const newAccessToken = 'simulated-new-access-token';
      const expiresIn = 3600; // 1 hour in seconds
      
      this.accessToken = newAccessToken;
      this.tokenExpiry = Date.now() + (expiresIn * 1000);
      
      await this.saveTokensToFile();
      
      console.log('Access token refreshed successfully');
    } catch (error) {
      throw new Error(`Failed to refresh access token: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute a Gemini CLI command
   */
  private async executeGeminiCommand(args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const geminiProcess = spawn('gemini', args);
      
      let stdout = '';
      let stderr = '';
      
      geminiProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      geminiProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      geminiProcess.on('close', (code) => {
        resolve({
          exitCode: code,
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });
      
      geminiProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn gemini process: ${error.message}`));
      });
    });
  }

  /**
   * Clear all stored tokens
   */
  public async logout(): Promise<void> {
    this.refreshToken = null;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    try {
      await writeFile(this.tokenFilePath, '{}');
    } catch (error) {
      console.error('Failed to clear token file:', error);
    }
  }
}

export default GeminiAuthService;