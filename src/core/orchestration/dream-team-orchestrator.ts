import { CircuitBreaker } from '../utils/circuit-breaker';
import { AgentHealthMonitor } from './fallback/agent-health-monitor';

interface DreamTeamResponse {
  content: string;
  metadata: {
    role: string;
    timestamp: Date;
    executionTime: number;
  };
}

interface MCPRequest {
  prompt: string;
  context?: any;
  timeout?: number;
}

class DreamTeamOrchestrator {
  private techLeadBreaker: CircuitBreaker;
  private seniorDevBreaker: CircuitBreaker;
  private docManagerBreaker: CircuitBreaker;
  private qaSpecialistBreaker: CircuitBreaker;
  
  private healthMonitor: AgentHealthMonitor;

  constructor() {
    this.techLeadBreaker = new CircuitBreaker('claude-tech-lead', 5, 60000);
    this.seniorDevBreaker = new CircuitBreaker('codex-senior-dev', 5, 60000);
    this.docManagerBreaker = new CircuitBreaker('gemini-doc-manager', 5, 60000);
    this.qaSpecialistBreaker = new CircuitBreaker('qwen-qa-specialist', 5, 60000);
    
    this.healthMonitor = new AgentHealthMonitor();
  }

  async callClaudeTechLead(request: MCPRequest): Promise<DreamTeamResponse> {
    return this.techLeadBreaker.execute(async () => {
      const startTime = Date.now();
      
      try {
        // Real MCP tool call
        const response = await fetch('mcp://claude-tech-lead/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: request.prompt,
            context: request.context,
            timeout: request.timeout || 30000
          }),
          signal: AbortSignal.timeout(request.timeout || 30000)
        });

        if (!response.ok) {
          throw new Error(`Tech Lead service error: ${response.status}`);
        }

        const data = await response.json();
        
        return {
          content: data.analysis,
          metadata: {
            role: 'Tech Lead',
            timestamp: new Date(),
            executionTime: Date.now() - startTime
          }
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Tech Lead request timeout');
        }
        throw error;
      }
    });
  }

  async callCodexSeniorDev(request: MCPRequest): Promise<DreamTeamResponse> {
    return this.seniorDevBreaker.execute(async () => {
      const startTime = Date.now();
      
      try {
        // Real MCP tool call
        const response = await fetch('mcp://codex-senior-dev/implement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: request.prompt,
            context: request.context,
            timeout: request.timeout || 45000
          }),
          signal: AbortSignal.timeout(request.timeout || 45000)
        });

        if (!response.ok) {
          throw new Error(`Senior Dev service error: ${response.status}`);
        }

        const data = await response.json();
        
        return {
          content: data.implementation,
          metadata: {
            role: 'Senior Developer',
            timestamp: new Date(),
            executionTime: Date.now() - startTime
          }
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Senior Dev request timeout');
        }
        throw error;
      }
    });
  }

  async callGeminiDocManager(request: MCPRequest): Promise<DreamTeamResponse> {
    return this.docManagerBreaker.execute(async () => {
      const startTime = Date.now();
      
      try {
        // Real MCP tool call
        const response = await fetch('mcp://gemini-doc-manager/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: request.prompt,
            context: request.context,
            timeout: request.timeout || 30000
          }),
          signal: AbortSignal.timeout(request.timeout || 30000)
        });

        if (!response.ok) {
          throw new Error(`Doc Manager service error: ${response.status}`);
        }

        const data = await response.json();
        
        return {
          content: data.documentation,
          metadata: {
            role: 'Documentation Manager',
            timestamp: new Date(),
            executionTime: Date.now() - startTime
          }
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Doc Manager request timeout');
        }
        throw error;
      }
    });
  }

  async callQwenQASpecialist(request: MCPRequest): Promise<DreamTeamResponse> {
    return this.qaSpecialistBreaker.execute(async () => {
      const startTime = Date.now();
      
      try {
        // Real MCP tool call
        const response = await fetch('mcp://qwen-qa-specialist/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: request.prompt,
            context: request.context,
            timeout: request.timeout || 30000
          }),
          signal: AbortSignal.timeout(request.timeout || 30000)
        });

        if (!response.ok) {
          throw new Error(`QA Specialist service error: ${response.status}`);
        }

        const data = await response.json();
        
        return {
          content: data.validation,
          metadata: {
            role: 'QA Specialist',
            timestamp: new Date(),
            executionTime: Date.now() - startTime
          }
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('QA Specialist request timeout');
        }
        throw error;
      }
    });
  }

  async executeDreamTeamWorkflow(task: string): Promise<DreamTeamResponse[]> {
    const results: DreamTeamResponse[] = [];
    
    // Check agent health before execution
    const healthStatus = await this.healthMonitor.checkAllAgents();
    
    if (!healthStatus.allHealthy) {
      throw new Error('One or more Dream Team agents are not healthy');
    }
    
    // Execute workflow in sequence
    const techLeadResponse = await this.callClaudeTechLead({
      prompt: `Analyze this technical task: ${task}`
    });
    results.push(techLeadResponse);
    
    const seniorDevResponse = await this.callCodexSeniorDev({
      prompt: `Implement solution for: ${task}`,
      context: { analysis: techLeadResponse.content }
    });
    results.push(seniorDevResponse);
    
    const docManagerResponse = await this.callGeminiDocManager({
      prompt: `Document implementation for: ${task}`,
      context: { implementation: seniorDevResponse.content }
    });
    results.push(docManagerResponse);
    
    const qaSpecialistResponse = await this.callQwenQASpecialist({
      prompt: `Validate solution for: ${task}`,
      context: { 
        analysis: techLeadResponse.content,
        implementation: seniorDevResponse.content,
        documentation: docManagerResponse.content
      }
    });
    results.push(qaSpecialistResponse);
    
    return results;
  }
}

export default DreamTeamOrchestrator;
