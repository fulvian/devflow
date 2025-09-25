# Task: Automatic Context Clearing Hook

**Task ID**: automatic-context-clearing-hook  
**Created**: 2025-09-25  
**Status**: pending  
**Priority**: medium  
**Type**: enhancement  

---

## Project Overview

Create an intelligent **Dual-Trigger Context Management System** that automatically saves session state to database and clears context (`/clear`) in two scenarios:
1. **Task Creation**: When new task creation is detected
2. **Context Limit**: When context window approaches limits (replacing Claude's token-expensive compaction)

### Business Value
- **Token Cost Savings**: Eliminates expensive Sonnet token usage for context compaction (~1000 tokens/session)
- **Complete State Preservation**: 100% information retention vs 35-67% loss in compression
- **Automated Workflow**: Zero manual context management overhead
- **Performance Optimization**: Local database operations vs slow API compaction calls
- **Enhanced Intelligence**: Context reload optimized by Cometa Brain database structure

---

## Context7 Research Summary

Based on research from Claude Code Hooks Mastery and Context7 patterns:

### Key Insights from Hook Systems
1. **UserPromptSubmit Hook Architecture**: Perfect trigger point for detecting task creation intent
2. **Session State Management**: Critical for maintaining cross-session state
3. **Command Execution Patterns**: Safe execution of `/clear` command through hooks
4. **Security Validation**: Input sanitization and pattern matching for task detection
5. **Collaborative Reasoning Patterns**: Session context management across multiple interactions

### Technical Patterns Applied
- **Standard Hook Pattern**: Leverage existing `standard_hook_pattern.py` base class
- **Natural Language Processing**: Pattern matching for task creation intent detection
- **State Management**: Session persistence for hook intelligence
- **Command Execution**: Safe `/clear` command invocation
- **Context Injection**: Provide feedback to user about context clearing

---

## Current System Architecture Analysis

### Existing Hook Infrastructure
- **Settings Location**: `.claude/settings.json` - Central hook configuration
- **Hook Types**: UserPromptSubmit, PreToolUse, PostToolUse, SessionStart, Stop, SubagentStop
- **Base Pattern**: `base/standard_hook_pattern.py` - Standardized hook implementation
- **Active Hooks**: 11 active hooks including project creation detection

### Task Creation Detection Points
Current triggers in `natural-language-project-creation.py`:
```python
project_creation_patterns = [
    r"(?i)(creiamo|facciamo)\s+(un\s+)?nuovo\s+(task|progetto|sistema|piattaforma)",
    r"(?i)dobbiamo\s+(implementare|creare|sviluppare|realizzare)",
    r"(?i)serve\s+(un\s+)?(progetto|task|sistema)\s+per",
    r"(?i)facciamo\s+(una\s+)?feature\s+per",
    r"(?i)(create|implement|develop|build)\s+(a\s+)?(new\s+)?(system|project|feature|task)",
]
```

### Integrated Systems
- **Cometa Brain**: Task management and NLP processing
- **Unified Database**: `./data/devflow_unified.sqlite` 
- **Session Management**: `.claude/state/` directory structure
- **Cross-Verification**: Multi-agent verification system

---

## Implementation Plan

### Phase 1: Dual-Trigger Architecture Design (3 hours)
**Deliverables:**
- Dual-trigger context management specification
- Context window monitoring system design
- Complete session state preservation schema
- Context compaction replacement strategy
- Safety mechanisms and rollback procedures

**Technical Tasks:**
1. Design `DualTriggerContextManager` class with both UserPromptSubmit and Context Limit triggers
2. Create context window usage monitoring system (>90% threshold detection)
3. Design complete session state preservation schema for database storage
4. Specify context compaction replacement with intelligent reload
5. Create comprehensive error handling and rollback mechanisms

### Phase 2: Dual-Trigger Implementation (5 hours)
**Deliverables:**
- Complete dual-trigger hook system
- Context window monitoring implementation
- Comprehensive session state preservation
- Context compaction replacement system
- Integration with Cometa Brain database

**Technical Tasks:**
1. Implement `DualTriggerContextManager` with both trigger types
2. Build context window usage monitoring (token counting + threshold detection)
3. Create complete session state capture and database storage
4. Implement intelligent context reload from Cometa Brain database
5. Replace Claude's context compaction with clear+reload system
6. Add comprehensive user notifications and confirmation options

### Phase 3: Integration & Testing (3 hours)
**Deliverables:**
- Hook registered in `.claude/settings.json`
- Integration tests with existing workflow
- Performance benchmarks and optimization
- User experience validation

**Technical Tasks:**
1. Register hook in Claude Code settings
2. Test integration with natural language project creation
3. Validate hook execution order and dependencies
4. Performance testing with context size limits
5. User acceptance testing with real task creation scenarios
6. Cross-verification with existing hook system

### Phase 4: Enhancement & Documentation (2 hours)
**Deliverables:**
- Comprehensive documentation
- Configuration options for customization
- Monitoring and analytics integration
- Maintenance procedures

**Technical Tasks:**
1. Document hook architecture and usage patterns
2. Create configuration options for pattern customization
3. Integrate with performance monitoring system
4. Create troubleshooting and maintenance guides
5. Update existing documentation for workflow changes

---

## Technical Specification

### Hook Class Structure
```python
class AutoContextClearingHook(UserPromptSubmitHook):
    """
    Context7-compliant hook for automatic context clearing on task creation
    
    Features:
    - Multilingual task creation pattern detection
    - Session state management for intelligent decisions
    - Safe command execution with rollback capability
    - User notification and confirmation system
    - Integration with Cometa Brain task management
    """
```

### Detection Patterns
**Task Creation Triggers:**
- Natural language patterns (Italian/English)
- Command patterns (`/cometa`, task creation commands)
- Database task creation API calls
- Project planning phase transitions

**Context Size Triggers:**
- Token count approaching limits (>90% context usage)
- Context complexity indicators
- Session duration thresholds

### Safety Mechanisms
1. **User Confirmation**: Optional confirmation before context clearing
2. **State Preservation**: Save critical session state before clearing
3. **Rollback Capability**: Restore context if clearing fails
4. **Error Handling**: Graceful degradation on execution errors
5. **Audit Logging**: Complete audit trail for all clearing events

### Integration Points
1. **UserPromptSubmit Hook**: Primary trigger mechanism
2. **Natural Language Project Creation**: Enhanced with context management
3. **Cometa Brain**: Task creation workflow integration
4. **Session State Management**: Cross-session intelligence
5. **Performance Monitoring**: Context efficiency metrics

---

## Expected Outcomes

### Primary Outcomes
1. **Automatic Context Management**: Zero-friction context clearing on task creation
2. **Improved Performance**: Optimal token usage for new tasks
3. **Enhanced UX**: Seamless task creation workflow
4. **Reduced Manual Overhead**: Eliminated need for manual `/clear` commands

### Secondary Benefits
1. **Analytics**: Context usage patterns and optimization insights
2. **Customization**: User-configurable detection patterns
3. **System Integration**: Enhanced DevFlow orchestration efficiency
4. **Quality Assurance**: Consistent context management across all tasks

### Success Metrics
- **Context Efficiency**: 95% optimal context usage for new tasks
- **User Satisfaction**: Seamless task creation experience
- **Performance Improvement**: 20% reduction in context-related delays
- **Automation Rate**: 90% of task creations trigger automatic context clearing

---

## Risk Assessment & Mitigation

### Technical Risks
1. **False Positives**: Inappropriate context clearing
   - *Mitigation*: Sophisticated pattern matching with confidence scoring
   
2. **Context Loss**: Critical information lost during clearing
   - *Mitigation*: State preservation and selective context retention
   
3. **Performance Impact**: Hook execution overhead
   - *Mitigation*: Optimized pattern matching and async processing
   
4. **Integration Conflicts**: Conflicts with existing hooks
   - *Mitigation*: Careful hook execution order and dependency management

### Operational Risks
1. **User Confusion**: Unexpected context clearing behavior
   - *Mitigation*: Clear user notifications and optional confirmation
   
2. **Workflow Disruption**: Interruption of ongoing work
   - *Mitigation*: Intelligent timing and user preference settings

---

## Implementation Timeline

**Total Estimated Time: 13 hours**

| Phase | Duration | Start | End | Key Deliverables |
|-------|----------|-------|-----|------------------|
| Phase 1: Dual-Trigger Design | 3h | Day 1 | Day 1 | Dual-trigger architecture, context monitoring |
| Phase 2: Implementation | 5h | Day 1 | Day 2 | Complete dual-trigger system, compaction replacement |
| Phase 3: Integration & Testing | 3h | Day 2 | Day 2 | Full system integration, dual-trigger validation |
| Phase 4: Documentation | 2h | Day 2 | Day 2 | Enhanced documentation, deployment |

---

## Context Manifest

### Dependencies
- Existing UserPromptSubmit hook infrastructure
- Natural language project creation system  
- Cometa Brain task management integration
- Claude Code command execution system
- Session state management framework

### Integration Requirements
- Hook registration in `.claude/settings.json`
- Database integration with `devflow_unified.sqlite`
- Cross-verification with existing hook system
- Performance monitoring integration

### Quality Gates
- All existing tests must pass
- No performance regression in hook execution
- User acceptance testing with task creation scenarios
- Integration testing with full DevFlow workflow

---

## Files to Create/Modify

### New Files
1. `.claude/hooks/auto-context-clearing-hook.py` - Main implementation
2. `tests/hooks/test_auto_context_clearing.py` - Test suite
3. `docs/hooks/auto-context-clearing.md` - Documentation

### Modified Files  
1. `.claude/settings.json` - Hook registration
2. `.claude/hooks/natural-language-project-creation.py` - Integration enhancement
3. `README.md` - Feature documentation update

---

## Verification Checklist

### Implementation Verification
- [ ] Hook implements Context7 patterns correctly
- [ ] Pattern detection covers all task creation scenarios
- [ ] Session state management preserves critical information
- [ ] Command execution includes safety mechanisms
- [ ] Error handling and rollback procedures work correctly

### Integration Verification
- [ ] Hook integrates seamlessly with existing project creation workflow
- [ ] No conflicts with other UserPromptSubmit hooks
- [ ] Performance impact is within acceptable limits
- [ ] User feedback and notification system works correctly

### Quality Verification
- [ ] All tests pass including new test suite
- [ ] Code follows DevFlow architecture standards
- [ ] Documentation is comprehensive and accurate
- [ ] User experience meets acceptance criteria

---

*This task follows the DevFlow Cometa Brain Protocol for project planning and implementation. All development must use the Unified Orchestrator system and comply with the 100-line limit enforcement.*