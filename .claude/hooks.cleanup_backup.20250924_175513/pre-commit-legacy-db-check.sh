#!/bin/bash
# Pre-commit hook to prevent legacy database references

echo "🔒 Checking for legacy database references in commit..."

# Check staged files for legacy database references
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\.(ts|js|py|sh|md)$" || true)

if [ -z "$STAGED_FILES" ]; then
    echo "  ✅ No relevant files to check"
    exit 0
fi

ERRORS=0

for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
        # Check for legacy database references
        if git show :$file | grep -E "devflow\.sqlite[^_]|data/devflow\.sqlite[^_]|vector\.sqlite[^_]" > /dev/null 2>&1; then
            echo "  ❌ BLOCKED: $file contains legacy database references"
            echo "     Use: devflow_unified.sqlite instead"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "❌ COMMIT BLOCKED: $ERRORS files reference legacy databases"
    echo "🔧 Update code to use: ./data/devflow_unified.sqlite"
    echo "📖 See: ./data/*.DEPRECATED.txt for migration info"
    exit 1
fi

echo "  ✅ No legacy database references found"
exit 0