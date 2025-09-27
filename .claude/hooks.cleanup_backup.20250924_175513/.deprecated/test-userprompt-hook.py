#!/usr/bin/env python3
"""
Minimal test hook for UserPromptSubmit
"""

import json
import sys
from datetime import datetime

def main():
    try:
        # Log that we got called
        with open('/Users/fulvioventura/devflow/temp/test-userprompt-debug.log', 'a') as f:
            f.write(f"[{datetime.now().isoformat()}] TEST UserPromptSubmit hook called!\n")

        # Try to read input
        input_text = sys.stdin.read()

        with open('/Users/fulvioventura/devflow/temp/test-userprompt-debug.log', 'a') as f:
            f.write(f"[{datetime.now().isoformat()}] Got input: {input_text[:200]}...\n")

        sys.exit(0)
    except Exception as e:
        with open('/Users/fulvioventura/devflow/temp/test-userprompt-debug.log', 'a') as f:
            f.write(f"[{datetime.now().isoformat()}] ERROR: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()