import { EventEmitter } from 'events';
import UserRequirementAdherenceVerifier, { 
  UserIntent, 
  OutcomeValidation, 
  DeploymentVerificationResult 
} from './user-requirement-adherence-verifier';
import { ContinuousVerificationLoop, Task, Alert } from './continuous-verification-loop';
import { PlanAdherenceValidator } from '../plan-adherence-validator';

/**
 * User Requirement Integration Wrapper - DEVFLOW-INTEGRATION-001
 * 
 * Integrates the User Requirement Adherence Verifier into the existing
 * verification infrastructure, providing seamless integration with
 * continuous verification and plan adherence validation.
 */

export interface IntegrationConfig {
  enableRealTimeValidation: boolean;
  enableDeploymentVerification: boolean;
  enableAutomaticIntentCapture: boolean;
  validationThreshold: number; // Minimum adherence score to pass
  criticalGapThreshold: number; // Max critical gaps before stopping
}

export interface IntegrationReport {
  systemStatus: 'healthy' | 'warning' | 'critical';
  overallAdherenceScore: number;
  activeIntents: number;
  recentValidations: number;
  criticalGaps: number;
  recommendations: string[];
  lastUpdate: string;
}

export class UserRequirementIntegration extends EventEmitter {
  private userRequirementVerifier: UserRequirementAdherenceVerifier;
  private continuousVerifier: ContinuousVerificationLoop;
  private planValidator: PlanAdherenceValidator;
  
  private config: IntegrationConfig;
  private isActive: boolean = false;
  private currentIntents: Map<string, UserIntent> = new Map();

  constructor(config: Partial<IntegrationConfig> = {}) {
    super();
    
    // Initialize components
    this.userRequirementVerifier = new UserRequirementAdherenceVerifier();
    this.continuousVerifier = new ContinuousVerificationLoop();
    this.planValidator = new PlanAdherenceValidator();
    
    // Set default configuration
    this.config = {
      enableRealTimeValidation: true,
      enableDeploymentVerification: true,
      enableAutomaticIntentCapture: true,
      validationThreshold: 80,
      criticalGapThreshold: 3,
      ...config
    };
    
    this.setupIntegration();
  }

  /**
   * Initialize the integrated verification system
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔗 Initializing User Requirement Integration System...');
      
      // Initialize the verifier
      await this.userRequirementVerifier.initialize();
      
      // Start continuous verification if not already running
      if (!this.continuousVerifier.getStatus().running) {
        await this.continuousVerifier.start();
      }
      
      this.isActive = true;
      console.log('✅ User Requirement Integration System initialized');
      this.emit('integration-initialized');
    } catch (error) {
      console.error('❌ Failed to initialize User Requirement Integration:', error);
      throw error;
    }
  }

  /**
   * Capture user intent with automatic context enrichment
   */
  async captureIntent(
    userRequest: string,
    context: { taskId?: string; branch?: string; sessionContext?: any } = {}
  ): Promise<UserIntent> {
    if (!this.isActive) {
      throw new Error('Integration system not initialized');
    }

    try {
      console.log('🎯 Capturing user intent through integration layer...');
      
      // Enrich context with current system state
      const enrichedContext = await this.enrichContextFromSystem(context);
      
      // Capture intent
      const intent = await this.userRequirementVerifier.captureUserIntent(
        userRequest, 
        enrichedContext
      );
      
      // Store for tracking
      this.currentIntents.set(intent.id, intent);
      
      // Set up real-time validation if enabled
      if (this.config.enableRealTimeValidation) {
        this.setupRealTimeValidationForIntent(intent.id);
      }
      
      console.log(`✅ Intent captured and integrated: ${intent.id}`);
      this.emit('intent-captured', intent);
      
      return intent;
    } catch (error) {
      console.error('❌ Failed to capture intent:', error);
      throw error;
    }
  }

  /**
   * Validate specific intent with full integration
   */
  async validateIntent(intentId: string): Promise<{
    userRequirementValidation: OutcomeValidation[];
    planAdherenceResult: any;
    integrationScore: number;
    recommendations: string[];
  }> {
    if (!this.isActive) {
      throw new Error('Integration system not initialized');
    }

    const intent = this.currentIntents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }

