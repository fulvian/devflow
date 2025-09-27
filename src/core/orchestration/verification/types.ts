/**
 * Core Types for Rigorous Verification System
 */

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  errorMessage?: string;
  executionTime: number;
  evidence: Record<string, any>;
}

export interface TestSuite {
  getName(): string;
  runTests(): Promise<TestResult[]>;
}

export interface Claim {
  id: string;
  text: string;
  category: string;
  tags: string[];
  timestamp: Date;
  context?: string;
}

export interface VerificationReport {
  claimId: string;
  claimText: string;
  verified: boolean;
  confidence: number;
  supportingEvidence: TestResult[];
  contradictingEvidence: TestResult[];
  timestamp: Date;
}

export interface Requirement {
  id: string;
  text: string;
  functionality?: string;
  tags?: string[];
  testIds?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: 'user_request' | 'system_requirement' | 'technical_constraint';
}

export interface RequirementValidationResult {
  requirementId: string;
  requirementText: string;
  implemented: boolean;
  functioningCorrectly: boolean;
  relevantTests: Array<{
    testName: string;
    status: 'passed' | 'failed' | 'skipped';
    executionTime: number;
  }>;
  validationNotes: string;
}

export interface TestExecutionSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  executionTime: number;
  timestamp: Date;
}

export interface VerificationContext {
  sessionId: string;
  userRequest: string;
  claudeResponse: string;
  implementedFiles: string[];
  timestamp: Date;
}

// Verification Types for UnifiedVerificationOrchestrator

/**
 * Enum representing the level of verification to be performed
 */
export enum VerificationLevel {
  BASIC = 'BASIC',
  STANDARD = 'STANDARD',
  COMPREHENSIVE = 'COMPREHENSIVE'
}

/**
 * Interface representing a finding from verification processes
 */
export interface Finding {
  /**
   * Unique identifier for the finding
   */
  id: string;

  /**
   * Type of finding (e.g., security, quality, performance)
   */
  type: string;

  /**
   * Severity level of the finding
   */
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  /**
   * Description of the finding
   */
  message: string;

  /**
   * File path or location where the finding was detected
   */
  location?: string;

  /**
   * Line number where the finding was detected
   */
  line?: number;

  /**
   * Additional metadata about the finding
   */
  metadata?: Record<string, unknown>;
}

/**
 * Interface representing an auto-correction applied during verification
 */
export interface Correction {
  /**
   * Unique identifier for the correction
   */
  id: string;

  /**
   * Reference to the finding that triggered this correction
   */
  findingId: string;

  /**
   * Description of the correction applied
   */
  description: string;

  /**
   * The original value before correction
   */
  originalValue?: string;

  /**
   * The corrected value
   */
  correctedValue?: string;

  /**
   * File path where the correction was applied
   */
  filePath?: string;

  /**
   * Timestamp when the correction was applied
   */
  appliedAt: Date;
}

/**
 * Interface representing metrics from verification processes
 */
export interface VerificationMetrics {
  /**
   * Total number of verifications performed
   */
  totalVerifications: number;

  /**
   * Number of verifications that passed
   */
  passedVerifications: number;

  /**
   * Number of verifications that failed
   */
  failedVerifications: number;

  /**
   * Number of auto-corrections applied
   */
  autoCorrections: number;

  /**
   * Number of security issues detected
   */
  securityIssuesDetected: number;

  /**
   * Performance metrics
   */
  performance: {
    averageVerificationTime: number;
    lastVerificationTime: number;
  };
}

/**
 * Interface representing the result of a verification process
 */
export interface VerificationResult {
  /**
   * Unique identifier for the verification result
   */
  id: string;

  /**
   * Timestamp when the verification was completed
   */
  timestamp: Date;

  /**
   * Level of verification performed
   */
  level: VerificationLevel;

  /**
   * Overall status of the verification
   */
  status: 'PASSED' | 'FAILED' | 'PENDING' | 'ERROR';

  /**
   * Findings discovered during verification
   */
  findings: Finding[];

  /**
   * Corrections automatically applied
   */
  corrections: Correction[];

  /**
   * Metrics collected during verification
   */
  metrics: VerificationMetrics;
}

/**
 * Interface representing a verification report
 */
export interface VerificationReport {
  /**
   * The verification result
   */
  result: VerificationResult;

  /**
   * Aggregated metrics from the verification
   */
  metrics: VerificationMetrics;

  /**
   * Timestamp when the report was generated
   */
  timestamp: Date;
}