#!/usr/bin/env python3
"""
Debug Hook Execution - Verifica se Claude Code esegue davvero gli hook
"""

import sys
import json
from datetime import datetime
from pathlib import Path

def main():
    # Log di debug sempre attivo
    debug_log = Path("/Users/fulvioventura/devflow/.claude/logs/hook-debug.log")
    debug_log.parent.mkdir(parents=True, exist_ok=True)

    with open(debug_log, 'a') as f:
        f.write(f"\n=== HOOK EXECUTION DEBUG - {datetime.now().isoformat()} ===\n")
        f.write(f"Script called: {__file__}\n")
        f.write(f"Arguments: {sys.argv}\n")
        f.write(f"STDIN isatty: {sys.stdin.isatty()}\n")

        # Try to read input
        if not sys.stdin.isatty():
            try:
                stdin_content = sys.stdin.read()
                f.write(f"STDIN content: {stdin_content[:200]}...\n")

                if stdin_content.strip():
                    try:
                        data = json.loads(stdin_content)
                        f.write(f"JSON parsed: {json.dumps(data, indent=2)[:300]}...\n")
                    except:
                        f.write(f"Not valid JSON\n")

            except Exception as e:
                f.write(f"STDIN read error: {e}\n")

        f.write("=== END DEBUG LOG ===\n\n")

    # Output for Claude Code
    print(f"🔍 DEBUG HOOK EXECUTED at {datetime.now().isoformat()}")

if __name__ == "__main__":
    main()