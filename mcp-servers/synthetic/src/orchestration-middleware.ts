// src/orchestration/middleware.ts
import { EventEmitter } from 'events';
import { Socket } from 'net';
import { createHash } from 'crypto';

/**
 * Live Orchestration Middleware for MCP Synthetic Server
 * Integrates with running MCP server (PID 45426) to provide real-time task orchestration
 */

// Type definitions
interface TaskRequest {
  id: string;
  type: 'codex' | 'gemini' | 'synthetic';
  payload: any;
  metadata: {
    complexity: number;
    sonnetUsage: number;
    timestamp: number;
  };
}

interface AgentStatus {
  id: string;
  type: 'codex' | 'gemini' | 'synthetic';
  available: boolean;
  load: number;
}

interface OrchestrationConfig {
  mcpServerHost: string;
  mcpServerPort: number;
  monitoringInterval: number;
}

class LiveOrchestrationMiddleware extends EventEmitter {
  private mcpSocket: Socket | null = null;
  private agents: Map<string, AgentStatus> = new Map();
  private sessionData: Map<string, any> = new Map();
  private config: OrchestrationConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: OrchestrationConfig) {
    super();
    this.config = config;
    this.connectToMCP();
    this.startMonitoring();
  }

  /**
   * Establish connection to the running MCP Synthetic server
   */
  private connectToMCP(): void {
    this.mcpSocket = new Socket();
    
    this.mcpSocket.connect(this.config.mcpServerPort, this.config.mcpServerHost, () => {
      console.log(`Connected to MCP Synthetic server at ${this.config.mcpServerHost}:${this.config.mcpServerPort}`);
      this.emit('connected');
    });

    this.mcpSocket.on('data', (data) => {
      this.handleIncomingData(data.toString());
    });

    this.mcpSocket.on('error', (error) => {
      console.error('MCP Connection Error:', error);
      this.emit('error', error);
    });

    this.mcpSocket.on('close', () => {
      console.log('Connection to MCP server closed');
      this.emit('disconnected');
    });
  }

  /**
   * Handle incoming data from MCP server
   */
  private handleIncomingData(data: string): void {
    try {
      const requests = data.split('\n').filter(Boolean);
      
      for (const requestData of requests) {
        const taskRequest: TaskRequest = JSON.parse(requestData);
        this.processTask(taskRequest);
      }
    } catch (error) {
      console.error('Error parsing MCP data:', error);
      this.emit('error', error);
    }
  }

  /**
   * Process incoming task requests with intelligent routing
   */
  private processTask(request: TaskRequest): void {
    // Update session data
    this.updateSessionData(request);
    
    // Determine optimal agent based on task complexity and sonnet usage
    const agent = this.selectOptimalAgent(request);
    
    if (agent) {
      this.delegateTask(request, agent);
    } else {
      // Fallback to synthetic agent if no optimal agent found
      const syntheticAgent = this.getAvailableAgent('synthetic');
      if (syntheticAgent) {
        this.delegateTask(request, syntheticAgent);
      } else {
        console.warn('No available agents to handle task:', request.id);
        this.emit('task-unhandled', request);
      }
    }
  }

  /**
   * Select the most appropriate agent based on task requirements
   */
  private selectOptimalAgent(request: TaskRequest): AgentStatus | null {
    const { complexity, sonnetUsage } = request.metadata;
    
    // High complexity tasks should go to Codex
    if (complexity > 0.8) {
      return this.getAvailableAgent('codex');
    }
    
    // High sonnet usage tasks should go to Gemini
    if (sonnetUsage > 0.7) {
      return this.getAvailableAgent('gemini');
    }
    
    // Moderate complexity/usage tasks to Synthetic agents
    if (complexity > 0.4 || sonnetUsage > 0.4) {
      return this.getAvailableAgent('synthetic');
    }
    
    // Simple tasks can go to any available agent
    return this.getLeastLoadedAgent();
  }

  /**
   * Get an available agent of specific type
   */
  private getAvailableAgent(type: 'codex' | 'gemini' | 'synthetic'): AgentStatus | null {
    for (const [id, agent] of this.agents.entries()) {
      if (agent.type === type && agent.available && agent.load < 0.8) {
        return agent;
      }
    }
    return null;
  }

  /**
   * Get the least loaded available agent
   */
  private getLeastLoadedAgent(): AgentStatus | null {
    let leastLoaded: AgentStatus | null = null;
    
    for (const agent of this.agents.values()) {
      if (agent.available && (leastLoaded === null || agent.load < leastLoaded.load)) {
        leastLoaded = agent;
      }
    }
    
    return leastLoaded;
  }

  /**
   * Delegate task to selected agent
   */
  private delegateTask(request: TaskRequest, agent: AgentStatus): void {
    // Update agent load
    agent.load = Math.min(1.0, agent.load + 0.1);
    this.agents.set(agent.id, agent);
    
    // Create delegation message
    const delegationMessage = {
      taskId: request.id,
      agentId: agent.id,
      payload: request.payload,
      timestamp: Date.now()
    };
    
    // Send to MCP server
    if (this.mcpSocket && !this.mcpSocket.destroyed) {
      this.mcpSocket.write(JSON.stringify(delegationMessage) + '\n');
      console.log(`Task ${request.id} delegated to ${agent.type} agent ${agent.id}`);
      this.emit('task-delegated', { taskId: request.id, agentId: agent.id });
    }
  }

  /**
   * Update session data with sonnet usage and task information
   */
  private updateSessionData(request: TaskRequest): void {
    const sessionId = this.generateSessionId(request);
    
    const currentData = this.sessionData.get(sessionId) || {
      taskId: request.id,
      totalTasks: 0,
      sonnetUsageHistory: [],
      complexityHistory: []
    };
    
    currentData.totalTasks += 1;
    currentData.sonnetUsageHistory.push(request.metadata.sonnetUsage);
    currentData.complexityHistory.push(request.metadata.complexity);
    
    // Keep only last 100 entries
    if (currentData.sonnetUsageHistory.length > 100) {
      currentData.sonnetUsageHistory.shift();
      currentData.complexityHistory.shift();
    }
    
    this.sessionData.set(sessionId, currentData);
    this.emit('session-updated', { sessionId, data: currentData });
  }

  /**
   * Generate session ID based on request metadata
   */
  private generateSessionId(request: TaskRequest): string {
    const sessionKey = `${request.metadata.timestamp}-${request.payload.context || 'default'}`;
    return createHash('md5').update(sessionKey).digest('hex');
  }

  /**
   * Start monitoring agents and session data
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateAgentStatuses();
      this.emit('monitoring-update', {
        agentCount: this.agents.size,
        sessionCount: this.sessionData.size,
        activeTasks: Array.from(this.sessionData.values())
          .reduce((sum, session) => sum + session.totalTasks, 0)
      });
    }, this.config.monitoringInterval);
  }

  /**
   * Update agent statuses (in real implementation, this would query actual agents)
   */
  private updateAgentStatuses(): void {
    // In a real implementation, this would query actual agent statuses
    // For demo purposes, we'll simulate agent updates
    for (const [id, agent] of this.agents.entries()) {
      // Simulate load reduction over time
      agent.load = Math.max(0, agent.load - 0.05);
      this.agents.set(id, agent);
    }
  }

  /**
   * Register a new agent with the orchestration system
   */
  public registerAgent(agent: AgentStatus): void {
    this.agents.set(agent.id, agent);
    console.log(`Agent ${agent.id} registered as ${agent.type}`);
    this.emit('agent-registered', agent);
  }

  /**
   * Update agent status
   */
  public updateAgentStatus(agentId: string, status: Partial<AgentStatus>): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      Object.assign(agent, status);
      this.agents.set(agentId, agent);
      this.emit('agent-updated', agent);
    }
  }

  /**
   * Get current session data
   */
  public getSessionData(sessionId: string): any {
    return this.sessionData.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  public getAllSessions(): Map<string, any> {
    return new Map(this.sessionData);
  }

  /**
   * Gracefully shutdown the middleware
   */
  public shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.mcpSocket) {
      this.mcpSocket.destroy();
    }
    
    this.emit('shutdown');
  }
}

// Export types for external use
export {
  LiveOrchestrationMiddleware,
  TaskRequest,
  AgentStatus,
  OrchestrationConfig
};

// Default export
export default LiveOrchestrationMiddleware;