import { FooterData } from './FooterManager';

export interface FooterTheme {
  model: string;
  calls: string;
  context: string;
  hierarchy: string;
  warning: string;
  critical: string;
}

export class FooterRenderer {
  private container: HTMLElement;
  private theme: FooterTheme;
  private isVisible: boolean = true;
  private maxWidth: number = 120; // Terminal width constraint
  
  private static readonly DEFAULT_THEME: FooterTheme = {
    model: '\x1b[36m', // Cyan
    calls: '\x1b[33m', // Yellow
    context: '\x1b[32m', // Green
    hierarchy: '\x1b[35m', // Magenta
    warning: '\x1b[33m', // Yellow
    critical: '\x1b[31m' // Red
  };

  private static readonly RESET = '\x1b[0m';

  constructor(container?: HTMLElement, theme?: FooterTheme) {
    this.container = container || this.createDefaultContainer();
    this.theme = theme || FooterRenderer.DEFAULT_THEME;
  }

  /**
   * Render footer with provided data
   */
  public render(data: FooterData): void {
    if (!this.isVisible) {
      return;
    }

    const footerText = this.buildFooterText(data);
    this.updateDisplay(footerText);
  }

  /**
   * Build the complete footer text string
   */
  private buildFooterText(data: FooterData): string {
    const segments = [
      this.renderModelSegment(data.model),
      this.renderCallsSegment(data.calls),
      this.renderContextSegment(data.context),
      this.renderHierarchySegment(data.hierarchy)
    ];

    const fullText = segments.join(' | ');
    
    // Truncate if too long for terminal
    return fullText.length > this.maxWidth 
      ? this.truncateFooter(segments)
      : fullText;
  }

  /**
   * Render model segment: 🧠 Sonnet-4
   */
  private renderModelSegment(model: FooterData['model']): string {
    const color = model.status === 'error' 
      ? this.theme.critical 
      : model.status === 'fallback' 
        ? this.theme.warning 
        : this.theme.model;

    return `${color}🧠 ${model.current}${FooterRenderer.RESET}`;
  }

  /**
   * Render calls segment: 🔥 47/60
   */
  private renderCallsSegment(calls: FooterData['calls']): string {
    let color = this.theme.calls;
    
    if (calls.percentage >= 90) {
      color = this.theme.critical;
    } else if (calls.percentage >= 75) {
      color = this.theme.warning;
    }

    return `${color}🔥 ${calls.current}/${calls.limit}${FooterRenderer.RESET}`;
  }

  /**
   * Render context segment: 📊 23%
   */
  private renderContextSegment(context: FooterData['context']): string {
    let color = this.theme.context;
    let icon = '📊';
    
    if (context.critical) {
      color = this.theme.critical;
      icon = '🚨'; // Critical warning
    } else if (context.warning) {
      color = this.theme.warning;
      icon = '⚠️'; // Warning
    }

    return `${color}${icon} ${context.percentage}%${FooterRenderer.RESET}`;
  }

  /**
   * Render hierarchy segment: 📋 Project→Macro→Micro
   */
  private renderHierarchySegment(hierarchy: FooterData['hierarchy']): string {
    const truncatedHierarchy = this.truncateHierarchy(hierarchy);
    return `${this.theme.hierarchy}📋 ${truncatedHierarchy}${FooterRenderer.RESET}`;
  }

  /**
   * Truncate hierarchy for display
   */
  private truncateHierarchy(hierarchy: FooterData['hierarchy']): string {
    const maxHierarchyLength = 50;
    const separator = '→';
    
    const parts = [
      this.truncateString(hierarchy.project, 15),
      this.truncateString(hierarchy.macroTask, 15),
      this.truncateString(hierarchy.microTask, 10)
    ];

    const fullHierarchy = parts.join(separator);
    
    return fullHierarchy.length > maxHierarchyLength
      ? this.truncateString(fullHierarchy, maxHierarchyLength)
      : fullHierarchy;
  }

