#!/usr/bin/env python3
"""
CRITICAL TEST: Simple PostToolUse Hook without cchooks dependency
Tests if PostToolUse hooks are being triggered by Claude Code
"""

import json
import sys
import sqlite3
from datetime import datetime
from pathlib import Path

def main():
    try:
        # Read input from stdin (Claude Code hook protocol)
        input_data = json.loads(sys.stdin.read())

        # Log the hook execution to verify it's being called
        log_file = Path("/Users/fulvioventura/devflow/temp/hook-test.log")
        log_file.parent.mkdir(exist_ok=True)

        with open(log_file, "a") as f:
            timestamp = datetime.now().isoformat()
            f.write(f"[{timestamp}] PostToolUse hook called!\n")
            f.write(f"Input data: {json.dumps(input_data, indent=2)}\n")
            f.write("="*50 + "\n")

        # Also store in database for verification
        db_path = "/Users/fulvioventura/devflow/data/devflow_unified.sqlite"
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO cometa_memory_stream (
                    session_id, event_type, significance_score,
                    context_data, tool_name, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                input_data.get('session_id', 'test-session'),
                'hook_test',
                1.0,
                json.dumps(input_data),
                input_data.get('tool_name', 'Unknown'),
                datetime.now().isoformat()
            ))
            conn.commit()

        # Print success message (exit code 0)
        print(f"🧪 PostToolUse hook WORKING! Tool: {input_data.get('tool_name', 'Unknown')}")
        sys.exit(0)

    except Exception as e:
        # Log error for debugging
        error_msg = f"Hook error: {str(e)}"
        with open("/Users/fulvioventura/devflow/temp/hook-error.log", "a") as f:
            f.write(f"[{datetime.now().isoformat()}] {error_msg}\n")

        print(error_msg, file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()