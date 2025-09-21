/**
 * Example DevFlow Configuration with Verification System Enabled
 */

import { DevFlowConfig } from '../src/core/devflow-orchestrator/index';

export const devflowConfigWithVerification: DevFlowConfig = {
  taskHierarchy: {
    enabled: true,
    databasePath: './data/devflow.sqlite'
  },
  cognitiveMapping: {
    enabled: true,
    neo4jConfig: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'password'
    }
  },
  memoryBridge: {
    enabled: true,
    cacheSize: 1000,
    tokenBudget: 2000
  },
  semanticMemory: {
    enabled: true,
    persistDirectory: './data/vectors',
    collectionName: 'devflow_semantic'
  },
  activityRegistry: {
    enabled: true
  },
  verification: {
    enabled: true,
    checkInterval: 10000,      // Check every 10 seconds
    inactivityThreshold: 300000 // Auto-deactivate after 5 minutes of inactivity
  }
};

// Example usage:
// const orchestrator = new DevFlowOrchestrator(devflowConfigWithVerification);
// await orchestrator.initialize();