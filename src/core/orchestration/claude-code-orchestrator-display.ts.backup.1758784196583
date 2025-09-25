/**
 * DEVFLOW-ORCHESTRATOR-DISPLAY-001
 *
 * Claude Code Session Integrated Orchestrator Status Display
 *
 * This module integrates with the Claude Code session to display the current
 * active manager model (SONNET/CODEX/GEMINI/QWEN3) directly within the conversation window.
 * It hooks into the existing global.DEVFLOW_ORCHESTRATION system for real-time updates.
 */

// Define the supported orchestrator models
type OrchestratorModel = 'SONNET' | 'CODEX' | 'GEMINI' | 'QWEN3';

// Define the structure of the global orchestration object
interface DevflowOrchestration {
  currentOrchestrator: OrchestratorModel | null;
  lastUpdated: Date | null;
  updateListener?: (newOrchestrator: OrchestratorModel) => void;
}

// Extend the global object with our orchestration interface
declare global {
  var DEVFLOW_ORCHESTRATION: DevflowOrchestration | undefined;
}

/**
 * Orchestrator Status Display Class
 * Manages the display of orchestrator status within Claude Code sessions
 */
class OrchestratorStatusDisplay {
  private currentOrchestrator: OrchestratorModel | null = null;
  private isInitialized: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize the orchestrator status display
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.log('[DEVFLOW] Orchestrator status display already initialized');
      return;
    }

    // Ensure global orchestration object exists
    if (!global.DEVFLOW_ORCHESTRATION) {
      global.DEVFLOW_ORCHESTRATION = {
        currentOrchestrator: null,
        lastUpdated: null
      };
    }

    // Set up the update listener
    global.DEVFLOW_ORCHESTRATION.updateListener = (newOrchestrator: OrchestratorModel) => {
      this.handleOrchestratorUpdate(newOrchestrator);
    };

    // Display initial status
    this.displayCurrentStatus();

    // Set up periodic status checks
    this.updateInterval = setInterval(() => {
      this.displayCurrentStatus();
    }, 30000); // Update every 30 seconds

    this.isInitialized = true;
    console.log('[DEVFLOW] Orchestrator status display initialized');
  }

  /**
   * Handle orchestrator updates from the global system
   * @param newOrchestrator The new orchestrator model
   */
  private handleOrchestratorUpdate(newOrchestrator: OrchestratorModel): void {
    if (this.currentOrchestrator !== newOrchestrator) {
      this.currentOrchestrator = newOrchestrator;
      this.displayStatusUpdate(newOrchestrator);
    }
  }

  /**
   * Display the current orchestrator status in the Claude Code chat
   */
  private displayCurrentStatus(): void {
    const orchestrator = global.DEVFLOW_ORCHESTRATION?.currentOrchestrator;

    if (orchestrator) {
      this.currentOrchestrator = orchestrator;
      this.displayStatusUpdate(orchestrator);
    } else {
      console.log('[DEVFLOW] Current Orchestrator: Not set');
    }
  }

  /**
   * Display an orchestrator status update
   * @param orchestrator The orchestrator model to display
   */
  private displayStatusUpdate(orchestrator: OrchestratorModel): void {
    const timestamp = new Date().toISOString();
    const statusMessage = `[DEVFLOW] Current Orchestrator: ${orchestrator} (Updated: ${timestamp})`;

    console.log(statusMessage);

    // Also update the global object timestamp
    if (global.DEVFLOW_ORCHESTRATION) {
      global.DEVFLOW_ORCHESTRATION.lastUpdated = new Date();
    }
  }

  /**
   * Force a status update display
   */
  public forceUpdate(): void {
    this.displayCurrentStatus();
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (global.DEVFLOW_ORCHESTRATION?.updateListener) {
      delete global.DEVFLOW_ORCHESTRATION.updateListener;
    }

    this.isInitialized = false;
    console.log('[DEVFLOW] Orchestrator status display destroyed');
  }
}

// Create and initialize the orchestrator status display
const orchestratorDisplay = new OrchestratorStatusDisplay();

/**
 * Public API for interacting with the orchestrator status display
 */
export const DevflowOrchestratorDisplay = {
  /**
   * Initialize the orchestrator status display
   */
  initialize: (): void => {
    orchestratorDisplay.initialize();
  },

  /**
   * Force an immediate status update display
   */
  update: (): void => {
    orchestratorDisplay.forceUpdate();
  },

  /**
   * Clean up the orchestrator status display
   */
  destroy: (): void => {
    orchestratorDisplay.destroy();
  },

  /**
   * Get the current orchestrator model
   */
  getCurrentOrchestrator: (): OrchestratorModel | null => {
    return global.DEVFLOW_ORCHESTRATION?.currentOrchestrator || null;
  }
};

// Auto-initialize when module is loaded
DevflowOrchestratorDisplay.initialize();

// For direct usage in Claude Code sessions
global.DEVFLOW_ORCHESTRATOR_DISPLAY = DevflowOrchestratorDisplay;

// Export types for external use
export type { OrchestratorModel, DevflowOrchestration };

// Extend global object with our display interface
declare global {
  var DEVFLOW_ORCHESTRATOR_DISPLAY: typeof DevflowOrchestratorDisplay | undefined;
}