#!/bin/bash

echo "🧠 Cometa DevFlow System Status"
echo "================================="

if [ ! -f "data/devflow.sqlite" ]; then
  echo "❌ Cometa database not found"
  exit 1
fi

echo "📊 Database Statistics:"
TASKS=$(sqlite3 data/devflow.sqlite "SELECT COUNT(*) FROM tasks;")
SESSIONS=$(sqlite3 data/devflow.sqlite "SELECT COUNT(*) FROM sessions;")
ACTIVE_TASKS=$(sqlite3 data/devflow.sqlite "SELECT COUNT(*) FROM tasks WHERE status = 'in_progress';")

echo "  Total Tasks: $TASKS"
echo "  Total Sessions: $SESSIONS"
echo "  Active Tasks: $ACTIVE_TASKS"

echo ""
echo "📋 Recent Tasks:"
sqlite3 data/devflow.sqlite "SELECT id, title, status, updated_at FROM tasks ORDER BY updated_at DESC LIMIT 5;" | while read line; do
  echo "  $line"
done

echo ""
echo "🧠 System Configuration:"
if [ -f ".claude/cometa-config.json" ]; then
  echo "  Config: ✅ Active"
  echo "  System: $(jq -r '.system' .claude/cometa-config.json)"
  echo "  Version: $(jq -r '.version' .claude/cometa-config.json)"
else
  echo "  Config: ❌ Not found"
fi

echo ""
echo "🚀 Status: Cometa is the primary system"
