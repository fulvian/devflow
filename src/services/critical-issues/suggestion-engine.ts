import { Issue } from '../../types/critical-issues';
import { ContextMatcher } from './context-matcher';
import { RecommendationSystem } from './recommendation-system';

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  relevanceScore: number;
  implementationSteps: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  relatedIssues: string[];
}

export class SuggestionEngine {
  private contextMatcher: ContextMatcher;
  private recommendationSystem: RecommendationSystem;

  constructor() {
    this.contextMatcher = new ContextMatcher();
    this.recommendationSystem = new RecommendationSystem();
  }

  async generateSuggestions(issue: Issue): Promise<Suggestion[]> {
    // Get context-aware matches
    const contextMatches = await this.contextMatcher.findSimilarContexts(issue);
    
    // Generate recommendations based on context
    const recommendations = await this.recommendationSystem.generateRecommendations(
      issue,
      contextMatches
    );
    
    // Rank suggestions by relevance
    return this.rankSuggestions(recommendations);
  }

  private rankSuggestions(suggestions: Suggestion[]): Suggestion[] {
    return suggestions
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10); // Return top 10 suggestions
  }

  async updateSuggestions(issueId: string, codeChanges: string): Promise<Suggestion[]> {
    // Re-generate suggestions based on code changes
    // This would be called when code is updated in real-time
    const updatedIssue = await this.getIssueById(issueId);
    return this.generateSuggestions(updatedIssue);
  }

  private async getIssueById(issueId: string): Promise<Issue> {
    // Placeholder for actual implementation
    // This would fetch issue from database
    return {
      id: issueId,
      title: 'Sample Issue',
      description: 'Sample Description',
      severity: 'high',
      status: 'open',
      projectId: 'sample-project',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
