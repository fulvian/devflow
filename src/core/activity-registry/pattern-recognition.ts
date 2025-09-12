import { Activity } from './types';

export interface Pattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  confidence: number;
  activities: string[]; // activity IDs
}

export class PatternRecognition {
  private patterns: Pattern[] = [];

  analyzeActivityPatterns(activities: Activity[]): Pattern[] {
    // Mock pattern recognition - in real usage would use ML algorithms
    const patterns: Pattern[] = [];
    
    // Group by category
    const categoryGroups = activities.reduce((groups, activity) => {
      if (!groups[activity.category]) {
        groups[activity.category] = [];
      }
      groups[activity.category].push(activity);
      return groups;
    }, {} as Record<string, Activity[]>);
    
    // Create patterns for frequent categories
    Object.entries(categoryGroups).forEach(([category, categoryActivities]) => {
      if (categoryActivities.length >= 3) {
        patterns.push({
          id: `pattern-${category}-${Date.now()}`,
          name: `Frequent ${category} activities`,
          description: `Pattern of ${category} activities occurring frequently`,
          frequency: categoryActivities.length,
          confidence: 0.8,
          activities: categoryActivities.map(a => a.id)
        });
      }
    });
    
    this.patterns = patterns;
    return patterns;
  }

  getPatterns(): Pattern[] {
    return this.patterns;
  }

  getPatternsForActivity(activityId: string): Pattern[] {
    return this.patterns.filter(pattern => 
      pattern.activities.includes(activityId)
    );
  }
}