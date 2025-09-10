#!/usr/bin/env python3
"""
DevFlow Initialization Script
Sets up DevFlow integration with Claude Code sessions
"""

import json
import os
import sys
from pathlib import Path

def setup_devflow_integration():
    """Setup DevFlow integration with cc-sessions"""
    
    project_dir = os.getenv('CLAUDE_PROJECT_DIR', os.getcwd())
    claude_dir = Path(project_dir) / '.claude'
    
    # Ensure .claude directory exists
    claude_dir.mkdir(exist_ok=True)
    
    # Setup settings.json
    setup_claude_settings(claude_dir)
    
    # Setup environment variables
    setup_environment_variables(project_dir)
    
    # Create DevFlow context directory
    context_dir = claude_dir / 'context'
    context_dir.mkdir(exist_ok=True)
    
    print("✅ DevFlow integration setup completed successfully!")
    print(f"📁 Project directory: {project_dir}")
    print(f"📁 Claude directory: {claude_dir}")
    print(f"📁 Context directory: {context_dir}")
    print("\n🚀 DevFlow is now ready for Claude Code sessions!")

def setup_claude_settings(claude_dir: Path):
    """Setup .claude/settings.json with DevFlow configuration"""
    
    settings_path = claude_dir / 'settings.json'
    
    # Default settings
    default_settings = {
        "hooks": {
            "UserPromptSubmit": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/user-messages.py"
                        }
                    ]
                }
            ],
            "PreToolUse": [
                {
                    "matcher": "Write|Edit|MultiEdit|Task|Bash",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/sessions-enforce.py"
                        }
                    ]
                },
                {
                    "matcher": "Task",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/task-transcript-link.py"
                        }
                    ]
                }
            ],
            "PostToolUse": [
                {
                    "hooks": [
                        {
                            "type": "command",
                            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/post-tool-use.py"
                        },
                        {
                            "type": "command",
                            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/devflow-integration.py"
                        }
                    ]
                }
            ],
            "SessionStart": [
                {
                    "matcher": "startup|clear",
                    "hooks": [
                        {
                            "type": "command",
                            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.py"
                        },
                        {
                            "type": "command",
                            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/devflow-integration.py"
                        }
                    ]
                }
            ]
        },
        "statusLine": {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/statusline-script.sh",
            "padding": 0
        },
        "devflow": {
            "enabled": True,
            "auto_inject": True,
            "handoff_enabled": True,
            "verbose": False,
            "memory_provider": "sqlite",
            "vector_provider": "openai",
            "platforms": {
                "claude_code": {
                    "enabled": True,
                    "specializations": ["architecture", "complex_reasoning", "system_design"]
                },
                "openai_codex": {
                    "enabled": True,
                    "api_key_env": "OPENAI_API_KEY",
                    "specializations": ["implementation", "bulk_coding", "pattern_following"]
                },
                "synthetic": {
                    "enabled": True,
                    "api_key_env": "SYNTHETIC_API_KEY",
                    "specializations": ["rapid_prototyping", "code_generation", "debugging"]
                },
                "gemini": {
                    "enabled": True,
                    "api_key_env": "GEMINI_API_KEY",
                    "specializations": ["reasoning", "analysis", "documentation"]
                }
            },
            "routing": {
                "confidence_threshold": 0.8,
                "fallback_platform": "claude_code",
                "cost_optimization": True
            }
        }
    }
    
    # Load existing settings if they exist
    if settings_path.exists():
        try:
            with open(settings_path, 'r') as f:
                existing_settings = json.load(f)
            
            # Merge DevFlow configuration
            existing_settings['devflow'] = default_settings['devflow']
            
            # Add DevFlow hooks to existing hooks
            if 'hooks' in existing_settings:
                for event_type, hooks in default_settings['hooks'].items():
                    if event_type in existing_settings['hooks']:
                        # Add DevFlow hooks to existing hooks
                        for hook_group in hooks:
                            if hook_group not in existing_settings['hooks'][event_type]:
                                existing_settings['hooks'][event_type].append(hook_group)
                    else:
                        existing_settings['hooks'][event_type] = hooks
            else:
                existing_settings['hooks'] = default_settings['hooks']
            
            settings_to_write = existing_settings
        except (json.JSONDecodeError, KeyError):
            settings_to_write = default_settings
    else:
        settings_to_write = default_settings
    
    # Write settings
    with open(settings_path, 'w') as f:
        json.dump(settings_to_write, f, indent=2)
    
    print(f"✅ Updated {settings_path} with DevFlow configuration")

def setup_environment_variables(project_dir: Path):
    """Setup environment variables for DevFlow"""
    
    env_path = project_dir / '.env'
    
    # DevFlow environment variables
    devflow_env_vars = [
        "# DevFlow Configuration",
        "DEVFLOW_ENABLED=true",
        "DEVFLOW_DB_PATH=./devflow.sqlite",
        "DEVFLOW_AUTO_INJECT=true",
        "DEVFLOW_HANDOFF_ENABLED=true",
        "DEVFLOW_VERBOSE=false",
        "",
        "# Platform API Keys (configure as needed)",
        "# OPENAI_API_KEY=your-openai-key",
        "# SYNTHETIC_API_KEY=your-synthetic-key",
        "# GEMINI_API_KEY=your-gemini-key",
        "# OPENROUTER_API_KEY=your-openrouter-key",
        "",
        "# DevFlow Memory Configuration",
        "DEVFLOW_MEMORY_PROVIDER=sqlite",
        "DEVFLOW_VECTOR_PROVIDER=openai",
        "DEVFLOW_EMBEDDING_MODEL=openai-ada-002",
        ""
    ]
    
    # Load existing .env if it exists
    existing_env_vars = []
    if env_path.exists():
        try:
            with open(env_path, 'r') as f:
                existing_env_vars = f.readlines()
        except Exception:
            existing_env_vars = []
    
    # Check if DevFlow vars already exist
    devflow_section_exists = any('DevFlow Configuration' in line for line in existing_env_vars)
    
    if not devflow_section_exists:
        # Add DevFlow variables
        with open(env_path, 'a') as f:
            f.write('\n' + '\n'.join(devflow_env_vars))
        print(f"✅ Added DevFlow environment variables to {env_path}")
    else:
        print(f"✅ DevFlow environment variables already exist in {env_path}")

if __name__ == "__main__":
    setup_devflow_integration()
