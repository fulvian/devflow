// unified-verification-orchestrator.ts

import { RealityCheckEngine } from './RealityCheckEngine';
import { AspectVerifiersSystem } from './AspectVerifiersSystem';
import { QualityGatesSystem } from './QualityGatesSystem';
import { SecurityAnalysisEngine } from './SecurityAnalysisEngine';
import { AutoCorrectionEngine } from './AutoCorrectionEngine';
import { VerificationReport, VerificationLevel, VerificationResult, VerificationMetrics } from './types';

/**
 * Unified Verification Orchestrator
 * 
 * Master orchestrator that integrates all verification systems to provide
 * comprehensive AI code verification aligned with best practices.
 */
export class UnifiedVerificationOrchestrator {
  private realityCheckEngine: RealityCheckEngine;
  private aspectVerifiersSystem: AspectVerifiersSystem;
  private qualityGatesSystem: QualityGatesSystem;
  private securityAnalysisEngine: SecurityAnalysisEngine;
  private autoCorrectionEngine: AutoCorrectionEngine;
  
  private verificationMetrics: VerificationMetrics;
  private verificationHistory: VerificationResult[];
  
  constructor() {
    // Initialize all verification systems
    this.realityCheckEngine = new RealityCheckEngine();
    this.aspectVerifiersSystem = new AspectVerifiersSystem();
    this.qualityGatesSystem = new QualityGatesSystem();
    this.securityAnalysisEngine = new SecurityAnalysisEngine();
    this.autoCorrectionEngine = new AutoCorrectionEngine();
    
    // Initialize metrics tracking
    this.verificationMetrics = {
      totalVerifications: 0,
      passedVerifications: 0,
      failedVerifications: 0,
      autoCorrections: 0,
      securityIssuesDetected: 0,
      performance: {
        averageVerificationTime: 0,
        lastVerificationTime: 0
      }
    };
    
    this.verificationHistory = [];
  }

