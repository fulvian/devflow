/**
 * Agent Status Connector
 * Real-time connection to Unified Orchestrator for agent status and mode
 */

import { EventEmitter } from 'events';
import { AgentStatus, AgentInfo, AgentMode, FOOTER_COLORS } from './types/enhanced-footer-types.js';
import * as http from 'http';

export class AgentStatusConnector extends EventEmitter {
  private orchestratorUrl: string;
  private agentStatus: AgentStatus;
  private statusInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private timeout = 5000; // 5 second timeout

  constructor(orchestratorUrl: string = 'http://localhost:3005') {
    super();
    this.orchestratorUrl = orchestratorUrl;
    this.agentStatus = this.initializeState();
  }

  private initializeState(): AgentStatus {
    return {
      active: 0,
      total: 5, // Default: Claude + 4 other agents
      agents: [],
      mode: 'claude-only',
      timestamp: new Date()
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Test connessione iniziale
      await this.fetchAgentStatus();
      console.log(`🤖 Agent Status Connector initialized for ${this.orchestratorUrl}`);
      this.isInitialized = true;
    } catch (error) {
      // Fallback mode se orchestrator non disponibile
      console.log('🟡 Unified Orchestrator not available, using fallback mode');
      this.setFallbackMode();
      this.isInitialized = true;
    }
  }

  start(): void {
    if (!this.isInitialized) {
      throw new Error('Connector not initialized. Call initialize() first.');
    }

    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }

    // Aggiorna status ogni 15 secondi
    this.statusInterval = setInterval(() => {
      this.fetchAgentStatus().catch(error => {
        console.error('Error fetching agent status:', error);
        this.setFallbackMode();
      });
    }, 15000);

    console.log('🚀 Agent Status Connector started - checking every 15 seconds');
  }

  stop(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    console.log('⏹️ Agent Status Connector stopped');
  }

  private async fetchAgentStatus(): Promise<void> {
    try {
      const [agentData, modeData] = await Promise.all([
        this.makeRequest('/api/agents/status'),
        this.makeRequest('/api/mode/current')
      ]);

      const agents: AgentInfo[] = agentData.agents || [];
      const activeCount = agents.filter(a => a.status === 'active').length;

      this.agentStatus = {
        active: activeCount,
        total: agents.length || 5,
        agents: agents,
        mode: (modeData.mode as AgentMode) || 'claude-only',
        timestamp: new Date()
      };

      this.emit('statusUpdate', this.agentStatus);

    } catch (error) {
      // Fallback a modalità locale se API non disponibile
      this.setFallbackMode();
      throw error;
    }
  }

  private makeRequest(endpoint: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.orchestratorUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 3005,
        path: url.pathname,
        method: 'GET',
        timeout: this.timeout
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (parseError) {
            reject(new Error(`Failed to parse response: ${parseError}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.setTimeout(this.timeout);
      req.end();
    });
  }

  private setFallbackMode(): void {
    // Fallback: usa informazioni locali disponibili
    const localAgents = this.detectLocalAgents();

    this.agentStatus = {
      active: localAgents.filter(a => a.status === 'active').length,
      total: 5,
      agents: localAgents,
      mode: this.detectCurrentMode(),
      timestamp: new Date()
    };

    this.emit('statusUpdate', this.agentStatus);
  }

  private detectLocalAgents(): AgentInfo[] {
    const agents: AgentInfo[] = [];

    // Claude (sempre attivo in questa modalità)
    agents.push({
      name: 'Claude',
      status: 'active',
      type: 'claude'
    });

    // Check per altri agenti basato su PID files
    const agentTypes = [
      { name: 'Synthetic', type: 'synthetic' as const, pidFile: '.synthetic.pid' },
      { name: 'Gemini', type: 'cli' as const, pidFile: '.gemini.pid' },
      { name: 'Qwen', type: 'cli' as const, pidFile: '.qwen.pid' },
      { name: 'Codex', type: 'cli' as const, pidFile: '.codex.pid' }
    ];

    const fs = require('fs');
    agentTypes.forEach(agent => {
      let status: 'active' | 'inactive' = 'inactive';

      try {
        if (fs.existsSync(agent.pidFile)) {
          const pidContent = fs.readFileSync(agent.pidFile, 'utf-8').trim();
          if (pidContent === 'MCP_READY' || (parseInt(pidContent) > 0)) {
            status = 'active';
          }
        }
      } catch (error) {
        // Ignore errors, assume inactive
      }

      agents.push({
        name: agent.name,
        status,
        type: agent.type
      });
    });

    return agents;
  }

  private detectCurrentMode(): AgentMode {
    // Prova a leggere dalla configurazione o environment
    const envMode = process.env.DEVFLOW_AGENT_MODE as AgentMode;
    if (envMode && ['claude-only', 'all-mode', 'cli-only', 'synthetic-only'].includes(envMode)) {
      return envMode;
    }

    // Default fallback
    return 'claude-only';
  }

  getCurrentStatus(): AgentStatus {
    return { ...this.agentStatus };
  }

  getFormattedDisplay(): { count: string; mode: string } {
    const { active, total } = this.agentStatus;
    const countColor = active > 0 ? FOOTER_COLORS.PROGRESS_HIGH : FOOTER_COLORS.PROGRESS_LOW;
    const countDisplay = `${countColor}${active}${FOOTER_COLORS.RESET}/${total} Agents`;

    let modeColor: string;
    switch (this.agentStatus.mode) {
      case 'claude-only':
        modeColor = FOOTER_COLORS.MODE_CLAUDE;
        break;
      case 'all-mode':
        modeColor = FOOTER_COLORS.MODE_ALL;
        break;
      case 'cli-only':
        modeColor = FOOTER_COLORS.MODE_CLI;
        break;
      case 'synthetic-only':
        modeColor = FOOTER_COLORS.MODE_SYNTH;
        break;
      default:
        modeColor = FOOTER_COLORS.DIM;
    }

    const modeDisplay = `${modeColor}[${this.agentStatus.mode}]${FOOTER_COLORS.RESET}`;

    return { count: countDisplay, mode: modeDisplay };
  }

  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}