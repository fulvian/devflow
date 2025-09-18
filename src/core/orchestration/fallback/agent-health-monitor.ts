interface AgentStatus {
  name: string;
  isHealthy: boolean;
  responseTime: number;
  lastChecked: Date;
  error?: string;
}

interface HealthCheckResult {
  allHealthy: boolean;
  agents: AgentStatus[];
}

class AgentHealthMonitor {
  private agentEndpoints = [
    { name: 'Claude Tech Lead', endpoint: 'mcp://claude-tech-lead/health' },
    { name: 'Codex Senior Dev', endpoint: 'mcp://codex-senior-dev/health' },
    { name: 'Gemini Doc Manager', endpoint: 'mcp://gemini-doc-manager/health' },
    { name: 'Qwen QA Specialist', endpoint: 'mcp://qwen-qa-specialist/health' }
  ];

  async performHealthCheck(agentEndpoint: string): Promise<{ isHealthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(agentEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        return { 
          isHealthy: data.status === 'healthy', 
          responseTime 
        };
      } else {
        return { 
          isHealthy: false, 
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (error instanceof Error && error.name === 'AbortError') {
        return { 
          isHealthy: false, 
          responseTime,
          error: 'Timeout during health check'
        };
      }
      
      return { 
        isHealthy: false, 
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async performRecovery(agentName: string): Promise<boolean> {
    try {
      // Find the agent endpoint
      const agent = this.agentEndpoints.find(a => a.name === agentName);
      if (!agent) {
        throw new Error(`Unknown agent: ${agentName}`);
      }
      
      // Attempt recovery through restart endpoint
      const response = await fetch(`${agent.endpoint.replace('/health', '/restart')}`, {
        method: 'POST',
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.status === 'restarted';
      }
      
      return false;
    } catch (error) {
      console.error(`Recovery failed for ${agentName}:`, error);
      return false;
    }
  }

  async checkAllAgents(): Promise<HealthCheckResult> {
    const agentChecks = this.agentEndpoints.map(async (agent) => {
      const result = await this.performHealthCheck(agent.endpoint);
      return {
        name: agent.name,
        ...result,
        lastChecked: new Date()
      };
    });
    
    const agents = await Promise.all(agentChecks);
    const allHealthy = agents.every(agent => agent.isHealthy);
    
    return {
      allHealthy,
      agents
    };
  }

  async getAgentAvailability(agentName: string): Promise<boolean> {
    const agent = this.agentEndpoints.find(a => a.name === agentName);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}`);
    }
    
    const result = await this.performHealthCheck(agent.endpoint);
    return result.isHealthy;
  }

  async measureResponseTime(agentName: string): Promise<number> {
    const agent = this.agentEndpoints.find(a => a.name === agentName);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentName}`);
    }
    
    const result = await this.performHealthCheck(agent.endpoint);
    return result.responseTime;
  }
}

export default AgentHealthMonitor;
export { AgentHealthMonitor, type AgentStatus, type HealthCheckResult };
