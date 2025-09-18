import { AgentResponse } from '../../types/agent.types';
import { Task } from '../../types/task.types';
import { AdherenceResult } from '../../types/verification.types';

export class PlanAdherenceValidator {
  async validateAdherence(
    response: AgentResponse,
    originalTask: Task
  ): Promise<AdherenceResult> {
    // Check if implementation matches task objectives
    const objectiveMatch = this.validateObjectives(
      response.content,
      originalTask.objectives
    );

    // Validate technical requirements compliance
    const techRequirementsMet = this.validateTechnicalRequirements(
      response.code || '',
      originalTask.technicalRequirements
    );

    // Check deliverables
    const deliverablesMatch = this.validateDeliverables(
      response.deliverables || [],
      originalTask.expectedDeliverables
    );

    // Calculate adherence score (0-100)
    const score = this.calculateAdherenceScore(
      objectiveMatch,
      techRequirementsMet,
      deliverablesMatch
    );

    const isAdherent = score >= 80; // 80% threshold for adherence
    const feedback = this.generateAdherenceFeedback(
      objectiveMatch,
      techRequirementsMet,
      deliverablesMatch
    );

    return {
      isAdherent,
      score,
      feedback,
      details: {
        objectives: objectiveMatch,
        technicalRequirements: techRequirementsMet,
        deliverables: deliverablesMatch
      }
    };
  }

  private validateObjectives(
    content: string,
    objectives: string[]
  ): { matched: number; total: number } {
    let matched = 0;
    
    for (const objective of objectives) {
      // Simple keyword matching - in practice, this would use NLP
      if (content.toLowerCase().includes(objective.toLowerCase())) {
        matched++;
      }
    }
    
    return { matched, total: objectives.length };
  }

  private validateTechnicalRequirements(
    code: string,
    requirements: string[]
  ): { matched: number; total: number } {
    let matched = 0;
    
    for (const requirement of requirements) {
      if (code.includes(requirement)) {
        matched++;
      }
    }
    
    return { matched, total: requirements.length };
  }

  private validateDeliverables(
    actual: string[],
    expected: string[]
  ): { matched: number; total: number } {
    let matched = 0;
    
    for (const item of expected) {
      if (actual.includes(item)) {
        matched++;
      }
    }
    
    return { matched, total: expected.length };
  }

  private calculateAdherenceScore(
    objectives: { matched: number; total: number },
    techReqs: { matched: number; total: number },
    deliverables: { matched: number; total: number }
  ): number {
    if (objectives.total === 0 && techReqs.total === 0 && deliverables.total === 0) {
      return 100;
    }
    
    const objScore = objectives.total > 0 
      ? (objectives.matched / objectives.total) * 100 
      : 0;
      
    const techScore = techReqs.total > 0 
      ? (techReqs.matched / techReqs.total) * 100 
      : 0;
      
    const delivScore = deliverables.total > 0 
      ? (deliverables.matched / deliverables.total) * 100 
      : 0;
    
    // Weighted average: 40% objectives, 40% tech requirements, 20% deliverables
    return Math.round(
      (objScore * 0.4) + 
      (techScore * 0.4) + 
      (delivScore * 0.2)
    );
  }

  private generateAdherenceFeedback(
    objectives: { matched: number; total: number },
    techReqs: { matched: number; total: number },
    deliverables: { matched: number; total: number }
  ): string[] {
    const feedback: string[] = [];
    
    if (objectives.matched < objectives.total) {
      feedback.push(`Missing ${objectives.total - objectives.matched} of ${objectives.total} objectives`);
    }
    
    if (techReqs.matched < techReqs.total) {
      feedback.push(`Missing ${techReqs.total - techReqs.matched} of ${techReqs.total} technical requirements`);
    }
    
    if (deliverables.matched < deliverables.total) {
      feedback.push(`Missing ${deliverables.total - deliverables.matched} of ${deliverables.total} deliverables`);
    }
    
    return feedback;
  }
}
