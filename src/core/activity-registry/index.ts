// Activity Registry System - Main exports
export * from './types';
export { ActivityRegistry } from './activity-registry';
export { GitIntegration } from './git-integration';
export { PatternRecognition } from './pattern-recognition';

import { Activity, ActivityRegistryConfig, SearchResult, StorageAdapter } from './types';
import { ActivityRegistry } from './activity-registry';
import { GitIntegration } from './git-integration';
import { PatternRecognition } from './pattern-recognition';

// In-memory storage adapter implementation
class InMemoryStorageAdapter implements StorageAdapter {
  private storage = new Map<string, Activity>();

  async save(activity: Activity): Promise<void> {
    this.storage.set(activity.id, { ...activity });
  }

  async load(id: string): Promise<Activity | null> {
    return this.storage.get(id) || null;
  }

  async list(): Promise<Activity[]> {
    return Array.from(this.storage.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.storage.delete(id);
  }
}

// Main activity registry system orchestrator
export class ActivityRegistrySystem {
  private registry: ActivityRegistry;
  private gitIntegration: GitIntegration;
  private patternRecognition: PatternRecognition;
  private storageAdapter: StorageAdapter;

  constructor(config: ActivityRegistryConfig) {
    this.registry = new ActivityRegistry(config);
    this.gitIntegration = new GitIntegration();
    this.patternRecognition = new PatternRecognition();
    this.storageAdapter = new InMemoryStorageAdapter();
  }

  getRegistry(): ActivityRegistry {
    return this.registry;
  }

  getGitIntegration(): GitIntegration {
    return this.gitIntegration;
  }

  getPatternRecognition(): PatternRecognition {
    return this.patternRecognition;
  }

  async searchActivities(query: string): Promise<SearchResult> {
    return this.registry.searchActivities(query);
  }

  async analyzePatterns(): Promise<void> {
    const activities = this.registry.getAllActivities();
    this.patternRecognition.analyzeActivityPatterns(activities);
  }

  async persistActivity(activity: Activity): Promise<void> {
    await this.storageAdapter.save(activity);
  }
}