import { CodeAnalyzer } from '../../analysis/code-analyzer';
import { PlanAdherenceValidator } from './plan-adherence-validator';
import { AgentResponse } from '../../types/agent.types';
import { Task } from '../../types/task.types';
import { VerificationResult } from '../../types/verification.types';

export class ContinuousVerifier {
  private codeAnalyzer: CodeAnalyzer;
  private planValidator: PlanAdherenceValidator;

  constructor() {
    this.codeAnalyzer = new CodeAnalyzer();
    this.planValidator = new PlanAdherenceValidator();
  }

  async verifyAgentOutput(
    response: AgentResponse,
    originalTask: Task
  ): Promise<VerificationResult> {
    // Verify code correctness using AST analysis
    const codeQualityResult = await this.codeAnalyzer.analyzeCode(
      response.code || ''
    );

    // Validate plan adherence
    const planAdherenceResult = await this.planValidator.validateAdherence(
      response,
      originalTask
    );

    // Combine results
    const isVerified = 
      codeQualityResult.isValid && planAdherenceResult.isAdherent;

    return {
      isVerified,
      codeQuality: codeQualityResult,
      planAdherence: planAdherenceResult,
      timestamp: new Date(),
      feedback: this.generateFeedback(
        codeQualityResult,
        planAdherenceResult
      )
    };
  }

  private generateFeedback(
    codeQuality: any,
    planAdherence: any
  ): string[] {
    const feedback: string[] = [];
    
    if (!codeQuality.isValid) {
      feedback.push(...codeQuality.issues);
    }
    
    if (!planAdherence.isAdherent) {
      feedback.push(...planAdherence.feedback);
    }
    
    return feedback;
  }

  async verifyWorkflowStep(
    response: AgentResponse,
    originalTask: Task
  ): Promise<VerificationResult> {
    return await this.verifyAgentOutput(response, originalTask);
  }
}
