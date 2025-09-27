// main-verification-orchestrator.ts

import { RealityCheckEngine } from './reality-check-engine';
import { ClaimVerificationSystem } from './claim-verification-system';
import { UserRequirementAdherenceValidator } from './user-requirement-adherence-validator';
import { VerificationReport, VerificationResult, ClaimVerificationResult, RequirementAdherenceResult } from './verification-types';

/**
 * Main verification orchestrator that executes comprehensive end-to-end testing
 * of DevFlow functionality by integrating multiple verification systems.
 */
export class MainVerificationOrchestrator {
  private realityCheckEngine: RealityCheckEngine;
  private claimVerificationSystem: ClaimVerificationSystem;
  private userRequirementValidator: UserRequirementAdherenceValidator;

  constructor() {
    this.realityCheckEngine = new RealityCheckEngine();
    this.claimVerificationSystem = new ClaimVerificationSystem();
    this.userRequirementValidator = new UserRequirementAdherenceValidator();
  }

  /**
   * Executes the complete verification workflow for DevFlow functionality
   * @param claims - Array of claims made by Claude about system functionality
   * @param userRequirements - User requirements that must be validated
   * @returns Comprehensive verification report
   */
  async executeVerificationWorkflow(
    claims: string[],
    userRequirements: string[]
  ): Promise<VerificationReport> {
    try {
      // Initialize verification report
      const report: VerificationReport = {
        timestamp: new Date().toISOString(),
        overallStatus: 'pending',
        claimVerificationResults: [],
        requirementAdherenceResults: [],
        realityCheckResults: [],
        summary: {
          totalClaims: claims.length,
          verifiedClaims: 0,
          failedClaims: 0,
          totalRequirements: userRequirements.length,
          metRequirements: 0,
          failedRequirements: 0,
          alerts: []
        }
      };

      // Execute reality checks first to establish baseline
      const realityResults = await this.realityCheckEngine.performRealityChecks();
      report.realityCheckResults = realityResults;
      
      // Check for critical system failures
      const criticalFailures = realityResults.filter(result => 
        result.status === 'failed' && result.severity === 'critical'
      );
      
      if (criticalFailures.length > 0) {
        report.overallStatus = 'failed';
        report.summary.alerts.push({
          type: 'critical_system_failure',
          message: 'Critical system components are failing reality checks',
          details: criticalFailures.map(f => f.description)
        });
        return this.finalizeReport(report);
      }

      // Verify Claude's claims against test evidence
      const claimResults = await this.verifyClaudeClaims(claims);
      report.claimVerificationResults = claimResults;
      
      // Validate user requirement adherence
      const requirementResults = await this.validateUserRequirements(userRequirements);
      report.requirementAdherenceResults = requirementResults;

      // Aggregate results and determine overall status
      return this.finalizeReport(report);

    } catch (error) {
      return this.handleVerificationError(error);
    }
  }

  /**
   * Verifies Claude's claims against actual test evidence
   * @param claims - Array of claims to verify
   * @returns Array of claim verification results
   */
  private async verifyClaudeClaims(claims: string[]): Promise<ClaimVerificationResult[]> {
    const results: ClaimVerificationResult[] = [];
    
    for (const claim of claims) {
      try {
        const verificationResult = await this.claimVerificationSystem.verifyClaim(claim);
        results.push(verificationResult);
      } catch (error) {
        results.push({
          claim,
          status: 'error',
          evidence: [],
          confidence: 0,
          errorMessage: error instanceof Error ? error.message : 'Unknown error during claim verification'
        });
      }
    }
    
    return results;
  }

  /**
   * Validates that user requirements are being met by the system
   * @param requirements - Array of user requirements to validate
   * @returns Array of requirement adherence results
   */
  private async validateUserRequirements(requirements: string[]): Promise<RequirementAdherenceResult[]> {
    const results: RequirementAdherenceResult[] = [];
    
    for (const requirement of requirements) {
      try {
        const validation = await this.userRequirementValidator.validateRequirement(requirement);
        results.push(validation);
      } catch (error) {
        results.push({
          requirement,
          status: 'error',
          testResults: [],
          errorMessage: error instanceof Error ? error.message : 'Unknown error during requirement validation'
        });
      }
    }
    
    return results;
  }

  /**
   * Finalizes the verification report by aggregating results and determining overall status
   * @param report - Partial verification report to finalize
   * @returns Complete verification report
   */
  private finalizeReport(report: VerificationReport): VerificationReport {
    // Count verified claims
    const verifiedClaims = report.claimVerificationResults.filter(r => r.status === 'verified').length;
    const failedClaims = report.claimVerificationResults.filter(r => r.status === 'failed').length;
    
    // Count met requirements
    const metRequirements = report.requirementAdherenceResults.filter(r => r.status === 'met').length;
    const failedRequirements = report.requirementAdherenceResults.filter(r => r.status === 'failed').length;
    
    // Update summary
    report.summary.verifiedClaims = verifiedClaims;
    report.summary.failedClaims = failedClaims;
    report.summary.metRequirements = metRequirements;
    report.summary.failedRequirements = failedRequirements;
    
    // Determine overall status
    if (failedClaims > 0 || failedRequirements > 0) {
      report.overallStatus = 'failed';
      
      // Add alerts for failed items
      if (failedClaims > 0) {
        report.summary.alerts.push({
          type: 'claim_verification_failure',
          message: `${failedClaims} claims failed verification`,
          details: report.claimVerificationResults
            .filter(r => r.status === 'failed')
            .map(r => r.claim)
        });
      }
      
      if (failedRequirements > 0) {
        report.summary.alerts.push({
          type: 'requirement_adherence_failure',
          message: `${failedRequirements} requirements not met`,
          details: report.requirementAdherenceResults
            .filter(r => r.status === 'failed')
            .map(r => r.requirement)
        });
      }
    } else {
      report.overallStatus = 'passed';
    }
    
    return report;
  }

  /**
   * Handles errors that occur during the verification process
   * @param error - The error that occurred
   * @returns Error verification report
   */
  private handleVerificationError(error: unknown): VerificationReport {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in verification orchestrator';
    
    return {
      timestamp: new Date().toISOString(),
      overallStatus: 'error',
      claimVerificationResults: [],
      requirementAdherenceResults: [],
      realityCheckResults: [],
      summary: {
        totalClaims: 0,
        verifiedClaims: 0,
        failedClaims: 0,
        totalRequirements: 0,
        metRequirements: 0,
        failedRequirements: 0,
        alerts: [{
          type: 'verification_system_error',
          message: 'Verification orchestrator encountered an error',
          details: [errorMessage]
        }]
      }
    };
  }
}

// Export types for external use
export type { VerificationReport, VerificationResult, ClaimVerificationResult, RequirementAdherenceResult };