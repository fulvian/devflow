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
import aiohttp
import time

# Tool name to platform name mapping for Platform Status Tracker
TOOL_PLATFORM_MAPPING = {
    "mcp__devflow-synthetic-cc-sessions": "synthetic",
    "Task": "claude",
    "Write": "claude",
    "Edit": "claude", 
    "MultiEdit": "claude",
    "Read": "claude",
    "Bash": "system",
    "mcp__devflow-code-analysis": "code-analysis",
    "mcp__devflow-security-scan": "security",
    "mcp__devflow-performance-test": "performance",
    "mcp__gemini-cli": "gemini",
    "mcp__qwen-code": "qwen",
    "mcp__codex-cli": "codex"
}

# DevFlow Orchestrator configuration
ORCHESTRATOR_BASE_URL = "http://localhost:3005"
ORCHESTRATOR_API_TOKEN = "devflow-orchestrator-token"
ORCHESTRATOR_HEADERS = {
    "Authorization": f"Bearer {ORCHESTRATOR_API_TOKEN}",
    "Content-Type": "application/json"
}

# Task management storage for active orchestrator tasks
active_orchestrator_tasks: Dict[str, Dict[str, Any]] = {}

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
        """Handle session start hook - inject relevant context and create orchestrator tasks"""
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
            
            # Create orchestrator task for complex sessions
            orchestrator_task_created = False
            if self.is_complex_session(hook_data):
                await self.create_orchestrator_task(session_id, task_name, hook_data)
                orchestrator_task_created = True
                self.log(f"Created orchestrator task for complex session: {task_name}")
            
            if context:
                self.log(f"Loaded {len(context)} context blocks for task: {task_name}")
                return {
                    "hookSpecificOutput": {
                        "hookEventName": "SessionStart",
                        "additionalContext": context,
                        "devflowEnabled": True,
                        "taskName": task_name,
                        "sessionId": session_id,
                        "orchestratorTaskCreated": orchestrator_task_created
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
                        "message": "No previous context found for this task",
                        "orchestratorTaskCreated": orchestrator_task_created
                    }
                }
                
        except Exception as e:
            self.log(f"Error in session start hook: {str(e)}", 'ERROR')
            return {
                "status": "error",
                "error": str(e)
            }

    async def handle_post_tool_use(self, hook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle post tool use hook - capture important decisions, delegate complex tasks, track metrics, and update orchestrator"""
        self.log("Handling post tool use hook")
        
        if not self.devflow_config.get('enabled', False):
            return {"status": "disabled"}
        
        tool_name = hook_data.get('tool_name', '')
        tool_response = hook_data.get('tool_response', '')
        session_id = hook_data.get('session_id', '')
        task_id = hook_data.get('task_id', '')
        execution_start_time = hook_data.get('execution_start_time', time.time())
        
        if not tool_name or not tool_response:
            return {"status": "no_data"}
        
        try:
            # Record execution metrics in Platform Status Tracker
            execution_success = 'error' not in tool_response.lower() and 'failed' not in tool_response.lower()
            await self.record_platform_execution_metrics(
                tool_name, execution_start_time, execution_success, tool_response
            )
            
            # Update orchestrator task with tool completion
            orchestrator_updated = False
            if session_id in active_orchestrator_tasks:
                await self.update_orchestrator_task_progress(session_id, tool_name, execution_success)
                orchestrator_updated = True
                self.log(f"Updated orchestrator task for tool completion: {tool_name}")
            
            # Check task complexity for orchestrator delegation
            task_complexity = self.assess_task_complexity(tool_response, tool_name)
            
            # Delegate complex tasks to Real Dream Team Orchestrator
            orchestrator_delegated = False
            if task_complexity in ['high', 'medium'] and await self.check_orchestrator_health():
                self.log(f"Delegating complex task to Real Dream Team Orchestrator: {tool_name}")
                
                orchestrator_task = {
                    "task_type": "post_tool_analysis",
                    "tool_name": tool_name,
                    "tool_response": tool_response,
                    "complexity": task_complexity,
                    "priority": "normal",
                    "metadata": {
                        "source": "devflow-integration-hook",
                        "session_id": session_id,
                        "task_id": task_id,
                        "timestamp": time.time()
                    }
                }
                
                orchestrator_result = await self.call_real_dream_team_orchestrator(orchestrator_task)
                self.log(f"Orchestrator delegation result: {orchestrator_result.get('status', 'unknown')}")
                orchestrator_delegated = True
            
            # Capture important decisions locally as well
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
                "capturedType": "architectural" if captured else "none",
                "orchestratorDelegated": orchestrator_delegated,
                "orchestratorTaskUpdated": orchestrator_updated,
                "platformMetricsRecorded": True,
                "executionSuccess": execution_success
            }
            
        except Exception as e:
            self.log(f"Error in post tool use hook: {str(e)}", 'ERROR')
            # Still try to record failed execution in metrics
            await self.record_platform_execution_metrics(
                tool_name, execution_start_time, False, str(e)
            )
            return {
                "status": "error",
                "error": str(e)
            }
    
    def is_complex_session(self, hook_data: Dict[str, Any]) -> bool:
        """Determine if a session is complex enough to warrant orchestrator task creation"""
        task_name = hook_data.get('task_name', '').lower()
        complex_indicators = [
            'implement', 'refactor', 'migrate', 'architecture', 'design', 
            'system', 'integration', 'orchestration', 'complex', 'multi'
        ]
        return any(indicator in task_name for indicator in complex_indicators)
    
    async def call_devflow_orchestrator_api(self, method: str, endpoint: str, 
                                          data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make an authenticated async call to the DevFlow Orchestrator API"""
        url = f"{ORCHESTRATOR_BASE_URL}{endpoint}"
        
        try:
            async with aiohttp.ClientSession() as session:
                if method.upper() == "GET":
                    async with session.get(url, headers=ORCHESTRATOR_HEADERS) as response:
                        if response.status == 200:
                            return await response.json()
                        else:
                            error_text = await response.text()
                            self.log(f"Orchestrator API GET error {response.status}: {error_text}", 'ERROR')
                            return {"error": f"API error {response.status}"}
                elif method.upper() == "POST":
                    async with session.post(url, headers=ORCHESTRATOR_HEADERS, json=data) as response:
                        if response.status == 200:
                            return await response.json()
                        else:
                            error_text = await response.text()
                            self.log(f"Orchestrator API POST error {response.status}: {error_text}", 'ERROR')
                            return {"error": f"API error {response.status}"}
                elif method.upper() == "PUT":
                    async with session.put(url, headers=ORCHESTRATOR_HEADERS, json=data) as response:
                        if response.status == 200:
                            return await response.json()
                        else:
                            error_text = await response.text()
                            self.log(f"Orchestrator API PUT error {response.status}: {error_text}", 'ERROR')
                            return {"error": f"API error {response.status}"}
        except Exception as e:
            self.log(f"DevFlow Orchestrator API call failed: {e}", 'ERROR')
            return {"error": str(e)}
    
    async def create_orchestrator_task(self, session_id: str, task_name: str, 
                                     session_data: Dict[str, Any]) -> None:
        """Create a new task in the DevFlow Orchestrator"""
        task_data = {
            "title": f"Session: {task_name}",
            "description": f"Development session for: {task_name}",
            "status": "in_progress",
            "priority": "medium",
            "metadata": {
                "session_id": session_id,
                "task_name": task_name,
                "created_by": "devflow-integration-hook",
                "created_at": time.time()
            }
        }
        
        try:
            response = await self.call_devflow_orchestrator_api("POST", "/api/tasks", task_data)
            
            if "data" in response and "id" in response["data"]:
                task_id = response["data"]["id"]
                active_orchestrator_tasks[session_id] = {
                    "task_id": task_id,
                    "task_data": response["data"],
                    "created_at": time.time()
                }
                self.log(f"Created orchestrator task {task_id} for session {session_id}")
            else:
                self.log(f"Failed to create orchestrator task: {response}", 'ERROR')
                
        except Exception as e:
            self.log(f"Error creating orchestrator task: {str(e)}", 'ERROR')
    
    async def update_orchestrator_task_progress(self, session_id: str, tool_name: str, success: bool) -> None:
        """Update orchestrator task with tool completion progress"""
        if session_id not in active_orchestrator_tasks:
            return
        
        task_id = active_orchestrator_tasks[session_id]["task_id"]
        
        # Update task metadata with tool progress
        current_metadata = active_orchestrator_tasks[session_id]["task_data"].get("metadata", {})
        tools_completed = current_metadata.get("tools_completed", [])
        tools_completed.append({
            "tool": tool_name,
            "success": success,
            "completed_at": time.time()
        })
        
        update_data = {
            "metadata": {
                **current_metadata,
                "tools_completed": tools_completed,
                "last_tool": tool_name,
                "last_update": time.time()
            }
        }
        
        try:
            response = await self.call_devflow_orchestrator_api("PUT", f"/api/tasks/{task_id}", update_data)
            if "data" in response:
                active_orchestrator_tasks[session_id]["task_data"] = response["data"]
                self.log(f"Updated orchestrator task {task_id} with tool completion: {tool_name}")
        except Exception as e:
            self.log(f"Error updating orchestrator task progress: {str(e)}", 'ERROR')
    
    async def record_platform_execution_metrics(self, tool_name: str, start_time: float, 
                                              success: bool, response_or_error: str = "") -> None:
        """Record tool execution metrics in Platform Status Tracker"""
        try:
            platform_name = TOOL_PLATFORM_MAPPING.get(tool_name, "unknown")
            execution_time = time.time() - start_time
            
            # Only record if we have a valid platform mapping
            if platform_name == "unknown":
                self.log(f"No platform mapping for tool: {tool_name}", 'WARN')
                return
            
            payload = {
                "platform": platform_name,
                "tool": tool_name,
                "executionTime": execution_time,
                "success": success,
                "timestamp": time.time() * 1000  # Convert to milliseconds
            }
            
            if not success:
                payload["errorMessage"] = response_or_error[:500]  # Limit error message length
            
            # Send metrics to Platform Status Tracker
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "http://localhost:3202/api/execution",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status == 200:
                        self.log(f"Recorded execution metrics for {platform_name}: {execution_time:.2f}s")
                    else:
                        self.log(f"Failed to record metrics, status: {response.status}", 'WARN')
                        
        except Exception as e:
            self.log(f"Error recording platform metrics: {str(e)}", 'WARN')
    
    async def call_real_dream_team_orchestrator(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Call the Real Dream Team Orchestrator API to delegate complex tasks"""
        url = "http://localhost:3200/execute"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=task_data,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        self.log(f"Orchestrator task executed successfully")
                        return result
                    else:
                        error_text = await response.text()
                        self.log(f"Orchestrator API error {response.status}: {error_text}", 'ERROR')
                        return {
                            "error": f"Orchestrator API error {response.status}",
                            "details": error_text
                        }
        except aiohttp.ClientError as e:
            self.log(f"Failed to connect to orchestrator: {e}", 'ERROR')
            return {"error": "Failed to connect to orchestrator", "details": str(e)}
        except asyncio.TimeoutError as e:
            self.log(f"Orchestrator request timeout: {e}", 'ERROR')
            return {"error": "Orchestrator request timeout", "details": str(e)}
        except Exception as e:
            self.log(f"Unexpected error calling orchestrator: {e}", 'ERROR')
            return {"error": "Unexpected error calling orchestrator", "details": str(e)}

    async def check_orchestrator_health(self) -> bool:
        """Check if the Real Dream Team Orchestrator is healthy"""
        url = "http://localhost:3200/health"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    return response.status == 200
        except Exception as e:
            self.log(f"Orchestrator health check failed: {e}", 'WARN')
            return False

    def assess_task_complexity(self, tool_response: str, tool_name: str) -> str:
        """Assess the complexity of a task based on tool response and name"""
        # Complex tool indicators
        complex_tools = ['Task', 'MultiEdit', 'Write', 'mcp__devflow-synthetic-cc-sessions']
        complex_keywords = ['architecture', 'design', 'strategy', 'complex', 'algorithm', 'optimization', 'system']
        
        # Check tool name complexity
        if tool_name in complex_tools:
            return 'high'
        
        # Check response content complexity
        if any(keyword in tool_response.lower() for keyword in complex_keywords):
            return 'medium'
        
        # Check response length as complexity indicator
        if len(tool_response) > 2000:
            return 'medium'
        
        return 'low'
    
    async def load_relevant_context(self, task_name: str, session_id: str) -> List[Dict[str, Any]]:
        """Load relevant context from DevFlow memory"""
        try:
            # Call DevFlow semantic search via Node.js
            result = await self.call_devflow_search(task_name)
            
            if result and 'blocks' in result:
                return result['blocks']
            else:
                return []
        except Exception as e:
            self.log(f"Error loading relevant context: {str(e)}", 'ERROR')
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
                capture_output=True,
                text=True,
                cwd=self.project_dir,
                timeout=30
            )
            
            # Clean up temporary file
            script_path.unlink(missing_ok=True)
            
            if result.returncode == 0 and result.stdout.strip():
                return json.loads(result.stdout.strip())
            else:
                self.log(f"DevFlow search failed: {result.stderr}", 'WARN')
                return None
                
        except Exception as e:
            self.log(f"Error calling DevFlow search: {str(e)}", 'ERROR')
            return None
    
    def is_architectural_decision(self, response: str) -> bool:
        """Check if a response contains architectural decisions"""
        architectural_keywords = [
            'architecture', 'design pattern', 'framework', 'structure',
            'component', 'service', 'module', 'interface', 'api design',
            'data model', 'schema', 'microservice', 'monolith'
        ]
        
        response_lower = response.lower()
        return any(keyword in response_lower for keyword in architectural_keywords)
    
    def is_implementation_pattern(self, response: str) -> bool:
        """Check if a response contains implementation patterns"""
        implementation_keywords = [
            'implementation', 'algorithm', 'method', 'function',
            'class', 'inheritance', 'composition', 'pattern',
            'strategy', 'factory', 'observer', 'singleton'
        ]
        
        response_lower = response.lower()
        return any(keyword in response_lower for keyword in implementation_keywords)
    
    async def capture_architectural_decision(self, content: str, task_id: str, session_id: str):
        """Capture architectural decisions to DevFlow memory"""
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
        """Capture implementation patterns to DevFlow memory"""
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
                capture_output=True,
                text=True,
                cwd=self.project_dir,
                timeout=30
            )
            
            # Clean up temporary file
            script_path.unlink(missing_ok=True)
            
            if result.returncode != 0:
                self.log(f"Memory store failed: {result.stderr}", 'WARN')
                
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