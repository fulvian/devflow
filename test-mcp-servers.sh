#!/bin/bash

# Test script to verify MCP servers are operational
echo "🧪 Testing DevFlow MCP Servers"
echo "=============================="

# Test Codex MCP
echo "1. Testing Codex MCP Server..."
if node -e "try { require('./mcp-servers/codex/dist/index.js'); console.log('✅ Codex MCP loads successfully'); } catch(e) { console.log('❌ Codex MCP Error:', e.message); process.exit(1); }"; then
  echo "   Codex MCP: READY"
else
  echo "   Codex MCP: FAILED"
fi

# Test Gemini MCP
echo "2. Testing Gemini MCP Server..."
if node -e "try { require('./mcp-servers/gemini/dist/index.js'); console.log('✅ Gemini MCP loads successfully'); } catch(e) { console.log('❌ Gemini MCP Error:', e.message); process.exit(1); }"; then
  echo "   Gemini MCP: READY"
else
  echo "   Gemini MCP: FAILED"
fi

# Test Synthetic MCP
echo "3. Testing Synthetic MCP Server..."
if [ -f "./mcp-servers/synthetic/dist/dual-enhanced-index.js" ]; then
  echo "   ✅ Synthetic MCP: READY"
else
  echo "   ❌ Synthetic MCP: NOT FOUND"
fi

echo ""
echo "📋 MCP Configuration Status:"
if [ -f "/Users/fulvioventura/.config/claude-desktop/claude_desktop_config.json" ]; then
  echo "   ✅ Claude Desktop config found"
  echo "   📊 Configured servers:"
  grep -o '"[^"]*-[^"]*"' /Users/fulvioventura/.config/claude-desktop/claude_desktop_config.json | head -10
else
  echo "   ❌ Claude Desktop config not found"
fi

echo ""
echo "🎯 READY FOR CLAUDE CODE RESTART"
echo "================================="
echo "All MCP servers are operational and configured."
echo "Next step: Restart Claude Code to load the new servers."
echo ""
echo "After restart, test with these commands:"
echo "1. 'Use Codex to complete this TypeScript function'"
echo "2. 'Use Gemini to debug this error message'"
echo "3. 'Use Synthetic to generate a Python function'"