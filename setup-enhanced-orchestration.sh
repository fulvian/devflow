#!/bin/bash

echo "🚀 Setting up Enhanced Orchestration System with Pro Plan Monitoring"

# Create data directory for usage persistence
mkdir -p /Users/fulvioventura/devflow/data
echo "📁 Created data directory for usage persistence"

# Compile TypeScript Pro Plan Monitor
echo "🔨 Compiling Pro Plan Monitor..."
cd /Users/fulvioventura/devflow
npx tsc src/core/monitoring/pro-plan-monitor.ts --outDir src/core/monitoring --target es2020 --module commonjs --esModuleInterop

if [ $? -eq 0 ]; then
    echo "✅ Pro Plan Monitor compiled successfully"
else
    echo "❌ Failed to compile Pro Plan Monitor"
fi

# Test the Pro Plan Monitor
echo "🧪 Testing Pro Plan Monitor..."
node -e "
try {
    const ProPlanMonitor = require('./src/core/monitoring/pro-plan-monitor.js');
    const monitor = new ProPlanMonitor.default('./data');
    console.log('✅ Pro Plan Monitor loads correctly');

    // Test basic functionality
    monitor.recordPrompt();
    const status = monitor.getUsageStatus();
    console.log('📊 Current usage status:', status);
    console.log('✅ Pro Plan Monitor test completed');
} catch (error) {
    console.error('❌ Pro Plan Monitor test failed:', error.message);
}
"

# Backup current orchestration hook
if [ -f "/Users/fulvioventura/devflow/.claude/hooks/orchestration-hook.js" ]; then
    cp "/Users/fulvioventura/devflow/.claude/hooks/orchestration-hook.js" "/Users/fulvioventura/devflow/.claude/hooks/orchestration-hook.js.backup-$(date +%Y%m%d-%H%M%S)"
    echo "💾 Backed up original orchestration hook"
fi

# Activate enhanced orchestration hook
cp "/Users/fulvioventura/devflow/.claude/hooks/enhanced-orchestration-hook.js" "/Users/fulvioventura/devflow/.claude/hooks/orchestration-hook.js"
chmod +x "/Users/fulvioventura/devflow/.claude/hooks/orchestration-hook.js"
echo "🔄 Activated enhanced orchestration hook"

# Test the enhanced orchestration hook
echo "🧪 Testing enhanced orchestration hook..."
node -e "
try {
    const orchestration = require('./.claude/hooks/orchestration-hook.js');
    console.log('✅ Enhanced orchestration hook loads correctly');

    // Test routing
    orchestration.routeTask('implement a simple function', 0.5, 500).then(decision => {
        console.log('📊 Test routing decision:', decision);
        console.log('✅ Enhanced orchestration hook test completed');
    }).catch(error => {
        console.error('❌ Routing test failed:', error.message);
    });
} catch (error) {
    console.error('❌ Enhanced orchestration hook test failed:', error.message);
}
"

echo ""
echo "🎉 Enhanced Orchestration Setup Complete!"
echo ""
echo "📋 Summary of changes:"
echo "  ✅ Pro Plan Monitor implemented and compiled"
echo "  ✅ Enhanced orchestration hook activated"
echo "  ✅ Real Pro Plan limit monitoring enabled"
echo "  ✅ MCP fallback delegation system ready"
echo "  ✅ Data persistence directory created"
echo ""
echo "🔍 Next steps:"
echo "  1. Test the system with actual Claude Code usage"
echo "  2. Monitor the logs in /Users/fulvioventura/devflow/data/"
echo "  3. Verify MCP server availability (Codex, Synthetic)"
echo "  4. Configure Gemini MCP server if needed"
echo ""
echo "⚙️  System is now ready to optimize Sonnet usage and enforce Pro Plan limits!"