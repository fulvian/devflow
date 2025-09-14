// Synthetic Delegation Rules Implementation
// Based on MDR-001, MDR-002, MDR-003 governance requirements

const SyntheticDelegationRules = {
  // MDR-001: Direct Code Writing Prevention
  preventDirectCodeWriting: {
    id: 'MDR-001',
    name: 'Direct Code Writing Prevention',
    description: 'Prevents direct code writing operations when DAIC mode is active or synthetic delegation is required',
    enabled: true,
    validate: async (context) => {
      try {
        // Check if operation is a write/edit operation
        const writeOperations = ['write', 'edit', 'create_file', 'modify_file'];
        
        if (!writeOperations.includes(context.operation)) {
          return true; // Rule doesn't apply to non-write operations
        }

        // Check for DAIC mode
        if (context.daicMode && context.daicMode.isActive) {
          return false; // Block direct writing in DAIC mode
        }

        // Check for synthetic agent authentication
        if (!context.delegation || !context.delegation.isSynthetic) {
          return false; // Require synthetic delegation for write operations
        }

        return true;
      } catch (error) {
        console.error('Error in MDR-001 validation:', error);
        return false; // Fail secure
      }
    }
  },

  // MDR-002: Synthetic Agent Authentication
  requireSyntheticAuthentication: {
    id: 'MDR-002',
    name: 'Synthetic Agent Authentication',
    description: 'Requires valid synthetic agent signature for all code submissions',
    enabled: true,
    validate: async (context) => {
      try {
        // Check if operation requires authentication
        const protectedOperations = ['write', 'edit', 'create_file', 'modify_file', 'delete_file'];
        
        if (!protectedOperations.includes(context.operation)) {
          return true;
        }

        // Verify synthetic agent signature
        if (context.syntheticAgent) {
          const hasValidSignature = context.syntheticAgent.signature &&
                                  context.syntheticAgent.agentId &&
                                  context.syntheticAgent.timestamp;

          if (!hasValidSignature) {
            return false;
          }

          // Validate signature freshness (within 5 minutes)
          const signatureAge = Date.now() - new Date(context.syntheticAgent.timestamp).getTime();
          if (signatureAge > 300000) {
            return false; // Signature too old
          }

          return true;
        }

        return false; // No synthetic agent data
      } catch (error) {
        console.error('Error in MDR-002 validation:', error);
        return false;
      }
    }
  },

  // MDR-003: Workflow Integration Compliance
  enforceWorkflowCompliance: {
    id: 'MDR-003',
    name: 'Workflow Integration Compliance',
    description: 'Ensures development activity follows approved synthetic delegation workflow',
    enabled: true,
    validate: async (context) => {
      try {
        // Check workflow compliance markers
        if (context.workflowCompliance) {
          const requiredMarkers = [
            'approved_workflow',
            'delegation_channel',
            'audit_trail'
          ];

          const hasAllMarkers = requiredMarkers.every(marker => 
            context.workflowCompliance[marker] !== undefined
          );

          if (!hasAllMarkers) {
            return false;
          }

          // Verify delegation channel is valid
          const validChannels = ['synthetic_mcp', 'claude_code', 'devflow_api'];
          if (!validChannels.includes(context.workflowCompliance.delegation_channel)) {
            return false;
          }

          return true;
        }

        // For emergency operations, allow with manager override
        if (context.emergencyOverride && context.emergencyOverride.authorized) {
          return true;
        }

        return false; // No workflow compliance data
      } catch (error) {
        console.error('Error in MDR-003 validation:', error);
        return false;
      }
    }
  }
};

// Export rules for dynamic loading
module.exports = SyntheticDelegationRules;