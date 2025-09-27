export interface ProjectDefinition {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'archived' | 'paused';
  priority: number;
  metadata?: Record<string, any>;
}

export interface RoadmapPlan {
  id: string;
  projectId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  status: 'planning' | 'active' | 'completed' | 'archived';
  priority: number;
  progress: number; // 0-100
  metadata?: Record<string, any>;
}

export interface MacroTaskWithBranch {
  id: string;
  roadmapId: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked' | 'cancelled';
  priority: number;
  progress: number; // 0-100
  dependencies: string[]; // Array of macro task IDs this task depends on
  assignee?: string;
  metadata?: Record<string, any>;
}

export interface MicroTaskGranular {
  id: string;
  macroTaskId: string;
  name: string;
  description: string;
  estimatedDuration: number; // in minutes
  actualDuration?: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
  status: 'todo' | 'in-progress' | 'review' | 'completed' | 'blocked' | 'cancelled';
  priority: number;
  progress: number; // 0-100
  dependencies: string[]; // Array of micro task IDs this task depends on
  assignee?: string;
  tags: string[];
  metadata?: Record<string, any>;
}

export type TaskStatus = 
  | 'pending' 
  | 'planning' 
  | 'in-progress' 
  | 'review' 
  | 'completed' 
  | 'blocked' 
  | 'cancelled' 
  | 'archived' 
  | 'active' 
  | 'paused';

export interface TaskProgress {
  taskId: string;
  progress: number;
  status: TaskStatus;
  updatedAt: Date;
}