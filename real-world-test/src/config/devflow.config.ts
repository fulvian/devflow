export interface DevFlowConfig {
  project: {
    name: string;
    version: string;
    description: string;
  };
  git: {
    mainBranch: string;
    featureBranchPrefix: string;
    releaseBranchPrefix: string;
  };
  taskManagement: {
    defaultAssignee: string | null;
    statusTransitions: Record<string, string[]>;
  };
  memory: {
    embeddingDimensions: number;
    similarityThreshold: number;
  };
}

export const devFlowConfig: DevFlowConfig = {
  project: {
    name: 'DevFlow-Test-Project',
    version: '1.0.0',
    description: 'Test project for DevFlow cognitive system validation'
  },
  git: {
    mainBranch: 'main',
    featureBranchPrefix: 'feature/',
    releaseBranchPrefix: 'release/'
  },
  taskManagement: {
    defaultAssignee: null,
    statusTransitions: {
      todo: ['in-progress'],
      'in-progress': ['review', 'done'],
      review: ['done', 'in-progress'],
      done: ['todo'] // For reopening tasks
    }
  },
  memory: {
    embeddingDimensions: 128,
    similarityThreshold: 0.7
  }
};