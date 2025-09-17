/**
 * Quality Control Hold Queue Implementation - Phase 3
 *
 * Manages the approval workflow for generated code before CI/CD integration
 * Part of the DevFlow orchestration system MANDATORY compliance
 */

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  implementationStatus: ImplementationStatus;
  assignedTo?: string;
  lastFeedback?: string;
  generatedCode?: string;
  domain?: string;
  complexity?: string;
  createdBy?: string;
  approvedBy?: string;
}

export enum TaskStatus {
  READY_FOR_IMPLEMENTATION = 'ready_for_implementation',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  IMPLEMENTATION_FAILED = 'implementation_failed'
}

export enum ImplementationStatus {
  QUEUED_FOR_QC = 'queued_for_qc',
  APPROVED_FOR_INTEGRATION = 'approved_for_integration',
  REQUIRES_REWORK = 'requires_rework',
  INTEGRATED = 'integrated',
  INTEGRATION_FAILED = 'integration_failed',
  CODE_GENERATION_IN_PROGRESS = 'code_generation_in_progress',
  CODE_GENERATED = 'code_generated',
  GENERATION_FAILED = 'generation_failed'
}

export interface ArchitectReview {
  taskId: string;
  status: ReviewStatus;
  createdAt: Date;
  assignedArchitects: string[];
  feedback: string | null;
  reviewedAt: Date | null;
  reviewedBy?: string;
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

/**
 * Quality Control Hold Queue Implementation
 * Manages the approval workflow for generated code before CI/CD integration
 */
export class QCHoldQueue {
  private holdQueue: Map<string, Task> = new Map();
  private reviewQueue: Map<string, ArchitectReview> = new Map();

  /**
   * Add a task to the QC Hold Queue for architect review
   * @param task The task to be reviewed
   */
  async enqueueTask(task: Task): Promise<void> {
    try {
      // Update task status to PENDING_REVIEW
      task.status = TaskStatus.PENDING_REVIEW;
      task.implementationStatus = ImplementationStatus.QUEUED_FOR_QC;

      this.holdQueue.set(task.id, task);

      // Create architect review record
      const review: ArchitectReview = {
        taskId: task.id,
        status: ReviewStatus.PENDING,
        createdAt: new Date(),
        assignedArchitects: this.getAssignedArchitects(task),
        feedback: null,
        reviewedAt: null
      };

      this.reviewQueue.set(task.id, review);

      // Notify assigned architects
      await this.notifyArchitects(review.assignedArchitects, task);

      console.log(`[QC-QUEUE] Task ${task.id} enqueued for QC review`);
    } catch (error) {
      console.error(`[QC-QUEUE] Failed to enqueue task ${task.id}:`, error);
      throw new Error(`QC Queue enqueue failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process architect review decision
   * @param taskId The task ID
   * @param architectId The architect who made the decision
   * @param decision Approval or rejection
   * @param feedback Optional feedback for re-delegation
   */
  async processReview(
    taskId: string,
    architectId: string,
    decision: ReviewStatus,
    feedback?: string
  ): Promise<void> {
    try {
      const task = this.holdQueue.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found in hold queue`);
      }

      const review = this.reviewQueue.get(taskId);
      if (!review) {
        throw new Error(`Review record for task ${taskId} not found`);
      }

      // Validate architect authorization
      if (!review.assignedArchitects.includes(architectId)) {
        throw new Error(`Architect ${architectId} not authorized to review task ${taskId}`);
      }

      // Update review record
      review.status = decision;
      review.reviewedBy = architectId;
      review.reviewedAt = new Date();
      review.feedback = feedback || null;

      this.reviewQueue.set(taskId, review);

      // Process decision
      if (decision === ReviewStatus.APPROVED) {
        await this.approveTask(task);
      } else if (decision === ReviewStatus.REJECTED) {
        await this.rejectTask(task, feedback);
      }

      console.log(`[QC-QUEUE] Architect ${architectId} ${decision} task ${taskId}`);
    } catch (error) {
      console.error(`[QC-QUEUE] Failed to process review for task ${taskId}:`, error);
      throw new Error(`Review processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Approve task and trigger CI/CD integration
   * @param task The approved task
   */
  private async approveTask(task: Task): Promise<void> {
    try {
      task.status = TaskStatus.APPROVED;
      task.implementationStatus = ImplementationStatus.APPROVED_FOR_INTEGRATION;

      this.holdQueue.set(task.id, task);

      // Remove from hold queue (will be handled by CI/CD service)
      console.log(`[QC-QUEUE] Task ${task.id} approved and ready for CI/CD integration`);
    } catch (error) {
      console.error(`[QC-QUEUE] Failed to approve task ${task.id}:`, error);
      throw new Error(`Task approval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reject task and handle re-delegation
   * @param task The rejected task
   * @param feedback Feedback for re-delegation
   */
  private async rejectTask(task: Task, feedback: string | undefined): Promise<void> {
    try {
      task.status = TaskStatus.REJECTED;
      task.implementationStatus = ImplementationStatus.REQUIRES_REWORK;
      task.lastFeedback = feedback || 'Implementation requires changes';

      this.holdQueue.set(task.id, task);

      console.log(`[QC-QUEUE] Task ${task.id} rejected with feedback: ${feedback}`);
    } catch (error) {
      console.error(`[QC-QUEUE] Failed to reject task ${task.id}:`, error);
      throw new Error(`Task rejection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get assigned architects based on task properties
   * @param task The task to assign architects to
   */
  private getAssignedArchitects(task: Task): string[] {
    // Logic to determine appropriate architects based on:
    // - Task domain/technology
    // - Complexity level
    // - Architect availability

    const architects = ['architect-lead'];

    if (task.domain === 'critical' || task.complexity === 'high') {
      architects.push('senior-architect');
    }

    if (task.domain === 'security') {
      architects.push('security-architect');
    }

    return architects;
  }

  /**
   * Get all pending reviews for an architect
   * @param architectId The architect ID
   */
  async getPendingReviews(architectId: string): Promise<ArchitectReview[]> {
    try {
      const pending: ArchitectReview[] = [];

      for (const review of this.reviewQueue.values()) {
        if (review.status === ReviewStatus.PENDING &&
            review.assignedArchitects.includes(architectId)) {
          pending.push(review);
        }
      }

      return pending;
    } catch (error) {
      console.error(`[QC-QUEUE] Failed to fetch pending reviews for ${architectId}:`, error);
      throw new Error(`Failed to fetch reviews: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get task from hold queue
   * @param taskId The task ID
   */
  getTask(taskId: string): Task | undefined {
    return this.holdQueue.get(taskId);
  }

  /**
   * Get review from review queue
   * @param taskId The task ID
   */
  getReview(taskId: string): ArchitectReview | undefined {
    return this.reviewQueue.get(taskId);
  }

  /**
   * Notify architects of new review tasks
   * @param architects Array of architect IDs
   * @param task The task requiring review
   */
  private async notifyArchitects(architects: string[], task: Task): Promise<void> {
    for (const architect of architects) {
      console.log(`[QC-QUEUE] Notifying architect ${architect} of new review task ${task.id}`);
      // In real implementation, this would send email/slack/etc notifications
    }
  }
}