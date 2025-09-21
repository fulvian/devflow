// src/types/project-types.ts
/**
 * TypeScript interfaces for project management entities
 */

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completionPercentage: number; // 0-100
}

export interface Plan {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  status: 'draft' | 'approved' | 'implemented' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  completionPercentage: number; // 0-100
}

export interface Roadmap {
  id: number;
  planId: number;
  name: string;
  description?: string;
  timelineStart?: Date;
  timelineEnd?: Date;
  status: 'planning' | 'active' | 'completed' | 'delayed';
  createdAt: Date;
  updatedAt: Date;
  completionPercentage: number; // 0-100
}

export interface Macrotask {
  id: number;
  roadmapId: number;
  name: string;
  description?: string;
  priority: number; // 1-5
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
  assignedTo?: string;
  estimatedHours?: number;
  actualHours?: number;
  startDate?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completionPercentage: number; // 0-100
}

export interface Microtask {
  id: number;
  macrotaskId: number;
  name: string;
  description?: string;
  priority: number; // 1-5
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
  assignedTo?: string;
  estimatedHours?: number;
  actualHours?: number;
  startDate?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completionPercentage: number; // 0-100
}

export interface Session {
  id: number;
  microtaskId: number;
  coordinationSessionId?: number;
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Status enums for better type safety
export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum PlanStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  IMPLEMENTED = 'implemented',
  ARCHIVED = 'archived'
}

export enum RoadmapStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  DELAYED = 'delayed'
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  BLOCKED = 'blocked'
}

export enum Priority {
  LOWEST = 1,
  LOW = 2,
  MEDIUM = 3,
  HIGH = 4,
  HIGHEST = 5
}