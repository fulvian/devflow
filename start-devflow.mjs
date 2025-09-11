#!/usr/bin/env node
/**
 * DevFlow Startup Script
 * Initializes DevFlow integration with Claude Code
 */

import { ClaudeAdapter } from '@devflow/claude-adapter';
import { SQLiteMemoryManager } from '@devflow/core';
import { SemanticSearchService } from '@devflow/claude-adapter';
import { PlatformHandoffEngine } from '@devflow/claude-adapter';

async function startDevFlow() {
  console.log('🚀 Starting DevFlow Universal Development State Manager...');
  
  try {
    // Initialize DevFlow adapter
    const adapter = new ClaudeAdapter({
      enableMCP: true,
      enableHandoff: true,
      verbose: true,
    });
    
    // Start MCP server
    await adapter.startMCPServer();
    
    // Health check
    const health = await adapter.healthCheck();
    console.log('📊 DevFlow Health Status:', health.status);
    console.log('🔧 Services:', Object.entries(health.services)
      .map(([service, status]) => `${service}: ${status ? '✅' : '❌'}`)
      .join(', '));
    
    if (health.status === 'healthy') {
      console.log('✅ DevFlow is ready for Claude Code sessions!');
      console.log('📝 Available MCP tools:');
      console.log('  - devflow_search: Search DevFlow memory');
      console.log('  - devflow_handoff: Handoff to other platforms');
      console.log('  - devflow_memory_store: Store important decisions');
      console.log('  - devflow_context_inject: Inject relevant context');
      console.log('  - devflow_analytics: Get performance metrics');
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down DevFlow...');
        await adapter.stopMCPServer();
        process.exit(0);
      });
      
      // Keep alive
      setInterval(() => {
        // Heartbeat to keep process alive
      }, 60000);
      
    } else {
      console.error('❌ DevFlow health check failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Failed to start DevFlow:', error);
    process.exit(1);
  }
}

// Start DevFlow
startDevFlow().catch(console.error);
