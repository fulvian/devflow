#!/usr/bin/env node

/**
 * QUICK ORCHESTRATOR STATUS DISPLAY
 * Shows current orchestrator for Claude Code sessions
 */

// Load orchestration if not already loaded
try {
    if (!global.DEVFLOW_ORCHESTRATION) {
        require('./.claude/hooks/orchestration-hook.js');
    }
} catch(e) {
    console.log('❌ Orchestration not available');
    process.exit(1);
}

const orch = global.DEVFLOW_ORCHESTRATION;

function showQuickStatus() {
    const stats = orch.getStats();
    const sonnetUsage = parseFloat(stats.sonnetUsage);

    // Determine current orchestrator
    let orchestrator, status, emoji;

    if (sonnetUsage < 85) {
        orchestrator = 'SONNET'; status = 'OPTIMAL'; emoji = '🟢';
    } else if (sonnetUsage < 90) {
        orchestrator = 'SONNET'; status = 'WARNING'; emoji = '🟡';
    } else {
        const codexAvailable = orch.checkAgentAvailability('codex');
        const geminiAvailable = orch.checkAgentAvailability('gemini');

        if (codexAvailable) {
            orchestrator = 'CODEX'; status = 'CASCADE-1'; emoji = '🟠';
        } else if (geminiAvailable) {
            orchestrator = 'GEMINI'; status = 'CASCADE-2'; emoji = '🔴';
        } else {
            orchestrator = 'QWEN3-EMERGENCY'; status = 'CRITICAL'; emoji = '🚨';
        }
    }

    console.log(`\n${emoji} ORCHESTRATOR: ${orchestrator} (${status})`);
    console.log(`📊 SONNET: ${stats.sonnetUsage} | TASKS: ${stats.sessionTasks}`);
}

// Run
showQuickStatus();