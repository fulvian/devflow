#!/usr/bin/env python3
"""
DevFlow Integration Hook for cc-sessions
Handles automatic context injection and memory capture
"""

import json
import sys
import os
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List

class DevFlowIntegration:
    def __init__(self):
        self.project_dir = os.getenv('CLAUDE_PROJECT_DIR', os.getcwd())
        self.devflow_config = self.load_devflow_config()
        self.memory_manager = None
        self.context_engine = None
        
    def load_devflow_config(self) -> Dict[str, Any]:
        """Load DevFlow configuration from .claude/settings.json"""
        config_path = Path(self.project_dir) / '.claude' / 'settings.json'
        
        if not config_path.exists():
            return {
                'enabled': False,
                'auto_inject': True,
                'handoff_enabled': True,
                'verbose': False
            }
        
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                return config.get('devflow', {
                    'enabled': True,
                    'auto_inject': True,
                    'handoff_enabled': True,
                    'verbose': False
                })
        except (json.JSONDecodeError, FileNotFoundError):
            return {
                'enabled': False,
                'auto_inject': True,
                'handoff_enabled': True,
                'verbose': False
            }
    
    def log(self, message: str, level: str = 'INFO'):
        """Log message if verbose mode is enabled"""
        if self.devflow_config.get('verbose', False):
            print(f"[DevFlow {level}] {message}", file=sys.stderr)
    
    async def handle_session_start(self, hook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle session start hook - inject relevant context"""
        self.log("Handling session start hook")
        
        if not self.devflow_config.get('enabled', False):
            self.log("DevFlow integration disabled", 'WARN')
            return {"status": "disabled"}
        
        task_name = hook_data.get('task_name', '')
        session_id = hook_data.get('session_id', '')
        
        if not task_name:
            self.log("No task name provided", 'WARN')
            return {"status": "no_task"}
        
        try:
            # Load relevant context from DevFlow
            context = await self.load_relevant_context(task_name, session_id)
            
            if context:
                self.log(f"Loaded {len(context)} context blocks for task: {task_name}")
                return {
                    "hookSpecificOutput": {
                        "hookEventName": "SessionStart",
                        "additionalContext": context,
                        "devflowEnabled": True,
                        "taskName": task_name,
                        "sessionId": session_id
                    }
                }
            else:
                self.log(f"No relevant context found for task: {task_name}")
                return {
                    "hookSpecificOutput": {
                        "hookEventName": "SessionStart",
                        "additionalContext": [],
                        "devflowEnabled": True,
                        "taskName": task_name,
                        "sessionId": session_id,
                        "message": "No previous context found for this task"
                    }
                }
                
        except Exception as e:
            self.log(f"Error in session start hook: {str(e)}", 'ERROR')
            return {
                "hookSpecificOutput": {
                    "hookEventName": "SessionStart",
                    "error": str(e),
                    "devflowEnabled": True
                }
            }
    
    async def handle_post_tool_use(self, hook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle post tool use hook - capture important decisions"""
        self.log("Handling post tool use hook")
        
        if not self.devflow_config.get('enabled', False):
            return {"status": "disabled"}
        
        tool_name = hook_data.get('tool_name', '')
        tool_response = hook_data.get('tool_response', '')
        session_id = hook_data.get('session_id', '')
        task_id = hook_data.get('task_id', '')
        
        if not tool_name or not tool_response:
            return {"status": "no_data"}
        
        try:
            # Capture important decisions
            captured = False
            
            if self.is_architectural_decision(tool_response):
                await self.capture_architectural_decision(tool_response, task_id, session_id)
                captured = True
                self.log(f"Captured architectural decision from tool: {tool_name}")
            
            if self.is_implementation_pattern(tool_response):
                await self.capture_implementation_pattern(tool_response, task_id, session_id)
                captured = True
                self.log(f"Captured implementation pattern from tool: {tool_name}")
            
            return {
                "status": "success",
                "devflowCaptured": captured,
                "toolName": tool_name,
                "capturedType": "architectural" if captured else "none"
            }
            
        except Exception as e:
            self.log(f"Error in post tool use hook: {str(e)}", 'ERROR')
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def load_relevant_context(self, task_name: str, session_id: str) -> List[Dict[str, Any]]:
        """Load relevant context from DevFlow memory"""
        try:
            # Call DevFlow semantic search via Node.js
            result = await self.call_devflow_search(task_name)
            
            if result and 'blocks' in result:
                return result['blocks']
            
            return []
            
        except Exception as e:
            self.log(f"Error loading context: {str(e)}", 'ERROR')
            return []
    
    async def call_devflow_search(self, query: str) -> Optional[Dict[str, Any]]:
        """Call DevFlow search via Node.js"""
        try:
            # Create a temporary script to call DevFlow
            script_content = f"""
const {{ ClaudeAdapter }} = require('@devflow/claude-adapter');

async function searchDevFlow() {{
    const adapter = new ClaudeAdapter({{ verbose: true }});
    const results = await adapter.searchMemory('{query}', {{
        maxResults: 10,
        blockTypes: ['architectural', 'implementation'],
        threshold: 0.7
    }});
    
    console.log(JSON.stringify({{
        blocks: results.map(r => ({{
            id: r.block.id,
            label: r.block.label,
            type: r.block.blockType,
            content: r.block.content,
            importance: r.block.importanceScore,
            similarity: r.similarity
        }}))
    }}));
}}

searchDevFlow().catch(console.error);
"""
            
            # Write script to temporary file
            script_path = Path(self.project_dir) / '.claude' / 'temp_search.js'
            script_path.parent.mkdir(exist_ok=True)
            
            with open(script_path, 'w') as f:
                f.write(script_content)
            
            # Execute script
            result = subprocess.run(
                ['node', str(script_path)],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Clean up
            script_path.unlink(missing_ok=True)
            
            if result.returncode == 0 and result.stdout:
                return json.loads(result.stdout)
            else:
                self.log(f"DevFlow search failed: {result.stderr}", 'ERROR')
                return None
                
        except Exception as e:
            self.log(f"Error calling DevFlow search: {str(e)}", 'ERROR')
            return None
    
    def is_architectural_decision(self, content: str) -> bool:
        """Detect if content contains architectural decisions"""
        architectural_keywords = [
            'architecture', 'architectural', 'design pattern', 'design decision',
            'system design', 'architecture decision', 'adr', 'architectural pattern',
            'component design', 'module design', 'interface design', 'api design',
            'database design', 'schema design', 'data model', 'domain model',
            'service architecture', 'microservices', 'monolith', 'distributed',
            'scalability', 'performance', 'security', 'reliability', 'maintainability'
        ]
        
        content_lower = content.lower()
        return any(keyword in content_lower for keyword in architectural_keywords)
    
    def is_implementation_pattern(self, content: str) -> bool:
        """Detect if content contains implementation patterns"""
        implementation_keywords = [
            'implementation', 'code pattern', 'coding pattern', 'best practice',
            'convention', 'standard', 'guideline', 'approach', 'method',
            'algorithm', 'data structure', 'function', 'class', 'module',
            'refactor', 'optimization', 'performance', 'efficiency'
        ]
        
        content_lower = content.lower()
        return any(keyword in content_lower for keyword in implementation_keywords)
    
    async def capture_architectural_decision(self, content: str, task_id: str, session_id: str):
        """Capture architectural decision in DevFlow memory"""
        try:
            # Call DevFlow memory store via Node.js
            await self.call_devflow_memory_store(
                content=content,
                block_type='architectural',
                label=f'Architectural Decision - {task_id}',
                importance_score=0.9,
                task_id=task_id,
                session_id=session_id
            )
        except Exception as e:
            self.log(f"Error capturing architectural decision: {str(e)}", 'ERROR')
    
    async def capture_implementation_pattern(self, content: str, task_id: str, session_id: str):
        """Capture implementation pattern in DevFlow memory"""
        try:
            # Call DevFlow memory store via Node.js
            await self.call_devflow_memory_store(
                content=content,
                block_type='implementation',
                label=f'Implementation Pattern - {task_id}',
                importance_score=0.8,
                task_id=task_id,
                session_id=session_id
            )
        except Exception as e:
            self.log(f"Error capturing implementation pattern: {str(e)}", 'ERROR')
    
    async def call_devflow_memory_store(self, content: str, block_type: str, label: str, 
                                      importance_score: float, task_id: str, session_id: str):
        """Call DevFlow memory store via Node.js"""
        try:
            # Create a temporary script to store memory
            script_content = f"""
const {{ ClaudeAdapter }} = require('@devflow/claude-adapter');

async function storeMemory() {{
    const adapter = new ClaudeAdapter({{ verbose: true }});
    
    const memoryBlock = {{
        content: `{content.replace('`', '\\`')}`,
        blockType: '{block_type}',
        label: '{label}',
        importanceScore: {importance_score},
        metadata: {{
            taskId: '{task_id}',
            sessionId: '{session_id}',
            capturedBy: 'devflow-hook',
            timestamp: new Date().toISOString()
        }},
        relationships: [],
        embeddingModel: 'openai-ada-002'
    }};
    
    await adapter.saveBlocks('{task_id}', '{session_id}', [memoryBlock]);
    console.log('Memory stored successfully');
}}

storeMemory().catch(console.error);
"""
            
            # Write script to temporary file
            script_path = Path(self.project_dir) / '.claude' / 'temp_store.js'
            script_path.parent.mkdir(exist_ok=True)
            
            with open(script_path, 'w') as f:
                f.write(script_content)
            
            # Execute script
            result = subprocess.run(
                ['node', str(script_path)],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Clean up
            script_path.unlink(missing_ok=True)
            
            if result.returncode != 0:
                self.log(f"DevFlow memory store failed: {result.stderr}", 'ERROR')
                
        except Exception as e:
            self.log(f"Error calling DevFlow memory store: {str(e)}", 'ERROR')

# Main hook handler
async def main():
    integration = DevFlowIntegration()
    
    try:
        # Read hook data from stdin
        hook_data = json.load(sys.stdin)
        
        hook_event_name = hook_data.get('hook_event_name', '')
        
        if hook_event_name == 'SessionStart':
            result = await integration.handle_session_start(hook_data)
        elif hook_event_name == 'PostToolUse':
            result = await integration.handle_post_tool_use(hook_data)
        else:
            result = {"status": "ignored", "event": hook_event_name}
        
        # Output result
        print(json.dumps(result))
        
    except json.JSONDecodeError as e:
        print(json.dumps({"status": "error", "error": f"Invalid JSON input: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
