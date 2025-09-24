// Cometa Brain Natural Language Command Schemas
// Based on TypeChat patterns for robust NL -> JSON transformation

export interface CometaCommand {
    intent: string;
    action: TaskAction | ProjectAction | SystemAction;
    parameters?: Record<string, any>;
    confidence?: number;
}

// Task Management Commands
export interface TaskAction {
    type: 'task_management';
    operation: 'create' | 'update' | 'complete' | 'delete' | 'list' | 'search';
    target?: TaskTarget;
    properties?: TaskProperties;
    filters?: TaskFilters;
}

export interface TaskTarget {
    id?: string;
    title?: string;
    priority?: 'h-' | 'm-' | 'l-';
    status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface TaskProperties {
    title?: string;
    description?: string;
    priority?: 'h-' | 'm-' | 'l-';
    status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
    estimated_duration_minutes?: number;
    complexity_score?: number;
    assigned_to?: string;
    due_date?: string;
    tags?: string[];
    parent_task_id?: number;
}

export interface TaskFilters {
    status?: string[];
    priority?: string[];
    assigned_to?: string;
    created_after?: string;
    created_before?: string;
    has_tag?: string[];
    search_text?: string;
}

// Project Management Commands
export interface ProjectAction {
    type: 'project_management';
    operation: 'create' | 'switch' | 'status' | 'archive';
    target?: ProjectTarget;
    properties?: ProjectProperties;
}

export interface ProjectTarget {
    id?: string;
    name?: string;
}

export interface ProjectProperties {
    name?: string;
    description?: string;
    status?: 'active' | 'completed' | 'archived';
    priority?: 'high' | 'medium' | 'low';
}

// System Commands
export interface SystemAction {
    type: 'system';
    operation: 'status' | 'metrics' | 'backup' | 'sync' | 'help';
    scope?: 'memory' | 'patterns' | 'sessions' | 'all';
    parameters?: Record<string, any>;
}

// Batch Operations
export interface BatchCommand {
    commands: CometaCommand[];
    execution_mode: 'sequential' | 'parallel' | 'conditional';
    rollback_on_error?: boolean;
    conditions?: BatchCondition[];
}

export interface BatchCondition {
    if: string; // Condition expression
    then: CometaCommand;
    else?: CometaCommand;
}

// Response Types
export interface CommandResponse {
    success: boolean;
    message: string;
    data?: any;
    execution_time_ms?: number;
    affected_tasks?: number;
    next_suggestions?: string[];
}

export interface ValidationResult {
    isValid: boolean;
    command?: CometaCommand;
    errors?: string[];
    suggestions?: string[];
}