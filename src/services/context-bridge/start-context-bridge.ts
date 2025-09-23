#!/usr/bin/env node

/**
 * Context Bridge Service Standalone Launcher
 *
 * Launches the Context Bridge Service on port 3007
 * Integrates embeddinggemma with SemanticMemoryService for enhanced context injection
 */

import { ContextBridgeService } from './context-bridge-service';

async function main() {
    try {
        console.log('🚀 Starting Context Bridge Service...');

        const service = new ContextBridgeService();
        await service.start();

        // Graceful shutdown handling
        const shutdown = async () => {
            console.log('🛑 Context Bridge Service shutting down...');
            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        console.error('❌ Failed to start Context Bridge Service:', error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});