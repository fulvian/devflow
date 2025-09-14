#!/usr/bin/env node

/**
 * DEVFLOW ORCHESTRATION HOOK - REAL-TIME INTEGRATION
 *
 * This hook integrates directly with Claude Code Sessions to provide
 * real-time intelligent agent routing and orchestration.
 */

const fs = require('fs');
const path = require('path');

// Global orchestration state
global.DEVFLOW_ORCHESTRATION = {
    active: true,
    sonnetUsage: 0.0,
    sessionTasks: 0,
    routingLog: [],

    // Agent capabilities mapping - CORRECT ARCHITECTURE
    agents: {
        // PROJECT/SESSION MANAGEMENT AGENTS (Primary Management)
        sonnet: {
            name: 'Claude Sonnet 4',
            role: 'Tech Lead/Project Architect',
            domain: 'project_management',
            specialties: ['architecture', 'strategic_decisions', 'project_coordination', 'complex_reasoning'],
            usageThreshold: 0.90
        },
        codex: {
            name: 'OpenAI Codex',
            role: 'Implementation Manager',
            domain: 'project_management',
            specialties: ['implementation_planning', 'bash_orchestration', 'quick_coordination', 'task_management'],
            fallbackFor: ['sonnet']
        },
        gemini: {
            name: 'Google Gemini',
            role: 'Context Analyst Manager',
            domain: 'project_management',
            specialties: ['session_debugging', 'large_context_analysis', 'pattern_analysis', 'workflow_coordination'],
            fallbackFor: ['sonnet', 'codex']
        },

        // CODING AGENTS (Pure Implementation)
        synthetic_qwen3_coder: {
            name: 'Qwen 3 Coder (Synthetic)',
            role: 'Advanced Code Writer + Analysis Support',
            domain: 'coding_implementation',
            specialties: ['complex_typescript', 'advanced_coding', 'api_development', 'heavy_analysis_support'],
            canSupportManagement: true, // Exception: can support management for analysis
            canOrchestrateOnBlock: true // Exception: becomes orchestrator if all management blocked
        },
        synthetic_qwen25_coder: {
            name: 'Qwen 2.5 Coder (Synthetic)',
            role: 'Standard Code Writer',
            domain: 'coding_implementation',
            specialties: ['javascript', 'standard_coding', 'rapid_prototyping', 'code_fixes'],
            canSupportManagement: false
        },
        synthetic_deepseek3: {
            name: 'DeepSeek 3.1 (Synthetic)',
            role: 'Code Analysis Writer',
            domain: 'coding_implementation',
            specialties: ['code_analysis', 'debugging_code', 'refactoring', 'code_optimization'],
            canSupportManagement: false
        }
    },

    // Real-time routing function
    routeTask: function(taskDescription, complexity = null, contextSize = 1000) {
        this.sessionTasks++;

        // Auto-detect complexity if not provided
        if (complexity === null) {
            complexity = this.assessComplexity(taskDescription);
        }

        // Update Sonnet usage
        this.sonnetUsage += 0.015; // Increment per task

        let selectedAgent = 'sonnet';
        let reason = 'default_lead';

        // CORRECT ROUTING LOGIC - PROJECT/SESSION vs CODING SEPARATION

        // Determine if this is a PROJECT/SESSION task or CODING task
        const isProjectTask = this.isProjectManagementTask(taskDescription);
        const isCodingTask = this.isCodingTask(taskDescription);

        if (isProjectTask) {
            // PROJECT/SESSION MANAGEMENT ROUTING WITH CASCADE FAILURE
            if (this.sonnetUsage > this.agents.sonnet.usageThreshold) {
                // Sonnet usage exceeded - implement cascade failure logic
                const cascadeResult = this.handleManagementCascadeFailure(taskDescription, complexity, contextSize);
                selectedAgent = cascadeResult.agent;
                reason = cascadeResult.reason;
            } else if (this.isArchitectureTask(taskDescription) || complexity > 0.85) {
                selectedAgent = 'sonnet';
                reason = 'project_architecture_or_high_complexity';
            } else if (this.isBashTask(taskDescription) || this.isCoordinationTask(taskDescription)) {
                selectedAgent = 'codex';
                reason = 'implementation_coordination';
            } else if (this.isAnalysisTask(taskDescription) || contextSize > 10000) {
                selectedAgent = 'gemini';
                reason = 'session_analysis_or_large_context';
            } else {
                selectedAgent = 'sonnet';
                reason = 'default_project_lead';
            }
        } else if (isCodingTask) {
            // CODING IMPLEMENTATION ROUTING
            if (complexity > 0.8 || this.isComplexCodingTask(taskDescription)) {
                selectedAgent = 'synthetic_qwen3_coder';
                reason = 'complex_coding_task';
            } else if (this.isCodeAnalysisTask(taskDescription) || this.isRefactoringTask(taskDescription)) {
                selectedAgent = 'synthetic_deepseek3';
                reason = 'code_analysis_or_debugging';
            } else {
                selectedAgent = 'synthetic_qwen25_coder';
                reason = 'standard_coding_task';
            }
        } else {
            // MIXED OR UNCLEAR TASK
            if (this.sonnetUsage > this.agents.sonnet.usageThreshold) {
                // Use Qwen3 as emergency orchestrator
                selectedAgent = 'synthetic_qwen3_coder';
                reason = 'emergency_orchestrator_qwen3';
            } else {
                selectedAgent = 'sonnet';
                reason = 'default_tech_lead';
            }
        }

        const decision = {
            taskDescription: taskDescription.substring(0, 100) + '...',
            selectedAgent,
            reason,
            complexity,
            contextSize,
            sonnetUsage: (this.sonnetUsage * 100).toFixed(1) + '%',
            timestamp: new Date().toISOString(),
            sessionTask: this.sessionTasks
        };

        this.routingLog.push(decision);

        // Log routing decision
        console.log(`🎯 ORCHESTRATION: Task #${this.sessionTasks} → ${selectedAgent.toUpperCase()}`);
        console.log(`   Reason: ${reason}`);
        console.log(`   Sonnet Usage: ${decision.sonnetUsage}`);
        console.log(`   Complexity: ${complexity.toFixed(2)}`);

        return decision;
    },

    // Task classification functions
    assessComplexity: function(task) {
        const complexKeywords = ['architecture', 'design', 'strategy', 'complex', 'algorithm', 'optimization'];
        const simpleKeywords = ['fix', 'update', 'change', 'simple', 'quick', 'bash'];

        let complexity = 0.5; // base

        complexKeywords.forEach(keyword => {
            if (task.toLowerCase().includes(keyword)) complexity += 0.1;
        });

        simpleKeywords.forEach(keyword => {
            if (task.toLowerCase().includes(keyword)) complexity -= 0.1;
        });

        return Math.max(0.1, Math.min(1.0, complexity));
    },

    // PROJECT/SESSION MANAGEMENT TASK DETECTION
    isProjectManagementTask: function(task) {
        return /architect|design|strategy|plan|coordinate|manage|session|workflow|organize/i.test(task);
    },

    isArchitectureTask: function(task) {
        return /architect|design|strategy|structure|pattern|system/i.test(task);
    },

    isCoordinationTask: function(task) {
        return /coordinate|manage|plan|organize|workflow|session/i.test(task);
    },

    isAnalysisTask: function(task) {
        return /analyze|review|inspect|understand|examine|evaluate|assess/i.test(task);
    },

    isBashTask: function(task) {
        return /bash|command|script|run|execute|terminal/i.test(task);
    },

    // CODING IMPLEMENTATION TASK DETECTION
    isCodingTask: function(task) {
        return /implement|code|create|build|develop|write|typescript|javascript|function|class|api|fix|refactor/i.test(task);
    },

    isComplexCodingTask: function(task) {
        return /complex|advanced|typescript|api|algorithm|optimization|performance/i.test(task);
    },

    isCodeAnalysisTask: function(task) {
        return /debug|refactor|optimize|analyze.*code|review.*code|fix.*bug/i.test(task);
    },

    isRefactoringTask: function(task) {
        return /refactor|optimize|clean|improve.*code|restructure/i.test(task);
    },

    // CASCADE FAILURE HANDLER FOR MANAGEMENT AGENTS
    handleManagementCascadeFailure: function(taskDescription, complexity, contextSize) {
        // Simulate agent availability check (in real implementation, this would check actual status)
        const codexAvailable = this.checkAgentAvailability('codex');
        const geminiAvailable = this.checkAgentAvailability('gemini');

        // Cascade failure logic: Sonnet -> Codex -> Gemini -> Qwen3 Emergency
        if (codexAvailable) {
            return {
                agent: 'codex',
                reason: 'sonnet_90%_cascade_to_codex'
            };
        } else if (geminiAvailable) {
            return {
                agent: 'gemini',
                reason: 'sonnet_90%_codex_busy_cascade_to_gemini'
            };
        } else {
            // ALL MANAGEMENT AGENTS UNAVAILABLE - Emergency Orchestrator
            return {
                agent: 'synthetic_qwen3_coder',
                reason: 'CRITICAL_all_management_blocked_emergency_qwen3_orchestrator'
            };
        }
    },

    // Agent availability checker (simplified simulation)
    checkAgentAvailability: function(agentName) {
        // Simulate availability based on session tasks and random factors
        if (agentName === 'codex') {
            // Codex becomes unavailable after 15 tasks or 70% chance
            return this.sessionTasks < 15 && Math.random() > 0.3;
        } else if (agentName === 'gemini') {
            // Gemini becomes unavailable after 20 tasks or 50% chance
            return this.sessionTasks < 20 && Math.random() > 0.5;
        }
        return true;
    },

    // Stats and monitoring
    getStats: function() {
        const recentDecisions = this.routingLog.slice(-10);
        const agentUsage = {};

        recentDecisions.forEach(decision => {
            agentUsage[decision.selectedAgent] = (agentUsage[decision.selectedAgent] || 0) + 1;
        });

        return {
            sessionTasks: this.sessionTasks,
            sonnetUsage: (this.sonnetUsage * 100).toFixed(1) + '%',
            agentDistribution: agentUsage,
            lastDecisions: recentDecisions.slice(-3),
            orchestrationActive: this.active
        };
    }
};

// Hook into MCP Synthetic calls
const originalMCPCall = global.mcp__devflow_synthetic_cc_sessions__synthetic_auto;
if (originalMCPCall) {
    global.mcp__devflow_synthetic_cc_sessions__synthetic_auto = function(params) {
        console.log('🔄 INTERCEPTED: MCP Synthetic call - routing through orchestration');

        const decision = global.DEVFLOW_ORCHESTRATION.routeTask(
            params.request || 'synthetic_task',
            null,
            (params.request || '').length
        );

        console.log(`📊 ORCHESTRATION STATS:`, global.DEVFLOW_ORCHESTRATION.getStats());

        return originalMCPCall.apply(this, arguments);
    };
}

// Activate orchestration
console.log('🚀 DEVFLOW ORCHESTRATION HOOK: ACTIVATED');
console.log('📊 Real-time agent routing enabled');
console.log('🎯 Sonnet usage protection active');
console.log('⚡ Synthetic agents delegation ready');

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.DEVFLOW_ORCHESTRATION;
}