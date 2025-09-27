import { EventEmitter } from 'events';
import { PlatformInfo, PlatformStatus, PlatformType } from '../orchestration/platform-detector';

export class PlatformStatusFooter extends EventEmitter {
  private platforms: PlatformInfo[] = [];
  private refreshInterval: NodeJS.Timeout | null = null;
  private terminalWidth: number = 80;
  private isRendering: boolean = false;

  constructor() {
    super();
    this.updateTerminalWidth();
    this.setupResizeListener();
  }

  updatePlatforms(platforms: PlatformInfo[]): void {
    this.platforms = [...platforms];
    if (!this.isRendering) {
      this.render();
    }
  }

  startAutoRefresh(interval: number = 2500): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this.refreshInterval = setInterval(() => {
      this.render();
    }, interval);
  }

  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private updateTerminalWidth(): void {
    this.terminalWidth = process.stdout.columns || 80;
  }

  private setupResizeListener(): void {
    process.stdout.on('resize', () => {
      this.updateTerminalWidth();
      this.render();
    });
  }

  private render(): void {
    if (this.isRendering) return;
    this.isRendering = true;

    try {
      // Move cursor to bottom of terminal
      process.stdout.write('\x1B[s'); // Save cursor position
      process.stdout.write(`\x1B[${process.stdout.rows};1H`); // Move to bottom
      process.stdout.write('\x1B[2K'); // Clear line
      
      const statusLine = this.generateStatusLine();
      process.stdout.write(statusLine);
      
      process.stdout.write('\x1B[u'); // Restore cursor position
    } catch (error) {
      // Silently fail to avoid disrupting main application
    } finally {
      this.isRendering = false;
    }
  }

  private generateStatusLine(): string {
    if (this.platforms.length === 0) {
      return this.centerText('No platform data available', this.terminalWidth);
    }

    // Calculate space per platform
    const platformCount = this.platforms.length;
    const spacePerPlatform = Math.max(15, Math.floor((this.terminalWidth - 10) / platformCount));
    
    const platformDisplays = this.platforms.map(platform => 
      this.formatPlatformDisplay(platform, spacePerPlatform)
    );
    
    let statusLine = platformDisplays.join(' | ');
    
    // Truncate or pad to fit terminal width
    if (statusLine.length > this.terminalWidth) {
      statusLine = statusLine.substring(0, this.terminalWidth - 3) + '...';
    } else {
      statusLine = statusLine.padEnd(this.terminalWidth, ' ');
    }
    
    return statusLine;
  }

  private formatPlatformDisplay(platform: PlatformInfo, maxWidth: number): string {
    const statusChar = this.getStatusIndicator(platform.status);
    const name = platform.type.substring(0, 4).toUpperCase();
    const latency = platform.latency > 0 ? `${platform.latency}ms` : 'N/A';
    
    // Color coding based on status
    const coloredName = this.colorizeText(name, platform.status);
    const coloredLatency = this.colorizeText(latency, platform.status);
    
    // Format: [QWEN● 45ms]
    let display = `${coloredName}${statusChar} ${coloredLatency}`;
    
    // Truncate if too long
    if (display.length > maxWidth) {
      display = display.substring(0, maxWidth);
    }
    
    return display.padEnd(maxWidth, ' ');
  }

  private getStatusIndicator(status: PlatformStatus): string {
    switch (status) {
      case PlatformStatus.AVAILABLE: return '●';
      case PlatformStatus.DEGRADED: return '○';
      case PlatformStatus.UNAVAILABLE: return '×';
      default: return '?';
    }
  }

  private colorizeText(text: string, status: PlatformStatus): string {
    // ANSI color codes
    const colors: Record<PlatformStatus, string> = {
      [PlatformStatus.AVAILABLE]: '\x1B[32m',    // Green
      [PlatformStatus.DEGRADED]: '\x1B[33m',     // Yellow
      [PlatformStatus.UNAVAILABLE]: '\x1B[31m'   // Red
    };
    
    const reset = '\x1B[0m';
    return `${colors[status] || ''}${text}${reset}`;
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text + ' '.repeat(width - text.length - padding);
  }

  showTooltip(platformType: PlatformType): void {
    const platform = this.platforms.find(p => p.type === platformType);
    if (!platform) return;
    
    const tooltip = `
${platform.type.toUpperCase()} Status:
` +
      `  Status: ${platform.status}
` +
      `  Latency: ${platform.latency}ms
` +
      `  Error Rate: ${(platform.errorRate * 100).toFixed(2)}%
` +
      `  Last Checked: ${platform.lastChecked.toLocaleTimeString()}
`;
    
    process.stdout.write(tooltip);
  }

  clear(): void {
    process.stdout.write(`\x1B[${process.stdout.rows};1H`); // Move to bottom
    process.stdout.write('\x1B[2K'); // Clear line
  }

  destroy(): void {
    this.stopAutoRefresh();
    this.clear();
  }
}
