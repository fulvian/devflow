/**
 * Cross-Platform AI Coding Router
 * DevFlow v3.1 - Intelligent routing across 4 AI platforms
 */

import { PlatformConfig, UnifiedRequest, UnifiedResponse, RouteStrategy, CrossPlatformMetrics } from '../../../src/types/cross-platform';
import { CLIAuthChecker } from './cli-auth-checker';

export class CrossPlatformRouter {
  private platforms: Map<string, PlatformConfig> = new Map();
  private metrics: CrossPlatformMetrics;
  private strategy: RouteStrategy;
  private authChecker: CLIAuthChecker;

  constructor() {
    this.initializePlatforms();
    this.initializeMetrics();
    this.authChecker = new CLIAuthChecker();
    this.strategy = {
      algorithm: 'quality-based',
      parameters: { qualityThreshold: 0.8, maxLatency: 5000 },
      fallback: ['claude-code', 'codex', 'gemini', 'qwen']
    };
  }

  private initializePlatforms(): void {
    // Claude Code Configuration
    this.platforms.set('claude-code', {
      name: 'claude-code',
      displayName: 'Claude Code',
      apiVersion: '3.1',
      enabled: true,
      priority: 1,
      capabilities: [
        { feature: 'code-completion', quality: 'high', latency: 'medium', costTier: 'paid' },
        { feature: 'chat', quality: 'high', latency: 'medium', costTier: 'paid' },
        { feature: 'refactoring', quality: 'high', latency: 'medium', costTier: 'paid' },
        { feature: 'explanation', quality: 'high', latency: 'medium', costTier: 'paid' }
      ],
      authMethod: 'oauth',
      endpoints: {
        completion: 'claude-code',
        chat: 'claude-code',
        analysis: 'claude-code',
        health: 'claude-code --version'
      }
    });

    // OpenAI Codex CLI Configuration
    this.platforms.set('codex', {
      name: 'codex',
      displayName: 'OpenAI Codex CLI',
      apiVersion: '1.0',
      enabled: true,
      priority: 2,
      capabilities: [
        { feature: 'code-completion', quality: 'high', latency: 'medium', costTier: 'paid' },
        { feature: 'refactoring', quality: 'high', latency: 'medium', costTier: 'paid' },
        { feature: 'debugging', quality: 'high', latency: 'medium', costTier: 'paid' },
        { feature: 'explanation', quality: 'high', latency: 'medium', costTier: 'paid' }
      ],
      authMethod: 'oauth',
      endpoints: {
        completion: 'codex',
        analysis: 'codex',
        health: 'codex --version'
      }
    });

    // Google Gemini CLI Configuration
    this.platforms.set('gemini', {
      name: 'gemini',
      displayName: 'Google Gemini CLI',
      apiVersion: '1.0',
      enabled: true,
      priority: 3,
      capabilities: [
        { feature: 'code-completion', quality: 'high', latency: 'fast', costTier: 'free' },
        { feature: 'generation', quality: 'high', latency: 'fast', costTier: 'free' },
        { feature: 'explanation', quality: 'high', latency: 'fast', costTier: 'free' },
        { feature: 'refactoring', quality: 'medium', latency: 'fast', costTier: 'free' }
      ],
      authMethod: 'oauth',
      endpoints: {
        completion: 'gemini',
        health: 'gemini --version'
      }
    });

    // Qwen CLI Configuration
    this.platforms.set('qwen', {
      name: 'qwen',
      displayName: 'Qwen CLI',
      apiVersion: '3.0',
      enabled: true,
      priority: 4,
      capabilities: [
        { feature: 'code-completion', quality: 'high', latency: 'fast', costTier: 'free' },
        { feature: 'generation', quality: 'high', latency: 'fast', costTier: 'free' },
        { feature: 'refactoring', quality: 'high', latency: 'fast', costTier: 'free' },
        { feature: 'explanation', quality: 'medium', latency: 'fast', costTier: 'free' }
      ],
      authMethod: 'oauth',
      endpoints: {
        completion: 'qwen',
        health: 'qwen --version'
      }
    });
  }

