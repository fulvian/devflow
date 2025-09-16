// devflow-types.ts

/**
 * DevFlow Orchestrator Type Definitions
 * 
 * This module contains TypeScript interfaces and types for the DevFlow Orchestrator system.
 * These types define the structure of data used throughout the orchestrator for tasks,
 * sessions, memory management, and API interactions.
 */

// ----------------------------------------
// RequestContext Interface
// ----------------------------------------

/**
 * Context information for a request execution
 */
export interface RequestContext {
  /** Unique identifier for the request */
  requestId: string;
  
  /** Timestamp when the request was initiated */
  timestamp: number;
  
  /** User or system that initiated the request */
  userId: string;
  
  /** Originating service or component */
  source: string;
  
  /** Additional metadata associated with the request */
  metadata?: Record<string, unknown>;
  
  /** Request priority level */
  priority?: number;
  
  /** Timeout for the request in milliseconds */
  timeout?: number;
}

// ----------------------------------------
// Memory-related Types
// ----------------------------------------

/**
 * Memory storage types
 */
export type MemoryType = 'volatile' | 'persistent' | 'cache';

/**
 * Memory access modes
 */
export type MemoryAccessMode = 'read' | 'write' | 'readwrite';

/**
 * Represents a memory entry in the orchestrator
 */
export interface MemoryEntry {
  /** Unique identifier for the memory entry */
  id: string;
  
  /** Type of memory storage */
  type: MemoryType;
  
  /** Data stored in memory */
  data: unknown;
  
  /** Timestamp when the entry was created */
  createdAt: number;
  
  /** Timestamp when the entry was last accessed */
  lastAccessed: number;
  
  /** Timestamp when the entry expires (if applicable) */
  expiresAt?: number;
  
  /** Size of the data in bytes */
  size: number;
  
  /** Access permissions */
  accessMode: MemoryAccessMode;
  
  /** Tags associated with the memory entry */
  tags?: string[];
}

/**
 * Memory management configuration
 */
export interface MemoryConfig {
  /** Maximum memory capacity in bytes */
  maxCapacity: number;
  
  /** Default expiration time in milliseconds */
  defaultExpiration: number;
  
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  
  /** Memory type to use by default */
  defaultType: MemoryType;
}

// ----------------------------------------
// Session Types
// ----------------------------------------

/**
 * Session status states
 */
export type SessionStatus = 'active' | 'inactive' | 'expired' | 'terminated';

/**
 * Represents a user or system session
 */
export interface Session {
  /** Unique session identifier */
  sessionId: string;
  
  /** User associated with the session */
  userId: string;
  
  /** Current status of the session */
  status: SessionStatus;
  
  /** Timestamp when the session was created */
  createdAt: number;
  
  /** Timestamp when the session was last active */
  lastActive: number;
  
  /** Timestamp when the session expires */
  expiresAt: number;
  
  /** Session context data */
  context: Record<string, unknown>;
  
  /** Associated memory entries */
  memoryEntries: string[];
  
  /** Active tasks in this session */
  activeTasks: string[];
}

/**
 * Session creation parameters
 */
export interface SessionCreateParams {
  /** User identifier */
  userId: string;
  
  /** Session timeout in milliseconds */
  timeout?: number;
  
  /** Initial context data */
  context?: Record<string, unknown>;
}

// ----------------------------------------
// Task Types
// ----------------------------------------

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Task status states
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Task execution result
 */
export interface TaskResult {
  /** Whether the task completed successfully */
  success: boolean;
  
  /** Result data from the task */
  data?: unknown;
  
  /** Error information if the task failed */
  error?: {
    /** Error message */
    message: string;
    
    /** Error code */
    code?: string;
    
    /** Additional error details */
    details?: Record<string, unknown>;
  };
  
  /** Execution duration in milliseconds */
  duration: number;
  
  /** Timestamp when execution completed */
  completedAt: number;
}

/**
 * Represents a task in the orchestrator
 */
export interface Task {
  /** Unique task identifier */
  taskId: string;
  
  /** Task name/type */
  name: string;
  
  /** Task description */
  description?: string;
  
  /** Current status of the task */
  status: TaskStatus;
  
  /** Task priority level */
  priority: TaskPriority;
  
  /** Session this task belongs to */
  sessionId?: string;
  
  /** Parent task if this is a subtask */
  parentTaskId?: string;
  
  /** Child tasks */
  childTaskIds: string[];
  
  /** Task parameters */
  parameters: Record<string, unknown>;
  
  /** Task result (when completed) */
  result?: TaskResult;
  
  /** Timestamp when the task was created */
  createdAt: number;
  
  /** Timestamp when the task started execution */
  startedAt?: number;
  
  /** Timestamp when the task was completed */
  completedAt?: number;
  
