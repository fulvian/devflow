#!/usr/bin/env node

/**
 * DEVFLOW ORCHESTRATOR DISPLAY
 * Shows current orchestrator/manager for each task in real-time
 */

// Load orchestration system
require('./.claude/hooks/orchestration-hook.js');

const orch = global.DEVFLOW_ORCHESTRATION;

console.log('\n🎯 DEVFLOW LIVE ORCHESTRATOR DISPLAY');
console.log('=' .repeat(60));

// Function to display current orchestrator status
function displayCurrentOrchestrator() {
    const stats = orch.getStats();

    // Determine current primary orchestrator based on usage
    let currentOrchestrator;
    let status;
    let color;

    const sonnetUsage = parseFloat(stats.sonnetUsage);

    if (sonnetUsage < 85) {
        currentOrchestrator = 'SONNET';
        status = 'OPTIMAL';
        color = '🟢';
    } else if (sonnetUsage < 90) {
        currentOrchestrator = 'SONNET';
        status = 'WARNING';
        color = '🟡';
    } else {
        // Check availability for cascade
        const codexAvailable = orch.checkAgentAvailability('codex');
        const geminiAvailable = orch.checkAgentAvailability('gemini');

        if (codexAvailable) {
            currentOrchestrator = 'CODEX';
            status = 'CASCADE-1';
            color = '🟠';
        } else if (geminiAvailable) {
            currentOrchestrator = 'GEMINI';
            status = 'CASCADE-2';
            color = '🔴';
        } else {
            currentOrchestrator = 'QWEN3-EMERGENCY';
            status = 'CRITICAL';
            color = '🚨';
        }
    }

    console.log(`\n${color} CURRENT ORCHESTRATOR: ${currentOrchestrator}`);
    console.log(`📊 STATUS: ${status}`);
    console.log(`⚡ SONNET USAGE: ${stats.sonnetUsage}`);
    console.log(`📈 SESSION TASKS: ${stats.sessionTasks}`);
    console.log(`🤖 ACTIVE: ${stats.orchestrationActive ? 'YES' : 'NO'}`);

    return { currentOrchestrator, status, sonnetUsage };
}

// Function to show agent specialization
function showAgentSpecialization() {
    console.log('\n🧠 AGENT SPECIALIZATION MAP:');
    console.log('-' .repeat(40));
    console.log('📋 PROJECT MANAGEMENT AGENTS:');
    console.log('  • SONNET    → Tech Lead, Architecture, Strategy');
    console.log('  • CODEX     → Implementation Manager, Bash Tasks');
    console.log('  • GEMINI    → Context Analyst, Large Analysis');
    console.log('');
    console.log('💻 CODING IMPLEMENTATION AGENTS:');
    console.log('  • QWEN3     → Advanced TypeScript, Complex Code');
    console.log('  • QWEN2.5   → Standard JavaScript, Quick Fixes');
    console.log('  • DEEPSEEK3 → Code Analysis, Debugging, Refactor');
}

// Function to simulate task routing and show orchestrator selection
function demonstrateTaskRouting() {
    console.log('\n🧪 LIVE TASK ROUTING DEMONSTRATION:');
    console.log('-' .repeat(50));

    const testTasks = [
        { desc: 'design system architecture', type: 'management' },
        { desc: 'implement REST API endpoints', type: 'coding' },
        { desc: 'coordinate team workflow', type: 'management' },
        { desc: 'debug authentication bug', type: 'coding' },
        { desc: 'analyze large codebase', type: 'management' }
    ];

    testTasks.forEach((task, index) => {
        const decision = orch.routeTask(task.desc, null, 1000);

        // Determine if it's management or coding agent
        const agentType = decision.selectedAgent.includes('synthetic') ? 'CODING' : 'MANAGEMENT';
        const emoji = agentType === 'CODING' ? '💻' : '📋';

        console.log(`\n${emoji} TASK ${index + 1}: "${task.desc}"`);
        console.log(`   → ROUTED TO: ${decision.selectedAgent.toUpperCase()}`);
        console.log(`   → AGENT TYPE: ${agentType}`);
        console.log(`   → REASON: ${decision.reason}`);

        // Show updated orchestrator status after each task
        const { currentOrchestrator, status } = displayCurrentOrchestrator();
        console.log(`   → ORCHESTRATOR NOW: ${currentOrchestrator} (${status})`);
    });
}

// Main display function
function runDisplay() {
    // Show current orchestrator
    displayCurrentOrchestrator();

    // Show agent specialization
    showAgentSpecialization();

    // Demonstrate task routing
    demonstrateTaskRouting();

    console.log('\n✅ DEVFLOW ORCHESTRATOR DISPLAY COMPLETED');
    console.log('=' .repeat(60));
}

// Export for use in other scripts
global.DEVFLOW_DISPLAY = {
    displayCurrentOrchestrator,
    showAgentSpecialization,
    demonstrateTaskRouting
};

// Run if called directly
if (require.main === module) {
    runDisplay();
}

module.exports = { displayCurrentOrchestrator, showAgentSpecialization, demonstrateTaskRouting };