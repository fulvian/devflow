#!/usr/bin/env node

/**
 * Session Retry Service - Entry point for the smart session retry system
 * This is the main executable that was missing and causing the startup error
 */

const path = require('path');
const fs = require('fs');

// Determine if we're running from source or compiled
const isCompiled = __filename.includes('/dist/');
const hubPath = isCompiled
  ? path.join(__dirname, '../../services/smart-session-retry-hub.js')
  : path.join(__dirname, '../../services/smart-session-retry-hub.ts');

async function startSessionRetryService() {
  console.log('🔄 Starting Session Retry Service...');
  console.log(`📍 Entry point: ${__filename}`);
  console.log(`🎯 Hub path: ${hubPath}`);

  try {
    // Check if hub file exists
    if (!fs.existsSync(hubPath)) {
      console.error(`❌ Hub file not found: ${hubPath}`);

      // Try alternative paths
      const alternatives = [
        path.join(__dirname, '../../../dist/services/smart-session-retry-hub.js'),
        path.join(__dirname, '../../services/smart-session-retry-hub.js'),
        path.join(process.cwd(), 'dist/services/smart-session-retry-hub.js'),
        path.join(process.cwd(), 'src/services/smart-session-retry-hub.ts')
      ];

      let foundPath = null;
      for (const altPath of alternatives) {
        if (fs.existsSync(altPath)) {
          foundPath = altPath;
          console.log(`✅ Found hub at alternative path: ${altPath}`);
          break;
        }
      }

      if (!foundPath) {
        console.error('❌ Could not locate smart-session-retry-hub in any expected location');
        process.exit(1);
      }

      // Use the found path
      const SmartSessionRetryHub = require(foundPath).default || require(foundPath).SmartSessionRetryHub;
      const hub = new SmartSessionRetryHub();
      await hub.start();

    } else {
      // Load and start the hub
      if (hubPath.endsWith('.ts')) {
        // Running from TypeScript source - use ts-node
        require('ts-node/register');
      }

      const SmartSessionRetryHub = require(hubPath).default || require(hubPath).SmartSessionRetryHub;
      const hub = new SmartSessionRetryHub();
      await hub.start();
    }

    console.log('✅ Session Retry Service started successfully');

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n📞 Session Retry Service received SIGINT, shutting down...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n📞 Session Retry Service received SIGTERM, shutting down...');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start Session Retry Service:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Handle direct execution
if (require.main === module) {
  console.log('🚀 Session Retry Service - Direct execution mode');
  console.log(`🔧 Node version: ${process.version}`);
  console.log(`📂 Working directory: ${process.cwd()}`);
  console.log(`📍 Script location: ${__filename}`);

  startSessionRetryService().catch((error) => {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  });
}

module.exports = {
  startSessionRetryService
};