  private initializeMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      platformUsage: {},
      averageLatency: {},
      successRates: {},
      costTracking: {},
      qualityScores: {}
    };
  }

  public async route(request: UnifiedRequest): Promise<UnifiedResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // 1. Determine target platform
      const targetPlatform = await this.selectPlatform(request);

      // 2. Execute request
      const response = await this.executeRequest(request, targetPlatform);

      // 3. Update metrics
      this.updateMetrics(targetPlatform.name, startTime, response);

      return response;
    } catch (error) {
      // Fallback logic
      return await this.handleFallback(request, startTime, error);
    }
  }

  private async selectPlatform(request: UnifiedRequest): Promise<PlatformConfig> {
    // If platform specified, use it (if available and enabled)
    if (request.platform) {
      const platform = this.platforms.get(request.platform);
      if (platform?.enabled) {
        return platform;
      }
    }

    // Intelligent routing based on strategy
    switch (this.strategy.algorithm) {
      case 'quality-based':
        return this.selectByQuality(request);
      case 'latency-first':
        return this.selectByLatency(request);
      case 'cost-optimized':
        return this.selectByCost(request);
      default:
        return this.selectRoundRobin();
    }
  }

  private selectByQuality(request: UnifiedRequest): PlatformConfig {
    const candidates = Array.from(this.platforms.values())
      .filter(p => p.enabled)
      .filter(p => this.hasCapability(p, request.type))
      .sort((a, b) => {
        const aQuality = this.getQualityScore(a, request.type);
        const bQuality = this.getQualityScore(b, request.type);
        return bQuality - aQuality;
      });

    return candidates[0] || this.getFallbackPlatform();
  }

  private selectByLatency(request: UnifiedRequest): PlatformConfig {
    const candidates = Array.from(this.platforms.values())
      .filter(p => p.enabled)
      .filter(p => this.hasCapability(p, request.type))
      .sort((a, b) => {
        const aLatency = this.metrics.averageLatency[a.name] || 0;
        const bLatency = this.metrics.averageLatency[b.name] || 0;
        return aLatency - bLatency;
      });

    return candidates[0] || this.getFallbackPlatform();
  }

  private selectByCost(request: UnifiedRequest): PlatformConfig {
    const candidates = Array.from(this.platforms.values())
      .filter(p => p.enabled)
      .filter(p => this.hasCapability(p, request.type))
      .sort((a, b) => {
        const aCost = this.metrics.costTracking[a.name] || 0;
        const bCost = this.metrics.costTracking[b.name] || 0;
        return aCost - bCost;
      });

    return candidates[0] || this.getFallbackPlatform();
  }

  private selectRoundRobin(): PlatformConfig {
    const enabledPlatforms = Array.from(this.platforms.values()).filter(p => p.enabled);
    const index = this.metrics.totalRequests % enabledPlatforms.length;
    return enabledPlatforms[index] || this.getFallbackPlatform();
  }

  private hasCapability(platform: PlatformConfig, requestType: string): boolean {
    return platform.capabilities.some(cap => cap.feature === requestType);
  }

  private getQualityScore(platform: PlatformConfig, requestType: string): number {
    const capability = platform.capabilities.find(cap => cap.feature === requestType);
    if (!capability) return 0;

    const qualityMap = { high: 3, medium: 2, low: 1 };
    return qualityMap[capability.quality] || 0;
  }

  private getFallbackPlatform(): PlatformConfig {
    return this.platforms.get('claude-code') || Array.from(this.platforms.values())[0];
  }

  private async executeRequest(request: UnifiedRequest, platform: PlatformConfig): Promise<UnifiedResponse> {
    const startTime = Date.now();

    try {
      // Execute CLI command based on platform and request type
      const result = await this.executePlatformCLI(platform, request);
      const latency = Date.now() - startTime;

      return {
        id: request.id,
        platform: platform.name,
        success: true,
        data: result,
        metadata: {
          latency,
          tokens: { input: 100, output: 150, total: 250 },
          quality: { relevance: 0.9, accuracy: 0.85, completeness: 0.8, confidence: 0.85 },
          cached: false,
          fallbackUsed: false
        }
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      throw {
        id: request.id,
        platform: platform.name,
        success: false,
        error: {
          code: 'CLI_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'CLI execution failed',
          retryable: true,
          platform: platform.name
        },
        metadata: {
          latency,
          cached: false,
          fallbackUsed: false
        }
      };
    }
  }

  private async executePlatformCLI(platform: PlatformConfig, request: UnifiedRequest): Promise<any> {
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      let command: string;
      let args: string[] = [];

      // Build CLI command based on platform and request type
      switch (platform.name) {
        case 'claude-code':
          command = 'claude-code';
          if (request.type === 'completion') {
            args = ['--suggest', request.context.fileContent || ''];
          } else if (request.type === 'chat') {
            args = ['--chat'];
          }
          break;

        case 'codex':
          command = 'codex';
          if (request.type === 'completion') {
            args = ['--suggest'];
          } else if (request.type === 'chat') {
            args = [];
          }
          break;

        case 'gemini':
          command = 'gemini';
          if (request.type === 'completion') {
            args = ['--generate'];
          }
          break;

        case 'qwen':
          command = 'qwen';
          if (request.type === 'completion') {
            args = [];
          }
          break;

        default:
          reject(new Error(`Unsupported platform: ${platform.name}`));
          return;
      }

      // Execute CLI command
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data: any) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data: any) => {
        stderr += data.toString();
      });

      process.on('close', (code: number) => {
        if (code === 0) {
          resolve({
            output: stdout,
            platform: platform.displayName,
            success: true
          });
        } else {
          reject(new Error(`${platform.displayName} CLI failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error: Error) => {
        reject(new Error(`Failed to execute ${platform.displayName} CLI: ${error.message}`));
      });

      // Send input if needed
      if (request.context.fileContent) {
        process.stdin.write(request.context.fileContent);
      }
      process.stdin.end();

      // Set timeout for long-running processes
      setTimeout(() => {
        process.kill();
        reject(new Error(`${platform.displayName} CLI timeout`));
      }, 30000); // 30 second timeout
    });
  }

  private async handleFallback(request: UnifiedRequest, startTime: number, error: any): Promise<UnifiedResponse> {
    // Try fallback platforms in order
    for (const platformName of this.strategy.fallback) {
      const platform = this.platforms.get(platformName);
      if (platform?.enabled) {
        try {
          const response = await this.executeRequest(request, platform);
          response.metadata.fallbackUsed = true;
          this.updateMetrics(platform.name, startTime, response);
          return response;
        } catch (fallbackError) {
          continue;
        }
      }
    }

    // All platforms failed
    return {
      id: request.id,
      platform: 'none',
      success: false,
      error: {
        code: 'ALL_PLATFORMS_FAILED',
        message: 'All configured platforms failed to respond',
        retryable: true,
        platform: 'cross-platform-router'
      },
      metadata: {
        latency: Date.now() - startTime,
        cached: false,
        fallbackUsed: true
      }
    };
  }

  private updateMetrics(platformName: string, startTime: number, response: UnifiedResponse): void {
    const latency = Date.now() - startTime;

    // Update usage count
    this.metrics.platformUsage[platformName] = (this.metrics.platformUsage[platformName] || 0) + 1;

    // Update average latency
    const currentAvg = this.metrics.averageLatency[platformName] || 0;
    const count = this.metrics.platformUsage[platformName];
    this.metrics.averageLatency[platformName] = (currentAvg * (count - 1) + latency) / count;

    // Update success rate
    const currentSuccess = this.metrics.successRates[platformName] || 0;
    const newSuccess = response.success ? 1 : 0;
    this.metrics.successRates[platformName] = (currentSuccess * (count - 1) + newSuccess) / count;

    // Update cost tracking
    if (response.metadata.tokens?.cost) {
      this.metrics.costTracking[platformName] = (this.metrics.costTracking[platformName] || 0) + response.metadata.tokens.cost;
    }

    // Update quality scores
    if (response.metadata.quality) {
      this.metrics.qualityScores[platformName] = response.metadata.quality;
    }
  }

  public getMetrics(): CrossPlatformMetrics {
    return { ...this.metrics };
  }

  public getPlatforms(): PlatformConfig[] {
    return Array.from(this.platforms.values());
  }

  public updateStrategy(strategy: RouteStrategy): void {
    this.strategy = strategy;
  }

  public async getAuthenticatedPlatforms(): Promise<string[]> {
    const authStatus = await this.authChecker.checkAllPlatforms();
    return authStatus.filter(status => status.authenticated).map(status => status.platform);
  }

  public async getPlatformAuthStatus(): Promise<any[]> {
    return await this.authChecker.checkAllPlatforms();
  }
}