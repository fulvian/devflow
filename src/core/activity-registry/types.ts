// Activity registry types
export interface Activity {
  id: string;
  name: string;
  description: string;
  category: string;
  duration: number; // in minutes
  dependencies: string[]; // activity IDs that must be completed first
  priority: number; // 1-10 scale
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityRegistryConfig {
  maxConcurrentActivities: number;
  defaultPriority: number;
}

export interface SearchResult {
  activities: Activity[];
  totalCount: number;
  hasMore: boolean;
}

export interface StorageAdapter {
  save(activity: Activity): Promise<void>;
  load(id: string): Promise<Activity | null>;
  list(): Promise<Activity[]>;
  delete(id: string): Promise<boolean>;
}