// aspect-verifiers.ts
import { RealityCheckEngine } from './RealityCheckEngine';

/**
 * Represents the result of an aspect verification
 */
export interface AspectVerificationResult {
  /** Unique identifier for the aspect */
  aspectId: string;
  /** Human-readable name of the aspect */
  aspectName: string;
  /** Binary approval result */
  approved: boolean;
  /** Detailed evidence supporting the decision */
  evidence: string;
  /** Confidence level in the decision (0-1) */
  confidence: number;
  /** Timestamp of verification */
  timestamp: Date;
}

/**
 * Abstract base class for all aspect verifiers
 */
export abstract class AspectVerifier {
  protected realityCheckEngine: RealityCheckEngine;

  constructor(realityCheckEngine: RealityCheckEngine) {
    this.realityCheckEngine = realityCheckEngine;
  }

  /**
   * Unique identifier for this aspect verifier
   */
  abstract getAspectId(): string;

  /**
   * Human-readable name for this aspect
   */
  abstract getAspectName(): string;

  /**
   * Verify the code against this aspect's criteria
   * @param code The code to verify
   * @param context Additional context for verification
   * @returns Verification result with binary approval and evidence
   */
  abstract verify(code: string, context?: Record<string, any>): Promise<AspectVerificationResult>;

  /**
   * Helper method to format prompts for LLM-based verification
   */
  protected createVerificationPrompt(code: string, criteria: string, context?: Record<string, any>): string {
    const contextStr = context ? `\nContext: ${JSON.stringify(context)}` : '';
    return `
      Analyze the following code for ${this.getAspectName()} compliance.
      
      Code:
      ${code}
      
      Evaluation Criteria:
      ${criteria}
      ${contextStr}
      
      Provide your analysis and a binary approval decision (pass/fail).
      Format your response as JSON with the following structure:
      {
        "approved": boolean,
        "evidence": "detailed explanation of your analysis",
        "confidence": number between 0 and 1
      }
    `;
  }

  /**
   * Helper method to parse LLM response into verification result
   */
  protected parseLLMResponse(response: string): Omit<AspectVerificationResult, 'aspectId' | 'aspectName' | 'timestamp'> {
    try {
      const parsed = JSON.parse(response);
      return {
        approved: Boolean(parsed.approved),
        evidence: String(parsed.evidence || 'No evidence provided'),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0.5)))
      };
    } catch (error) {
      return {
        approved: false,
        evidence: `Failed to parse LLM response: ${response}`,
        confidence: 0
      };
    }
  }
}

/**
 * Security aspect verifier
 */
export class SecurityVerifier extends AspectVerifier {
  getAspectId(): string {
    return 'security';
  }

  getAspectName(): string {
    return 'Security';
  }

  async verify(code: string, context?: Record<string, any>): Promise<AspectVerificationResult> {
    const securityCriteria = `
      1. No hardcoded credentials or sensitive information
      2. Proper input validation and sanitization
      3. No known vulnerable patterns or libraries
      4. Appropriate authentication and authorization checks
      5. Secure handling of sensitive data
      6. Protection against common attacks (XSS, SQLi, CSRF, etc.)
    `;

    const prompt = this.createVerificationPrompt(code, securityCriteria, context);
    const llmResponse = await this.realityCheckEngine.queryLLM(prompt);
    const result = this.parseLLMResponse(llmResponse);

    return {
      aspectId: this.getAspectId(),
      aspectName: this.getAspectName(),
      ...result,
      timestamp: new Date()
    };
  }
}

/**
 * Correctness aspect verifier
 */
export class CorrectnessVerifier extends AspectVerifier {
  getAspectId(): string {
    return 'correctness';
  }

  getAspectName(): string {
    return 'Correctness';
  }

  async verify(code: string, context?: Record<string, any>): Promise<AspectVerificationResult> {
    const correctnessCriteria = `
      1. Code follows specified requirements and logic
      2. Proper error handling and edge case management
      3. Correct use of APIs and libraries
      4. No logical flaws or contradictions
      5. Appropriate data structures and algorithms
      6. Handles all specified input cases correctly
    `;

    const prompt = this.createVerificationPrompt(code, correctnessCriteria, context);
    const llmResponse = await this.realityCheckEngine.queryLLM(prompt);
    const result = this.parseLLMResponse(llmResponse);

    return {
      aspectId: this.getAspectId(),
      aspectName: this.getAspectName(),
      ...result,
      timestamp: new Date()
    };
  }
}

/**
 * Performance aspect verifier
 */
export class PerformanceVerifier extends AspectVerifier {
  getAspectId(): string {
    return 'performance';
  }

  getAspectName(): string {
    return 'Performance';
  }

  async verify(code: string, context?: Record<string, any>): Promise<AspectVerificationResult> {
    const performanceCriteria = `
      1. Efficient algorithms and data structures
      2. Proper resource management (memory, CPU, network)
      3. No obvious bottlenecks or performance anti-patterns
      4. Appropriate caching strategies
      5. Scalable design patterns
      6. Reasonable time and space complexity
    `;

    const prompt = this.createVerificationPrompt(code, performanceCriteria, context);
    const llmResponse = await this.realityCheckEngine.queryLLM(prompt);
    const result = this.parseLLMResponse(llmResponse);

    return {
      aspectId: this.getAspectId(),
      aspectName: this.getAspectName(),
      ...result,
      timestamp: new Date()
    };
  }
}

/**
 * Maintainability aspect verifier
 */
export class MaintainabilityVerifier extends AspectVerifier {
  getAspectId(): string {
    return 'maintainability';
  }

