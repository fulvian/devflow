/**
 * ASCII Art Renderer
 * Advanced rendering engine for enhanced footer with animations and colors
 */

import { EventEmitter } from 'events';
import { FooterState, RenderedSegment, FooterLayout, FOOTER_COLORS } from './types/enhanced-footer-types.js';

export class ASCIIArtRenderer extends EventEmitter {
  private terminalWidth: number;
  private lastRenderedContent: string = '';
  private animationFrame = 0;
  private isRendering = false;

  constructor() {
    super();
    this.terminalWidth = process.stdout.columns || 80;
    this.setupResizeListener();
  }

  private setupResizeListener(): void {
    process.stdout.on('resize', () => {
      this.terminalWidth = process.stdout.columns || 80;
      this.emit('terminalResize', this.terminalWidth);
    });
  }

  renderFooter(state: FooterState): void {
    if (this.isRendering) return;
    this.isRendering = true;

    try {
      const layout = this.createLayout(state);
      const renderedContent = this.formatLayout(layout);

      if (renderedContent !== this.lastRenderedContent) {
        this.outputToTerminal(renderedContent);
        this.lastRenderedContent = renderedContent;
        this.emit('rendered', renderedContent);
      }
    } catch (error) {
      console.error('Error rendering footer:', error);
      this.emit('error', error);
    } finally {
      this.isRendering = false;
    }
  }

  private createLayout(state: FooterState): FooterLayout {
    const segments: RenderedSegment[] = [];

    // 1. Brain Status (🧠 R:● W:○)
    const brainSegment = this.createBrainSegment(state);
    segments.push(brainSegment);

    // 2. Separator
    segments.push(this.createSeparator());

    // 3. Task Progress (enhanced_footer 85%)
    const taskSegment = this.createTaskSegment(state);
    segments.push(taskSegment);

    // 4. Separator
    segments.push(this.createSeparator());

    // 5. Agent Mode ([claude-only])
    const modeSegment = this.createModeSegment(state);
    segments.push(modeSegment);

    // 6. Separator
    segments.push(this.createSeparator());

    // 7. Agent Count (3/5 Agents)
    const agentSegment = this.createAgentSegment(state);
    segments.push(agentSegment);

    // 8. Separator
    segments.push(this.createSeparator());

    // 9. Token Counters (Session:2.5K Task:1.2K)
    const tokenSegment = this.createTokenSegment(state);
    segments.push(tokenSegment);

    // 10. Separator
    segments.push(this.createSeparator());

    // 11. Pending Tasks (3 pending)
    const pendingSegment = this.createPendingSegment(state);
    segments.push(pendingSegment);

    const totalWidth = segments.reduce((width, segment) => width + segment.width, 0);

    return {
      segments,
      totalWidth,
      overflow: totalWidth > this.terminalWidth
    };
  }

  private createBrainSegment(state: FooterState): RenderedSegment {
    const readIndicator = state.dbActivity.reads.active
      ? `${FOOTER_COLORS.R_ACTIVE}R:●${FOOTER_COLORS.RESET}`
      : `${FOOTER_COLORS.R_IDLE}R:○${FOOTER_COLORS.RESET}`;

    const writeIndicator = state.dbActivity.writes.active
      ? `${FOOTER_COLORS.W_ACTIVE}W:●${FOOTER_COLORS.RESET}`
      : `${FOOTER_COLORS.W_IDLE}W:○${FOOTER_COLORS.RESET}`;

    const content = `${FOOTER_COLORS.BRAIN_PURPLE}🧠${FOOTER_COLORS.RESET} ${readIndicator} ${writeIndicator}`;

    return {
      content,
      width: 12, // Approssimazione lunghezza visuale
      animated: state.dbActivity.reads.active || state.dbActivity.writes.active
    };
  }

  private createTaskSegment(state: FooterState): RenderedSegment {
    const { name, progress } = state.taskProgress;

    let progressColor: string;
    if (progress >= 80) {
      progressColor = FOOTER_COLORS.PROGRESS_HIGH;
    } else if (progress >= 40) {
      progressColor = FOOTER_COLORS.PROGRESS_MID;
    } else {
      progressColor = FOOTER_COLORS.PROGRESS_LOW;
    }

    const content = `${FOOTER_COLORS.BOLD}${name}${FOOTER_COLORS.RESET} ${progressColor}${progress}%${FOOTER_COLORS.RESET}`;

    return {
      content,
      width: name.length + 5, // nome + " XX%"
      animated: false
    };
  }

