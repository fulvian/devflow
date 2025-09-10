# Trust Calibration System - Adaptive Delegation Based on Historical Performance
import json
import time
import math
import statistics
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path

from orchestrator import AgentType, TaskComplexity, TaskRequest

class TrustLevel(Enum):
    UNTRUSTED = "untrusted"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ContextCompleteness(Enum):
    INSUFFICIENT = "insufficient"
    MINIMAL = "minimal"
    ADEQUATE = "adequate"
    COMPREHENSIVE = "comprehensive"

class DecisionType(Enum):
    STRATEGIC = "strategic"
    TACTICAL = "tactical"

@dataclass
class TrustMetrics:
    agent_type: AgentType
    trust_level: TrustLevel
    success_count: int
    failure_count: int
    total_tasks: int
    confidence_intervals: Dict[str, float]
    context_dependency: float
    strategic_vs_tactical_ratio: float
    last_updated: float

@dataclass
class CalibrationResult:
    should_delegate: bool
    recommended_agent: AgentType
    trust_score: float
    confidence_level: float
    required_context_level: ContextCompleteness
    risk_assessment: Dict[str, float]
    calibration_notes: List[str]

class TrustCalibrationSystem:
    """Adaptive delegation system with trust calibration based on historical success rates and context completeness."""
    
    def __init__(self, calibration_file: str = "orchestration/trust_calibration.json"):
        self.calibration_file = Path(calibration_file)
        self.calibration_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Trust metrics for each agent
        self.trust_metrics: Dict[AgentType, TrustMetrics] = {}
        
        # Calibration parameters
        self.min_tasks_for_calibration = 5
        self.trust_decay_rate = 0.05  # Weekly decay if no activity
        self.context_weight = 0.3
        self.historical_weight = 0.7
        
        # Risk thresholds
        self.risk_thresholds = {
            TrustLevel.UNTRUSTED: 0.2,
            TrustLevel.LOW: 0.5,
            TrustLevel.MEDIUM: 0.7,
            TrustLevel.HIGH: 0.85,
            TrustLevel.CRITICAL: 0.95
        }
        
        # Decision matrix weights
        self.decision_weights = {
            'complexity_match': 0.25,
            'historical_success': 0.30,
            'context_completeness': 0.20,
            'agent_specialization': 0.15,
            'current_load': 0.10
        }
        
        self._initialize_trust_metrics()
        self._load_calibration_data()
    
    def calibrate_delegation(self, task: TaskRequest, available_agents: List[AgentType], 
                           context_completeness: ContextCompleteness) -> CalibrationResult:
        """Main calibration method that determines optimal delegation strategy."""
        
        calibration_notes = []
        
        # Assess task requirements
        decision_type = self._classify_decision_type(task)
        risk_level = self._assess_task_risk(task)
        
        calibration_notes.append(f"Task classified as {decision_type.value} with {risk_level:.2f} risk")
        
        # Calculate trust scores for available agents
        agent_scores = {}
        for agent_type in available_agents:
            trust_score = self._calculate_trust_score(agent_type, task, context_completeness)
            agent_scores[agent_type] = trust_score
            calibration_notes.append(f"Agent {agent_type.value}: trust score {trust_score:.3f}")
        
        if not agent_scores:
            return CalibrationResult(
                should_delegate=False,
                recommended_agent=None,
                trust_score=0.0,
                confidence_level=0.0,
                required_context_level=ContextCompleteness.COMPREHENSIVE,
                risk_assessment={"error": 1.0},
                calibration_notes=["No available agents"]
            )
        
        # Select best agent
        best_agent = max(agent_scores.keys(), key=lambda a: agent_scores[a])
        best_score = agent_scores[best_agent]
        
        # Determine if delegation should proceed
        should_delegate = self._should_delegate_task(best_score, risk_level, context_completeness)
        
        # Calculate confidence level
        confidence = self._calculate_confidence_level(best_score, agent_scores)
        
        # Assess required context level
        required_context = self._determine_required_context(task, best_agent, best_score)
        
        # Generate risk assessment
        risk_assessment = self._generate_risk_assessment(task, best_agent, best_score, context_completeness)
        
        calibration_notes.append(f"Delegation decision: {should_delegate} (confidence: {confidence:.3f})")
        
        return CalibrationResult(
            should_delegate=should_delegate,
            recommended_agent=best_agent,
            trust_score=best_score,
            confidence_level=confidence,
            required_context_level=required_context,
            risk_assessment=risk_assessment,
            calibration_notes=calibration_notes
        )
    
    def update_trust_metrics(self, agent_type: AgentType, task: TaskRequest, 
                           success: bool, context_quality: float) -> None:
        """Update trust metrics based on task completion results."""
        
        metrics = self.trust_metrics[agent_type]
        
        # Update basic counters
        metrics.total_tasks += 1
        if success:
            metrics.success_count += 1
        else:
            metrics.failure_count += 1
        
        # Update context dependency
        alpha = 0.1  # Learning rate
        if success:
            # Good performance with good context increases dependency
            context_effect = context_quality * 0.5
        else:
            # Poor performance suggests higher context dependency
            context_effect = (1.0 - context_quality) * 0.3
        
        metrics.context_dependency = (1 - alpha) * metrics.context_dependency + alpha * context_effect
        
        # Update strategic vs tactical ratio
        decision_type = self._classify_decision_type(task)
        if decision_type == DecisionType.STRATEGIC:
            strategic_weight = 1.0
        else:
            strategic_weight = 0.0
        
        metrics.strategic_vs_tactical_ratio = (1 - alpha) * metrics.strategic_vs_tactical_ratio + alpha * strategic_weight
        
        # Calculate new trust level
        new_trust_level = self._calculate_trust_level(metrics)
        metrics.trust_level = new_trust_level
        
        # Update confidence intervals
        self._update_confidence_intervals(metrics)
        
        metrics.last_updated = time.time()
        
        self._save_calibration_data()
    
    def get_trust_assessment(self, agent_type: AgentType) -> Dict[str, Any]:
        """Get comprehensive trust assessment for an agent."""
        metrics = self.trust_metrics[agent_type]
        
        # Calculate success rate with confidence interval
        success_rate = metrics.success_count / max(1, metrics.total_tasks)
        
        # Wilson score interval for better confidence estimation
        n = metrics.total_tasks
        if n > 0:
            z = 1.96  # 95% confidence
            p = success_rate
            lower_bound = (p + z*z/(2*n) - z*math.sqrt((p*(1-p) + z*z/(4*n))/n)) / (1 + z*z/n)
            upper_bound = (p + z*z/(2*n) + z*math.sqrt((p*(1-p) + z*z/(4*n))/n)) / (1 + z*z/n)
        else:
            lower_bound = upper_bound = 0.0
        
        # Calculate trust stability
        recent_performance = self._calculate_recent_performance(agent_type)
        trust_stability = 1.0 - abs(success_rate - recent_performance)
        
        return {
            "agent_type": agent_type.value,
            "trust_level": metrics.trust_level.value,
            "success_rate": round(success_rate, 3),
            "confidence_interval": [round(lower_bound, 3), round(upper_bound, 3)],
            "total_tasks": metrics.total_tasks,
            "context_dependency": round(metrics.context_dependency, 3),
            "strategic_tactical_ratio": round(metrics.strategic_vs_tactical_ratio, 3),
            "trust_stability": round(trust_stability, 3),
            "calibration_status": "calibrated" if n >= self.min_tasks_for_calibration else "learning",
            "last_updated": metrics.last_updated
        }
    
    def recommend_context_improvement(self, agent_type: AgentType, task: TaskRequest) -> Dict[str, Any]:
        """Recommend context improvements to increase delegation success."""
        metrics = self.trust_metrics[agent_type]
        
        recommendations = []
        
        # Analyze context dependency
        if metrics.context_dependency > 0.7:
            recommendations.append({
                "type": "high_context_dependency",
                "suggestion": "Provide comprehensive context and examples",
                "importance": "critical"
            })
        
        # Analyze task complexity vs agent capability
        if task.complexity in [TaskComplexity.HIGH, TaskComplexity.CRITICAL]:
            recommendations.append({
                "type": "complex_task",
                "suggestion": "Include architectural diagrams and detailed specifications",
                "importance": "high"
            })
        
        # Analyze historical performance
        success_rate = metrics.success_count / max(1, metrics.total_tasks)
        if success_rate < 0.7:
            recommendations.append({
                "type": "low_success_rate",
                "suggestion": "Add examples of similar successful implementations",
                "importance": "high"
            })
        
        # Strategic vs tactical analysis
        if metrics.strategic_vs_tactical_ratio > 0.6 and task.complexity == TaskComplexity.LOW:
            recommendations.append({
                "type": "strategic_agent_tactical_task",
                "suggestion": "Consider using tactical agent for better efficiency",
                "importance": "medium"
            })
        
        return {
            "agent_type": agent_type.value,
            "task_complexity": task.complexity.value,
            "context_recommendations": recommendations,
            "minimum_context_level": self._determine_required_context(task, agent_type, success_rate).value
        }
    
    def get_calibration_summary(self) -> Dict[str, Any]:
        """Get overall calibration system summary."""
        total_tasks = sum(metrics.total_tasks for metrics in self.trust_metrics.values())
        total_successes = sum(metrics.success_count for metrics in self.trust_metrics.values())
        
        overall_success_rate = total_successes / max(1, total_tasks)
        
        trust_distribution = {}
        for trust_level in TrustLevel:
            count = sum(1 for metrics in self.trust_metrics.values() if metrics.trust_level == trust_level)
            trust_distribution[trust_level.value] = count
        
        calibrated_agents = sum(1 for metrics in self.trust_metrics.values() 
                              if metrics.total_tasks >= self.min_tasks_for_calibration)
        
        return {
            "total_tasks_processed": total_tasks,
            "overall_success_rate": round(overall_success_rate, 3),
            "trust_distribution": trust_distribution,
            "calibrated_agents": calibrated_agents,
            "total_agents": len(self.trust_metrics),
            "calibration_parameters": {
                "min_tasks_for_calibration": self.min_tasks_for_calibration,
                "trust_decay_rate": self.trust_decay_rate,
                "context_weight": self.context_weight,
                "historical_weight": self.historical_weight
            },
            "system_health": "optimal" if overall_success_rate > 0.8 else "needs_improvement"
        }
    
    def _calculate_trust_score(self, agent_type: AgentType, task: TaskRequest, 
                             context_completeness: ContextCompleteness) -> float:
        """Calculate comprehensive trust score for agent-task combination."""
        metrics = self.trust_metrics[agent_type]
        
        # Historical success component
        if metrics.total_tasks >= self.min_tasks_for_calibration:
            historical_score = metrics.success_count / metrics.total_tasks
        else:
            # Use default optimistic score for new agents
            historical_score = 0.75
        
        # Context completeness component
        context_scores = {
            ContextCompleteness.INSUFFICIENT: 0.2,
            ContextCompleteness.MINIMAL: 0.5,
            ContextCompleteness.ADEQUATE: 0.8,
            ContextCompleteness.COMPREHENSIVE: 1.0
        }
        context_score = context_scores[context_completeness]
        
        # Adjust context score based on agent's context dependency
        adjusted_context_score = context_score * (1.0 + metrics.context_dependency)
        adjusted_context_score = min(1.0, adjusted_context_score)
        
        # Complexity match component
        complexity_match = self._calculate_complexity_match(agent_type, task)
        
        # Specialization match component
        specialization_match = self._calculate_specialization_match(agent_type, task)
        
        # Load factor (lower load = higher score)
        load_factor = 1.0  # Assume optimal load for now
        
        # Weighted combination
        trust_score = (
            self.decision_weights['historical_success'] * historical_score +
            self.decision_weights['context_completeness'] * adjusted_context_score +
            self.decision_weights['complexity_match'] * complexity_match +
            self.decision_weights['agent_specialization'] * specialization_match +
            self.decision_weights['current_load'] * load_factor
        )
        
        return min(1.0, trust_score)
    
    def _classify_decision_type(self, task: TaskRequest) -> DecisionType:
        """Classify task as strategic or tactical decision."""
        strategic_keywords = [
            'architecture', 'design', 'strategy', 'framework', 'system',
            'infrastructure', 'orchestration', 'coordination', 'planning'
        ]
        
        tactical_keywords = [
            'implement', 'code', 'function', 'method', 'fix', 'debug',
            'optimize', 'refactor', 'test', 'deploy'
        ]
        
        description_lower = task.description.lower()
        
        strategic_matches = sum(1 for keyword in strategic_keywords if keyword in description_lower)
        tactical_matches = sum(1 for keyword in tactical_keywords if keyword in description_lower)
        
        return DecisionType.STRATEGIC if strategic_matches > tactical_matches else DecisionType.TACTICAL
    
    def _assess_task_risk(self, task: TaskRequest) -> float:
        """Assess risk level of the task."""
        risk_score = 0.0
        
        # Complexity risk
        complexity_risks = {
            TaskComplexity.LOW: 0.1,
            TaskComplexity.MEDIUM: 0.3,
            TaskComplexity.HIGH: 0.6,
            TaskComplexity.CRITICAL: 0.9
        }
        risk_score += complexity_risks[task.complexity]
        
        # File count risk
        file_count = len(task.target_files)
        if file_count > 10:
            risk_score += 0.3
        elif file_count > 5:
            risk_score += 0.2
        elif file_count > 1:
            risk_score += 0.1
        
        # Priority risk
        if task.priority >= 4:
            risk_score += 0.2
        
        return min(1.0, risk_score)
    
    def _should_delegate_task(self, trust_score: float, risk_level: float, 
                            context_completeness: ContextCompleteness) -> bool:
        """Determine if task should be delegated based on trust and risk."""
        
        # Calculate required trust threshold based on risk
        base_threshold = 0.6
        risk_adjustment = risk_level * 0.3
        required_trust = base_threshold + risk_adjustment
        
        # Adjust for context completeness
        context_adjustment = {
            ContextCompleteness.INSUFFICIENT: 0.2,
            ContextCompleteness.MINIMAL: 0.1,
            ContextCompleteness.ADEQUATE: 0.0,
            ContextCompleteness.COMPREHENSIVE: -0.1
        }
        
        required_trust += context_adjustment[context_completeness]
        
        return trust_score >= required_trust
    
    def _calculate_confidence_level(self, best_score: float, all_scores: Dict[AgentType, float]) -> float:
        """Calculate confidence level in the delegation decision."""
        if len(all_scores) == 1:
            return best_score
        
        # Calculate score gap between best and second best
        sorted_scores = sorted(all_scores.values(), reverse=True)
        if len(sorted_scores) >= 2:
            score_gap = sorted_scores[0] - sorted_scores[1]
            confidence = best_score * (1.0 + score_gap)
        else:
            confidence = best_score
        
        return min(1.0, confidence)
    
    def _determine_required_context(self, task: TaskRequest, agent_type: AgentType, 
                                  trust_score: float) -> ContextCompleteness:
        """Determine required context level for successful delegation."""
        metrics = self.trust_metrics[agent_type]
        
        # Higher context dependency requires more context
        if metrics.context_dependency > 0.8:
            return ContextCompleteness.COMPREHENSIVE
        elif metrics.context_dependency > 0.6:
            return ContextCompleteness.ADEQUATE
        elif metrics.context_dependency > 0.3:
            return ContextCompleteness.MINIMAL
        
        # Lower trust scores require more context
        if trust_score < 0.6:
            return ContextCompleteness.COMPREHENSIVE
        elif trust_score < 0.8:
            return ContextCompleteness.ADEQUATE
        else:
            return ContextCompleteness.MINIMAL
    
    def _generate_risk_assessment(self, task: TaskRequest, agent_type: AgentType, 
                                trust_score: float, context_completeness: ContextCompleteness) -> Dict[str, float]:
        """Generate comprehensive risk assessment."""
        return {
            "delegation_failure": 1.0 - trust_score,
            "insufficient_context": 1.0 - (list(ContextCompleteness).index(context_completeness) / 3),
            "complexity_mismatch": 1.0 - self._calculate_complexity_match(agent_type, task),
            "timeline_risk": self._assess_task_risk(task),
            "overall_risk": max(0.0, 1.0 - trust_score * 0.7 - (list(ContextCompleteness).index(context_completeness) / 3) * 0.3)
        }
    
    def _calculate_complexity_match(self, agent_type: AgentType, task: TaskRequest) -> float:
        """Calculate how well agent complexity capability matches task."""
        agent_capabilities = {
            AgentType.CODE: TaskComplexity.CRITICAL,
            AgentType.REASONING: TaskComplexity.HIGH,
            AgentType.CONTEXT: TaskComplexity.MEDIUM,
            AgentType.QA_DEPLOYMENT: TaskComplexity.HIGH
        }
        
        complexity_levels = {
            TaskComplexity.LOW: 1,
            TaskComplexity.MEDIUM: 2,
            TaskComplexity.HIGH: 3,
            TaskComplexity.CRITICAL: 4
        }
        
        agent_level = complexity_levels[agent_capabilities[agent_type]]
        task_level = complexity_levels[task.complexity]
        
        if agent_level >= task_level:
            # Perfect match or over-capability
            return 1.0 - (agent_level - task_level) * 0.1  # Slight penalty for over-capability
        else:
            # Under-capability
            return max(0.0, 1.0 - (task_level - agent_level) * 0.3)
    
    def _calculate_specialization_match(self, agent_type: AgentType, task: TaskRequest) -> float:
        """Calculate specialization match between agent and task."""
        # This is a simplified version - in practice, this would be more sophisticated
        agent_specializations = {
            AgentType.CODE: ['implement', 'code', 'function', 'class', 'typescript', 'python'],
            AgentType.REASONING: ['analyze', 'design', 'architecture', 'strategy'],
            AgentType.CONTEXT: ['research', 'document', 'gather', 'context'],
            AgentType.QA_DEPLOYMENT: ['test', 'deploy', 'validate', 'quality']
        }
        
        task_words = task.description.lower().split()
        agent_specs = agent_specializations.get(agent_type, [])
        
        matches = sum(1 for spec in agent_specs if any(word in spec for word in task_words))
        return matches / len(agent_specs) if agent_specs else 0.5
    
    def _calculate_trust_level(self, metrics: TrustMetrics) -> TrustLevel:
        """Calculate trust level based on metrics."""
        if metrics.total_tasks < self.min_tasks_for_calibration:
            return TrustLevel.LOW  # Default for uncalibrated agents
        
        success_rate = metrics.success_count / metrics.total_tasks
        
        for trust_level in reversed(list(TrustLevel)):
            if success_rate >= self.risk_thresholds[trust_level]:
                return trust_level
        
        return TrustLevel.UNTRUSTED
    
    def _update_confidence_intervals(self, metrics: TrustMetrics) -> None:
        """Update confidence intervals for trust metrics."""
        if metrics.total_tasks > 0:
            success_rate = metrics.success_count / metrics.total_tasks
            n = metrics.total_tasks
            
            # Wilson score interval
            z = 1.96  # 95% confidence
            p = success_rate
            
            if n > 0:
                lower = (p + z*z/(2*n) - z*math.sqrt((p*(1-p) + z*z/(4*n))/n)) / (1 + z*z/n)
                upper = (p + z*z/(2*n) + z*math.sqrt((p*(1-p) + z*z/(4*n))/n)) / (1 + z*z/n)
            else:
                lower = upper = 0.0
            
            metrics.confidence_intervals = {
                "lower_bound": max(0.0, lower),
                "upper_bound": min(1.0, upper),
                "confidence_level": 0.95
            }
    
    def _calculate_recent_performance(self, agent_type: AgentType) -> float:
        """Calculate recent performance for trust stability assessment."""
        # This would analyze recent task history - simplified for now
        metrics = self.trust_metrics[agent_type]
        if metrics.total_tasks > 0:
            return metrics.success_count / metrics.total_tasks
        return 0.0
    
    def _initialize_trust_metrics(self) -> None:
        """Initialize default trust metrics for all agents."""
        for agent_type in AgentType:
            self.trust_metrics[agent_type] = TrustMetrics(
                agent_type=agent_type,
                trust_level=TrustLevel.MEDIUM,
                success_count=0,
                failure_count=0,
                total_tasks=0,
                confidence_intervals={},
                context_dependency=0.5,
                strategic_vs_tactical_ratio=0.5,
                last_updated=time.time()
            )
    
    def _load_calibration_data(self) -> None:
        """Load calibration data from file."""
        if self.calibration_file.exists():
            try:
                with open(self.calibration_file, 'r') as f:
                    data = json.load(f)
                    
                for agent_type_str, metrics_data in data.get('trust_metrics', {}).items():
                    agent_type = AgentType(agent_type_str)
                    
                    # Convert trust level
                    trust_level_str = metrics_data.get('trust_level', 'medium')
                    trust_level = TrustLevel(trust_level_str)
                    
                    self.trust_metrics[agent_type] = TrustMetrics(
                        agent_type=agent_type,
                        trust_level=trust_level,
                        success_count=metrics_data.get('success_count', 0),
                        failure_count=metrics_data.get('failure_count', 0),
                        total_tasks=metrics_data.get('total_tasks', 0),
                        confidence_intervals=metrics_data.get('confidence_intervals', {}),
                        context_dependency=metrics_data.get('context_dependency', 0.5),
                        strategic_vs_tactical_ratio=metrics_data.get('strategic_vs_tactical_ratio', 0.5),
                        last_updated=metrics_data.get('last_updated', time.time())
                    )
            except Exception as e:
                print(f"Warning: Could not load calibration data from {self.calibration_file}: {e}")
    
    def _save_calibration_data(self) -> None:
        """Save calibration data to file."""
        try:
            data = {
                'trust_metrics': {
                    agent_type.value: asdict(metrics)
                    for agent_type, metrics in self.trust_metrics.items()
                },
                'calibration_parameters': {
                    'min_tasks_for_calibration': self.min_tasks_for_calibration,
                    'trust_decay_rate': self.trust_decay_rate,
                    'context_weight': self.context_weight,
                    'historical_weight': self.historical_weight
                },
                'last_updated': time.time()
            }
            
            with open(self.calibration_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Warning: Could not save calibration data to {self.calibration_file}: {e}")

# Usage example
def main():
    calibration_system = TrustCalibrationSystem()
    
    # Example task
    task = TaskRequest(
        task_id="TRUST-TEST-001",
        description="Implement complex TypeScript algorithm with testing",
        complexity=TaskComplexity.HIGH,
        target_files=["src/algorithm.ts", "tests/algorithm.test.ts"],
        context="Performance-critical implementation with comprehensive tests",
        priority=3
    )
    
    # Calibrate delegation
    available_agents = [AgentType.CODE, AgentType.QA_DEPLOYMENT]
    context_completeness = ContextCompleteness.ADEQUATE
    
    result = calibration_system.calibrate_delegation(task, available_agents, context_completeness)
    
    print(f"Calibration result: {result}")
    print(f"Trust assessment: {calibration_system.get_trust_assessment(result.recommended_agent)}")
    print(f"Context recommendations: {calibration_system.recommend_context_improvement(result.recommended_agent, task)}")
    print(f"System summary: {calibration_system.get_calibration_summary()}")

if __name__ == "__main__":
    main()