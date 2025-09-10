from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime, timedelta
import logging
import json
import random
import time

logger = logging.getLogger(__name__)

class FailureType(Enum):
    TRANSIENT = "transient"  # Temporary issues that may resolve
    PERMANENT = "permanent"  # Issues requiring intervention
    RESOURCE = "resource"    # Resource exhaustion
    DEPENDENCY = "dependency" # Dependency failure
    CONFIGURATION = "configuration" # Misconfiguration

class RecoveryStrategy(Enum):
    RETRY = "retry"
    ESCALATE = "escalate"
    FALLBACK = "fallback"
    SKIP = "skip"
    BLOCK = "block"

@dataclass
class FailureRecord:
    task_id: str
    failure_type: FailureType
    error_message: str
    timestamp: datetime
    retry_count: int = 0
    recovery_strategy: Optional[RecoveryStrategy] = None
    recovery_action_taken: Optional[str] = None
    recovery_timestamp: Optional[datetime] = None
    is_resolved: bool = False

@dataclass
class RetryPolicy:
    max_retries: int = 3
    backoff_factor: float = 2.0
    base_delay: float = 1.0  # seconds
    max_delay: float = 300.0  # seconds
    jitter: bool = True

@dataclass
class EscalationRule:
    failure_count_threshold: int
    time_window: timedelta
    escalation_target: str  # e.g., "admin", "supervisor", email address
    notification_message: str

