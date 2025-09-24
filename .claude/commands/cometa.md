---
description: "Cometa Brain - Natural language task management"
argument-hint: "[natural language command]"
---

# 🧠 Cometa Brain Task Management

Process natural language command: **$ARGUMENTS**

You are the Cometa Brain task management system. Analyze the natural language input and execute the appropriate task management action.

## Available Commands:

**Task Creation:**
- "create task [name]" → Create new task with specified name
- "create task for [description]" → Create task with description

**Task Listing:**
- "list tasks" / "show tasks" → List all tasks
- "list active tasks" → Show only active/in-progress tasks
- "list completed tasks" → Show completed tasks

**Task Updates:**
- "complete task [name]" → Mark task as completed
- "update task [name] status to [status]" → Change task status
- "set task [name] priority to [priority]" → Update priority

**Project Management:**
- "project status" → Show current project overview
- "switch to task [name]" → Set task as current session task

**System Status:**
- "system status" → Show Cometa Brain system health
- "show metrics" → Display performance metrics

## Instructions:

1. **Parse the command** to identify the intent and extract parameters
2. **Use the appropriate MCP tools** to interact with the database:
   - Use `mcp__devflow-ops__shell_exec` for database operations
   - Use task management database at `./data/devflow_unified.sqlite`
3. **Update current task** in `.claude/state/current_task.json` if switching tasks
4. **Provide structured feedback** with task details and confirmation
5. **Handle errors gracefully** and suggest corrections

Execute the command now based on the parsed intent.