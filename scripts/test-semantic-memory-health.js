#!/usr/bin/env node
/**
 * Test script for Enhanced Semantic Memory System Health
 * Simple Node.js script to validate Phase 1 implementation
 */

const path = require('path');
const fs = require('fs');

async function testSystemHealth() {
    console.log('🧠 Enhanced Semantic Memory System Health Check');
    console.log('================================================');

    // Basic checks first
    const checks = {
        ollama_service: await checkOllamaService(),
        database_file: checkDatabaseFile(),
        typescript_files: checkTypeScriptFiles(),
        hook_integration: checkHookIntegration()
    };

    // Print results
    console.log('\nComponent Status:');
    Object.entries(checks).forEach(([component, status]) => {
        const icon = status.healthy ? '✅' : '❌';
        console.log(`${icon} ${component.replace(/_/g, ' ')}: ${status.message}`);
    });

    const overallHealth = Object.values(checks).every(c => c.healthy);
    console.log('\nOverall System Status:');
    console.log(overallHealth ? '✅ HEALTHY - System ready for Phase 2 implementation'
                              : '❌ ISSUES - Review failed components above');

    console.log('\nNext Steps:');
    if (overallHealth) {
        console.log('  1. System is ready for Context Injection Intelligence integration');
        console.log('  2. Hook system integration can proceed');
        console.log('  3. Consider running performance benchmarks');
    } else {
        console.log('  1. Address failed components listed above');
        console.log('  2. Ensure Ollama service is running: `ollama serve`');
        console.log('  3. Verify database and TypeScript files are properly configured');
    }
}

async function checkOllamaService() {
    try {
        // Simple HTTP check to Ollama service
        const response = await fetch('http://localhost:11434/api/tags', {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            const hasEmbeddingModel = data.models?.some(m =>
                m.name.includes('embeddinggemma') || m.name.includes('embedding')
            );

            return {
                healthy: hasEmbeddingModel,
                message: hasEmbeddingModel
                    ? 'Service running with embedding model available'
                    : 'Service running but embedding model not found'
            };
        } else {
            return {
                healthy: false,
                message: `HTTP ${response.status}: Service not responding correctly`
            };
        }
    } catch (error) {
        return {
            healthy: false,
            message: `Connection failed: ${error.message || 'Service not running'}`
        };
    }
}

function checkDatabaseFile() {
    const dbPath = './data/devflow_unified.sqlite';

    try {
        if (fs.existsSync(dbPath)) {
            const stats = fs.statSync(dbPath);
            const sizeKB = Math.round(stats.size / 1024);

            return {
                healthy: true,
                message: `Database file exists (${sizeKB} KB)`
            };
        } else {
            return {
                healthy: false,
                message: 'Database file not found at ./data/devflow_unified.sqlite'
            };
        }
    } catch (error) {
        return {
            healthy: false,
            message: `Database check failed: ${error.message}`
        };
    }
}

function checkTypeScriptFiles() {
    const requiredFiles = [
        './src/core/semantic-memory/enhanced-memory-system.ts',
        './src/core/semantic-memory/ollama-embedding-service.ts',
        './src/core/semantic-memory/semantic-memory-engine.ts',
        './src/core/semantic-memory/semantic-search-engine.ts',
        './src/core/semantic-memory/memory-clustering-engine.ts',
        './src/core/semantic-memory/context-injection-intelligence-engine.ts',
        './src/core/semantic-memory/memory-hook-integration-bridge.ts'
    ];

    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));

    if (missingFiles.length === 0) {
        return {
            healthy: true,
            message: `All ${requiredFiles.length} TypeScript components found`
        };
    } else {
        return {
            healthy: false,
            message: `Missing ${missingFiles.length} files: ${missingFiles.join(', ')}`
        };
    }
}

function checkHookIntegration() {
    const hookFiles = [
        './.claude/hooks/enhanced-memory-integration.py',
        './.claude/hooks/dual-trigger-context-manager.py'
    ];

    const existingHooks = hookFiles.filter(file => fs.existsSync(file));

    if (existingHooks.length >= 1) {
        return {
            healthy: true,
            message: `Hook integration ready (${existingHooks.length}/${hookFiles.length} hooks found)`
        };
    } else {
        return {
            healthy: false,
            message: 'Hook integration files not found'
        };
    }
}

// Make fetch available in older Node.js versions
if (typeof fetch === 'undefined') {
    global.fetch = async (url, options = {}) => {
        const http = url.startsWith('https:') ? require('https') : require('http');
        const urlObj = new URL(url);

        return new Promise((resolve, reject) => {
            const req = http.request({
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {}
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        json: async () => JSON.parse(data)
                    });
                });
            });

            req.on('error', reject);
            req.end();
        });
    };
}

// Run the health check
testSystemHealth().catch(console.error);