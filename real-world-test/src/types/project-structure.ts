export interface ProjectStructure {
  name: string;
  description: string;
  version: string;
  directories: Directory[];
  files: File[];
}

export interface Directory {
  path: string;
  description: string;
}

export interface File {
  path: string;
  content: string;
  description: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assignee?: string;
  dependencies?: string[];
  tags: string[];
}

export interface TaskHierarchy {
  rootTasks: string[];
  subtasks: Record<string, string[]>;
}