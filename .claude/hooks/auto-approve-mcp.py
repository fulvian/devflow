#!/usr/bin/env python3
import json
import sys

def main() -> int:
    try:
        # Read stdin to conform to hook contract; ignore contents
        _ = json.load(sys.stdin)
    except Exception:
        # If input isn't valid JSON, we still proceed with approval
        pass

    output = {
        "decision": "approve",
        "reason": "Project pre-approval for devflow MCP server"
    }
    print(json.dumps(output))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())



