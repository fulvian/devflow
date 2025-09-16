#!/bin/bash

# Simple DevFlow v3.1 StatusLine for Claude Code
# Single line, no colors, just essential info

# Read current task
if [[ -f ".claude/state/current_task.json" ]]; then
    task_info=$(python3 -c "
import sys, json
try:
    with open('.claude/state/current_task.json', 'r') as f:
        data = json.load(f)
        task_name = data.get('task', 'None')
        progress = data.get('progress_percentage', 0)
        services = data.get('services', [])
        system = data.get('system', '')

        if system == 'cometa-devflow':
            prefix = 'DevFlow v3.1'
        else:
            prefix = 'Task'

        service_count = len(services) if services else 0
        if progress > 0:
            print(f'{prefix}: {task_name} ({progress}% | {service_count} services)')
        else:
            print(f'{prefix}: {task_name}')
except:
    print('Task: None')
" 2>/dev/null)
else
    task_info="Task: None"
fi

# Count services
services_count=0
[[ -f ".vector.pid" ]] && ((services_count++))
[[ -f ".database.pid" ]] && ((services_count++))
[[ -f ".registry.pid" ]] && ((services_count++))
[[ -f ".optimizer.pid" ]] && ((services_count++))

# Count modified files
if [[ -d ".git" ]]; then
    modified_count=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
else
    modified_count=0
fi

# Single line output
echo "$task_info | $services_count services active | $modified_count files modified"