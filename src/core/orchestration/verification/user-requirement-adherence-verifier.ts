import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PlanAdherenceValidator } from '../plan-adherence-validator';
import { ContinuousVerificationLoop, Task, Alert } from './continuous-verification-loop';

/**
 * User Requirement Adherence Verification System - DEVFLOW-VERIFY-META-001
 * 
 * Provides comprehensive meta-verification to ensure AI implementations 
 * actually match what users requested, not just technically correct code.
 * 
 * Features:
 * - Intent tracking from conversation history
 * - Outcome validation against original requirements
 * - Deployment verification
 * - Real-time validation during implementation
 * - Integration with existing verification systems
 */

// Core Interfaces
export interface UserIntent {
  id: string;
  originalRequest: string;
  parsedRequirements: ParsedRequirement[];
  context: ConversationContext;
  taskId: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata: {
    requestType: 'feature' | 'bugfix' | 'deployment' | 'refactor' | 'analysis';
    complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
    estimatedSteps: number;
    actualSteps: number;
    dependencies: string[];
  };
}

export interface ParsedRequirement {
  id: string;
  type: 'functional' | 'technical' | 'deployment' | 'performance' | 'security';
  description: string;
  mustHave: boolean;
  verifiable: boolean;
  acceptance_criteria: string[];
  keywords: string[];
  expected_outcome: string;
  validation_method: 'code_analysis' | 'behavior_test' | 'deployment_check' | 'user_confirmation';
}

export interface ConversationContext {
  sessionId: string;
  messageHistory: ConversationMessage[];
  userContext: {
    expertise_level: 'beginner' | 'intermediate' | 'expert';
    previous_requests: string[];
    current_project_context: string;
  };
  technicalContext: {
    codebase_state: string;
    current_branch: string;
    recent_changes: string[];
    deployment_environment: string;
  };
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  contains_requirements: boolean;
  extracted_intents: string[];
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  name: string;
  args: any;
  result?: any;
  timestamp: string;
}

export interface OutcomeValidation {
  intentId: string;
  validationId: string;
  requirement: ParsedRequirement;
  actual_implementation: ImplementationEvidence;
  adherence_score: number; // 0-100
  validation_status: 'passed' | 'failed' | 'partial' | 'pending';
  gaps: AdherenceGap[];
  recommendations: string[];
  timestamp: string;
}

export interface ImplementationEvidence {
  code_changes: CodeChange[];
  file_modifications: FileModification[];
  tests_added: TestEvidence[];
  deployments: DeploymentEvidence[];
  behavior_verification: BehaviorEvidence[];
}

export interface CodeChange {
  file_path: string;
  function_name?: string;
  change_type: 'added' | 'modified' | 'deleted';
  lines_changed: number;
  complexity_score: number;
  purpose: string;
  relates_to_requirement: string;
}

export interface FileModification {
  path: string;
  modification_type: 'created' | 'updated' | 'deleted' | 'moved';
  size_change: number;
  timestamp: string;
  checksum: string;
}

export interface TestEvidence {
  test_file: string;
  test_name: string;
  test_type: 'unit' | 'integration' | 'e2e';
  covers_requirement: string;
  status: 'passed' | 'failed' | 'skipped';
}

export interface DeploymentEvidence {
  deployment_id: string;
  environment: string;
  status: 'success' | 'failed' | 'in_progress';
  deployment_time: string;
  verification_url?: string;
  health_checks: HealthCheck[];
}

export interface HealthCheck {
  check_name: string;
  status: 'passed' | 'failed';
  response_time_ms: number;
  error_message?: string;
}

export interface BehaviorEvidence {
  verification_method: string;
  expected_behavior: string;
  actual_behavior: string;
  matches: boolean;
  confidence_score: number;
  evidence_source: 'automated_test' | 'manual_verification' | 'user_feedback';
}

export interface AdherenceGap {
  requirement_id: string;
  gap_type: 'missing_implementation' | 'incorrect_behavior' | 'incomplete_feature' | 'deployment_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  suggested_fix: string;
  estimated_effort: string;
}

export interface DeploymentVerificationResult {
  deploymentId: string;
  userRequestedSpecs: DeploymentSpec[];
  actualDeployment: DeploymentEvidence;
  adherence_score: number;
  gaps: AdherenceGap[];
  verification_timestamp: string;
}

export interface DeploymentSpec {
  requirement: string;
  environment: string;
  expected_endpoints: string[];
  expected_behavior: string[];
  health_check_requirements: string[];
}

export class UserRequirementAdherenceVerifier extends EventEmitter {
  private readonly STATE_DIR = '.claude/state';
  private readonly INTENT_STORE_PATH = '.claude/state/user_intents.json';
  private readonly VALIDATION_STORE_PATH = '.claude/state/outcome_validations.json';
  private readonly CONVERSATION_STORE_PATH = '.claude/state/conversation_history.json';
  
  private planAdherenceValidator: PlanAdherenceValidator;
  private continuousVerifier: ContinuousVerificationLoop;
  
  private intents: Map<string, UserIntent> = new Map();
  private validations: Map<string, OutcomeValidation> = new Map();
  private conversationHistory: ConversationMessage[] = [];
  
  private isInitialized: boolean = false;
  private validationInProgress: Set<string> = new Set();

  constructor() {
    super();
    this.planAdherenceValidator = new PlanAdherenceValidator();
    this.continuousVerifier = new ContinuousVerificationLoop();
    this.setupEventListeners();
  }

