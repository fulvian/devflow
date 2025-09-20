import UserRequirementAdherenceVerifier from "./user-requirement-adherence-verifier";
import UserRequirementIntegration from './user-requirement-integration';

/**
 * User Requirement Adherence Verification Demo
 * 
 * Demonstrates the comprehensive meta-verification system
 */

export async function demonstrateVerificationSystem() {
  console.log('Starting User Requirement Verification Demo...');
  
  try {
    // Initialize system
    const verifier = new UserRequirementAdherenceVerifier();
    await verifier.initialize();
    
    // Example user request
    const userRequest = 'Create a comprehensive verification system for meta-validation of AI implementations.';
    
    // Capture intent
    const intent = await verifier.captureUserIntent(userRequest);
    console.log('Intent captured:', intent.id);
    console.log('Requirements parsed:', intent.parsedRequirements.length);
    
    // Validate outcome
    const validations = await verifier.validateOutcome(intent.id);
    console.log('Validation completed for', validations.length, 'requirements');
    
    // Get report
    const report = await verifier.getAdherenceReport(intent.id);
    console.log('Overall adherence score:', report.overallScore + '%');
    
    console.log('Demo completed successfully!');
    
  } catch (error) {
    console.error('Demo failed:', error);
  }
}

// Export for use
export { demonstrateVerificationSystem as demo };
