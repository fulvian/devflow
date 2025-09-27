import { ToolContext } from '../tools/types';

export class DAICModeDetector {
  async detect(context: ToolContext): Promise<boolean> {
    // Stub implementation
    return context.daicMode?.isActive || false;
  }
}