import { DreamTeamOrchestrator } from './dream-team-orchestrator';
import { ContinuousVerifier } from './continuous-verifier';
import { TaskProgressTracker } from './task-progress-tracker';
import { PlanAdherenceValidator } from './plan-adherence-validator';
import { AgentResponse } from '../../types/agent.types';
import { Task } from '../../types/task.types';
import { VerificationResult } from '../../types/verification.types';

export class EnhancedDreamTeamOrchestrator extends DreamTeamOrchestrator {
  private continuousVerifier: ContinuousVerifier;
  private progressTracker: TaskProgressTracker;
  private planValidator: PlanAdherenceValidator;
  private statusListeners: Array<(status: string) => void> = [];

  constructor() {
    super();
    this.continuousVerifier = new ContinuousVerifier();
    this.progressTracker = new TaskProgressTracker();
    this.planValidator = new PlanAdherenceValidator();
  }

  async executeTask(task: Task): Promise<AgentResponse> {
    this.notifyStatus(`Starting task execution: ${task.title}`);
    this.progressTracker.registerTask(task);
    
    try {
      // Execute the original workflow
      const response = await super.executeTask(task);
      
      // Continuous verification after each agent output
      const verification = await this.continuousVerifier.verifyWorkflowStep(
        response,
        task
      );
      
      if (!verification.isVerified) {
        this.handleVerificationFailure(verification, task);
      }
      
      // Update progress
      this.progressTracker.updateTaskProgress(task.id, {
        id: `microtask-${Date.now()}`,
        title: 'Task execution',
        status: 'completed',
        assignedAgent: response.agentId
      });
      
      this.notifyStatus(`Task completed with adherence score: ${
        verification.planAdherence.score
      }%`);
      
      return response;
    } catch (error) {
      this.notifyStatus(`Task execution failed: ${error.message}`);
      throw error;
    }
  }

  async executeAgentResponse(
    response: AgentResponse,
    task: Task
  ): Promise<AgentResponse> {
    // Call parent implementation
    const result = await super.executeAgentResponse(response, task);
    
    // Continuous verification
    const verification = await this.continuousVerifier.verifyAgentOutput(
      result,
      task
    );
    
    // Handle verification results
    if (!verification.isVerified) {
      await this.handleVerificationFailure(verification, task);
    }
    
    // Update progress
    this.progressTracker.updateTaskProgress(task.id, {
      id: `microtask-${Date.now()}`,
      title: `Agent response from ${result.agentId}`,
      status: 'completed',
      assignedAgent: result.agentId
    });
    
    return result;
  }

  private async handleVerificationFailure(
    verification: VerificationResult,
    task: Task
  ): Promise<void> {
    this.notifyStatus(`Verification failed for task ${task.id}`);
    
    // Send feedback to agents for correction
    if (verification.feedback.length > 0) {
      await this.requestAgentCorrections(
        verification.feedback,
        task
      );
    }
    
    // Log detailed verification results
    console.warn('Verification failed:', {
      codeQuality: verification.codeQuality,
      planAdherence: verification.planAdherence
    });
  }

  private async requestAgentCorrections(
    feedback: string[],
    task: Task
  ): Promise<void> {
    // In a real implementation, this would send feedback to the agents
    console.log('Requesting corrections from agents:', feedback);
    
    // This could trigger a new workflow cycle with the feedback
    this.notifyStatus(`Requesting corrections: ${feedback.join(', ')}`);
  }

  getTaskProgress(taskId: string): number {
    return this.progressTracker.getTaskProgress(taskId);
  }

  addStatusListener(listener: (status: string) => void): void {
    this.statusListeners.push(listener);
  }

  removeStatusListener(listener: (status: string) => void): void {
    const index = this.statusListeners.indexOf(listener);
    if (index > -1) {
      this.statusListeners.splice(index, 1);
    }
  }

  private notifyStatus(status: string): void {
    this.statusListeners.forEach(listener => listener(status));
  }

  async validateFinalAdherence(
    response: AgentResponse,
    task: Task
  ): Promise<any> {
    return await this.planValidator.validateAdherence(response, task);
  }
}
