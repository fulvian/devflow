import { MemoryCache, MemoryBlock, MemoryType } from './memory-cache';

export interface HarvestedKnowledge {
  taskId: string;
  reasoningChain: string[];
  decisionTrail: DecisionPoint[];
  newPatterns: KnowledgePattern[];
  cognitiveUpdates: CognitiveUpdate[];
  metadata: {
    timestamp: number;
    confidence: number;
    source: string;
  };
}

export interface DecisionPoint {
  id: string;
  description: string;
  alternatives: string[];
  chosenPath: string;
  rationale: string;
}

export interface KnowledgePattern {
  id: string;
  pattern: string;
  examples: string[];
  confidence: number;
}

export interface CognitiveUpdate {
  id: string;
  type: 'insight' | 'correction' | 'optimization';
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export class HarvestingProtocol {
  private cache: MemoryCache;
  
  constructor(cache: MemoryCache) {
    this.cache = cache;
  }

  extractKnowledge(taskId: string, rawOutput: string): HarvestedKnowledge {
    // In a real implementation, this would use NLP to extract
    // reasoning chains, decision trails, and patterns
    // For now, we'll simulate extraction
    
    const knowledge: HarvestedKnowledge = {
      taskId,
      reasoningChain: this.extractReasoningChain(rawOutput),
      decisionTrail: this.extractDecisionTrail(rawOutput),
      newPatterns: this.extractPatterns(rawOutput),
      cognitiveUpdates: this.extractCognitiveUpdates(rawOutput),
      metadata: {
        timestamp: Date.now(),
        confidence: this.estimateConfidence(rawOutput),
        source: 'task_execution'
      }
    };
    
    return knowledge;
  }

  storeKnowledge(knowledge: HarvestedKnowledge): void {
    // Convert harvested knowledge to memory blocks
    const memoryBlocks = this.convertToMemoryBlocks(knowledge);
    
    // Store in cache
    memoryBlocks.forEach(block => {
      this.cache.set(block);
    });
  }

  processTaskOutput(taskId: string, rawOutput: string): void {
    const knowledge = this.extractKnowledge(taskId, rawOutput);
    this.storeKnowledge(knowledge);
  }

  private extractReasoningChain(output: string): string[] {
    // Simulate extraction of reasoning steps
    // In practice, this would use NLP techniques
    return [
      "Identified problem domain",
      "Retrieved relevant memories",
      "Applied known patterns",
      "Generated solution approach",
      "Validated solution consistency"
    ];
  }

  private extractDecisionTrail(output: string): DecisionPoint[] {
    // Simulate extraction of decision points
    return [
      {
        id: "dp_001",
        description: "Approach selection",
        alternatives: ["Rule-based", "Pattern matching", "Generative"],
        chosenPath: "Pattern matching",
        rationale: "Previous success with similar problems"
      }
    ];
  }

  private extractPatterns(output: string): KnowledgePattern[] {
    // Simulate pattern extraction
    return [
      {
        id: "kp_001",
        pattern: "Recursion termination pattern",
        examples: ["Factorial calculation", "Tree traversal"],
        confidence: 0.85
      }
    ];
  }

  private extractCognitiveUpdates(output: string): CognitiveUpdate[] {
    // Simulate cognitive updates
    return [
      {
        id: "cu_001",
        type: "insight",
        description: "Recursive approach more efficient for nested structures",
        impact: "medium"
      }
    ];
  }

  private estimateConfidence(output: string): number {
    // Simulate confidence estimation
    return 0.75;
  }

  private convertToMemoryBlocks(knowledge: HarvestedKnowledge): MemoryBlock[] {
    const blocks: MemoryBlock[] = [];
    
    // Convert reasoning chain
    blocks.push({
      id: `reasoning_${knowledge.taskId}`,
      content: knowledge.reasoningChain.join(' -> '),
      type: 'working',
      importance: knowledge.metadata.confidence,
      tokens: knowledge.reasoningChain.join(' ').split(' ').length,
      timestamp: knowledge.metadata.timestamp
    });
    
    // Convert key decisions
    knowledge.decisionTrail.forEach(decision => {
      blocks.push({
        id: `decision_${decision.id}`,
        content: `${decision.description}: ${decision.chosenPath} because ${decision.rationale}`,
        type: 'episodic',
        importance: 0.8,
        tokens: decision.description.split(' ').length + decision.rationale.split(' ').length,
        timestamp: knowledge.metadata.timestamp
      });
    });
    
    // Convert patterns
    knowledge.newPatterns.forEach(pattern => {
      blocks.push({
        id: `pattern_${pattern.id}`,
        content: `${pattern.pattern} with examples: ${pattern.examples.join(', ')}`,
        type: 'semantic',
        importance: pattern.confidence,
        tokens: pattern.pattern.split(' ').length + pattern.examples.join(' ').split(' ').length,
        timestamp: knowledge.metadata.timestamp
      });
    });
    
    return blocks;
  }
}