  /**
   * Initialize the verification system
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎯 Initializing User Requirement Adherence Verification System...');
      
      // Ensure directories exist
      await this.ensureDirectoriesExist();
      
      // Load existing data
      await this.loadStoredData();
      
      // Setup integration with continuous verification
      await this.setupContinuousVerificationIntegration();
      
      this.isInitialized = true;
      console.log('✅ User Requirement Adherence Verification System initialized');
      this.emit('system-initialized');
    } catch (error) {
      console.error('❌ Failed to initialize User Requirement Adherence Verification:', error);
      throw error;
    }
  }

  /**
   * Intent Tracking System - Capture and parse user requirements
   */
  async captureUserIntent(
    request: string,
    conversationContext: Partial<ConversationContext> = {}
  ): Promise<UserIntent> {
    const intentId = this.generateIntentId();
    const timestamp = new Date().toISOString();
    
    try {
      console.log(`🎯 Capturing user intent: ${intentId}`);
      
      // Parse requirements from the request
      const parsedRequirements = await this.parseRequirements(request);
      
      // Enrich conversation context
      const fullContext = await this.enrichConversationContext(conversationContext);
      
      // Create intent object
      const intent: UserIntent = {
        id: intentId,
        originalRequest: request,
        parsedRequirements,
        context: fullContext,
        taskId: await this.getCurrentTaskId(),
        timestamp,
        priority: this.assessPriority(request, parsedRequirements),
        status: 'pending',
        metadata: {
          requestType: this.classifyRequestType(request),
          complexity: this.assessComplexity(parsedRequirements),
          estimatedSteps: this.estimateSteps(parsedRequirements),
          actualSteps: 0,
          dependencies: this.extractDependencies(request, parsedRequirements)
        }
      };
      
      // Store intent
      this.intents.set(intentId, intent);
      await this.persistIntents();
      
      console.log(`✅ User intent captured with ${parsedRequirements.length} requirements`);
      this.emit('intent-captured', intent);
      
      return intent;
    } catch (error) {
      console.error(`❌ Failed to capture user intent:`, error);
      throw error;
    }
  }

