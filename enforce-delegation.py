import re
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

class TaskComplexity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class TrustLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

@dataclass
class EnforcementContext:
    message: str
    history: List[str]
    task_id: str
    timestamp: float
    
@dataclass
class EnforcementResult:
    allowed: bool
    reason: str
    recommended_action: Optional[str] = None
    delegated_agent: Optional[str] = None

@dataclass
class TrustMetrics:
    complexity: TaskComplexity
    historical_success_rate: float
    context_completeness: float
    
@dataclass
class AgentSelection:
    agent_name: str
    confidence: float
    reason: str
    
class TrustCalibrationSystem:
    def __init__(self):
        self.agent_success_history: Dict[str, List[bool]] = {}
        self.complexity_patterns = {
            TaskComplexity.LOW: [r'\b(read|list|show|display)\b'],
            TaskComplexity.MEDIUM: [r'\b(modify|update|change|add|remove)\b'],
            TaskComplexity.HIGH: [r'\b(implement|build|install|create|function|class)\b']
        }
    
    def assess_complexity(self, context: EnforcementContext) -> TaskComplexity:
        text = context.message.lower()
        for complexity, patterns in self.complexity_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text):
                    return complexity
        return TaskComplexity.LOW
    
    def calculate_context_completeness(self, context: EnforcementContext) -> float:
        required_elements = ['task', 'objective', 'constraint', 'output']
        found_elements = sum(1 for element in required_elements if element in context.message.lower())
        return found_elements / len(required_elements)
    
    def get_historical_success_rate(self, agent_name: str) -> float:
        history = self.agent_success_history.get(agent_name, [])
        if not history:
            return 0.8  # Default confidence
        return sum(history) / len(history)
    
    def calculate_trust_metrics(self, context: EnforcementContext, agent_name: str) -> TrustMetrics:
        return TrustMetrics(
            complexity=self.assess_complexity(context),
            historical_success_rate=self.get_historical_success_rate(agent_name),
            context_completeness=self.calculate_context_completeness(context)
        )
    
    def should_delegate(self, metrics: TrustMetrics) -> bool:
        # High complexity tasks need delegation regardless of trust
        if metrics.complexity == TaskComplexity.HIGH:
            return True
        
        # Medium complexity with low context completeness
        if metrics.complexity == TaskComplexity.MEDIUM and metrics.context_completeness < 0.6:
            return True
            
        # Low historical success rate
        if metrics.historical_success_rate < 0.7:
            return True
            
        return False

