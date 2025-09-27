#!/bin/bash
# Validate no legacy database usage across DevFlow codebase

echo "🔍 Validating no legacy database usage..."

# Function to check for legacy references
check_legacy_refs() {
    local pattern="$1"
    local description="$2"

    if grep -r "$pattern" src/ packages/ --exclude-dir=dist --exclude-dir=node_modules --exclude="*.DEPRECATED*" --exclude="*.log" 2>/dev/null; then
        echo "❌ Found references to $description"
        return 1
    fi
    return 0
}

# Check for legacy database references
ERRORS=0

echo "  Checking for devflow.sqlite references..."
if check_legacy_refs "devflow\.sqlite[^_]" "legacy devflow.sqlite"; then
    echo "  ✅ No legacy devflow.sqlite references found"
else
    ERRORS=$((ERRORS + 1))
fi

echo "  Checking for data/devflow.sqlite references..."
if check_legacy_refs "data/devflow\.sqlite[^_]" "legacy data/devflow.sqlite"; then
    echo "  ✅ No legacy data/devflow.sqlite references found"
else
    ERRORS=$((ERRORS + 1))
fi

echo "  Checking for vector.sqlite references..."
if check_legacy_refs "vector\.sqlite[^_]" "legacy vector.sqlite"; then
    echo "  ✅ No legacy vector.sqlite references found"
else
    ERRORS=$((ERRORS + 1))
fi

# Verify unified database usage in .env
echo "  Checking .env configuration..."
if grep -q "devflow_unified.sqlite" .env; then
    echo "  ✅ .env correctly references unified database"
else
    echo "  ❌ .env doesn't reference unified database"
    ERRORS=$((ERRORS + 1))
fi

# Verify deprecated files exist
echo "  Checking deprecated database files are properly marked..."
if [ -f "./devflow.sqlite.DEPRECATED" ] && [ -f "./devflow.sqlite.DEPRECATED.txt" ]; then
    echo "  ✅ Legacy root database properly deprecated"
else
    echo "  ❌ Legacy root database not properly deprecated"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "./data/devflow.sqlite.DEPRECATED" ] && [ -f "./data/devflow.sqlite.DEPRECATED.txt" ]; then
    echo "  ✅ Legacy data database properly deprecated"
else
    echo "  ❌ Legacy data database not properly deprecated"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "./data/vector.sqlite.DEPRECATED" ] && [ -f "./data/vector.sqlite.DEPRECATED.txt" ]; then
    echo "  ✅ Legacy vector database properly deprecated"
else
    echo "  ❌ Legacy vector database not properly deprecated"
    ERRORS=$((ERRORS + 1))
fi

# Verify unified database exists
echo "  Checking unified database exists..."
if [ -f "./data/devflow_unified.sqlite" ]; then
    echo "  ✅ Unified database exists"
else
    echo "  ❌ Unified database missing!"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ Validation PASSED: No legacy database usage found"
    echo "📊 Current architecture: Single unified database at ./data/devflow_unified.sqlite"
    exit 0
else
    echo "❌ Validation FAILED: $ERRORS issues found"
    echo "🔧 Fix required before proceeding"
    exit 1
fi