    try {
      console.log(`🔍 Running integrated validation for intent: ${intentId}`);

      // Run user requirement validation
      const userRequirementValidation = await this.userRequirementVerifier.validateOutcome(intentId);
      
      // Run plan adherence validation (if applicable)
      let planAdherenceResult = null;
      try {
        // This would need to be adapted based on the actual plan adherence validator API
        const mockAgentResponse = {
          content: intent.originalRequest,
          code: '', // Would be gathered from implementation evidence
          deliverables: []
        };
        const mockTask = {
          objectives: intent.parsedRequirements.map(req => req.description),
          technicalRequirements: intent.parsedRequirements
            .filter(req => req.type === 'technical')
            .map(req => req.description),
          expectedDeliverables: intent.parsedRequirements
            .map(req => req.expected_outcome)
        };
        planAdherenceResult = await this.planValidator.validateAdherence(mockAgentResponse, mockTask);
      } catch (error) {
        console.warn('Plan adherence validation failed:', error);
      }

      // Calculate integration score
      const userScore = this.calculateUserRequirementScore(userRequirementValidation);
      const planScore = planAdherenceResult?.score || 0;
      const integrationScore = Math.round((userScore * 0.7) + (planScore * 0.3));

      // Generate recommendations
      const recommendations = this.generateIntegrationRecommendations(
        userRequirementValidation,
        planAdherenceResult,
        integrationScore
      );

      const result = {
        userRequirementValidation,
        planAdherenceResult,
        integrationScore,
        recommendations
      };

      console.log(`✅ Integrated validation completed with score: ${integrationScore}%`);
      this.emit('intent-validated', { intentId, result });

      return result;
    } catch (error) {
      console.error(`❌ Integrated validation failed for intent ${intentId}:`, error);
      throw error;
    }
  }

  /**
   * Verify deployment with user requirement checking
   */
  async verifyDeployment(
    intentId: string,
    deploymentData: any
  ): Promise<DeploymentVerificationResult> {
    if (!this.config.enableDeploymentVerification) {
      throw new Error('Deployment verification is disabled');
    }

    try {
      console.log(`🚀 Running integrated deployment verification for intent: ${intentId}`);

      // Convert deployment data to DeploymentEvidence format
      const deploymentEvidence = this.convertToDeploymentEvidence(deploymentData);

      // Run deployment verification
      const result = await this.userRequirementVerifier.verifyDeployment(
        intentId,
        deploymentEvidence
      );

      // Check if deployment meets requirements
      if (result.adherence_score < this.config.validationThreshold) {
        console.warn(`⚠️ Deployment does not meet user requirements (score: ${result.adherence_score}%)`);
        this.emit('deployment-failed', { intentId, result });
      } else {
        console.log(`✅ Deployment verified successfully (score: ${result.adherence_score}%)`);
        this.emit('deployment-verified', { intentId, result });
      }

      return result;
    } catch (error) {
      console.error(`❌ Deployment verification failed for intent ${intentId}:`, error);
      throw error;
    }
  }

  /**
   * Get comprehensive integration report
   */
  async getIntegrationReport(): Promise<IntegrationReport> {
    try {
      // Get overall report from user requirement verifier
      const overallReport = await this.userRequirementVerifier.getAdherenceReport();
      
      // Calculate system status
      const systemStatus = this.calculateSystemStatus(overallReport);
      
      // Generate recommendations
      const recommendations = this.generateSystemRecommendations(overallReport);

      const report: IntegrationReport = {
        systemStatus,
        overallAdherenceScore: overallReport.summary.overall_adherence_score,
        activeIntents: overallReport.summary.total_intents,
        recentValidations: overallReport.summary.total_validations,
        criticalGaps: this.countCriticalGaps(overallReport),
        recommendations,
        lastUpdate: new Date().toISOString()
      };

      this.emit('report-generated', report);
      return report;
    } catch (error) {
      console.error('❌ Failed to generate integration report:', error);
      throw error;
    }
  }

  /**
   * Stop the integration system
   */
  async stop(): Promise<void> {
    try {
      console.log('🛑 Stopping User Requirement Integration System...');
      
      // Stop continuous verification
      await this.continuousVerifier.stop();
      
      this.isActive = false;
      console.log('✅ User Requirement Integration System stopped');
      this.emit('integration-stopped');
    } catch (error) {
      console.error('❌ Failed to stop integration system:', error);
      throw error;
    }
  }

  // === Private Methods ===

  private setupIntegration(): void {
    // Listen to user requirement verifier events
    this.userRequirementVerifier.on('intent-captured', (intent) => {
      this.currentIntents.set(intent.id, intent);
    });

    this.userRequirementVerifier.on('outcome-validated', ({ intentId, validations, overallScore }) => {
      console.log(`📊 Intent ${intentId} validated with score: ${overallScore}%`);
      
      // Check if score meets threshold
      if (overallScore < this.config.validationThreshold) {
        this.emit('validation-warning', { intentId, score: overallScore });
      }
      
      // Check for critical gaps
      const criticalGaps = validations.flatMap(v => v.gaps).filter(g => g.severity === 'critical');
      if (criticalGaps.length >= this.config.criticalGapThreshold) {
        this.emit('critical-gaps-detected', { intentId, gaps: criticalGaps });
      }
    });

    this.userRequirementVerifier.on('realtime-validation', ({ intentId, adherenceScore, feedback, shouldContinue }) => {
      if (!shouldContinue) {
        console.warn(`🚨 Real-time validation suggests stopping implementation for intent: ${intentId}`);
        this.emit('implementation-concern', { intentId, adherenceScore, feedback });
      }
    });

    // Listen to continuous verification events
    this.continuousVerifier.on('verification-complete', ({ task, alerts }) => {
      console.log(`🔄 Continuous verification completed for task: ${task.task}`);
      this.handleContinuousVerificationResults(task, alerts);
    });
  }

  private async enrichContextFromSystem(context: any): Promise<any> {
    // Get current system state
    const currentTask = await this.getCurrentTaskInfo();
    const verificationStatus = this.continuousVerifier.getStatus();
    
    return {
      ...context,
      technicalContext: {
        current_task: currentTask,
        verification_active: verificationStatus.running,
        last_verification: verificationStatus.lastActivity,
        ...context.technicalContext
      }
    };
  }

  private setupRealTimeValidationForIntent(intentId: string): void {
    // This would set up monitoring for code changes related to the intent
    console.log(`⚡ Setting up real-time validation for intent: ${intentId}`);
    
    // In a real implementation, this would:
    // 1. Monitor file system changes
    // 2. Hook into git commits
    // 3. Watch for deployment events
    // 4. Trigger validation checks automatically
  }

  private calculateUserRequirementScore(validations: OutcomeValidation[]): number {
    if (validations.length === 0) return 0;
    
    const totalScore = validations.reduce((sum, v) => sum + v.adherence_score, 0);
    return Math.round(totalScore / validations.length);
  }

  private generateIntegrationRecommendations(
    userValidations: OutcomeValidation[],
    planAdherence: any,
    integrationScore: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (integrationScore < 60) {
      recommendations.push('🚨 Integration score is low - review implementation against user requirements');
    }
    
    if (integrationScore < 80) {
      recommendations.push('⚠️ Consider reviewing user requirements and implementation alignment');
    }
    
    // Add specific recommendations based on validation results
    const criticalGaps = userValidations.flatMap(v => v.gaps).filter(g => g.severity === 'critical');
    if (criticalGaps.length > 0) {
      recommendations.push(`🔴 Address ${criticalGaps.length} critical gaps immediately`);
    }
    
    const missingImplementations = userValidations.filter(v => 
      v.gaps.some(g => g.gap_type === 'missing_implementation')
    );
    if (missingImplementations.length > 0) {
      recommendations.push(`📝 Complete implementation for ${missingImplementations.length} requirements`);
    }
    
    return recommendations;
  }

  private convertToDeploymentEvidence(deploymentData: any): any {
    // Convert whatever deployment data format we receive to DeploymentEvidence
    return {
      deployment_id: deploymentData.id || `deploy-${Date.now()}`,
      environment: deploymentData.environment || 'production',
      status: deploymentData.success ? 'success' : 'failed',
      deployment_time: deploymentData.timestamp || new Date().toISOString(),
      verification_url: deploymentData.url,
      health_checks: deploymentData.healthChecks || []
    };
  }

  private calculateSystemStatus(overallReport: any): IntegrationReport['systemStatus'] {
    const score = overallReport.summary.overall_adherence_score;
    const failedIntents = overallReport.summary.failed_intents;
    
    if (score < 50 || failedIntents > 2) {
      return 'critical';
    }
    
    if (score < 80 || failedIntents > 0) {
      return 'warning';
    }
    
    return 'healthy';
  }

  private generateSystemRecommendations(overallReport: any): string[] {
    const recommendations: string[] = [];
    
    if (overallReport.summary.failed_intents > 0) {
      recommendations.push(`Review ${overallReport.summary.failed_intents} failed intent(s)`);
    }
    
    if (overallReport.summary.overall_adherence_score < 80) {
      recommendations.push('Improve overall adherence to user requirements');
    }
    
    recommendations.push('Regularly review and update user requirement tracking');
    
    return recommendations;
  }

  private countCriticalGaps(overallReport: any): number {
    // This would count critical gaps from the report
    // Implementation depends on the actual report structure
    return 0;
  }

  private async getCurrentTaskInfo(): Promise<any> {
    try {
      const fs = require('fs');
      const taskData = JSON.parse(fs.readFileSync('.claude/state/current_task.json', 'utf8'));
      return taskData;
    } catch {
      return { task: 'unknown', branch: 'unknown' };
    }
  }

  private handleContinuousVerificationResults(task: any, alerts: any[]): void {
    // Check if any current intents relate to this task
    const relatedIntents = Array.from(this.currentIntents.values()).filter(intent =>
      intent.taskId === task.task || 
      intent.context.technicalContext.current_branch === task.branch
    );
    
    for (const intent of relatedIntents) {
      console.log(`🔄 Task ${task.task} relates to intent ${intent.id} - triggering validation`);
      
      // Trigger validation for related intents
      this.validateIntent(intent.id).catch(error =>
        console.error(`Failed to validate related intent ${intent.id}:`, error)
      );
    }
  }
}

export default UserRequirementIntegration;
