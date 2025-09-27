/**
 * Enhanced Footer System - Main Entry Point
 * Export all components and provide easy integration
 */

// Main System
export { EnhancedFooterSystem as default } from './enhanced-footer-system.js';
export { EnhancedFooterSystem } from './enhanced-footer-system.js';

// Individual Components
export { DatabaseActivityMonitor } from './database-activity-monitor.js';
export { TokenUsageTracker } from './token-usage-tracker.js';
export { AgentStatusConnector } from './agent-status-connector.js';
export { TaskProgressTracker } from './task-progress-tracker.js';
export { ASCIIArtRenderer } from './ascii-art-renderer.js';

// Types
export * from './types/enhanced-footer-types.js';

// Import for factory function
import { EnhancedFooterSystem } from './enhanced-footer-system.js';

// Factory function for quick setup
export function createEnhancedFooter(config?: any) {
  return new EnhancedFooterSystem(config);
}

// CLI integration helper
export async function startFooterCLI() {
  const footer = createEnhancedFooter();

  try {
    await footer.start();

    console.log('🚀 Enhanced Footer System running...');
    console.log('📊 Preview:', footer.getFormattedPreview());
    console.log('Press Ctrl+C to stop');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down Enhanced Footer System...');
      await footer.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down Enhanced Footer System...');
      await footer.destroy();
      process.exit(0);
    });

    return footer;

  } catch (error) {
    console.error('❌ Failed to start Enhanced Footer System:', error);
    throw error;
  }
}