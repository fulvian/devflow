#!/usr/bin/env python3
"""
Manual Memory Trigger - Bypass Claude Code hook bug
Comando manuale per attivare ricerca semantica quando hook non funziona
"""

import sys
import subprocess
import json

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 manual-memory-trigger.py 'your query'")
        return

    query = ' '.join(sys.argv[1:])

    # Call Universal Memory Injection directly
    try:
        cmd = ['python3', '/Users/fulvioventura/devflow/.claude/hooks/universal-memory-injection.py', query]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.stdout:
            print("🔍 MANUAL SEMANTIC SEARCH TRIGGERED:")
            print(result.stdout)
        else:
            print("No context found or activation threshold not met")

        if result.stderr:
            print("ERRORS:", result.stderr)

    except Exception as e:
        print(f"Manual trigger failed: {e}")

if __name__ == "__main__":
    main()