/**
 * Task ID Standardization Module - Phase 2 Implementation
 *
 * Implements MANDATORY compliance for Task ID format: DEVFLOW-[COMPONENT]-[SEQUENCE]
 * Part of the DevFlow orchestration system enforcement rules
 */

export interface StandardizedTaskId {
  original: string;
  standardized: string;
}

export interface InvalidTaskId {
  taskId: string;
  error: string;
}

export interface TaskIdProcessingResult {
  valid: string[];
  standardized: StandardizedTaskId[];
  invalid: InvalidTaskId[];
  mapping: Map<string, string>;
}

/**
 * Task ID Generator Service
 * Generates standardized task IDs in DEVFLOW-[COMPONENT]-[SEQUENCE] format
 */
export class TaskIDGenerator {
  private static sequenceCounters: Map<string, number> = new Map();

  /**
   * Generates a new task ID in DEVFLOW-[COMPONENT]-[SEQUENCE] format
   * @param component The component name
   * @returns Generated task ID
   */
  static generateTaskId(component: string): string {
    // Validate component name
    if (!component || !/^[A-Z0-9]+$/.test(component)) {
      throw new Error(`Invalid component name: ${component}. Must contain only uppercase letters and numbers.`);
    }

    // Get and increment sequence counter for this component
    const counter = this.sequenceCounters.get(component) || 0;
    this.sequenceCounters.set(component, counter + 1);

    // Format sequence number with leading zeros
    const sequence = (counter + 1).toString().padStart(3, '0');

    return `DEVFLOW-${component}-${sequence}`;
  }

  /**
   * Resets the sequence counter for a component (for testing purposes)
   * @param component The component name
   */
  static resetCounter(component: string): void {
    this.sequenceCounters.delete(component);
  }
}

/**
 * Task ID Standardization Service
 * Validates and standardizes task IDs according to MANDATORY format
 */
export class TaskIDStandardizationService {
  // Regex pattern for valid Task ID format
  private static readonly taskIdRegex = /^DEVFLOW-[A-Z]+-\d{3}$/;

  /**
   * Validates if a task ID conforms to the standard format
   * @param taskId The task ID to validate
   * @returns boolean indicating if the task ID is valid
   */
  static validateTaskIdFormat(taskId: string): boolean {
    if (!taskId || typeof taskId !== 'string') {
      return false;
    }

    const isValid = this.taskIdRegex.test(taskId);
    console.log(`[TASK-ID-VALIDATION] Task ID ${taskId} validation result: ${isValid}`);
    return isValid;
  }

  /**
   * Standardizes a task ID to the required format
   * If already valid, returns as-is. Otherwise generates a new standardized ID.
   * @param taskId The task ID to standardize
   * @param component Optional component name to use for generation
   * @returns Standardized task ID
   */
  static standardizeTaskId(taskId: string, component?: string): string {
    // If already valid, return as-is
    if (this.validateTaskIdFormat(taskId)) {
      console.log(`[TASK-ID-VALIDATION] Task ID ${taskId} already conforms to standard format`);
      return taskId;
    }

    // Extract component from existing ID if not provided
    if (!component) {
      component = this.extractComponentFromId(taskId) || 'ORCHESTRATION';
    }

    // Generate new standardized ID
    const newTaskId = TaskIDGenerator.generateTaskId(component);
    console.log(`[TASK-ID-VALIDATION] Standardized Task ID: ${taskId} -> ${newTaskId}`);

    return newTaskId;
  }

  /**
   * Extracts component name from existing task ID formats
   * @param taskId The task ID to extract component from
   * @returns Extracted component name or null if not found
   */
  private static extractComponentFromId(taskId: string): string | null {
    // Handle various existing formats
    const patterns = [
      /^DEVFLOW-([A-Z]+)-\d+/,         // Already standard format
      /^([A-Z]+)-/,                    // PREFIX-123
      /^([A-Z]+)_[A-Z]+_\d+/,          // PREFIX_TYPE_123
      /^[A-Z]+-([A-Z]+)-\d+/,          // PREFIX-COMPONENT-123
    ];

    for (const pattern of patterns) {
      const match = taskId.match(pattern);
      if (match && match[1]) {
        // Convert to uppercase and remove special characters
        return match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
      }
    }

    return null;
  }

  /**
   * Validates and standardizes a list of task IDs
   * @param taskIds Array of task IDs to process
   * @returns Object containing results of validation and standardization
   */
  static processTaskIds(taskIds: string[]): TaskIdProcessingResult {
    const results: TaskIdProcessingResult = {
      valid: [],
      standardized: [],
      invalid: [],
      mapping: new Map()
    };

    for (const taskId of taskIds) {
      try {
        if (this.validateTaskIdFormat(taskId)) {
          results.valid.push(taskId);
          results.mapping.set(taskId, taskId);
        } else {
          const standardizedId = this.standardizeTaskId(taskId);
          results.standardized.push({
            original: taskId,
            standardized: standardizedId
          });
          results.mapping.set(taskId, standardizedId);
        }
      } catch (error) {
        console.error(`[TASK-ID-VALIDATION] Error processing task ID ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
        results.invalid.push({
          taskId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log(`[TASK-ID-VALIDATION] Processed ${taskIds.length} task IDs: ${results.valid.length} valid, ${results.standardized.length} standardized, ${results.invalid.length} invalid`);

    return results;
  }

  /**
   * MANDATORY validation for delegation API
   * Throws error if task ID is not compliant
   */
  static enforceTaskIdCompliance(taskId: string): string {
    if (!this.validateTaskIdFormat(taskId)) {
      throw new Error(`MANDATORY VIOLATION: Task ID '${taskId}' does not conform to required format DEVFLOW-[COMPONENT]-[SEQUENCE]. Use TaskIDStandardizationService.standardizeTaskId() to fix.`);
    }
    return taskId;
  }
}