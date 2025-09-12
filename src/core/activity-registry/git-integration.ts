import { Activity } from './types';

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: Date;
  files: string[];
}

export class GitIntegration {
  private commits: GitCommit[] = [];

  async getRecentCommits(limit: number = 10): Promise<GitCommit[]> {
    // Mock implementation - in real usage would call git commands
    return this.commits.slice(0, limit);
  }

  async linkActivityToCommit(activity: Activity, commitHash: string): Promise<void> {
    // Mock implementation - in real usage would create git notes or tags
    console.log(`Linking activity ${activity.id} to commit ${commitHash}`);
  }

  async getActivitiesForCommit(commitHash: string): Promise<Activity[]> {
    // Mock implementation - in real usage would read git notes or tags
    return [];
  }

  private mockCommits(): GitCommit[] {
    return [
      {
        hash: 'abc123',
        message: 'feat: implement cognitive mapping',
        author: 'developer@example.com',
        date: new Date(),
        files: ['src/cognitive/index.ts']
      }
    ];
  }
}