  private createModeSegment(state: FooterState): RenderedSegment {
    const mode = state.agentStatus.mode;

    let modeColor: string;
    switch (mode) {
      case 'claude-only':
        modeColor = FOOTER_COLORS.MODE_CLAUDE;
        break;
      case 'all-mode':
        modeColor = FOOTER_COLORS.MODE_ALL;
        break;
      case 'cli-only':
        modeColor = FOOTER_COLORS.MODE_CLI;
        break;
      case 'synthetic-only':
        modeColor = FOOTER_COLORS.MODE_SYNTH;
        break;
      default:
        modeColor = FOOTER_COLORS.DIM;
    }

    const content = `${modeColor}[${mode}]${FOOTER_COLORS.RESET}`;

    return {
      content,
      width: mode.length + 2, // [mode]
      animated: false
    };
  }

  private createAgentSegment(state: FooterState): RenderedSegment {
    const { active, total } = state.agentStatus;
    const countColor = active > 0 ? FOOTER_COLORS.PROGRESS_HIGH : FOOTER_COLORS.PROGRESS_LOW;

    const content = `${countColor}${active}${FOOTER_COLORS.RESET}/${total} Agents`;

    return {
      content,
      width: 9, // "X/X Agents"
      animated: false
    };
  }

  private createTokenSegment(state: FooterState): RenderedSegment {
    const sessionTokens = this.formatTokenCount(state.tokenMetrics.session.total);
    const taskTokens = this.formatTokenCount(state.tokenMetrics.task.current);

    const content = `${FOOTER_COLORS.TOKEN_SESSION}Session:${sessionTokens}${FOOTER_COLORS.RESET} ${FOOTER_COLORS.TOKEN_TASK}Task:${taskTokens}${FOOTER_COLORS.RESET}`;

    return {
      content,
      width: 20, // Approssimazione per "Session:XXK Task:XXK"
      animated: false
    };
  }

  private createPendingSegment(state: FooterState): RenderedSegment {
    const count = state.taskProgress.pendingCount;
    const pendingColor = count > 0 ? FOOTER_COLORS.PENDING_COUNT : FOOTER_COLORS.DIM;

    const content = `${pendingColor}${count} pending${FOOTER_COLORS.RESET}`;

    return {
      content,
      width: 10, // "XX pending"
      animated: false
    };
  }

  private createSeparator(): RenderedSegment {
    return {
      content: `${FOOTER_COLORS.DIM} │ ${FOOTER_COLORS.RESET}`,
      width: 3,
      animated: false
    };
  }

  private formatLayout(layout: FooterLayout): string {
    if (!layout.overflow) {
      // Layout normale
      return layout.segments.map(s => s.content).join('');
    } else {
      // Layout compatto per terminali piccoli
      return this.createCompactLayout(layout);
    }
  }

  private createCompactLayout(layout: FooterLayout): string {
    // Modalità compatta: mostra solo elementi essenziali
    const essentialSegments = layout.segments.filter((_, index) => {
      // Mantieni: Brain (0), Task (2), Mode (4), Agents (6), Tokens (8), Pending (10)
      // Rimuovi alcuni separatori se necessario
      const essentialIndices = [0, 2, 4, 6, 8, 10];
      const separatorIndices = [1, 3, 5, 7, 9];

      if (essentialIndices.includes(index)) return true;
      if (separatorIndices.includes(index) && layout.totalWidth > this.terminalWidth * 0.8) {
        return false; // Rimuovi separatori se troppo lungo
      }
      return separatorIndices.includes(index);
    });

    let compactContent = essentialSegments.map(s => s.content).join('');

    // Se ancora troppo lungo, abbrevia ulteriormente
    if (compactContent.length > this.terminalWidth) {
      compactContent = this.createMinimalLayout(layout);
    }

    return compactContent;
  }

  private createMinimalLayout(layout: FooterLayout): string {
    // Layout minimale per terminali molto piccoli
    const brain = layout.segments[0].content;
    const task = layout.segments[2].content;
    const mode = layout.segments[4].content;

    return `${brain} │ ${task} │ ${mode}`;
  }

  private formatTokenCount(count: number): string {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    } else {
      return count.toString();
    }
  }

  private outputToTerminal(content: string): void {
    try {
      // Salva posizione cursore
      process.stdout.write('\x1B[s');

      // Muovi alla riga inferiore del terminale
      const terminalHeight = process.stdout.rows || 24;
      process.stdout.write(`\x1B[${terminalHeight};1H`);

      // Pulisci la riga
      process.stdout.write('\x1B[2K');

      // Scrivi il contenuto del footer
      process.stdout.write(content);

      // Ripristina posizione cursore
      process.stdout.write('\x1B[u');

    } catch (error) {
      // Fallback silenzioso per evitare disruption
      console.error('Footer render error:', error);
    }
  }

  clearFooter(): void {
    try {
      const terminalHeight = process.stdout.rows || 24;
      process.stdout.write(`\x1B[${terminalHeight};1H`);
      process.stdout.write('\x1B[2K');
      this.lastRenderedContent = '';
    } catch (error) {
      // Silent fail
    }
  }

  getTerminalWidth(): number {
    return this.terminalWidth;
  }

  destroy(): void {
    this.clearFooter();
    this.removeAllListeners();
  }
}