  /**
   * Truncate footer when it exceeds terminal width
   */
  private truncateFooter(segments: string[]): string {
    // Priority order: Model > Calls > Context > Hierarchy (truncated)
    const essential = segments.slice(0, 3).join(' | ');
    const remainingSpace = this.maxWidth - essential.length - 3; // 3 for ' | '
    
    if (remainingSpace > 10) {
      const truncatedHierarchy = this.truncateString(segments[3], remainingSpace);
      return `${essential} | ${truncatedHierarchy}`;
    }
    
    return essential;
  }

  /**
   * Truncate string with ellipsis
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - 1) + '…';
  }

  /**
   * Update the display container
   */
  private updateDisplay(text: string): void {
    if (this.container) {
      // For HTML container
      if (this.container.innerHTML !== undefined) {
        this.container.innerHTML = this.convertAnsiToHtml(text);
      } 
      // For text-based container
      else if (this.container.textContent !== undefined) {
        this.container.textContent = this.stripAnsiCodes(text);
      }
    } else {
      // Console output as fallback
      this.outputToConsole(text);
    }
  }

  /**
   * Convert ANSI color codes to HTML
   */
  private convertAnsiToHtml(text: string): string {
    const ansiToHtml: Record<string, string> = {
      '\x1b[36m': '<span style="color: cyan;">',
      '\x1b[33m': '<span style="color: orange;">',
      '\x1b[32m': '<span style="color: green;">',
      '\x1b[35m': '<span style="color: magenta;">',
      '\x1b[31m': '<span style="color: red;">',
      '\x1b[0m': '</span>'
    };

    let html = text;
    for (const [ansi, replacement] of Object.entries(ansiToHtml)) {
      html = html.replace(new RegExp(ansi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
    }

    return html;
  }

  /**
   * Strip ANSI color codes
   */
  private stripAnsiCodes(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Output to console (fallback)
   */
  private outputToConsole(text: string): void {
    // Clear previous line and output new footer
    process.stdout.write('\r\x1b[K' + text);
  }

  /**
   * Create default container for console output
   */
  private createDefaultContainer(): HTMLElement {
    // Return a mock container for console environments
    return {
      textContent: '',
      innerHTML: ''
    } as HTMLElement;
  }

  /**
   * Set visibility of footer
   */
  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    
    if (!visible && this.container) {
      if (this.container.innerHTML !== undefined) {
        this.container.innerHTML = '';
      } else if (this.container.textContent !== undefined) {
        this.container.textContent = '';
      }
    }
  }

  /**
   * Check if footer is visible
   */
  public isFooterVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Set custom theme
   */
  public setTheme(theme: FooterTheme): void {
    this.theme = theme;
  }

  /**
   * Get current theme
   */
  public getTheme(): FooterTheme {
    return { ...this.theme };
  }

  /**
   * Set maximum width for footer
   */
  public setMaxWidth(width: number): void {
    if (width < 40) {
      throw new Error('Maximum width must be at least 40 characters');
    }
    this.maxWidth = width;
  }

  /**
   * Get current maximum width
   */
  public getMaxWidth(): number {
    return this.maxWidth;
  }

  /**
   * Render a static preview of the footer
   */
  public renderPreview(): string {
    const mockData: FooterData = {
      model: {
        current: 'Sonnet-4',
        fallbackChain: ['Claude', 'Codex', 'Gemini', 'Qwen3'],
        status: 'active'
      },
      calls: {
        current: 47,
        limit: 60,
        percentage: 78
      },
      context: {
        percentage: 23,
        used: 23000,
        total: 100000,
        warning: false,
        critical: false
      },
      hierarchy: {
        project: 'DevFlow',
        macroTask: 'v3.1-Core-UX',
        microTask: 'Footer-System'
      },
      timestamp: Date.now()
    };

    return this.buildFooterText(mockData);
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.setVisible(false);
    // Additional cleanup if needed
  }
}