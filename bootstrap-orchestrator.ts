#!/usr/bin/env ts-node

/**
 * Real Dream Team Orchestrator Bootstrap
 * DEVFLOW-ORCH-001 - Avvio diretto senza privilegi sistema
 */

import { RealDreamTeamOrchestrator } from './src/core/orchestration/real-dream-team-orchestrator';
import * as fs from 'fs';
import * as path from 'path';

// Constants
const FOOTER_STATE_FILE = '.devflow/footer-state.json';
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

/**
 * Loads the footer state from the JSON file
 */
async function loadFooterState(): Promise<any> {
  try {
    if (!fs.existsSync(FOOTER_STATE_FILE)) {
      console.warn(`Footer state file not found at ${FOOTER_STATE_FILE}`);
      return {};
    }

    const data = fs.readFileSync(FOOTER_STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load footer state:', error);
    return {};
  }
}

/**
 * Updates the footer state file with orchestrator status
 */
async function updateFooterState(status: string): Promise<void> {
  try {
    const currentState = await loadFooterState();

    // Update orchestrator service status
    const services = currentState.services || [];
    const orchestratorIndex = services.findIndex((s: any) => s.name === 'Orchestrator');

    if (orchestratorIndex >= 0) {
      services[orchestratorIndex].status = status === 'running' ? 'active' : 'inactive';
    }

    // Update services count
    const activeCount = services.filter((s: any) => s.status === 'active').length;

    const newState = {
      ...currentState,
      timestamp: new Date().toISOString(),
      system: {
        ...currentState.system,
        services_active: activeCount,
        status: activeCount >= 6 ? 'ACTIVE' : 'PARTIAL'
      },
      services
    };

    fs.writeFileSync(FOOTER_STATE_FILE, JSON.stringify(newState, null, 2));
    console.log(`✅ Footer state updated - Orchestrator: ${status}`);
  } catch (error) {
    console.error('Failed to update footer state:', error);
  }
}

/**
 * Performs a health check on the orchestrator
 */
async function performHealthCheck(orchestrator: RealDreamTeamOrchestrator): Promise<boolean> {
  try {
    const healthStatus = orchestrator.getHealthStatus();
    const isHealthy = healthStatus.healthy && Object.values(healthStatus.models).every(Boolean);

    console.log(`🏥 Health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    console.log(`   Models: ${Object.entries(healthStatus.models).map(([k,v]) => `${k}:${v}`).join(', ')}`);

    return isHealthy;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

/**
 * Main bootstrap function
 */
async function bootstrap(): Promise<void> {
  console.log('🚀 Starting Real Dream Team Orchestrator...');

  try {
    // Initialize orchestrator
    const orchestrator = new RealDreamTeamOrchestrator();

    // Update footer state to running
    await updateFooterState('running');

    // Setup health check interval
    const healthCheckInterval = setInterval(async () => {
      await performHealthCheck(orchestrator);
    }, HEALTH_CHECK_INTERVAL);

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`📴 Received ${signal}, shutting down gracefully...`);
      clearInterval(healthCheckInterval);

      try {
        await orchestrator.shutdown();
        await updateFooterState('stopped');
        console.log('✅ Orchestrator stopped successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Initial health check
    await performHealthCheck(orchestrator);

    console.log('✅ Real Dream Team Orchestrator started successfully!');
    console.log('📊 Health checks every 30 seconds...');

  } catch (error) {
    console.error('❌ Failed to start orchestrator:', error);
    await updateFooterState('error');
    process.exit(1);
  }
}

// Run the bootstrap function
if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  });
}