  getAspectName(): string {
    return 'Maintainability';
  }

  async verify(code: string, context?: Record<string, any>): Promise<AspectVerificationResult> {
    const maintainabilityCriteria = `
      1. Clear, readable, and well-structured code
      2. Appropriate comments and documentation
      3. Consistent naming conventions
      4. Proper modularization and separation of concerns
      5. Minimal code duplication
      6. Follows established coding standards and best practices
    `;

    const prompt = this.createVerificationPrompt(code, maintainabilityCriteria, context);
    const llmResponse = await this.realityCheckEngine.queryLLM(prompt);
    const result = this.parseLLMResponse(llmResponse);

    return {
      aspectId: this.getAspectId(),
      aspectName: this.getAspectName(),
      ...result,
      timestamp: new Date()
    };
  }
}

/**
 * Factory for creating aspect verifiers
 */
export class AspectVerifierFactory {
  private static verifiers: Record<string, typeof AspectVerifier> = {
    security: SecurityVerifier,
    correctness: CorrectnessVerifier,
    performance: PerformanceVerifier,
    maintainability: MaintainabilityVerifier
  };

  /**
   * Register a new aspect verifier type
   * @param aspectId Unique identifier for the aspect
   * @param verifierClass The verifier class to register
   */
  static registerVerifier(aspectId: string, verifierClass: typeof AspectVerifier): void {
    this.verifiers[aspectId] = verifierClass;
  }

  /**
   * Create an instance of an aspect verifier
   * @param aspectId The aspect to verify
   * @param realityCheckEngine The reality check engine to use
   * @returns Instance of the requested verifier
   */
  static createVerifier(aspectId: string, realityCheckEngine: RealityCheckEngine): AspectVerifier {
    const VerifierClass = this.verifiers[aspectId];
    if (!VerifierClass) {
      throw new Error(`No verifier registered for aspect: ${aspectId}`);
    }
    return new VerifierClass(realityCheckEngine);
  }

  /**
   * Get all registered aspect IDs
   */
  static getAvailableAspects(): string[] {
    return Object.keys(this.verifiers);
  }
}

/**
 * Multi-Agent Verification orchestrator
 */
export class MultiAgentVerification {
  private verifiers: AspectVerifier[] = [];

  constructor(private realityCheckEngine: RealityCheckEngine) {}

  /**
   * Add an aspect verifier to the verification process
   * @param aspectId The aspect to verify
   */
  addAspectVerifier(aspectId: string): void {
    const verifier = AspectVerifierFactory.createVerifier(aspectId, this.realityCheckEngine);
    this.verifiers.push(verifier);
  }

  /**
   * Add multiple aspect verifiers
   * @param aspectIds Array of aspects to verify
   */
  addAspectVerifiers(aspectIds: string[]): void {
    aspectIds.forEach(id => this.addAspectVerifier(id));
  }

  /**
   * Run verification against all configured aspects
   * @param code The code to verify
   * @param context Additional context for verification
   * @returns Array of verification results
   */
  async verify(code: string, context?: Record<string, any>): Promise<AspectVerificationResult[]> {
    const verificationPromises = this.verifiers.map(verifier => 
      verifier.verify(code, context).catch(error => ({
        aspectId: verifier.getAspectId(),
        aspectName: verifier.getAspectName(),
        approved: false,
        evidence: `Verification failed: ${error.message}`,
        confidence: 0,
        timestamp: new Date()
      }))
    );

    return Promise.all(verificationPromises);
  }

  /**
   * Get overall approval status based on all verifications
   * @param results Verification results
   * @returns True if all verifications pass, false otherwise
   */
  getOverallApproval(results: AspectVerificationResult[]): boolean {
    return results.every(result => result.approved);
  }

  /**
   * Get a summary report of the verification
   * @param results Verification results
   * @returns Summary object with approval status and details
   */
  getVerificationSummary(results: AspectVerificationResult[]): {
    approved: boolean;
    passed: number;
    total: number;
    details: AspectVerificationResult[];
  } {
    const passed = results.filter(r => r.approved).length;
    return {
      approved: this.getOverallApproval(results),
      passed,
      total: results.length,
      details: results
    };
  }
}

/**
 * Main AspectVerifiersSystem class that orchestrates all aspect verifications
 */
export class AspectVerifiersSystem {
  private verifiers: AspectVerifier[] = [];
  private multiAgentVerification: MultiAgentVerification;

  constructor() {
    const realityCheckEngine = new RealityCheckEngine();

    // Initialize all verifiers
    this.verifiers = [
      new SecurityVerifier(realityCheckEngine),
      new CorrectnessVerifier(realityCheckEngine),
      new PerformanceVerifier(realityCheckEngine),
      new MaintainabilityVerifier(realityCheckEngine)
    ];

    this.multiAgentVerification = new MultiAgentVerification(realityCheckEngine);
  }

  async verifyAspects(code: string, level: any): Promise<{ findings: any[] }> {
    const findings: any[] = [];

    // Run all aspect verifiers
    for (const verifier of this.verifiers) {
      try {
        const result = await verifier.verify(code, {});
        if (!result.approved) {
          findings.push({
            id: result.aspectId,
            type: 'ASPECT_VERIFICATION',
            severity: 'MEDIUM',
            message: result.evidence,
            location: 'CODE'
          });
        }
      } catch (error) {
        findings.push({
          id: 'ASPECT_ERROR',
          type: 'SYSTEM_ERROR',
          severity: 'HIGH',
          message: `Aspect verification failed: ${error}`,
          location: 'SYSTEM'
        });
      }
    }

    return { findings };
  }
}