class FailureRecoverySystem:
    def __init__(self):
        self.failure_records: Dict[str, List[FailureRecord]] = {}
        self.retry_policies: Dict[str, RetryPolicy] = {}
        self.escalation_rules: List[EscalationRule] = []
        self.failure_patterns: Dict[str, int] = {}  # Simple pattern tracking
        self.recovery_handlers: Dict[RecoveryStrategy, List[Callable]] = {
            RecoveryStrategy.RETRY: [],
            RecoveryStrategy.ESCALATE: [],
            RecoveryStrategy.FALLBACK: [],
            RecoveryStrategy.SKIP: [],
            RecoveryStrategy.BLOCK: []
        }
    
    def register_recovery_handler(self, strategy: RecoveryStrategy, handler: Callable):
        """Register a handler for a recovery strategy"""
        if strategy not in self.recovery_handlers:
            self.recovery_handlers[strategy] = []
        self.recovery_handlers[strategy].append(handler)
    
    def set_retry_policy(self, task_id: str, policy: RetryPolicy):
        """Set retry policy for a specific task"""
        self.retry_policies[task_id] = policy
    
    def add_escalation_rule(self, rule: EscalationRule):
        """Add an escalation rule"""
        self.escalation_rules.append(rule)
    
    def record_failure(self, task_id: str, failure_type: FailureType, 
                      error_message: str) -> FailureRecord:
        """Record a task failure"""
        failure = FailureRecord(
            task_id=task_id,
            failure_type=failure_type,
            error_message=error_message,
            timestamp=datetime.now()
        )
        
        if task_id not in self.failure_records:
            self.failure_records[task_id] = []
        
        self.failure_records[task_id].append(failure)
        
        # Update failure patterns
        pattern_key = f"{failure_type.value}:{error_message[:50]}"
        self.failure_patterns[pattern_key] = self.failure_patterns.get(pattern_key, 0) + 1
        
        # Determine recovery strategy
        strategy = self._determine_recovery_strategy(task_id, failure)
        failure.recovery_strategy = strategy
        
        logger.info(f"Recorded failure for task {task_id}: {failure_type.value} - {error_message}")
        logger.info(f"Recommended recovery strategy: {strategy.value}")
        
        return failure
    
    def _determine_recovery_strategy(self, task_id: str, failure: FailureRecord) -> RecoveryStrategy:
        """Determine the best recovery strategy for a failure"""
        # Get retry policy for this task
        retry_policy = self.retry_policies.get(task_id, RetryPolicy())
        
        # Count recent failures
        recent_failures = self._get_recent_failures(task_id, timedelta(hours=1))
        
        # Strategy decision logic
        if failure.failure_type == FailureType.TRANSIENT:
            if len(recent_failures) < retry_policy.max_retries:
                return RecoveryStrategy.RETRY
            else:
                return RecoveryStrategy.ESCALATE
        
        elif failure.failure_type == FailureType.RESOURCE:
            # For resource issues, try to retry with backoff
            if len(recent_failures) < retry_policy.max_retries:
                return RecoveryStrategy.RETRY
            else:
                return RecoveryStrategy.BLOCK  # Block until resources available
        
        elif failure.failure_type == FailureType.DEPENDENCY:
            return RecoveryStrategy.BLOCK  # Wait for dependency to be resolved
        
        elif failure.failure_type == FailureType.CONFIGURATION:
            return RecoveryStrategy.ESCALATE  # Needs human intervention
        
        elif failure.failure_type == FailureType.PERMANENT:
            return RecoveryStrategy.ESCALATE  # Needs human intervention
        
        return RecoveryStrategy.ESCALATE  # Default fallback
    
    def execute_recovery(self, task_id: str, failure: FailureRecord) -> bool:
        """Execute recovery strategy for a failure"""
        strategy = failure.recovery_strategy
        if not strategy:
            logger.error(f"No recovery strategy set for failure in task {task_id}")
            return False
        
        try:
            if strategy == RecoveryStrategy.RETRY:
                return self._execute_retry(task_id, failure)
            
            elif strategy == RecoveryStrategy.ESCALATE:
                return self._execute_escalation(task_id, failure)
            
            elif strategy == RecoveryStrategy.FALLBACK:
                return self._execute_fallback(task_id, failure)
            
            elif strategy == RecoveryStrategy.SKIP:
                return self._execute_skip(task_id, failure)
            
            elif strategy == RecoveryStrategy.BLOCK:
                return self._execute_block(task_id, failure)
            
            else:
                logger.error(f"Unknown recovery strategy: {strategy}")
                return False
                
        except Exception as e:
            logger.error(f"Error executing recovery strategy {strategy} for task {task_id}: {e}")
            return False
    
    def _execute_retry(self, task_id: str, failure: FailureRecord) -> bool:
        """Execute retry recovery strategy"""
        retry_policy = self.retry_policies.get(task_id, RetryPolicy())
        
        # Calculate delay with exponential backoff
        delay = min(
            retry_policy.base_delay * (retry_policy.backoff_factor ** failure.retry_count),
            retry_policy.max_delay
        )
        
        # Add jitter if enabled
        if retry_policy.jitter:
            delay *= (0.5 + random.random() * 0.5)
        
        logger.info(f"Retrying task {task_id} after {delay:.2f} seconds")
        
        # Execute registered retry handlers
        success = True
        for handler in self.recovery_handlers[RecoveryStrategy.RETRY]:
            try:
                handler(task_id, failure, delay)
            except Exception as e:
                logger.error(f"Retry handler failed for task {task_id}: {e}")
                success = False
        
        failure.recovery_action_taken = f"Retry with delay {delay:.2f}s"
        failure.recovery_timestamp = datetime.now()
        failure.retry_count += 1
        
        return success
    
    def _execute_escalation(self, task_id: str, failure: FailureRecord) -> bool:
        """Execute escalation recovery strategy"""
        # Check escalation rules
        for rule in self.escalation_rules:
            recent_failures = self._get_recent_failures(task_id, rule.time_window)
            if len(recent_failures) >= rule.failure_count_threshold:
                logger.warning(f"Escalating task {task_id} to {rule.escalation_target}")
                
                # Execute registered escalation handlers
                for handler in self.recovery_handlers[RecoveryStrategy.ESCALATE]:
                    try:
                        handler(task_id, failure, rule)
                    except Exception as e:
                        logger.error(f"Escalation handler failed for task {task_id}: {e}")
                
                failure.recovery_action_taken = f"Escalated to {rule.escalation_target}"
                failure.recovery_timestamp = datetime.now()
                return True
        
        # Default escalation if no specific rules matched
        logger.warning(f"Escalating task {task_id} - default escalation")
        failure.recovery_action_taken = "Default escalation"
        failure.recovery_timestamp = datetime.now()
        return True
    
    def _execute_fallback(self, task_id: str, failure: FailureRecord) -> bool:
        """Execute fallback recovery strategy"""
        logger.info(f"Executing fallback for task {task_id}")
        
        # Execute registered fallback handlers
        success = True
        for handler in self.recovery_handlers[RecoveryStrategy.FALLBACK]:
            try:
                handler(task_id, failure)
            except Exception as e:
                logger.error(f"Fallback handler failed for task {task_id}: {e}")
                success = False
        
        failure.recovery_action_taken = "Fallback executed"
        failure.recovery_timestamp = datetime.now()
        return success
    
    def _execute_skip(self, task_id: str, failure: FailureRecord) -> bool:
        """Execute skip recovery strategy"""
        logger.info(f"Skipping task {task_id} due to failure")
        
        # Execute registered skip handlers
        for handler in self.recovery_handlers[RecoveryStrategy.SKIP]:
            try:
                handler(task_id, failure)
            except Exception as e:
                logger.error(f"Skip handler failed for task {task_id}: {e}")
        
        failure.recovery_action_taken = "Task skipped"
        failure.recovery_timestamp = datetime.now()
        failure.is_resolved = True  # Mark as resolved by skipping
        return True
    
    def _execute_block(self, task_id: str, failure: FailureRecord) -> bool:
        """Execute block recovery strategy"""
        logger.info(f"Blocking task {task_id} until conditions improve")
        
        # Execute registered block handlers
        for handler in self.recovery_handlers[RecoveryStrategy.BLOCK]:
            try:
                handler(task_id, failure)
            except Exception as e:
                logger.error(f"Block handler failed for task {task_id}: {e}")
        
        failure.recovery_action_taken = "Task blocked"
        failure.recovery_timestamp = datetime.now()
        return True
    
    def _get_recent_failures(self, task_id: str, time_window: timedelta) -> List[FailureRecord]:
        """Get failures within a time window"""
        if task_id not in self.failure_records:
            return []
        
        cutoff_time = datetime.now() - time_window
        return [f for f in self.failure_records[task_id] if f.timestamp >= cutoff_time]
    
    def get_failure_statistics(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        """Get failure statistics"""
        if task_id:
            failures = self.failure_records.get(task_id, [])
            total_failures = len(failures)
            resolved_failures = len([f for f in failures if f.is_resolved])
            
            failure_types = {}
            for failure in failures:
                failure_types[failure.failure_type.value] = failure_types.get(failure.failure_type.value, 0) + 1
            
            return {
                "task_id": task_id,
                "total_failures": total_failures,
                "resolved_failures": resolved_failures,
                "resolution_rate": resolved_failures / total_failures if total_failures > 0 else 0,
                "failure_types": failure_types
            }
        else:
            # Global statistics
            all_failures = []
            for failures in self.failure_records.values():
                all_failures.extend(failures)
            
            total_failures = len(all_failures)
            resolved_failures = len([f for f in all_failures if f.is_resolved])
            
            failure_types = {}
            for failure in all_failures:
                failure_types[failure.failure_type.value] = failure_types.get(failure.failure_type.value, 0) + 1
            
            return {
                "total_failures": total_failures,
                "resolved_failures": resolved_failures,
                "resolution_rate": resolved_failures / total_failures if total_failures > 0 else 0,
                "failure_types": failure_types,
                "affected_tasks": len(self.failure_records)
            }
    
    def get_failure_patterns(self) -> Dict[str, int]:
        """Get common failure patterns"""
        return dict(sorted(self.failure_patterns.items(), key=lambda x: x[1], reverse=True))
    
    def mark_failure_resolved(self, task_id: str, failure_index: int) -> bool:
        """Mark a specific failure as resolved"""
        if task_id not in self.failure_records:
            return False
        
        failures = self.failure_records[task_id]
        if 0 <= failure_index < len(failures):
            failures[failure_index].is_resolved = True
            logger.info(f"Marked failure {failure_index} for task {task_id} as resolved")
            return True
        
        return False
    
    def export_failure_data(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        """Export failure data for analysis"""
        if task_id:
            failures = self.failure_records.get(task_id, [])
            return {
                "task_id": task_id,
                "failures": [asdict(f) for f in failures],
                "statistics": self.get_failure_statistics(task_id)
            }
        else:
            return {
                "all_failures": {tid: [asdict(f) for f in failures] 
                               for tid, failures in self.failure_records.items()},
                "statistics": self.get_failure_statistics(),
                "patterns": self.get_failure_patterns()
            }