#!/bin/bash

# DevFlow v3.1 Phase 1 - Production Testing Script
# Comprehensive testing before production deployment

echo "🚀 DevFlow v3.1 Phase 1 - Production Testing Suite"
echo "==============================================="

# Set environment
export NODE_ENV=testing
export DEVFLOW_VERSION=v3.1.0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Environment: ${NODE_ENV}${NC}"
echo -e "${BLUE}Version: ${DEVFLOW_VERSION}${NC}"
echo ""

# Test 1: Dependencies Check
echo -e "${YELLOW}[1/6] Checking Dependencies...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dependencies OK${NC}"
echo ""

# Test 2: Build Check
echo -e "${YELLOW}[2/6] Building DevFlow...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# Test 3: Type Check
echo -e "${YELLOW}[3/6] Type Checking...${NC}"
if npx tsc --noEmit; then
    echo -e "${GREEN}✅ Type check passed${NC}"
else
    echo -e "${RED}❌ Type check failed${NC}"
    exit 1
fi
echo ""

# Test 4: Unit Tests
echo -e "${YELLOW}[4/6] Running Unit Tests...${NC}"
if npm test; then
    echo -e "${GREEN}✅ Unit tests passed${NC}"
else
    echo -e "${RED}❌ Unit tests failed${NC}"
    exit 1
fi
echo ""

# Test 5: Integration Tests
echo -e "${YELLOW}[5/6] Running Integration Tests...${NC}"
if npx ts-node src/test/integration/devflow-v31-comprehensive-test.ts; then
    echo -e "${GREEN}✅ Integration tests passed${NC}"
else
    echo -e "${RED}❌ Integration tests failed${NC}"
    exit 1
fi
echo ""

# Test 6: Performance Validation
echo -e "${YELLOW}[6/6] Performance Validation...${NC}"
echo "Testing Footer System performance..."
node -e "
const { FooterRenderer } = require('./dist/ui/footer/FooterRenderer');
const footer = new FooterRenderer();

const iterations = 10000;
const start = Date.now();

for (let i = 0; i < iterations; i++) {
  footer.renderPreview();
}

const avgTime = (Date.now() - start) / iterations;
console.log(\`Average render time: \${avgTime.toFixed(3)}ms\`);

if (avgTime > 16) {
  console.log('❌ Performance test failed - too slow');
  process.exit(1);
} else {
  console.log('✅ Performance test passed');
}
"

echo ""
echo -e "${GREEN}🎉 All tests passed! DevFlow v3.1 Phase 1 ready for production${NC}"
echo -e "${BLUE}Next step: Production deployment${NC}"
