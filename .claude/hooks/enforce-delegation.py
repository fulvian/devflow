#!/usr/bin/env python3

import sys
import json

def main():
    if len(sys.argv) < 2:
        print("Error: No input provided")
        sys.exit(1)
    
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("Error: Invalid JSON input")
        sys.exit(1)
    
    tool_name = input_data.get('tool_name', '')
    
    # Allow MCP tools to pass through
    if tool_name.startswith('mcp__'):
        sys.exit(0)
    
    # Blocked tools that indicate direct coding
    blocked_tools = ['Edit', 'MultiEdit', 'Write', 'NotebookEdit']
    
    if tool_name in blocked_tools:
        print("\n=== CODE DELEGATION REQUIRED ===")
        print("Direct coding tools are disabled for the Architect role.")
        print("Please delegate implementation tasks to specialized agents:")
        print("")
        print("For implementation: @synthetic_code (Qwen3-Coder-480B)")
        print("For architecture analysis: @synthetic_reasoning (DeepSeek-V3)")
        print("For large codebase analysis: @synthetic_context (Qwen2.5-Coder-32B)")
        print("For intelligent model selection: @synthetic_auto")
        print("For debug/corrections: @MCP_Gemini_CLI")
        print("")
        print("Example: @synthetic_code Please implement the authentication module")
        print("===============================\n")
        sys.exit(1)
    
    # Allow all other tools
    sys.exit(0)

if __name__ == "__main__":
    main()
