// src/core/task-hierarchy/types.ts

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked'
}

export enum TaskPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface ProjectDefinition {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  // Temporal validation: 1-6 months duration
  validateTemporalConsistency(): boolean;
}

export interface RoadmapPlan {
  id: string;
  projectId: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  // Temporal validation: 1-4 weeks duration
  validateTemporalConsistency(): boolean;
}

export interface MacroTaskWithBranch {
  id: string;
  roadmapId: string;
  title: string;
  description: string;
  branchName: string;
  estimatedHours: number; // 2-8 hours
  actualHours: number;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  // Temporal validation: 2-8 hours duration
  validateTemporalConsistency(): boolean;
}

export interface MicroTaskGranular {
  id: string;
  macroTaskId: string;
  title: string;
  description: string;
  estimatedMinutes: number; // 5-10 minutes
  actualMinutes: number;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
  // Temporal validation: 5-10 minutes duration
  validateTemporalConsistency(): boolean;
}

// Relationship constraints
export interface TaskRelationship {
  parentId: string;
  childId: string;
  relationshipType: 'direct' | 'dependent' | 'parallel';
}

// Temporal validation rules
export interface TemporalValidationRule {
  entityType: 'project' | 'roadmap' | 'macro_task' | 'micro_task';
  minDuration: number;
  maxDuration: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
}
