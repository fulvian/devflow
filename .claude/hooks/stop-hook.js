#!/usr/bin/env node

// Enhanced stop-hook: intelligent save + auto-commit
const path = require('path');
const { spawn } = require('child_process');

async function executeStopHook() {
    console.log('🔄 Running session stop sequence...');

    try {
        // 1. Execute intelligent save hook first
        console.log('📝 Running intelligent save hook...');
        require(path.resolve(__dirname, 'intelligent-save-hook.js'));

        // 2. Wait a moment for file operations to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 3. Execute auto-commit manager
        console.log('🤖 Checking for auto-commit opportunities...');
        const autoCommitPath = path.resolve(__dirname, 'auto-commit-manager.js');

        const autoCommit = spawn('node', [autoCommitPath], {
            stdio: ['pipe', 'inherit', 'inherit'],
            cwd: path.resolve(__dirname, '../..')
        });

        autoCommit.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Stop sequence completed successfully');
            } else {
                console.log('⚠️  Stop sequence completed with warnings');
            }
        });

    } catch (error) {
        console.error('❌ Error in stop hook:', error.message);
    }
}

// Execute if called directly
if (require.main === module) {
    executeStopHook();
} else {
    // Allow module export for testing
    module.exports = executeStopHook;
}