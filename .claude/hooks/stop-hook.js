#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');

console.log('🔄 DevFlow Stop Hook - Starting verification sequence...');

async function executeStopHook() {
    try {
        // 1. Check if verification trigger exists
        const triggerPath = path.resolve(__dirname, '../../.devflow/verification-trigger.json');
        let shouldRunVerification = false;

        try {
            const fs = require('fs');
            if (fs.existsSync(triggerPath)) {
                const triggerData = JSON.parse(fs.readFileSync(triggerPath, 'utf8'));
                shouldRunVerification = triggerData.verification_enabled === true;
                console.log(`📋 Verification trigger found - enabled: ${shouldRunVerification}`);
            }
        } catch (error) {
            console.log('📋 No verification trigger found, skipping verification');
        }

        // 2. Run critical issues detection
        try {
            console.log('🔍 Running critical issues detection...');
            const bridgePath = path.resolve(__dirname, 'critical-issues-bridge.js');
            if (require('fs').existsSync(bridgePath)) {
                const detectionResult = execSync(`node "${bridgePath}" '{}'`, {
                    encoding: 'utf8',
                    timeout: 30000,
                    cwd: path.resolve(__dirname, '../..')
                });
                console.log('✅ Critical issues detection completed');
            } else {
                console.log('⚠️ Critical issues bridge not found, skipping detection');
            }
        } catch (error) {
            console.log(`⚠️ Critical issues detection failed: ${error.message}`);
        }

        // 3. Execute database session logging
        try {
            console.log('💾 Logging session to database...');
            const dbLoggerPath = path.resolve(__dirname, 'database-session-logger.py');
            if (require('fs').existsSync(dbLoggerPath)) {
                execSync(`python3 "${dbLoggerPath}"`, {
                    encoding: 'utf8',
                    timeout: 15000,
                    cwd: path.resolve(__dirname, '../..')
                });
                console.log('✅ Database logging completed');
            } else {
                console.log('⚠️ Database logger not found, skipping');
            }
        } catch (error) {
            console.log(`⚠️ Database logging failed: ${error.message}`);
        }

        // 4. Run Generic Task Verification Protocol if enabled
        if (shouldRunVerification) {
            console.log('🔬 Running Generic Task Verification Protocol...');
            try {
                const verificationHookPath = path.resolve(__dirname, 'enhanced-stop-hook-with-verification.js');
                if (require('fs').existsSync(verificationHookPath)) {
                    console.log('📋 Executing Generic Task Verification Protocol...');
                    const verificationResult = execSync(`node "${verificationHookPath}"`, {
                        encoding: 'utf8',
                        timeout: 120000, // 2 minutes timeout for comprehensive verification
                        cwd: path.resolve(__dirname, '../..')
                    });

                    console.log('🎯 Generic Task Verification Protocol output:');
                    console.log(verificationResult);
                    console.log('✅ Generic Task Verification Protocol completed successfully');
                } else {
                    console.log('⚠️ Generic Task Verification Protocol not found, using fallback verification');

                    // Fallback verification status
                    const verificationStatus = {
                        status: "completed",
                        timestamp: new Date().toISOString(),
                        task: "fallback-verification",
                        engine: "stop-hook-fallback",
                        verification_result: "limited_verification"
                    };

                    const fs = require('fs');
                    const statusPath = path.resolve(__dirname, '../../.devflow/verification-status.json');
                    fs.writeFileSync(statusPath, JSON.stringify(verificationStatus, null, 2));
                }
            } catch (error) {
                console.log(`⚠️ Generic Task Verification Protocol failed: ${error.message}`);

                // Create error status
                const errorStatus = {
                    status: "failed",
                    timestamp: new Date().toISOString(),
                    task: "verification-error",
                    engine: "stop-hook-error-handler",
                    verification_result: "verification_failed",
                    error: error.message
                };

                const fs = require('fs');
                const statusPath = path.resolve(__dirname, '../../.devflow/verification-status.json');
                fs.writeFileSync(statusPath, JSON.stringify(errorStatus, null, 2));
            }
        }

        console.log('🎉 Stop hook sequence completed');

    } catch (error) {
        console.error('❌ Error in stop hook:', error.message);
        process.exit(1);
    }
}

// Execute if called directly
if (require.main === module) {
    executeStopHook().then(() => {
        console.log('✅ Stop hook finished');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Stop hook failed:', error);
        process.exit(1);
    });
}

module.exports = executeStopHook;