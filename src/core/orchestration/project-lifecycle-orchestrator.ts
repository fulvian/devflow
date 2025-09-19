/**
 * Project Lifecycle Orchestrator
 * Task ID: DEVFLOW-PLM-FIX-001
 * 
 * This module orchestrates project lifecycle events and integrates with the Project Lifecycle Manager.
 * It handles event processing, API communications, and error management.
 */

// Import required modules and types
import { EventEmitter } from 'events';
import { Project, ProjectStatus, LifecycleEvent, ApiClient } from './types';

/**
 * Interface for Project Lifecycle Manager
 */
interface IProjectLifecycleManager {
  getProject(id: string): Promise<Project>;
  updateProjectStatus(id: string, status: ProjectStatus): Promise<void>;
  triggerEvent(event: LifecycleEvent): Promise<void>;
}

/**
 * Interface for API Client
 */
interface IApiClient {
  post(endpoint: string, data: any): Promise<any>;
  get(endpoint: string): Promise<any>;
  put(endpoint: string, data: any): Promise<any>;
}

/**
 * Configuration interface for the orchestrator
 */
interface OrchestratorConfig {
  apiBaseUrl: string;
  maxRetries: number;
  timeout: number;
}

/**
 * Project Lifecycle Orchestrator Class
 * Manages project lifecycle events and coordinates with external systems
 */
export class ProjectLifecycleOrchestrator extends EventEmitter {
  private apiClient: IApiClient;
  private config: OrchestratorConfig;
  private isInitialized: boolean = false;

  /**
   * Constructor for ProjectLifecycleOrchestrator
   * @param config - Configuration object for the orchestrator
   * @param apiClient - API client instance for external communications
   */
  constructor(config: OrchestratorConfig, apiClient: IApiClient) {
    super();
    this.config = config;
    this.apiClient = apiClient;
  }

  /**
   * Initialize the orchestrator
   */
  public async initialize(): Promise<void> {
    try {
      // Perform initialization tasks
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.handleError('INITIALIZATION_ERROR', error);
      throw error;
    }
  }

  /**
   * Process a lifecycle event for a project
   * @param event - The lifecycle event to process
   */
  public async processEvent(event: LifecycleEvent): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Orchestrator not initialized');
    }

    try {
      this.emit('eventProcessingStarted', event);
      
      // Validate event
      if (!this.isValidEvent(event)) {
        throw new Error(`Invalid event: ${JSON.stringify(event)}`);
      }

      // Process the event based on its type
      switch (event.type) {
        case 'PROJECT_CREATED':
          await this.handleProjectCreated(event);
          break;
        case 'PROJECT_UPDATED':
          await this.handleProjectUpdated(event);
          break;
        case 'PROJECT_COMPLETED':
          await this.handleProjectCompleted(event);
          break;
        case 'PROJECT_CANCELLED':
          await this.handleProjectCancelled(event);
          break;
        default:
          throw new Error(`Unsupported event type: ${event.type}`);
      }

      this.emit('eventProcessingCompleted', event);
    } catch (error) {
      this.handleError('EVENT_PROCESSING_ERROR', error, event);
      throw error;
    }
  }

  /**
   * Handle project creation event
   * @param event - The project creation event
   */
  private async handleProjectCreated(event: LifecycleEvent): Promise<void> {
    try {
      // Notify external systems about project creation
      await this.notifyExternalSystem('project-created', event.payload);
      
      // Update project status
      await this.updateProjectStatus(event.projectId, 'ACTIVE');
      
      this.emit('projectCreated', event);
    } catch (error) {
      this.handleError('PROJECT_CREATION_ERROR', error, event);
      throw error;
    }
  }

  /**
   * Handle project update event
   * @param event - The project update event
   */
  private async handleProjectUpdated(event: LifecycleEvent): Promise<void> {
    try {
      // Notify external systems about project update
      await this.notifyExternalSystem('project-updated', event.payload);
      
      this.emit('projectUpdated', event);
    } catch (error) {
      this.handleError('PROJECT_UPDATE_ERROR', error, event);
      throw error;
    }
  }

  /**
   * Handle project completion event
   * @param event - The project completion event
   */
  private async handleProjectCompleted(event: LifecycleEvent): Promise<void> {
    try {
      // Update project status to completed
      await this.updateProjectStatus(event.projectId, 'COMPLETED');
      
      // Notify external systems about project completion
      await this.notifyExternalSystem('project-completed', event.payload);
      
      this.emit('projectCompleted', event);
    } catch (error) {
      this.handleError('PROJECT_COMPLETION_ERROR', error, event);
      throw error;
    }
  }

  /**
   * Handle project cancellation event
   * @param event - The project cancellation event
   */
  private async handleProjectCancelled(event: LifecycleEvent): Promise<void> {
    try {
      // Update project status to cancelled
      await this.updateProjectStatus(event.projectId, 'CANCELLED');
      
      // Notify external systems about project cancellation
      await this.notifyExternalSystem('project-cancelled', event.payload);
      
      this.emit('projectCancelled', event);
    } catch (error) {
      this.handleError('PROJECT_CANCELLATION_ERROR', error, event);
      throw error;
    }
  }

  /**
   * Update project status through API
   * @param projectId - The ID of the project to update
   * @param status - The new status for the project
   */
  private async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
    try {
      const maxRetries = this.config.maxRetries;
      let retries = 0;
      
      while (retries <= maxRetries) {
        try {
          await this.apiClient.put(`/projects/${projectId}/status`, { status });
          return;
        } catch (error) {
          if (retries === maxRetries) {
            throw error;
          }
          retries++;
          await this.delay(1000 * retries); // Exponential backoff
        }
      }
    } catch (error) {
      this.handleError('STATUS_UPDATE_ERROR', error, { projectId, status });
      throw error;
    }
  }

  /**
   * Notify external systems about events
   * @param eventType - The type of event
   * @param payload - The event payload
   */
  private async notifyExternalSystem(eventType: string, payload: any): Promise<void> {
    try {
      await this.apiClient.post('/notifications', {
        eventType,
        payload,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError('NOTIFICATION_ERROR', error, { eventType, payload });
      // Don't throw - notification failures shouldn't break the main flow
      console.warn(`Failed to notify external system about ${eventType}`, error);
    }
  }

  /**
   * Validate if an event is properly structured
   * @param event - The event to validate
   * @returns true if valid, false otherwise
   */
  private isValidEvent(event: LifecycleEvent): boolean {
    return !!(
      event &&
      event.type &&
      event.projectId &&
      event.timestamp &&
      new Date(event.timestamp).toString() !== 'Invalid Date'
    );
  }

  /**
   * Handle errors by emitting error events and logging
   * @param errorType - The type of error
   * @param error - The error object
   * @param context - Additional context information
   */
  private handleError(errorType: string, error: any, context?: any): void {
    const errorInfo = {
      errorType,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString()
    };

    this.emit('error', errorInfo);
    console.error(`[${errorType}]`, errorInfo);
  }

  /**
   * Utility function for delaying execution
   * @param ms - Milliseconds to delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown the orchestrator gracefully
   */
  public async shutdown(): Promise<void> {
    try {
      this.isInitialized = false;
      this.emit('shutdown');
    } catch (error) {
      this.handleError('SHUTDOWN_ERROR', error);
      throw error;
    }
  }
}

// Export types for external use
export { 
  Project, 
  ProjectStatus, 
  LifecycleEvent, 
  OrchestratorConfig,
  IProjectLifecycleManager,
  IApiClient
};