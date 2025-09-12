import { Activity, ActivityRegistryConfig, SearchResult } from './types';

export class ActivityRegistry {
  private activities: Map<string, Activity> = new Map();
  private config: ActivityRegistryConfig;

  constructor(config: ActivityRegistryConfig) {
    this.config = config;
  }

  registerActivity(activity: Omit<Activity, 'id' | 'status' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId();
    const newActivity: Activity = {
      id,
      ...activity,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.activities.set(id, newActivity);
    return id;
  }

  getActivity(id: string): Activity | undefined {
    return this.activities.get(id);
  }

  getAllActivities(): Activity[] {
    return Array.from(this.activities.values());
  }

  updateActivityStatus(id: string, status: Activity['status']): boolean {
    const activity = this.activities.get(id);
    if (!activity) return false;
    
    activity.status = status;
    activity.updatedAt = new Date();
    return true;
  }

  searchActivities(query: string): SearchResult {
    const results = this.getAllActivities().filter(activity => 
      activity.name.toLowerCase().includes(query.toLowerCase()) ||
      activity.description.toLowerCase().includes(query.toLowerCase())
    );
    
    return {
      activities: results,
      totalCount: results.length,
      hasMore: false
    };
  }

  private generateId(): string {
    return 'activity-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
}