#!/bin/bash
# DevFlow Debug Script
# Comprehensive system health check and troubleshooting

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Header
echo -e "${BLUE}🔍 DevFlow System Debug Report${NC}"
echo "=================================="

# 1. Process Status
echo -e "\n${BLUE}📊 Process Status${NC}"
echo "CCR Process:"
if [ -f "../.ccr.pid" ]; then
    PID=$(cat "../.ccr.pid")
    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}✅ Running (PID: $PID)${NC}"
    else
        echo -e "${RED}❌ Not running (stale PID)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ No PID file found${NC}"
fi

# 2. Port Status
echo -e "\n${BLUE}🌐 Port Status${NC}"
PORTS=(3000 8000 8001 8002 8003 3456 4000 5000)
for port in "${PORTS[@]}"; do
    if lsof -i:$port >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Port $port: In use${NC}"
    else
        echo -e "${RED}❌ Port $port: Available${NC}"
    fi
done

# 3. Log Files
echo -e "\n${BLUE}📋 Recent Log Activity${NC}"
if [ -d "../logs" ]; then
    echo "Recent log files:"
    ls -la ../logs/ | head -10
else
    echo -e "${YELLOW}⚠️ No logs directory found${NC}"
fi

# 4. Configuration
echo -e "\n${BLUE}⚙️ Configuration Status${NC}"
if [ -f "../.env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
else
    echo -e "${YELLOW}⚠️ No .env file found${NC}"
fi

# 5. Emergency CCR Status
echo -e "\n${BLUE}🚨 Emergency CCR Status${NC}"
if [ -f "../emergency-ccr-cli.mjs" ]; then
    echo -e "${GREEN}✅ Emergency CCR CLI found${NC}"
    node ../emergency-ccr-cli.mjs status 2>/dev/null || echo -e "${RED}❌ Status check failed${NC}"
else
    echo -e "${RED}❌ Emergency CCR CLI not found${NC}"
fi

# 6. System Resources
echo -e "\n${BLUE}💻 System Resources${NC}"
echo "Memory usage:"
free -h 2>/dev/null || echo "Memory info not available"
echo "Disk usage:"
df -h . 2>/dev/null || echo "Disk info not available"

echo -e "\n${BLUE}🎯 Debug Complete${NC}"