class OrchestratorAgent:
    def __init__(self):
        self.allowed_tools = {
            'Read', 'Glob', 'Grep', 'mcp__*', 'Task', 'TodoWrite', 
            'WebFetch', 'WebSearch', 'task_create', 'launch_subagent', 
            'add_context', 'finish'
        }
        
        self.blocked_commands = {
            'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash',
            'mv', 'rm', 'cp', 'mkdir', 'touch', 'echo', 'sed', 'awk',
            'chmod', 'chown'
        }
        
        self.code_keywords = {
            'implement', 'write', 'modify', 'create', 'update', 'delete',
            'function', 'class', 'method', 'component', 'fix', 'add',
            'remove', 'change', 'build', 'install'
        }
        
        self.code_patterns = [
            r'```[a-zA-Z]*\n',  # Code blocks
            r'import\s+[a-zA-Z]',  # Import statements
            r'def\s+[a-zA-Z]',  # Function definitions
            r'class\s+[A-Z][a-zA-Z]',  # Class definitions
            r'function\s*[a-zA-Z]',  # JS function
            r'=>',  # Arrow functions
        ]
        
        self.last_enforcement_time = 0
        self.attempt_patterns: Dict[str, int] = {}
        self.trust_system = TrustCalibrationSystem()
    
    def _check_tool_whitelist(self, tool_name: str) -> bool:
        # Mathematical verification - no implementation tools allowed
        implementation_tools = {'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash'}
        
        # Verify no overlap between allowed tools and implementation tools
        forbidden_overlap = self.allowed_tools.intersection(implementation_tools)
        if forbidden_overlap:
            raise SecurityError(f"CRITICAL: Implementation tools found in whitelist: {forbidden_overlap}")
            
        # Check if tool is explicitly allowed
        if tool_name in self.allowed_tools:
            return True
            
        # Check for pattern matches (e.g., mcp__*)
        for pattern in self.allowed_tools:
            if '*' in pattern and re.match(pattern.replace('*', '.*'), tool_name):
                return True
                
        return False
    
    def _check_command_patterns(self, message: str) -> List[str]:
        blocked = []
        
        # Direct command blocking
        for cmd in self.blocked_commands:
            if cmd.lower() in message.lower():
                blocked.append(cmd)
        
        # Regex pattern blocking for file operations
        file_modification_patterns = [
            r'\b(mv|cp|rm|mkdir|touch)\s+',
            r'\b(echo\s+.*>\s*)',
            r'\b(>>|>|<)\s*[\w./]',
            r'\b(sed|awk)\s+.*[\'\"]',
            r'\b(chmod|chown)\s+'
        ]
        
        for pattern in file_modification_patterns:
            if re.search(pattern, message, re.IGNORECASE):
                blocked.append(f"pattern: {pattern}")
                
        # Hidden bypass prevention
        hidden_patterns = [
            r'\\x[0-9a-fA-F]{2}',  # Hex encoding
            r'\\[0-7]{3}',         # Octal encoding
            r'\\u[0-9a-fA-F]{4}', # Unicode
            r'base64\s*-d',         # Base64 decoding
            r'eval\s*\(',           # Eval functions
        ]
        
        for pattern in hidden_patterns:
            if re.search(pattern, message, re.IGNORECASE):
                blocked.append(f"hidden bypass: {pattern}")
                
        return blocked
    
    def _check_delegation_triggers(self, message: str) -> List[str]:
        triggers = []
        
        for keyword in self.code_keywords:
            if keyword in message.lower():
                triggers.append(keyword)
                
        return triggers
    
    def _check_code_patterns(self, message: str) -> List[str]:
        patterns_found = []
        
        for pattern in self.code_patterns:
            if re.search(pattern, message):
                patterns_found.append(pattern)
                
        return patterns_found
    
    def _analyze_context_intent(self, context: EnforcementContext) -> bool:
        # Check conversation history for coding intent
        coding_indicators = 0
        
        for history_item in context.history[-3:]:  # Last 3 items
            if any(keyword in history_item.lower() for keyword in self.code_keywords):
                coding_indicators += 1
                
        # Check for code-like structure in message
        lines = context.message.split('\n')
        code_structure_indicators = [
            line.strip().startswith(('def ', 'class ', 'function ', 'import ', 'from '))
            for line in lines
        ]
        
        code_structure_score = sum(code_structure_indicators) / max(len(lines), 1)
        
        # High probability of coding intent
        return coding_indicators >= 2 or code_structure_score > 0.3
    
    def _enforce_cooling_period(self) -> bool:
        current_time = time.time()
        if current_time - self.last_enforcement_time < 5:
            return False
        self.last_enforcement_time = current_time
        return True
    
    def _track_attempt_patterns(self, context: EnforcementContext):
        pattern_key = f"{context.task_id}:{hash(context.message) % 1000}"
        self.attempt_patterns[pattern_key] = self.attempt_patterns.get(pattern_key, 0) + 1
    
    def _select_appropriate_agent(self, context: EnforcementContext) -> AgentSelection:
        message = context.message.lower()
        
        # Agent selection based on task type
        if any(word in message for word in ['web', 'search', 'url', 'http']):
            return AgentSelection('WebResearchAgent', 0.95, 'Web-related task detected')
        
        if any(word in message for word in ['file', 'read', 'list', 'directory']):
            return AgentSelection('FileOperationsAgent', 0.90, 'File operations required')
            
        if any(word in message for word in ['implement', 'code', 'function', 'class']):
            return AgentSelection('CodeImplementationAgent', 0.95, 'Code implementation needed')
            
        if any(word in message for word in ['test', 'verify', 'check']):
            return AgentSelection('TestingAgent', 0.85, 'Testing/validation required')
            
        return AgentSelection('GeneralPurposeAgent', 0.70, 'General task delegation')
    
    def enforce_delegation(self, context: EnforcementContext) -> EnforcementResult:
        # Level 4: Context Awareness
        if not self._enforce_cooling_period():
            return EnforcementResult(
                False, 
                "Cooling period enforced", 
                "Wait 5 seconds between requests"
            )
        
        self._track_attempt_patterns(context)
        
        # Level 1: Tool Whitelist
        # This would be checked at the tool execution level
        
        # Level 2: Command Pattern Blocking
        blocked_commands = self._check_command_patterns(context.message)
        if blocked_commands:
            return EnforcementResult(
                False, 
                f"Blocked commands detected: {', '.join(blocked_commands)}"
            )
        
        # Level 3: Delegation Enforcement
        delegation_triggers = self._check_delegation_triggers(context.message)
        code_patterns = self._check_code_patterns(context.message)
        context_intent = self._analyze_context_intent(context)
        
        # Escalate if any code-related activity detected
        if delegation_triggers or code_patterns or context_intent:
            # Trust calibration
            selected_agent = self._select_appropriate_agent(context)
            trust_metrics = self.trust_system.calculate_trust_metrics(context, selected_agent.agent_name)
            
            if self.trust_system.should_delegate(trust_metrics):
                return EnforcementResult(
                    False,
                    f"Delegation required: {', '.join(delegation_triggers)} detected",
                    f"Delegating to {selected_agent.agent_name}",
                    selected_agent.agent_name
                )
            else:
                return EnforcementResult(
                    True,
                    f"Direct handling allowed (trust metrics: {trust_metrics})",
                    None,
                    None
                )
        
        # No delegation needed
        return EnforcementResult(
            True,
            "No delegation triggers detected",
            None,
            None
        )
    
    def add_task_context(self, task_id: str, context: str):
        # Strategic context management without execution
        pass
    
    def coordinate_agents(self, task_id: str, agents: List[str]) -> str:
        # Agent selection and coordination logic
        return f"Coordinating {len(agents)} agents for task {task_id}"
    
    def finish_task(self, task_id: str, result: str):
        # Task completion without implementation
        pass

class SecurityError(Exception):
    pass

# Global orchestrator instance
ORCHESTRATOR_AGENT = OrchestratorAgent()

# Main enforcement function
def enforce_delegation(context: EnforcementContext) -> EnforcementResult:
    return ORCHESTRATOR_AGENT.enforce_delegation(context)
