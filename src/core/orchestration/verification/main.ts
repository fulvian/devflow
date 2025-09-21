#!/usr/bin/env node
/**
 * Verification System Main Entry Point - DEVFLOW-VERIFY-001
 * Starts the 4-agent Synthetic verification system
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

import { ContinuousVerificationLoop } from './continuous-verification-loop';

async function main() {
  console.log('🔄 Starting DevFlow Verification System (4 AI Agents)...');

  const verificationLoop = new ContinuousVerificationLoop();

  // Setup graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down verification system...');
    await verificationLoop.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down verification system...');
    await verificationLoop.stop();
    process.exit(0);
  });

  try {
    await verificationLoop.start();
    console.log('✅ Verification System started successfully');

    // Keep process alive
    setInterval(() => {
      // Health check - service is alive
    }, 30000);
  } catch (error) {
    console.error('💥 Failed to start verification system:', error);
    process.exit(1);
  }
}

main().catch(console.error);