  /**
   * Update intent status and progress
   */
  async updateIntentProgress(
    intentId: string,
    updates: Partial<Pick<UserIntent, 'status' | 'metadata'>>
  ): Promise<void> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }

    // Update intent
    if (updates.status) {
      intent.status = updates.status;
    }
    
    if (updates.metadata) {
      intent.metadata = { ...intent.metadata, ...updates.metadata };
    }

    this.intents.set(intentId, intent);
    await this.persistIntents();
    
    this.emit('intent-updated', intent);
  }

  /**
   * Outcome Validation Engine - Compare implementation against requirements
   */
  async validateOutcome(intentId: string): Promise<OutcomeValidation[]> {
    if (!this.isInitialized) {
      throw new Error('Verifier not initialized');
    }

    if (this.validationInProgress.has(intentId)) {
      console.log(`⏳ Validation already in progress for intent: ${intentId}`);
      return [];
    }

    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }

    this.validationInProgress.add(intentId);
    const validations: OutcomeValidation[] = [];

    try {
      console.log(`🔍 Validating outcome for intent: ${intentId} (${intent.parsedRequirements.length} requirements)`);

      // Gather implementation evidence
      const evidence = await this.gatherImplementationEvidence(intent);

      // Validate each requirement
      for (const requirement of intent.parsedRequirements) {
        const validation = await this.validateRequirement(intent, requirement, evidence);
        validations.push(validation);
        this.validations.set(validation.validationId, validation);
      }

      // Calculate overall adherence
      const overallScore = this.calculateOverallAdherence(validations);
      
      // Update intent status based on validation results
      const newStatus = overallScore >= 80 ? 'completed' : 
                       overallScore >= 60 ? 'in_progress' : 'failed';
      
      await this.updateIntentProgress(intentId, { status: newStatus });

      // Persist validations
      await this.persistValidations();

      console.log(`✅ Outcome validation completed for intent: ${intentId} (score: ${overallScore}%)`);
      this.emit('outcome-validated', { intentId, validations, overallScore });

      return validations;
    } catch (error) {
      console.error(`❌ Failed to validate outcome for intent ${intentId}:`, error);
      throw error;
    } finally {
      this.validationInProgress.delete(intentId);
    }
  }

  /**
   * Deployment Verification - Ensure deployed functionality matches requests
   */
  async verifyDeployment(
    intentId: string,
    deploymentEvidence: DeploymentEvidence
  ): Promise<DeploymentVerificationResult> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }

    console.log(`🚀 Verifying deployment for intent: ${intentId}`);

    try {
      // Extract deployment requirements from intent
      const deploymentSpecs = this.extractDeploymentSpecs(intent);
      
      // Verify each specification
      const gaps: AdherenceGap[] = [];
      let totalScore = 0;

      for (const spec of deploymentSpecs) {
        const specScore = await this.verifyDeploymentSpec(spec, deploymentEvidence);
        totalScore += specScore.score;
        gaps.push(...specScore.gaps);
      }

      const adherenceScore = deploymentSpecs.length > 0 ? 
        Math.round(totalScore / deploymentSpecs.length) : 100;

      const result: DeploymentVerificationResult = {
        deploymentId: deploymentEvidence.deployment_id,
        userRequestedSpecs: deploymentSpecs,
        actualDeployment: deploymentEvidence,
        adherence_score: adherenceScore,
        gaps,
        verification_timestamp: new Date().toISOString()
      };

      console.log(`✅ Deployment verification completed (score: ${adherenceScore}%)`);
      this.emit('deployment-verified', result);

      return result;
    } catch (error) {
      console.error(`❌ Failed to verify deployment:`, error);
      throw error;
    }
  }

  /**
   * Real-time validation during implementation
   */
  async validateRealTime(
    intentId: string,
    implementationStep: Partial<ImplementationEvidence>
  ): Promise<{ adherenceScore: number; feedback: string[]; shouldContinue: boolean }> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }

    console.log(`⚡ Real-time validation for intent: ${intentId}`);

    try {
      const feedback: string[] = [];
      let adherenceScore = 100;
      let shouldContinue = true;

      // Check code changes against requirements
      if (implementationStep.code_changes) {
        const codeValidation = await this.validateCodeChanges(
          intent.parsedRequirements, 
          implementationStep.code_changes
        );
        adherenceScore *= codeValidation.score / 100;
        feedback.push(...codeValidation.feedback);
      }

      // Check behavior against expected outcomes
      if (implementationStep.behavior_verification) {
        const behaviorValidation = await this.validateBehaviorEvidence(
          intent.parsedRequirements,
          implementationStep.behavior_verification
        );
        adherenceScore *= behaviorValidation.score / 100;
        feedback.push(...behaviorValidation.feedback);
      }

      // Determine if implementation should continue
      shouldContinue = adherenceScore >= 50; // Stop if critically off-track

      if (!shouldContinue) {
        feedback.push('🚨 Implementation appears to be diverging significantly from user requirements. Consider reviewing the original request.');
      }

      this.emit('realtime-validation', { intentId, adherenceScore, feedback, shouldContinue });

      return { adherenceScore: Math.round(adherenceScore), feedback, shouldContinue };
    } catch (error) {
      console.error(`❌ Real-time validation failed:`, error);
      return { adherenceScore: 0, feedback: ['Validation system error'], shouldContinue: false };
    }
  }

  /**
   * Get comprehensive adherence report
   */
  async getAdherenceReport(intentId?: string): Promise<any> {
    if (intentId) {
      return this.getIntentReport(intentId);
    } else {
      return this.getOverallReport();
    }
  }

  // === Private Methods ===

  private setupEventListeners(): void {
    this.on('intent-captured', (intent: UserIntent) => {
      console.log(`📊 Intent captured: ${intent.id} - ${intent.originalRequest.substring(0, 100)}...`);
    });

    this.on('outcome-validated', ({ intentId, validations, overallScore }) => {
      console.log(`📈 Outcome validated: ${intentId} - Score: ${overallScore}%`);
    });

    this.on('deployment-verified', (result: DeploymentVerificationResult) => {
      console.log(`🚀 Deployment verified: ${result.deploymentId} - Score: ${result.adherence_score}%`);
    });
  }

  private async ensureDirectoriesExist(): Promise<void> {
    if (!fs.existsSync(this.STATE_DIR)) {
      fs.mkdirSync(this.STATE_DIR, { recursive: true });
    }
  }

  private async loadStoredData(): Promise<void> {
    try {
      // Load intents
      if (fs.existsSync(this.INTENT_STORE_PATH)) {
        const intentData = JSON.parse(fs.readFileSync(this.INTENT_STORE_PATH, 'utf8'));
        this.intents = new Map(Object.entries(intentData));
      }

      // Load validations
      if (fs.existsSync(this.VALIDATION_STORE_PATH)) {
        const validationData = JSON.parse(fs.readFileSync(this.VALIDATION_STORE_PATH, 'utf8'));
        this.validations = new Map(Object.entries(validationData));
      }

      // Load conversation history
      if (fs.existsSync(this.CONVERSATION_STORE_PATH)) {
        this.conversationHistory = JSON.parse(fs.readFileSync(this.CONVERSATION_STORE_PATH, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load stored verification data:', error);
    }
  }

  private async persistIntents(): Promise<void> {
    const data = Object.fromEntries(this.intents);
    fs.writeFileSync(this.INTENT_STORE_PATH, JSON.stringify(data, null, 2));
  }

  private async persistValidations(): Promise<void> {
    const data = Object.fromEntries(this.validations);
    fs.writeFileSync(this.VALIDATION_STORE_PATH, JSON.stringify(data, null, 2));
  }

  private async setupContinuousVerificationIntegration(): Promise<void> {
    // Listen to continuous verification events
    this.continuousVerifier.on('verification-complete', async ({ task, alerts }) => {
      // Check if this task relates to any tracked intents
      const relatedIntents = this.findRelatedIntents(task);
      
      for (const intent of relatedIntents) {
        console.log(`🔄 Continuous verification triggered validation for intent: ${intent.id}`);
        await this.validateOutcome(intent.id);
      }
    });
  }

  private generateIntentId(): string {
    return `intent-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  private async parseRequirements(request: string): Promise<ParsedRequirement[]> {
    const requirements: ParsedRequirement[] = [];
    
    // Simple keyword-based parsing (in production, would use NLP)
    const requirementIndicators = [
      { pattern: /create|implement|build|add/i, type: 'functional' as const },
      { pattern: /deploy|production|environment/i, type: 'deployment' as const },
      { pattern: /performance|speed|optimize/i, type: 'performance' as const },
      { pattern: /secure|authentication|authorization/i, type: 'security' as const },
      { pattern: /refactor|clean|improve/i, type: 'technical' as const }
    ];

    const sentences = request.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence.length < 10) continue;

      // Determine requirement type
      let reqType: ParsedRequirement['type'] = 'functional';
      for (const indicator of requirementIndicators) {
        if (indicator.pattern.test(sentence)) {
          reqType = indicator.type;
          break;
        }
      }

      // Extract keywords
      const keywords = sentence.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !['that', 'with', 'from', 'this', 'they', 'will', 'should'].includes(word));

      // Determine if it's a must-have
      const mustHave = /must|required|need|critical|essential/i.test(sentence);

      const requirement: ParsedRequirement = {
        id: `req-${Date.now()}-${i}`,
        type: reqType,
        description: sentence,
        mustHave,
        verifiable: this.isVerifiable(sentence),
        acceptance_criteria: this.extractAcceptanceCriteria(sentence),
        keywords,
        expected_outcome: this.extractExpectedOutcome(sentence),
        validation_method: this.determineValidationMethod(reqType, sentence)
      };

      requirements.push(requirement);
    }

    return requirements;
  }

  private async enrichConversationContext(
    partialContext: Partial<ConversationContext>
  ): Promise<ConversationContext> {
    const defaultContext: ConversationContext = {
      sessionId: this.generateSessionId(),
      messageHistory: this.conversationHistory.slice(-10), // Last 10 messages
      userContext: {
        expertise_level: 'intermediate',
        previous_requests: [],
        current_project_context: ''
      },
      technicalContext: {
        codebase_state: await this.getCurrentCodebaseState(),
        current_branch: await this.getCurrentBranch(),
        recent_changes: await this.getRecentChanges(),
        deployment_environment: 'development'
      }
    };

    return { ...defaultContext, ...partialContext };
  }

  private assessPriority(request: string, requirements: ParsedRequirement[]): UserIntent['priority'] {
    const criticalKeywords = ['critical', 'urgent', 'asap', 'immediately', 'production', 'down', 'broken'];
    const highKeywords = ['important', 'priority', 'soon', 'deployment'];
    
    const text = request.toLowerCase();
    
    if (criticalKeywords.some(keyword => text.includes(keyword))) {
      return 'critical';
    }
    
    if (highKeywords.some(keyword => text.includes(keyword)) || 
        requirements.some(req => req.mustHave && req.type === 'security')) {
      return 'high';
    }
    
    if (requirements.some(req => req.type === 'deployment' || req.mustHave)) {
      return 'medium';
    }
    
    return 'low';
  }

  private classifyRequestType(request: string): UserIntent['metadata']['requestType'] {
    const text = request.toLowerCase();
    
    if (/bug|fix|error|issue|problem/i.test(text)) return 'bugfix';
    if (/deploy|production|release/i.test(text)) return 'deployment';
    if (/refactor|clean|improve|optimize/i.test(text)) return 'refactor';
    if (/analyze|review|check|examine/i.test(text)) return 'analysis';
    
    return 'feature';
  }

  private assessComplexity(requirements: ParsedRequirement[]): UserIntent['metadata']['complexity'] {
    const totalRequirements = requirements.length;
    const mustHaveCount = requirements.filter(req => req.mustHave).length;
    const typeVariety = new Set(requirements.map(req => req.type)).size;
    
    if (totalRequirements >= 10 || mustHaveCount >= 5 || typeVariety >= 4) {
      return 'enterprise';
    }
    
    if (totalRequirements >= 6 || mustHaveCount >= 3 || typeVariety >= 3) {
      return 'complex';
    }
    
    if (totalRequirements >= 3 || mustHaveCount >= 1) {
      return 'moderate';
    }
    
    return 'simple';
  }

  private estimateSteps(requirements: ParsedRequirement[]): number {
    // Simple estimation based on requirement types
    const stepEstimates = {
      functional: 2,
      technical: 1.5,
      deployment: 3,
      performance: 2.5,
      security: 3
    };
    
    return Math.ceil(
      requirements.reduce((total, req) => total + stepEstimates[req.type], 0)
    );
  }

  private extractDependencies(request: string, requirements: ParsedRequirement[]): string[] {
    const dependencies: string[] = [];
    
    // Look for explicit dependencies in text
    const depPatterns = [
      /depends? on ([^.]+)/gi,
      /requires? ([^.]+)/gi,
      /needs? ([^.]+)/gi,
      /after ([^.]+)/gi
    ];
    
    for (const pattern of depPatterns) {
      const matches = request.matchAll(pattern);
      for (const match of matches) {
        dependencies.push(match[1].trim());
      }
    }
    
    return dependencies;
  }

  private async getCurrentTaskId(): Promise<string> {
    try {
      const taskData = JSON.parse(fs.readFileSync('.claude/state/current_task.json', 'utf8'));
      return taskData.task || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  }

  private async getCurrentCodebaseState(): Promise<string> {
    try {
      const { execSync } = require('child_process');
      const hash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      return hash.substring(0, 8);
    } catch {
      return 'unknown';
    }
  }

  private async getCurrentBranch(): Promise<string> {
    try {
      const { execSync } = require('child_process');
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private async getRecentChanges(): Promise<string[]> {
    try {
      const { execSync } = require('child_process');
      const output = execSync('git diff --name-only HEAD~3 HEAD', { encoding: 'utf8' });
      return output.trim().split('\n').filter(line => line.length > 0);
    } catch {
      return [];
    }
  }

  private isVerifiable(sentence: string): boolean {
    // Requirements that can be automatically verified
    const verifiablePatterns = [
      /create.*file/i,
      /implement.*function/i,
      /add.*endpoint/i,
      /deploy.*to/i,
      /test.*pass/i
    ];
    
    return verifiablePatterns.some(pattern => pattern.test(sentence));
  }

  private extractAcceptanceCriteria(sentence: string): string[] {
    const criteria: string[] = [];
    
    // Look for "should" statements
    const shouldMatches = sentence.match(/should ([^,;.]+)/gi);
    if (shouldMatches) {
      criteria.push(...shouldMatches.map(match => match.trim()));
    }
    
    // Add default criteria based on content
    if (/create|implement/.test(sentence)) {
      criteria.push('Implementation exists and is functional');
    }
    
    if (/deploy/.test(sentence)) {
      criteria.push('Successfully deployed and accessible');
    }
    
    return criteria;
  }

  private extractExpectedOutcome(sentence: string): string {
    // Simple outcome extraction
    const outcomePatterns = [
      /so that ([^.]+)/i,
      /to ([^.]+)/i,
      /will ([^.]+)/i
    ];
    
    for (const pattern of outcomePatterns) {
      const match = sentence.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return 'Requirement fulfilled as described';
  }

  private determineValidationMethod(
    type: ParsedRequirement['type'], 
    sentence: string
  ): ParsedRequirement['validation_method'] {
    if (type === 'deployment' || /deploy|production/.test(sentence)) {
      return 'deployment_check';
    }
    
    if (type === 'functional' || /behavior|work|function/.test(sentence)) {
      return 'behavior_test';
    }
    
    if (/confirm|approve|verify/.test(sentence)) {
      return 'user_confirmation';
    }
    
    return 'code_analysis';
  }

  private async gatherImplementationEvidence(intent: UserIntent): Promise<ImplementationEvidence> {
    console.log(`📋 Gathering implementation evidence for intent: ${intent.id}`);
    
    const evidence: ImplementationEvidence = {
      code_changes: await this.getCodeChanges(intent),
      file_modifications: await this.getFileModifications(intent),
      tests_added: await this.getTestEvidence(intent),
      deployments: await this.getDeploymentEvidence(intent),
      behavior_verification: await this.getBehaviorEvidence(intent)
    };
    
    return evidence;
  }

  private async getCodeChanges(intent: UserIntent): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];
    
    try {
      // Get git changes since intent was created
      const { execSync } = require('child_process');
      const sinceDate = intent.timestamp;
      const diffOutput = execSync(
        `git diff --name-status --since="${sinceDate}"`, 
        { encoding: 'utf8' }
      );
      
      const lines = diffOutput.trim().split('\n').filter(line => line.length > 0);
      
      for (const line of lines) {
        const [status, filePath] = line.split('\t');
        if (!filePath) continue;
        
        let changeType: CodeChange['change_type'];
        switch (status) {
          case 'A': changeType = 'added'; break;
          case 'M': changeType = 'modified'; break;
          case 'D': changeType = 'deleted'; break;
          default: changeType = 'modified';
        }
        
        // Get line count changes
        let linesChanged = 0;
        try {
          const statOutput = execSync(
            `git diff --numstat HEAD~1 HEAD -- "${filePath}"`,
            { encoding: 'utf8' }
          );
          const [added, deleted] = statOutput.split('\t').map(Number);
          linesChanged = (added || 0) + (deleted || 0);
        } catch {
          linesChanged = 1;
        }
        
        changes.push({
          file_path: filePath,
          change_type: changeType,
          lines_changed: linesChanged,
          complexity_score: this.calculateFileComplexity(filePath, linesChanged),
          purpose: this.inferChangePurpose(filePath, intent),
          relates_to_requirement: this.findRelatedRequirement(filePath, intent)
        });
      }
    } catch (error) {
      console.warn('Could not get code changes:', error);
    }
    
    return changes;
  }

  private async getFileModifications(intent: UserIntent): Promise<FileModification[]> {
    const modifications: FileModification[] = [];
    
    try {
      // Get all modified files since intent timestamp
      const files = await this.getChangedFilesSince(intent.timestamp);
      
      for (const filePath of files) {
        const stats = await this.getFileStats(filePath);
        if (stats) {
          modifications.push({
            path: filePath,
            modification_type: stats.modification_type,
            size_change: stats.size_change,
            timestamp: stats.timestamp,
            checksum: stats.checksum
          });
        }
      }
    } catch (error) {
      console.warn('Could not get file modifications:', error);
    }
    
    return modifications;
  }

  private async getTestEvidence(intent: UserIntent): Promise<TestEvidence[]> {
    const tests: TestEvidence[] = [];
    
    try {
      // Look for test files that might relate to the intent
      const testFiles = await this.findTestFiles();
      
      for (const testFile of testFiles) {
        if (await this.isTestRelatedToIntent(testFile, intent)) {
          const testResults = await this.getTestResults(testFile);
          tests.push(...testResults);
        }
      }
    } catch (error) {
      console.warn('Could not get test evidence:', error);
    }
    
    return tests;
  }

  private async getDeploymentEvidence(intent: UserIntent): Promise<DeploymentEvidence[]> {
    const deployments: DeploymentEvidence[] = [];
    
    try {
      // Check for deployment logs or evidence
      const deploymentLogs = await this.findDeploymentLogs(intent.timestamp);
      
      for (const log of deploymentLogs) {
        const evidence = await this.parseDeploymentLog(log);
        if (evidence) {
          deployments.push(evidence);
        }
      }
    } catch (error) {
      console.warn('Could not get deployment evidence:', error);
    }
    
    return deployments;
  }

  private async getBehaviorEvidence(intent: UserIntent): Promise<BehaviorEvidence[]> {
    const evidence: BehaviorEvidence[] = [];
    
    // This would integrate with testing frameworks or monitoring systems
    // For now, we'll create basic evidence based on code analysis
    
    for (const requirement of intent.parsedRequirements) {
      if (requirement.validation_method === 'behavior_test') {
        evidence.push({
          verification_method: 'code_analysis',
          expected_behavior: requirement.expected_outcome,
          actual_behavior: 'Implementation detected but behavior not verified',
          matches: false,
          confidence_score: 0.5,
          evidence_source: 'automated_test'
        });
      }
    }
    
    return evidence;
  }

  private async validateRequirement(
    intent: UserIntent,
    requirement: ParsedRequirement,
    evidence: ImplementationEvidence
  ): Promise<OutcomeValidation> {
    const validationId = `validation-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    
    console.log(`🔍 Validating requirement: ${requirement.id} - ${requirement.description.substring(0, 50)}...`);
    
    let adherenceScore = 0;
    const gaps: AdherenceGap[] = [];
    const recommendations: string[] = [];
    
    // Validate based on requirement type
    switch (requirement.validation_method) {
      case 'code_analysis':
        const codeScore = await this.validateCodeImplementation(requirement, evidence.code_changes);
        adherenceScore = codeScore.score;
        gaps.push(...codeScore.gaps);
        recommendations.push(...codeScore.recommendations);
        break;
        
      case 'behavior_test':
        const behaviorScore = await this.validateBehavior(requirement, evidence.behavior_verification);
        adherenceScore = behaviorScore.score;
        gaps.push(...behaviorScore.gaps);
        recommendations.push(...behaviorScore.recommendations);
        break;
        
      case 'deployment_check':
        const deploymentScore = await this.validateDeploymentRequirement(requirement, evidence.deployments);
        adherenceScore = deploymentScore.score;
        gaps.push(...deploymentScore.gaps);
        recommendations.push(...deploymentScore.recommendations);
        break;
        
      case 'user_confirmation':
        // This would require user input - for now, mark as pending
        adherenceScore = 0;
        gaps.push({
          requirement_id: requirement.id,
          gap_type: 'incomplete_feature',
          severity: 'medium',
          description: 'Requires user confirmation',
          impact: 'Cannot verify without user input',
          suggested_fix: 'Request user confirmation of implementation',
          estimated_effort: '5 minutes'
        });
        break;
    }
    
    const validationStatus: OutcomeValidation['validation_status'] = 
      adherenceScore >= 90 ? 'passed' :
      adherenceScore >= 60 ? 'partial' :
      adherenceScore > 0 ? 'failed' : 'pending';
    
    const validation: OutcomeValidation = {
      intentId: intent.id,
      validationId,
      requirement,
      actual_implementation: evidence,
      adherence_score: adherenceScore,
      validation_status: validationStatus,
      gaps,
      recommendations,
      timestamp: new Date().toISOString()
    };
    
    return validation;
  }

  private calculateOverallAdherence(validations: OutcomeValidation[]): number {
    if (validations.length === 0) return 0;
    
    const totalScore = validations.reduce((sum, validation) => sum + validation.adherence_score, 0);
    return Math.round(totalScore / validations.length);
  }

  private extractDeploymentSpecs(intent: UserIntent): DeploymentSpec[] {
    const specs: DeploymentSpec[] = [];
    
    const deploymentRequirements = intent.parsedRequirements.filter(
      req => req.type === 'deployment'
    );
    
    for (const req of deploymentRequirements) {
      specs.push({
        requirement: req.description,
        environment: this.extractEnvironment(req.description),
        expected_endpoints: this.extractEndpoints(req.description),
        expected_behavior: req.acceptance_criteria,
        health_check_requirements: this.extractHealthChecks(req.description)
      });
    }
    
    return specs;
  }

  private async verifyDeploymentSpec(
    spec: DeploymentSpec,
    evidence: DeploymentEvidence
  ): Promise<{ score: number; gaps: AdherenceGap[] }> {
    let score = 100;
    const gaps: AdherenceGap[] = [];
    
    // Check if deployment was successful
    if (evidence.status !== 'success') {
      score -= 50;
      gaps.push({
        requirement_id: 'deployment-status',
        gap_type: 'deployment_failure',
        severity: 'critical',
        description: `Deployment failed with status: ${evidence.status}`,
        impact: 'Feature not available to users',
        suggested_fix: 'Debug and fix deployment issues',
        estimated_effort: '2-4 hours'
      });
    }
    
    // Check health checks
    const failedChecks = evidence.health_checks?.filter(check => check.status === 'failed') || [];
    if (failedChecks.length > 0) {
      score -= 25;
      gaps.push({
        requirement_id: 'health-checks',
        gap_type: 'deployment_failure',
        severity: 'high',
        description: `${failedChecks.length} health checks failed`,
        impact: 'System may not be functioning correctly',
        suggested_fix: 'Fix failing health checks',
        estimated_effort: '1-2 hours'
      });
    }
    
    return { score: Math.max(0, score), gaps };
  }

  private async validateCodeChanges(
    requirements: ParsedRequirement[],
    codeChanges: CodeChange[]
  ): Promise<{ score: number; feedback: string[] }> {
    const feedback: string[] = [];
    let score = 100;
    
    // Check if there are any code changes at all
    if (codeChanges.length === 0) {
      feedback.push('⚠️ No code changes detected - implementation may be missing');
      score -= 50;
    }
    
    // Check if changes relate to requirements
    const relatedChanges = codeChanges.filter(change => 
      requirements.some(req => 
        req.keywords.some(keyword => 
          change.file_path.toLowerCase().includes(keyword) ||
          change.purpose.toLowerCase().includes(keyword)
        )
      )
    );
    
    if (relatedChanges.length === 0) {
      feedback.push('⚠️ Code changes do not appear to relate to user requirements');
      score -= 30;
    } else {
      feedback.push(`✅ Found ${relatedChanges.length} code changes related to requirements`);
    }
    
    return { score: Math.max(0, score), feedback };
  }

  private async validateBehaviorEvidence(
    requirements: ParsedRequirement[],
    behaviorEvidence: BehaviorEvidence[]
  ): Promise<{ score: number; feedback: string[] }> {
    const feedback: string[] = [];
    let score = 100;
    
    const functionalRequirements = requirements.filter(req => req.type === 'functional');
    
    if (functionalRequirements.length > 0 && behaviorEvidence.length === 0) {
      feedback.push('⚠️ No behavior verification found for functional requirements');
      score -= 40;
    }
    
    const failedBehaviors = behaviorEvidence.filter(evidence => !evidence.matches);
    if (failedBehaviors.length > 0) {
      feedback.push(`❌ ${failedBehaviors.length} behavior verifications failed`);
      score -= failedBehaviors.length * 20;
    }
    
    return { score: Math.max(0, score), feedback };
  }

  private findRelatedIntents(task: Task): UserIntent[] {
    const related: UserIntent[] = [];
    
    for (const intent of this.intents.values()) {
      if (intent.taskId === task.task || 
          intent.context.technicalContext.current_branch === task.branch ||
          task.services.some(service => 
            intent.parsedRequirements.some(req => 
              req.keywords.some(keyword => 
                service.toLowerCase().includes(keyword)
              )
            )
          )
      ) {
        related.push(intent);
      }
    }
    
    return related;
  }

  private async getIntentReport(intentId: string): Promise<any> {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`Intent not found: ${intentId}`);
    }
    
    const validations = Array.from(this.validations.values())
      .filter(v => v.intentId === intentId);
    
    const overallScore = this.calculateOverallAdherence(validations);
    
    return {
      intent,
      validations,
      overallScore,
      status: intent.status,
      summary: {
        total_requirements: intent.parsedRequirements.length,
        validated_requirements: validations.length,
        passed_validations: validations.filter(v => v.validation_status === 'passed').length,
        critical_gaps: validations.flatMap(v => v.gaps).filter(g => g.severity === 'critical').length
      }
    };
  }

  private async getOverallReport(): Promise<any> {
    const allIntents = Array.from(this.intents.values());
    const allValidations = Array.from(this.validations.values());
    
    const completedIntents = allIntents.filter(intent => intent.status === 'completed');
    const failedIntents = allIntents.filter(intent => intent.status === 'failed');
    
    const overallScore = allValidations.length > 0 ? 
      Math.round(allValidations.reduce((sum, v) => sum + v.adherence_score, 0) / allValidations.length) : 0;
    
    return {
      summary: {
        total_intents: allIntents.length,
        completed_intents: completedIntents.length,
        failed_intents: failedIntents.length,
        overall_adherence_score: overallScore,
        total_validations: allValidations.length
      },
      by_priority: this.groupIntentsByPriority(allIntents),
      by_status: this.groupIntentsByStatus(allIntents),
      recent_activity: this.getRecentActivity()
    };
  }

  // === Helper Methods (Implementation Stubs) ===

  private calculateFileComplexity(filePath: string, linesChanged: number): number {
    // Simple complexity calculation
    const fileTypeMultipliers = {
      '.ts': 1.5,
      '.js': 1.2,
      '.py': 1.3,
      '.java': 1.8,
      '.sql': 1.0
    };
    
    const extension = path.extname(filePath);
    const multiplier = fileTypeMultipliers[extension as keyof typeof fileTypeMultipliers] || 1.0;
    
    return Math.round(linesChanged * multiplier);
  }

  private inferChangePurpose(filePath: string, intent: UserIntent): string {
    // Infer purpose based on file path and intent
    if (filePath.includes('test')) return 'Testing';
    if (filePath.includes('config')) return 'Configuration';
    if (filePath.includes('deploy')) return 'Deployment';
    
    // Match against intent keywords
    for (const req of intent.parsedRequirements) {
      for (const keyword of req.keywords) {
        if (filePath.toLowerCase().includes(keyword)) {
          return `Implements: ${req.type} requirement`;
        }
      }
    }
    
    return 'Code implementation';
  }

  private findRelatedRequirement(filePath: string, intent: UserIntent): string {
    for (const req of intent.parsedRequirements) {
      for (const keyword of req.keywords) {
        if (filePath.toLowerCase().includes(keyword)) {
          return req.id;
        }
      }
    }
    return 'unrelated';
  }

  private async getChangedFilesSince(timestamp: string): Promise<string[]> {
    try {
      const { execSync } = require('child_process');
      const output = execSync(
        `git diff --name-only --since="${timestamp}"`,
        { encoding: 'utf8' }
      );
      return output.trim().split('\n').filter(line => line.length > 0);
    } catch {
      return [];
    }
  }

  private async getFileStats(filePath: string): Promise<any> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          modification_type: 'deleted' as const,
          size_change: 0,
          timestamp: new Date().toISOString(),
          checksum: ''
        };
      }
      
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('md5').update(content).digest('hex');
      
      return {
        modification_type: 'updated' as const,
        size_change: content.length,
        timestamp: stats.mtime.toISOString(),
        checksum
      };
    } catch {
      return null;
    }
  }

  private async findTestFiles(): Promise<string[]> {
    const testFiles: string[] = [];
    
    try {
      const { execSync } = require('child_process');
      const output = execSync('find . -name "*.test.*" -o -name "*.spec.*"', { encoding: 'utf8' });
      testFiles.push(...output.trim().split('\n').filter(line => line.length > 0));
    } catch {
      // Fallback to common patterns
      const commonTestPaths = [
        'test',
        'tests',
        'spec',
        '__tests__'
      ];
      
      for (const testPath of commonTestPaths) {
        if (fs.existsSync(testPath)) {
          // Would scan directory for test files
        }
      }
    }
    
    return testFiles;
  }

  private async isTestRelatedToIntent(testFile: string, intent: UserIntent): Promise<boolean> {
    try {
      const content = fs.readFileSync(testFile, 'utf8');
      
      // Check if test mentions any keywords from intent
      return intent.parsedRequirements.some(req =>
        req.keywords.some(keyword =>
          content.toLowerCase().includes(keyword)
        )
      );
    } catch {
      return false;
    }
  }

  private async getTestResults(testFile: string): Promise<TestEvidence[]> {
    // This would integrate with actual test runners
    // For now, return mock evidence
    return [{
      test_file: testFile,
      test_name: 'Mock test',
      test_type: 'unit',
      covers_requirement: 'unknown',
      status: 'passed'
    }];
  }

  private async findDeploymentLogs(timestamp: string): Promise<string[]> {
    const logFiles: string[] = [];
    
    const commonLogPaths = [
      'logs',
      '.logs',
      'deployment.log',
      'deploy.log'
    ];
    
    for (const logPath of commonLogPaths) {
      if (fs.existsSync(logPath)) {
        logFiles.push(logPath);
      }
    }
    
    return logFiles;
  }

  private async parseDeploymentLog(logPath: string): Promise<DeploymentEvidence | null> {
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      
      // Very basic log parsing - would be more sophisticated in practice
      if (content.includes('deployment success') || content.includes('deploy complete')) {
        return {
          deployment_id: `deploy-${Date.now()}`,
          environment: 'production',
          status: 'success',
          deployment_time: new Date().toISOString(),
          health_checks: [{
            check_name: 'basic',
            status: 'passed',
            response_time_ms: 100
          }]
        };
      }
    } catch {
      // Ignore log parsing errors
    }
    
    return null;
  }

  private async validateCodeImplementation(
    requirement: ParsedRequirement,
    codeChanges: CodeChange[]
  ): Promise<{ score: number; gaps: AdherenceGap[]; recommendations: string[] }> {
    let score = 0;
    const gaps: AdherenceGap[] = [];
    const recommendations: string[] = [];
    
    // Check if there are relevant code changes
    const relevantChanges = codeChanges.filter(change =>
      requirement.keywords.some(keyword =>
        change.file_path.toLowerCase().includes(keyword) ||
        change.purpose.toLowerCase().includes(keyword)
      )
    );
    
    if (relevantChanges.length > 0) {
      score = 75; // Base score for having relevant changes
      recommendations.push('Code changes detected that relate to this requirement');
      
      // Bonus points for complexity and thoroughness
      const totalComplexity = relevantChanges.reduce((sum, change) => sum + change.complexity_score, 0);
      if (totalComplexity > 10) {
        score += 15; // Substantial implementation
      }
    } else {
      gaps.push({
        requirement_id: requirement.id,
        gap_type: 'missing_implementation',
        severity: requirement.mustHave ? 'critical' : 'medium',
        description: 'No code changes found that relate to this requirement',
        impact: 'Requirement may not be implemented',
        suggested_fix: 'Implement code changes to fulfill this requirement',
        estimated_effort: '1-4 hours'
      });
    }
    
    return { score: Math.min(100, score), gaps, recommendations };
  }

  private async validateBehavior(
    requirement: ParsedRequirement,
    behaviorEvidence: BehaviorEvidence[]
  ): Promise<{ score: number; gaps: AdherenceGap[]; recommendations: string[] }> {
    let score = 0;
    const gaps: AdherenceGap[] = [];
    const recommendations: string[] = [];
    
    const relevantEvidence = behaviorEvidence.filter(evidence =>
      evidence.expected_behavior.toLowerCase().includes(requirement.description.toLowerCase()) ||
      requirement.keywords.some(keyword =>
        evidence.expected_behavior.toLowerCase().includes(keyword) ||
        evidence.actual_behavior.toLowerCase().includes(keyword)
      )
    );
    
    if (relevantEvidence.length > 0) {
      const matchingEvidence = relevantEvidence.filter(evidence => evidence.matches);
      score = Math.round((matchingEvidence.length / relevantEvidence.length) * 100);
      
      if (score < 100) {
        gaps.push({
          requirement_id: requirement.id,
          gap_type: 'incorrect_behavior',
          severity: 'high',
          description: 'Behavior verification shows incorrect implementation',
          impact: 'Feature may not work as expected',
          suggested_fix: 'Fix implementation to match expected behavior',
          estimated_effort: '2-6 hours'
        });
      }
    } else {
      gaps.push({
        requirement_id: requirement.id,
        gap_type: 'missing_implementation',
        severity: 'medium',
        description: 'No behavior verification found for this requirement',
        impact: 'Cannot confirm requirement is working correctly',
        suggested_fix: 'Add tests or verification for this behavior',
        estimated_effort: '1-3 hours'
      });
    }
    
    return { score, gaps, recommendations };
  }

  private async validateDeploymentRequirement(
    requirement: ParsedRequirement,
    deployments: DeploymentEvidence[]
  ): Promise<{ score: number; gaps: AdherenceGap[]; recommendations: string[] }> {
    let score = 0;
    const gaps: AdherenceGap[] = [];
    const recommendations: string[] = [];
    
    if (deployments.length > 0) {
      const successfulDeployments = deployments.filter(d => d.status === 'success');
      score = Math.round((successfulDeployments.length / deployments.length) * 100);
      
      if (score === 100) {
        recommendations.push('All deployments completed successfully');
      } else {
        gaps.push({
          requirement_id: requirement.id,
          gap_type: 'deployment_failure',
          severity: 'critical',
          description: 'Some deployments failed',
          impact: 'Feature may not be accessible to users',
          suggested_fix: 'Debug and fix deployment issues',
          estimated_effort: '2-8 hours'
        });
      }
    } else {
      gaps.push({
        requirement_id: requirement.id,
        gap_type: 'missing_implementation',
        severity: 'high',
        description: 'No deployment evidence found',
        impact: 'Requirement may not be deployed',
        suggested_fix: 'Deploy the implementation',
        estimated_effort: '1-2 hours'
      });
    }
    
    return { score, gaps, recommendations };
  }

  private extractEnvironment(description: string): string {
    const environments = ['production', 'staging', 'development', 'test'];
    
    for (const env of environments) {
      if (description.toLowerCase().includes(env)) {
        return env;
      }
    }
    
    return 'development';
  }

  private extractEndpoints(description: string): string[] {
    const endpoints: string[] = [];
    
    // Look for URL patterns
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = description.match(urlPattern);
    if (urls) {
      endpoints.push(...urls);
    }
    
    // Look for endpoint patterns
    const endpointPattern = /\/[a-zA-Z0-9/_-]+/g;
    const paths = description.match(endpointPattern);
    if (paths) {
      endpoints.push(...paths);
    }
    
    return endpoints;
  }

  private extractHealthChecks(description: string): string[] {
    const checks: string[] = [];
    
    if (description.includes('health')) {
      checks.push('health check');
    }
    
    if (description.includes('status')) {
      checks.push('status check');
    }
    
    if (description.includes('ping')) {
      checks.push('ping check');
    }
    
    return checks.length > 0 ? checks : ['basic connectivity'];
  }

  private groupIntentsByPriority(intents: UserIntent[]): any {
    const groups = {
      critical: intents.filter(i => i.priority === 'critical'),
      high: intents.filter(i => i.priority === 'high'),
      medium: intents.filter(i => i.priority === 'medium'),
      low: intents.filter(i => i.priority === 'low')
    };
    
    return Object.fromEntries(
      Object.entries(groups).map(([priority, intentList]) => [
        priority,
        {
          count: intentList.length,
          completed: intentList.filter(i => i.status === 'completed').length,
          failed: intentList.filter(i => i.status === 'failed').length
        }
      ])
    );
  }

  private groupIntentsByStatus(intents: UserIntent[]): any {
    const groups = {
      pending: intents.filter(i => i.status === 'pending'),
      in_progress: intents.filter(i => i.status === 'in_progress'),
      completed: intents.filter(i => i.status === 'completed'),
      failed: intents.filter(i => i.status === 'failed')
    };
    
    return Object.fromEntries(
      Object.entries(groups).map(([status, intentList]) => [
        status,
        {
          count: intentList.length,
          intents: intentList.map(i => ({
            id: i.id,
            request: i.originalRequest.substring(0, 100),
            timestamp: i.timestamp
          }))
        }
      ])
    );
  }

  private getRecentActivity(): any {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    
    const recentIntents = Array.from(this.intents.values())
      .filter(intent => now - new Date(intent.timestamp).getTime() < oneDay)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
    
    const recentValidations = Array.from(this.validations.values())
      .filter(validation => now - new Date(validation.timestamp).getTime() < oneHour)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
    
    return {
      recent_intents: recentIntents.map(intent => ({
        id: intent.id,
        request: intent.originalRequest.substring(0, 80),
        status: intent.status,
        timestamp: intent.timestamp
      })),
      recent_validations: recentValidations.map(validation => ({
        id: validation.validationId,
        requirement: validation.requirement.description.substring(0, 60),
        status: validation.validation_status,
        score: validation.adherence_score,
        timestamp: validation.timestamp
      }))
    };
  }
}

export default UserRequirementAdherenceVerifier;
