export interface GitStatus {
  branch: string;
  uncommittedChanges: number;
  isSynced: boolean;
  repositoryRoot: string;
}

export interface ModelStatus {
  activeModel: string;
  activeAgent: string;
  tokenUsage: number;
  estimatedCost: number;
}

export interface PerformanceMetrics {
  responseTime: number; // in milliseconds
  memoryUsage: number; // in MB
  cpuUsage: number; // percentage
}

export interface StatusLineState {
  timestamp: number;
  git: GitStatus;
  model: ModelStatus;
  performance: PerformanceMetrics;
}

export interface StatusLineEvents {
  statusUpdate: (state: StatusLineState) => void;
  gitUpdate: (status: GitStatus) => void;
  modelUpdate: () => void;
}

export interface FooterState {
  statusLine: StatusLineState;
  lastUpdated: string;
}
