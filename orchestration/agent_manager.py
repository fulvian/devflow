# Agent Manager - Intelligent Agent Selection and Coordination
import json
import time
import statistics
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path

from orchestrator import AgentType, TaskComplexity, TaskRequest, AgentCapability

class AgentStatus(Enum):
    IDLE = "idle"
    BUSY = "busy"
    OVERLOADED = "overloaded"
    OFFLINE = "offline"

class TaskPriority(Enum):
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class AgentMetrics:
    agent_type: AgentType
    total_tasks_completed: int
    success_rate: float
    average_completion_time: float
    current_load: int
    max_concurrent_tasks: int
    specialization_scores: Dict[str, float]
    last_updated: float

@dataclass
class TaskAssignment:
    task_id: str
    agent_type: AgentType
    assigned_at: float
    estimated_completion: float
    priority: TaskPriority
    status: str

class AgentManager:
    """Intelligent agent selection and coordination system with load balancing and performance tracking."""
    
    def __init__(self, metrics_file: str = "orchestration/agent_metrics.json"):
        self.metrics_file = Path(metrics_file)
        self.metrics_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Agent metrics and performance tracking
        self.agent_metrics: Dict[AgentType, AgentMetrics] = {}
        self.active_assignments: Dict[str, TaskAssignment] = {}
        self.task_history: List[Dict[str, Any]] = []
        
        # Load balancing configuration
        self.max_concurrent_tasks = {
            AgentType.CODE: 3,
            AgentType.REASONING: 2,
            AgentType.CONTEXT: 4,
            AgentType.QA_DEPLOYMENT: 2
        }
        
        # Initialize agent metrics
        self._initialize_agent_metrics()
        self._load_metrics()
    
    def select_optimal_agent(self, task: TaskRequest) -> Tuple[AgentType, float]:
        """Select the optimal agent for a task based on multiple factors."""
        
        # Get available agents that can handle the task
        candidate_agents = self._get_available_agents(task)
        
        if not candidate_agents:
            raise RuntimeError(f"No available agents can handle task {task.task_id} with complexity {task.complexity.value}")
        
        # Score each candidate agent
        agent_scores = {}
        for agent_type in candidate_agents:
            score = self._calculate_agent_score(agent_type, task)
            agent_scores[agent_type] = score
        
        # Select agent with highest score
        optimal_agent = max(agent_scores.keys(), key=lambda a: agent_scores[a])
        confidence = agent_scores[optimal_agent]
        
        return optimal_agent, confidence
    
    def assign_task(self, task: TaskRequest, agent_type: AgentType) -> TaskAssignment:
        """Assign a task to a specific agent with tracking."""
        
        # Verify agent can handle the task
        if not self._can_agent_handle_task(agent_type, task):
            raise ValueError(f"Agent {agent_type.value} cannot handle task {task.task_id}")
        
        # Check agent availability
        if not self._is_agent_available(agent_type):
            raise RuntimeError(f"Agent {agent_type.value} is not available (overloaded)")
        
        # Create assignment
        assignment = TaskAssignment(
            task_id=task.task_id,
            agent_type=agent_type,
            assigned_at=time.time(),
            estimated_completion=self._estimate_completion_time(agent_type, task),
            priority=TaskPriority(task.priority),
            status="assigned"
        )
        
        # Update tracking
        self.active_assignments[task.task_id] = assignment
        self.agent_metrics[agent_type].current_load += 1
        
        # Save metrics
        self._save_metrics()
        
        return assignment
    
    def complete_task(self, task_id: str, success: bool, actual_completion_time: float) -> None:
        """Mark a task as completed and update agent metrics."""
        
        if task_id not in self.active_assignments:
            raise ValueError(f"Task {task_id} not found in active assignments")
        
        assignment = self.active_assignments[task_id]
        agent_type = assignment.agent_type
        
        # Update agent metrics
        metrics = self.agent_metrics[agent_type]
        metrics.total_tasks_completed += 1
        metrics.current_load = max(0, metrics.current_load - 1)
        
        # Update success rate (exponential moving average)
        if metrics.total_tasks_completed == 1:
            metrics.success_rate = 1.0 if success else 0.0
        else:
            alpha = 0.1  # Learning rate
            new_success = 1.0 if success else 0.0
            metrics.success_rate = (1 - alpha) * metrics.success_rate + alpha * new_success
        
        # Update average completion time
        if metrics.total_tasks_completed == 1:
            metrics.average_completion_time = actual_completion_time
        else:
            alpha = 0.1
            metrics.average_completion_time = (1 - alpha) * metrics.average_completion_time + alpha * actual_completion_time
        
        metrics.last_updated = time.time()
        
        # Add to history
        self.task_history.append({
            "task_id": task_id,
            "agent_type": agent_type.value,
            "success": success,
            "completion_time": actual_completion_time,
            "estimated_time": assignment.estimated_completion,
            "priority": assignment.priority.value,
            "completed_at": time.time()
        })
        
        # Remove from active assignments
        del self.active_assignments[task_id]
        
        # Save updated metrics
        self._save_metrics()
    
    def get_agent_status(self, agent_type: AgentType) -> AgentStatus:
        """Get current status of an agent."""
        metrics = self.agent_metrics[agent_type]
        max_tasks = self.max_concurrent_tasks[agent_type]
        
        if metrics.current_load == 0:
            return AgentStatus.IDLE
        elif metrics.current_load < max_tasks:
            return AgentStatus.BUSY
        else:
            return AgentStatus.OVERLOADED
    
    def get_load_balancing_info(self) -> Dict[str, Any]:
        """Get comprehensive load balancing information."""
        return {
            "agent_statuses": {
                agent_type.value: self.get_agent_status(agent_type).value
                for agent_type in AgentType
            },
            "current_loads": {
                agent_type.value: self.agent_metrics[agent_type].current_load
                for agent_type in AgentType
            },
            "max_loads": {
                agent_type.value: self.max_concurrent_tasks[agent_type]
                for agent_type in AgentType
            },
            "active_assignments": len(self.active_assignments),
            "total_completed_tasks": sum(metrics.total_tasks_completed for metrics in self.agent_metrics.values())
        }
    
    def get_performance_analytics(self) -> Dict[str, Any]:
        """Get detailed performance analytics for all agents."""
        analytics = {}
        
        for agent_type, metrics in self.agent_metrics.items():
            # Calculate performance trends
            agent_tasks = [task for task in self.task_history if task["agent_type"] == agent_type.value]
            
            recent_tasks = [task for task in agent_tasks if task["completed_at"] > time.time() - 86400]  # Last 24 hours
            
            analytics[agent_type.value] = {
                "total_tasks": metrics.total_tasks_completed,
                "success_rate": round(metrics.success_rate, 3),
                "average_completion_time": round(metrics.average_completion_time, 2),
                "current_load": metrics.current_load,
                "recent_tasks_24h": len(recent_tasks),
                "recent_success_rate": round(
                    sum(1 for task in recent_tasks if task["success"]) / len(recent_tasks)
                    if recent_tasks else 0.0, 3
                ),
                "specialization_scores": metrics.specialization_scores,
                "efficiency_score": self._calculate_efficiency_score(agent_type),
                "recommendation": self._get_agent_recommendation(agent_type)
            }
        
        return analytics
    
    def rebalance_workload(self) -> Dict[str, Any]:
        """Attempt to rebalance workload across agents."""
        rebalancing_actions = []
        
        # Find overloaded and underloaded agents
        overloaded = []
        underloaded = []
        
        for agent_type in AgentType:
            status = self.get_agent_status(agent_type)
            if status == AgentStatus.OVERLOADED:
                overloaded.append(agent_type)
            elif status == AgentStatus.IDLE:
                underloaded.append(agent_type)
        
        # Suggest task reassignments
        for overloaded_agent in overloaded:
            # Find tasks that could be reassigned
            reassignable_tasks = [
                assignment for assignment in self.active_assignments.values()
                if assignment.agent_type == overloaded_agent and assignment.priority.value < 4
            ]
            
            for task_assignment in reassignable_tasks[:2]:  # Limit reassignments
                # Find suitable underloaded agent
                for underloaded_agent in underloaded:
                    if self._agents_compatible(overloaded_agent, underloaded_agent):
                        rebalancing_actions.append({
                            "action": "reassign",
                            "task_id": task_assignment.task_id,
                            "from_agent": overloaded_agent.value,
                            "to_agent": underloaded_agent.value,
                            "reason": "load_balancing"
                        })
                        break
        
        return {
            "rebalancing_needed": len(overloaded) > 0,
            "overloaded_agents": [agent.value for agent in overloaded],
            "underloaded_agents": [agent.value for agent in underloaded],
            "suggested_actions": rebalancing_actions
        }
    
    def _get_available_agents(self, task: TaskRequest) -> List[AgentType]:
        """Get list of agents that can handle the task."""
        available = []
        
        for agent_type in AgentType:
            if (self._can_agent_handle_task(agent_type, task) and 
                self._is_agent_available(agent_type)):
                available.append(agent_type)
        
        return available
    
    def _can_agent_handle_task(self, agent_type: AgentType, task: TaskRequest) -> bool:
        """Check if agent can handle task complexity and type."""
        complexity_levels = {
            TaskComplexity.LOW: 1,
            TaskComplexity.MEDIUM: 2,
            TaskComplexity.HIGH: 3,
            TaskComplexity.CRITICAL: 4
        }
        
        # Agent max complexity levels
        agent_max_complexity = {
            AgentType.CODE: TaskComplexity.CRITICAL,
            AgentType.REASONING: TaskComplexity.HIGH,
            AgentType.CONTEXT: TaskComplexity.MEDIUM,
            AgentType.QA_DEPLOYMENT: TaskComplexity.HIGH
        }
        
        max_level = complexity_levels[agent_max_complexity[agent_type]]
        task_level = complexity_levels[task.complexity]
        
        return task_level <= max_level
    
    def _is_agent_available(self, agent_type: AgentType) -> bool:
        """Check if agent is available for new tasks."""
        current_load = self.agent_metrics[agent_type].current_load
        max_load = self.max_concurrent_tasks[agent_type]
        return current_load < max_load
    
    def _calculate_agent_score(self, agent_type: AgentType, task: TaskRequest) -> float:
        """Calculate comprehensive score for agent-task matching."""
        metrics = self.agent_metrics[agent_type]
        score = 0.0
        
        # Base score from success rate (40% weight)
        score += metrics.success_rate * 0.4
        
        # Specialization match (30% weight)
        specialization_score = self._calculate_specialization_match(agent_type, task)
        score += specialization_score * 0.3
        
        # Load factor (20% weight) - prefer less loaded agents
        load_factor = 1.0 - (metrics.current_load / self.max_concurrent_tasks[agent_type])
        score += load_factor * 0.2
        
        # Efficiency factor (10% weight) - based on completion time accuracy
        efficiency_score = self._calculate_efficiency_score(agent_type)
        score += efficiency_score * 0.1
        
        return score
    
    def _calculate_specialization_match(self, agent_type: AgentType, task: TaskRequest) -> float:
        """Calculate how well agent specializations match the task."""
        task_keywords = task.description.lower().split()
        
        # Agent specializations
        specializations = {
            AgentType.CODE: ["typescript", "python", "javascript", "implementation", "coding", "function", "class"],
            AgentType.REASONING: ["analysis", "architecture", "problem", "solving", "design", "strategy"],
            AgentType.CONTEXT: ["documentation", "research", "gathering", "context", "information"],
            AgentType.QA_DEPLOYMENT: ["testing", "deployment", "validation", "qa", "quality", "deploy"]
        }
        
        agent_specs = specializations.get(agent_type, [])
        matches = sum(1 for spec in agent_specs if any(keyword in spec for keyword in task_keywords))
        
        return matches / len(agent_specs) if agent_specs else 0.0
    
    def _calculate_efficiency_score(self, agent_type: AgentType) -> float:
        """Calculate agent efficiency based on completion time accuracy."""
        agent_tasks = [task for task in self.task_history if task["agent_type"] == agent_type.value]
        
        if not agent_tasks:
            return 0.5  # Neutral score for new agents
        
        # Calculate accuracy of time estimates
        accuracies = []
        for task in agent_tasks[-10:]:  # Last 10 tasks
            estimated = task["estimated_time"]
            actual = task["completion_time"]
            if estimated > 0:
                accuracy = 1.0 - abs(estimated - actual) / estimated
                accuracies.append(max(0.0, accuracy))
        
        return statistics.mean(accuracies) if accuracies else 0.5
    
    def _estimate_completion_time(self, agent_type: AgentType, task: TaskRequest) -> float:
        """Estimate task completion time for specific agent."""
        metrics = self.agent_metrics[agent_type]
        
        # Base time from agent's average
        base_time = metrics.average_completion_time
        
        # Adjust for task complexity
        complexity_multipliers = {
            TaskComplexity.LOW: 0.5,
            TaskComplexity.MEDIUM: 1.0,
            TaskComplexity.HIGH: 2.0,
            TaskComplexity.CRITICAL: 4.0
        }
        
        adjusted_time = base_time * complexity_multipliers[task.complexity]
        
        # Adjust for current load
        load_factor = 1.0 + (metrics.current_load * 0.2)
        
        return adjusted_time * load_factor
    
    def _get_agent_recommendation(self, agent_type: AgentType) -> str:
        """Get recommendation for agent optimization."""
        metrics = self.agent_metrics[agent_type]
        status = self.get_agent_status(agent_type)
        
        if status == AgentStatus.OVERLOADED:
            return "Reduce load or increase concurrent task limit"
        elif metrics.success_rate < 0.7:
            return "Review task assignments and provide additional training"
        elif metrics.average_completion_time > 120:  # 2 hours
            return "Optimize for faster completion times"
        elif status == AgentStatus.IDLE:
            return "Consider assigning more tasks"
        else:
            return "Operating optimally"
    
    def _agents_compatible(self, agent1: AgentType, agent2: AgentType) -> bool:
        """Check if agents have compatible capabilities for task reassignment."""
        # Simple compatibility check
        compatible_pairs = {
            AgentType.CODE: [AgentType.REASONING],
            AgentType.REASONING: [AgentType.CODE, AgentType.CONTEXT],
            AgentType.CONTEXT: [AgentType.REASONING],
            AgentType.QA_DEPLOYMENT: [AgentType.CODE]
        }
        
        return agent2 in compatible_pairs.get(agent1, [])
    
    def _initialize_agent_metrics(self) -> None:
        """Initialize default metrics for all agents."""
        for agent_type in AgentType:
            self.agent_metrics[agent_type] = AgentMetrics(
                agent_type=agent_type,
                total_tasks_completed=0,
                success_rate=0.85,  # Default optimistic rate
                average_completion_time=60.0,  # 1 hour default
                current_load=0,
                max_concurrent_tasks=self.max_concurrent_tasks[agent_type],
                specialization_scores={},
                last_updated=time.time()
            )
    
    def _load_metrics(self) -> None:
        """Load agent metrics from file."""
        if self.metrics_file.exists():
            try:
                with open(self.metrics_file, 'r') as f:
                    data = json.load(f)
                    
                for agent_type_str, metrics_data in data.get('agent_metrics', {}).items():
                    agent_type = AgentType(agent_type_str)
                    self.agent_metrics[agent_type] = AgentMetrics(**metrics_data)
                
                self.task_history = data.get('task_history', [])
            except Exception as e:
                print(f"Warning: Could not load metrics from {self.metrics_file}: {e}")
    
    def _save_metrics(self) -> None:
        """Save agent metrics to file."""
        try:
            data = {
                'agent_metrics': {
                    agent_type.value: asdict(metrics)
                    for agent_type, metrics in self.agent_metrics.items()
                },
                'task_history': self.task_history[-1000:],  # Keep last 1000 tasks
                'last_updated': time.time()
            }
            
            with open(self.metrics_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Warning: Could not save metrics to {self.metrics_file}: {e}")

# Usage example
def main():
    manager = AgentManager()
    
    # Example task
    task = TaskRequest(
        task_id="AGENT-TEST-001",
        description="Implement complex algorithm with TypeScript",
        complexity=TaskComplexity.HIGH,
        target_files=["src/algorithm.ts"],
        context="Performance-critical implementation",
        priority=3
    )
    
    # Select optimal agent
    agent, confidence = manager.select_optimal_agent(task)
    print(f"Selected agent: {agent.value} (confidence: {confidence:.3f})")
    
    # Assign task
    assignment = manager.assign_task(task, agent)
    print(f"Task assigned: {assignment}")
    
    # Show analytics
    analytics = manager.get_performance_analytics()
    print(f"Performance analytics: {json.dumps(analytics, indent=2)}")

if __name__ == "__main__":
    main()