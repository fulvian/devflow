import { CircuitBreaker } from '../utils/circuit-breaker';
import { AgentHealthMonitor } from './fallback/agent-health-monitor';
import { MCPClient, ModelType } from './mcp-client';

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
  private mcpClient: MCPClient;
  private isConnected: boolean = false;

  constructor() {
    this.techLeadBreaker = new CircuitBreaker('claude-tech-lead', 5, 60000);
    this.seniorDevBreaker = new CircuitBreaker('codex-senior-dev', 5, 60000);
    this.docManagerBreaker = new CircuitBreaker('gemini-doc-manager', 5, 60000);
    this.qaSpecialistBreaker = new CircuitBreaker('qwen-qa-specialist', 5, 60000);
    
    this.healthMonitor = new AgentHealthMonitor();
    
    // Initialize MCP client with orchestrator connection
    this.mcpClient = new MCPClient(
      process.env.MCP_ORCHESTRATOR_URL || 'ws://localhost:3000',
      process.env.MCP_API_KEY || 'devflow-api-key'
    );
  }

  /**
   * Connect to the MCP orchestrator
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }
    
    try {
      await this.mcpClient.connect();
      await this.mcpClient.initializeSession({
        projectName: 'DevFlow Dream Team',
        createdAt: new Date().toISOString()
      });
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to connect to MCP orchestrator:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP orchestrator
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }
    
    try {
      await this.mcpClient.closeSession();
      await this.mcpClient.disconnect();
      this.isConnected = false;
    } catch (error) {
      console.error('Error disconnecting from MCP orchestrator:', error);
    }
  }

  async callClaudeTechLead(request: MCPRequest): Promise<DreamTeamResponse> {
    return this.techLeadBreaker.execute(async () => {
      const startTime = Date.now();
      
      try {
        // Ensure we're connected to the MCP orchestrator
        if (!this.isConnected) {
          await this.connect();
        }
        
        // Send message to Sonnet model (Tech Lead)
        const content = JSON.stringify({
          prompt: request.prompt,
          context: request.context
        });
        
        const response = await this.mcpClient.sendMessageToModel(
          content,
          'sonnet'
        );

        return {
          content: response,
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
        // Ensure we're connected to the MCP orchestrator
        if (!this.isConnected) {
          await this.connect();
        }
        
        // Send message to Codex model (Senior Developer)
        const content = JSON.stringify({
          prompt: request.prompt,
          context: request.context
        });
        
        const response = await this.mcpClient.sendMessageToModel(
          content,
          'codex'
        );

        return {
          content: response,
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
        // Ensure we're connected to the MCP orchestrator
        if (!this.isConnected) {
          await this.connect();
        }
        
        // Send message to Gemini model (Documentation Manager)
        const content = JSON.stringify({
          prompt: request.prompt,
          context: request.context
        });
        
        const response = await this.mcpClient.sendMessageToModel(
          content,
          'gemini'
        );

        return {
          content: response,
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
        // Ensure we're connected to the MCP orchestrator
        if (!this.isConnected) {
          await this.connect();
        }
        
        // Send message to Qwen model (QA Specialist)
        const content = JSON.stringify({
          prompt: request.prompt,
          context: request.context
        });
        
        const response = await this.mcpClient.sendMessageToModel(
          content,
          'qwen'
        );

        return {
          content: response,
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
    
    try {
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
    } catch (error) {
      console.error('Error executing Dream Team workflow:', error);
      throw error;
    } finally {
      // Ensure we disconnect after workflow completion
      await this.disconnect();
    }
  }
}

export default DreamTeamOrchestrator;