  /** Assigned executor */
  assignedTo?: string;
  
  /** Dependencies that must complete before this task */
  dependencies: string[];
  
  /** Retry configuration */
  retryConfig?: {
    /** Maximum number of retry attempts */
    maxRetries: number;
    
    /** Delay between retries in milliseconds */
    retryDelay: number;
    
    /** Exponential backoff factor */
    backoffFactor: number;
  };
}

/**
 * Task creation parameters
 */
export interface TaskCreateParams {
  /** Task name/type */
  name: string;
  
  /** Task description */
  description?: string;
  
  /** Task priority */
  priority?: TaskPriority;
  
  /** Session to associate with the task */
  sessionId?: string;
  
  /** Parent task ID */
  parentTaskId?: string;
  
  /** Task parameters */
  parameters: Record<string, unknown>;
  
  /** Task dependencies */
  dependencies?: string[];
  
  /** Retry configuration */
  retryConfig?: Task['retryConfig'];
}

// ----------------------------------------
// API Response Types
// ----------------------------------------

/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
  /** Indicates if the request was successful */
  success: boolean;
  
  /** Response data */
  data?: T;
  
  /** Error information if the request failed */
  error?: {
    /** Error message */
    message: string;
    
    /** Error code */
    code?: string;
    
    /** Additional error details */
    details?: Record<string, unknown>;
  };
  
  /** Response metadata */
  meta?: {
    /** Timestamp of the response */
    timestamp: number;
    
    /** Request ID */
    requestId?: string;
    
    /** Response time in milliseconds */
    responseTime?: number;
  };
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;
    
    /** Number of items per page */
    limit: number;
    
    /** Total number of items */
    total: number;
    
    /** Total number of pages */
    totalPages: number;
  };
}

// ----------------------------------------
// Usage Record Types
// ----------------------------------------

/**
 * Resource types tracked for usage
 */
export type ResourceType = 'cpu' | 'memory' | 'storage' | 'network' | 'api';

/**
 * Represents a usage record for resource tracking
 */
export interface UsageRecord {
  /** Unique identifier for the usage record */
  recordId: string;
  
  /** Type of resource being tracked */
  resourceType: ResourceType;
  
  /** Identifier for the user or system consuming the resource */
  consumerId: string;
  
  /** Session associated with the usage */
  sessionId?: string;
  
  /** Task associated with the usage */
  taskId?: string;
  
  /** Amount of resource consumed */
  amount: number;
  
  /** Unit of measurement for the resource */
  unit: string;
  
  /** Timestamp when the usage occurred */
  timestamp: number;
  
  /** Additional metadata about the usage */
  metadata?: Record<string, unknown>;
  
  /** Cost associated with the usage (if applicable) */
  cost?: number;
}

/**
 * Usage summary for a specific period
 */
export interface UsageSummary {
  /** Resource type */
  resourceType: ResourceType;
  
  /** Total amount consumed */
  totalAmount: number;
  
  /** Total cost */
  totalCost: number;
  
  /** Number of usage records */
  recordCount: number;
  
  /** Start of the summary period */
  periodStart: number;
  
  /** End of the summary period */
  periodEnd: number;
}

// ----------------------------------------
// Event Types
// ----------------------------------------

/**
 * Event types in the orchestrator system
 */
export type EventType = 
  | 'task.created'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.cancelled'
  | 'session.created'
  | 'session.activated'
  | 'session.expired'
  | 'session.terminated'
  | 'memory.accessed'
  | 'memory.evicted'
  | 'system.error'
  | 'system.warning'
  | 'usage.recorded';

/**
 * Represents an event in the orchestrator system
 */
export interface Event {
  /** Unique event identifier */
  eventId: string;
  
  /** Type of event */
  type: EventType;
  
  /** Timestamp when the event occurred */
  timestamp: number;
  
  /** Identifier of the entity associated with the event */
  entityId: string;
  
  /** Additional event data */
  data?: Record<string, unknown>;
  
  /** Severity level */
  severity: 'info' | 'warning' | 'error';
  
  /** Source component that generated the event */
  source: string;
  
  /** Associated session ID */
  sessionId?: string;
  
  /** Associated task ID */
  taskId?: string;
  
  /** Associated request context */
  requestContext?: RequestContext;
}

/**
 * Event filter parameters
 */
export interface EventFilter {
  /** Filter by event type */
  types?: EventType[];
  
  /** Filter by entity ID */
  entityIds?: string[];
  
  /** Filter by time range (start) */
  startTime?: number;
  
  /** Filter by time range (end) */
  endTime?: number;
  
  /** Filter by severity */
  severity?: Event['severity'][];
  
  /** Filter by source */
  sources?: string[];
}