# Iron-Clad Orchestrator Agent - Strategic Tools Only
import json
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

class TaskComplexity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AgentType(Enum):
    CODE = "code"
    REASONING = "reasoning"
    CONTEXT = "context"
    QA_DEPLOYMENT = "qa-deployment"

@dataclass
class TaskRequest:
    task_id: str
    description: str
    complexity: TaskComplexity
    target_files: List[str]
    context: str
    deadline: Optional[float] = None
    priority: int = 1

@dataclass
class AgentCapability:
    agent_type: AgentType
    max_complexity: TaskComplexity
    specializations: List[str]
    success_rate: float
    current_load: int

class OrchestratorAgent:
    """Iron-clad orchestrator with ZERO implementation capabilities - Strategic tools only."""
    
    def __init__(self, claude_state_dir: str = ".claude/state"):
        self.claude_state_dir = Path(claude_state_dir)
        self.claude_state_dir.mkdir(parents=True, exist_ok=True)
        
        # CRITICAL: Only strategic tools allowed
        self.allowed_tools = {
            'task_create',
            'launch_subagent', 
            'add_context',
            'finish',
            'delegate_to_synthetic',
            'update_task_status',
            'get_agent_capabilities',
            'analyze_complexity'
        }
        
        # NO implementation tools whatsoever
        self.forbidden_tools = {
            'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash',
            'execute_code', 'modify_file', 'create_file', 'delete_file'
        }
        
        # Agent registry
        self.available_agents = {
            AgentType.CODE: AgentCapability(
                agent_type=AgentType.CODE,
                max_complexity=TaskComplexity.CRITICAL,
                specializations=["typescript", "python", "javascript", "implementation"],
                success_rate=0.92,
                current_load=0
            ),
            AgentType.REASONING: AgentCapability(
                agent_type=AgentType.REASONING,
                max_complexity=TaskComplexity.HIGH,
                specializations=["analysis", "architecture", "problem_solving"],
                success_rate=0.95,
                current_load=0
            ),
            AgentType.CONTEXT: AgentCapability(
                agent_type=AgentType.CONTEXT,
                max_complexity=TaskComplexity.MEDIUM,
                specializations=["documentation", "context_gathering", "research"],
                success_rate=0.88,
                current_load=0
            ),
            AgentType.QA_DEPLOYMENT: AgentCapability(
                agent_type=AgentType.QA_DEPLOYMENT,
                max_complexity=TaskComplexity.HIGH,
                specializations=["testing", "deployment", "validation"],
                success_rate=0.90,
                current_load=0
            )
        }
        
        # Task tracking
        self.active_tasks: Dict[str, TaskRequest] = {}
        self.completed_tasks: List[str] = []
        
    def verify_tool_restriction(self, tool_name: str) -> bool:
        """CRITICAL: Verify orchestrator can only use strategic tools."""
        if tool_name in self.forbidden_tools:
            raise PermissionError(f"ORCHESTRATOR RESTRICTION VIOLATION: Tool '{tool_name}' is forbidden for orchestrator")
        
        if tool_name not in self.allowed_tools:
            raise PermissionError(f"ORCHESTRATOR RESTRICTION: Tool '{tool_name}' not in allowed strategic tools")
        
        return True
    
    def task_create(self, task_request: TaskRequest) -> Dict[str, Any]:
        """Strategic tool: Create and register a new task."""
        self.verify_tool_restriction('task_create')
        
        # Analyze task complexity automatically
        complexity = self.analyze_complexity(task_request.description, task_request.target_files)
        task_request.complexity = complexity
        
        # Register task
        self.active_tasks[task_request.task_id] = task_request
        
        # Update claude state
        self._update_claude_state(task_request)
        
        return {
            "task_id": task_request.task_id,
            "complexity": complexity.value,
            "recommended_agent": self._recommend_agent(task_request).value,
            "status": "created"
        }
    
    def launch_subagent(self, task_id: str, agent_type: AgentType, additional_context: str = "") -> Dict[str, Any]:
        """Strategic tool: Launch specialized subagent for implementation."""
        self.verify_tool_restriction('launch_subagent')
        
        if task_id not in self.active_tasks:
            raise ValueError(f"Task {task_id} not found")
        
        task = self.active_tasks[task_id]
        agent_capability = self.available_agents[agent_type]
        
        # Verify agent can handle task complexity
        if not self._can_agent_handle_task(agent_capability, task):
            raise ValueError(f"Agent {agent_type.value} cannot handle task complexity {task.complexity.value}")
        
        # Prepare delegation payload
        delegation_payload = {
            "task_id": task_id,
            "agent_type": agent_type.value,
            "description": task.description,
            "target_files": task.target_files,
            "context": task.context + "\n" + additional_context,
            "complexity": task.complexity.value,
            "launched_at": time.time()
        }
        
        # Update agent load
        agent_capability.current_load += 1
        
        return {
            "delegation_payload": delegation_payload,
            "agent_selected": agent_type.value,
            "estimated_completion": self._estimate_completion_time(task),
            "status": "delegated"
        }
    
    def add_context(self, task_id: str, context_type: str, context_data: Dict[str, Any]) -> Dict[str, Any]:
        """Strategic tool: Add context to existing task without implementation."""
        self.verify_tool_restriction('add_context')
        
        if task_id not in self.active_tasks:
            raise ValueError(f"Task {task_id} not found")
        
        task = self.active_tasks[task_id]
        
        # Add context based on type
        context_addition = f"\n--- {context_type.upper()} CONTEXT ---\n"
        context_addition += json.dumps(context_data, indent=2)
        
        task.context += context_addition
        
        return {
            "task_id": task_id,
            "context_added": context_type,
            "updated_at": time.time(),
            "status": "context_updated"
        }
    
    def finish(self, task_id: str, completion_notes: str = "") -> Dict[str, Any]:
        """Strategic tool: Mark task as completed and clean up."""
        self.verify_tool_restriction('finish')
        
        if task_id not in self.active_tasks:
            raise ValueError(f"Task {task_id} not found")
        
        task = self.active_tasks[task_id]
        
        # Move to completed tasks
        self.completed_tasks.append(task_id)
        del self.active_tasks[task_id]
        
        # Update claude state
        self._clear_claude_state(task_id)
        
        return {
            "task_id": task_id,
            "completion_notes": completion_notes,
            "completed_at": time.time(),
            "status": "completed"
        }
    
    def analyze_complexity(self, description: str, target_files: List[str]) -> TaskComplexity:
        """Strategic tool: Analyze task complexity without implementation."""
        self.verify_tool_restriction('analyze_complexity')
        
        complexity_score = 0
        
        # File count factor
        file_count = len(target_files)
        if file_count > 10:
            complexity_score += 3
        elif file_count > 5:
            complexity_score += 2
        elif file_count > 1:
            complexity_score += 1
        
        # Description complexity factors
        description_lower = description.lower()
        
        # High complexity indicators
        high_complexity_keywords = [
            'architecture', 'system', 'integration', 'framework',
            'database', 'security', 'performance', 'scalability'
        ]
        
        # Medium complexity indicators
        medium_complexity_keywords = [
            'feature', 'component', 'function', 'class',
            'method', 'api', 'endpoint', 'service'
        ]
        
        # Critical complexity indicators
        critical_complexity_keywords = [
            'refactor', 'migration', 'optimization', 'deployment',
            'infrastructure', 'orchestration', 'kubernetes'
        ]
        
        for keyword in critical_complexity_keywords:
            if keyword in description_lower:
                complexity_score += 4
        
        for keyword in high_complexity_keywords:
            if keyword in description_lower:
                complexity_score += 3
        
        for keyword in medium_complexity_keywords:
            if keyword in description_lower:
                complexity_score += 2
        
        # Determine complexity level
        if complexity_score >= 8:
            return TaskComplexity.CRITICAL
        elif complexity_score >= 5:
            return TaskComplexity.HIGH
        elif complexity_score >= 2:
            return TaskComplexity.MEDIUM
        else:
            return TaskComplexity.LOW
    
    def get_agent_capabilities(self) -> Dict[str, Dict[str, Any]]:
        """Strategic tool: Get current agent capabilities and load."""
        self.verify_tool_restriction('get_agent_capabilities')
        
        return {
            agent_type.value: {
                "max_complexity": capability.max_complexity.value,
                "specializations": capability.specializations,
                "success_rate": capability.success_rate,
                "current_load": capability.current_load
            }
            for agent_type, capability in self.available_agents.items()
        }
    
    def _recommend_agent(self, task: TaskRequest) -> AgentType:
        """Internal: Recommend best agent for task."""
        # Simple recommendation logic based on complexity and specializations
        if task.complexity == TaskComplexity.CRITICAL:
            return AgentType.CODE  # Most capable for critical tasks
        
        # Check specializations match
        task_keywords = task.description.lower()
        
        if any(keyword in task_keywords for keyword in ["test", "deploy", "validate"]):
            return AgentType.QA_DEPLOYMENT
        elif any(keyword in task_keywords for keyword in ["analyze", "research", "understand"]):
            return AgentType.REASONING
        elif any(keyword in task_keywords for keyword in ["document", "context", "gather"]):
            return AgentType.CONTEXT
        else:
            return AgentType.CODE  # Default for implementation tasks
    
    def _can_agent_handle_task(self, agent: AgentCapability, task: TaskRequest) -> bool:
        """Internal: Check if agent can handle task complexity."""
        complexity_levels = {
            TaskComplexity.LOW: 1,
            TaskComplexity.MEDIUM: 2,
            TaskComplexity.HIGH: 3,
            TaskComplexity.CRITICAL: 4
        }
        
        return complexity_levels[task.complexity] <= complexity_levels[agent.max_complexity]
    
    def _estimate_completion_time(self, task: TaskRequest) -> float:
        """Internal: Estimate task completion time in minutes."""
        base_times = {
            TaskComplexity.LOW: 15,
            TaskComplexity.MEDIUM: 45,
            TaskComplexity.HIGH: 120,
            TaskComplexity.CRITICAL: 300
        }
        
        # Factor in file count
        file_factor = 1 + (len(task.target_files) * 0.1)
        
        return base_times[task.complexity] * file_factor
    
    def _update_claude_state(self, task: TaskRequest) -> None:
        """Internal: Update .claude/state with current task."""
        current_task_file = self.claude_state_dir / "current_task.json"
        
        state = {
            "task": task.task_id,
            "branch": f"feature/{task.task_id}",
            "services": task.target_files,
            "updated": time.strftime("%Y-%m-%d"),
            "complexity": task.complexity.value,
            "description": task.description
        }
        
        with open(current_task_file, 'w') as f:
            json.dump(state, f, indent=2)
    
    def _clear_claude_state(self, task_id: str) -> None:
        """Internal: Clear claude state for completed task."""
        current_task_file = self.claude_state_dir / "current_task.json"
        
        if current_task_file.exists():
            with open(current_task_file, 'r') as f:
                state = json.load(f)
            
            if state.get("task") == task_id:
                # Clear current task
                state = {
                    "task": None,
                    "branch": None,
                    "services": [],
                    "updated": time.strftime("%Y-%m-%d")
                }
                
                with open(current_task_file, 'w') as f:
                    json.dump(state, f, indent=2)
    
    def get_orchestrator_stats(self) -> Dict[str, Any]:
        """Get comprehensive orchestrator statistics."""
        return {
            "active_tasks": len(self.active_tasks),
            "completed_tasks": len(self.completed_tasks),
            "agent_loads": {
                agent_type.value: capability.current_load
                for agent_type, capability in self.available_agents.items()
            },
            "allowed_tools": list(self.allowed_tools),
            "forbidden_tools": list(self.forbidden_tools),
            "restriction_verification": all(
                tool not in self.allowed_tools for tool in self.forbidden_tools
            )
        }

# Usage example
def main():
    orchestrator = OrchestratorAgent()
    
    # Example task creation
    task = TaskRequest(
        task_id="ORCH-001",
        description="Implement iron-clad enforcement system with mathematical verification",
        complexity=TaskComplexity.HIGH,
        target_files=["enforce-delegation.py", "orchestration/orchestrator.py"],
        context="Zero Touch Architecture implementation"
    )
    
    # Create task
    result = orchestrator.task_create(task)
    print(f"Task created: {result}")
    
    # Launch subagent
    delegation = orchestrator.launch_subagent("ORCH-001", AgentType.CODE)
    print(f"Agent delegated: {delegation}")
    
    # Show stats
    stats = orchestrator.get_orchestrator_stats()
    print(f"Orchestrator stats: {stats}")

if __name__ == "__main__":
    main()