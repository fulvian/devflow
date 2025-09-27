/**
 * Default DevFlow configuration with verification enabled
 */

export const defaultDevFlowConfig = {
  taskHierarchy: {
    enabled: false,
    databasePath: './data/devflow_unified.sqlite'
  },
  cognitiveMapping: {
    enabled: false
  },
  memoryBridge: {
    enabled: false,
    cacheSize: 1000,
    tokenBudget: 2000
  },
  semanticMemory: {
    enabled: false,
    persistDirectory: './data/vectors',
    collectionName: 'devflow_semantic'
  },
  activityRegistry: {
    enabled: false
  },
  verification: {
    enabled: true,
    checkInterval: 10000,
    inactivityThreshold: 300000
  }
};

export default defaultDevFlowConfig;