  /**
   * Execute comprehensive verification workflow
   * 
   * @param code - The code to verify
   * @param level - Verification level (BASIC, STANDARD, COMPREHENSIVE)
   * @returns Verification report with results and metrics
   */
  async executeVerification(code: string, level: VerificationLevel = VerificationLevel.STANDARD): Promise<VerificationReport> {
    const startTime = Date.now();
    let verificationResult: VerificationResult = {
      id: this.generateVerificationId(),
      timestamp: new Date(),
      level,
      status: 'PENDING',
      findings: [],
      corrections: [],
      metrics: { ...this.verificationMetrics }
    };

    try {
      // Step 1: Reality Check - Validate code against requirements
      const realityCheckResult = await this.realityCheckEngine.validate(code, level);
      verificationResult.findings.push(...realityCheckResult.findings);
      
      if (!realityCheckResult.passed) {
        verificationResult.status = 'FAILED';
        return this.finalizeVerification(verificationResult, startTime);
      }

      // Step 2: Quality Gate - Initial quality checkpoint
      const qualityGatePassed = await this.qualityGatesSystem.evaluateCheckpoint(
        'INITIAL', 
        verificationResult
      );
      
      if (!qualityGatePassed) {
        verificationResult.status = 'FAILED';
        return this.finalizeVerification(verificationResult, startTime);
      }

      // Step 3: Security Analysis - SAST security scanning
      const securityAnalysis = await this.securityAnalysisEngine.analyze(code, level);
      verificationResult.findings.push(...securityAnalysis.findings);
      
      if (securityAnalysis.issuesFound) {
        this.verificationMetrics.securityIssuesDetected += securityAnalysis.findings.length;
      }

      // Step 4: Quality Gate - Security checkpoint
      const securityGatePassed = await this.qualityGatesSystem.evaluateCheckpoint(
        'SECURITY', 
        verificationResult
      );
      
      if (!securityGatePassed) {
        verificationResult.status = 'FAILED';
        return this.finalizeVerification(verificationResult, startTime);
      }

      // Step 5: Aspect Verification - Multi-Agent Verification (MAV) process
      const aspectVerification = await this.aspectVerifiersSystem.verifyAspects(code, level);
      verificationResult.findings.push(...aspectVerification.findings);
      
      // Step 6: Quality Gate - Aspect verification checkpoint
      const aspectGatePassed = await this.qualityGatesSystem.evaluateCheckpoint(
        'ASPECTS', 
        verificationResult
      );
      
      if (!aspectGatePassed) {
        verificationResult.status = 'FAILED';
        return this.finalizeVerification(verificationResult, startTime);
      }

      // Step 7: Auto-correction for detected issues
      if (verificationResult.findings.length > 0) {
        const corrections = await this.autoCorrectionEngine.applyCorrections(
          code, 
          verificationResult.findings
        );
        
        verificationResult.corrections = corrections;
        this.verificationMetrics.autoCorrections += corrections.length;
        
        // Re-verify corrected code if significant corrections were made
        if (corrections.length > 0) {
          const reVerification = await this.executeVerification(code, level);
          verificationResult = {
            ...verificationResult,
            ...reVerification.result
          };
        }
      }

      // Step 8: Final Quality Gate
      const finalGatePassed = await this.qualityGatesSystem.evaluateCheckpoint(
        'FINAL', 
        verificationResult
      );
      
      verificationResult.status = finalGatePassed ? 'PASSED' : 'FAILED';
      
      return this.finalizeVerification(verificationResult, startTime);
      
    } catch (error) {
      verificationResult.status = 'ERROR';
      verificationResult.findings.push({
        id: 'VERIFICATION_ERROR',
        type: 'SYSTEM_ERROR',
        severity: 'CRITICAL',
        message: `Verification process failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: 'ORCHESTRATOR'
      });
      
      return this.finalizeVerification(verificationResult, startTime);
    }
  }

  /**
   * Rollback to a previous verification state
   * 
   * @param verificationId - ID of the verification to rollback to
   * @returns Success status of rollback operation
   */
  async rollbackToVerification(verificationId: string): Promise<boolean> {
    const targetVerification = this.verificationHistory.find(v => v.id === verificationId);
    
    if (!targetVerification) {
      throw new Error(`Verification with ID ${verificationId} not found in history`);
    }
    
    try {
      // Apply rollback logic based on the verification state
      // This would typically involve reverting code changes or configuration
      await this.autoCorrectionEngine.rollbackChanges(targetVerification.corrections);
      return true;
    } catch (error) {
      console.error(`Rollback failed for verification ${verificationId}:`, error);
      return false;
    }
  }

  /**
   * Get current verification metrics
   * 
   * @returns Current verification metrics
   */
  getMetrics(): VerificationMetrics {
    return { ...this.verificationMetrics };
  }

  /**
   * Get verification history
   * 
   * @param limit - Number of recent verifications to return (default: 10)
   * @returns Array of recent verification results
   */
  getVerificationHistory(limit: number = 10): VerificationResult[] {
    return this.verificationHistory.slice(-limit);
  }

  /**
   * Reset verification metrics
   */
  resetMetrics(): void {
    this.verificationMetrics = {
      totalVerifications: 0,
      passedVerifications: 0,
      failedVerifications: 0,
      autoCorrections: 0,
      securityIssuesDetected: 0,
      performance: {
        averageVerificationTime: 0,
        lastVerificationTime: 0
      }
    };
  }

  /**
   * Finalize verification process and update metrics
   * 
   * @param result - Verification result to finalize
   * @param startTime - Start time of verification process
   * @returns Finalized verification report
   */
  private finalizeVerification(result: VerificationResult, startTime: number): VerificationReport {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Update metrics
    this.verificationMetrics.totalVerifications++;
    if (result.status === 'PASSED') {
      this.verificationMetrics.passedVerifications++;
    } else {
      this.verificationMetrics.failedVerifications++;
    }
    
    this.verificationMetrics.performance.lastVerificationTime = duration;
    this.verificationMetrics.performance.averageVerificationTime = 
      (this.verificationMetrics.performance.averageVerificationTime * (this.verificationMetrics.totalVerifications - 1) + duration) 
      / this.verificationMetrics.totalVerifications;
    
    // Store in history
    this.verificationHistory.push(result);
    
    // Keep only last 100 verifications in memory
    if (this.verificationHistory.length > 100) {
      this.verificationHistory.shift();
    }
    
    return {
      result,
      metrics: { ...this.verificationMetrics },
      timestamp: new Date()
    };
  }

  /**
   * Generate unique verification ID
   * 
   * @returns Unique verification identifier
   */
  private generateVerificationId(): string {
    return `VER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export types for external use
export * from './types';