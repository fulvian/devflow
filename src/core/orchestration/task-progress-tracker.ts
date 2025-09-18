import { Task, TaskStatus } from '../../types/task.types';
import { MicroTask } from '../../types/microtask.types';

export class TaskProgressTracker {
  private tasks: Map<string, Task> = new Map();
  private progressListeners: Array<(progress: number, taskId: string) => void> = [];

  registerTask(task: Task): void {
    this.tasks.set(task.id, task);
  }

  updateTaskProgress(taskId: string, microTask: MicroTask): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // Update micro-task status
    const index = task.microTasks.findIndex(mt => mt.id === microTask.id);
    if (index !== -1) {
      task.microTasks[index] = microTask;
      this.calculateAndNotifyProgress(taskId);
    }
  }

  private calculateAndNotifyProgress(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const totalMicroTasks = task.microTasks.length;
    const completedMicroTasks = task.microTasks.filter(
      mt => mt.status === TaskStatus.COMPLETED
    ).length;

    const progress = totalMicroTasks > 0 
      ? Math.round((completedMicroTasks / totalMicroTasks) * 100) 
      : 0;

    // Notify listeners
    this.progressListeners.forEach(listener => 
      listener(progress, taskId)
    );

    // Persist progress
    this.persistProgress(taskId, progress);
  }

  getTaskProgress(taskId: string): number {
    const task = this.tasks.get(taskId);
    if (!task) return 0;

    const total = task.microTasks.length;
    const completed = task.microTasks.filter(
      mt => mt.status === TaskStatus.COMPLETED
    ).length;

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }

  addProgressListener(listener: (progress: number, taskId: string) => void): void {
    this.progressListeners.push(listener);
  }

  removeProgressListener(listener: (progress: number, taskId: string) => void): void {
    const index = this.progressListeners.indexOf(listener);
    if (index > -1) {
      this.progressListeners.splice(index, 1);
    }
  }

  private persistProgress(taskId: string, progress: number): void {
    // In a real implementation, this would persist to storage
    localStorage.setItem(`task-progress-${taskId}`, progress.toString());
  }

  loadProgress(taskId: string): number {
    const progress = localStorage.getItem(`task-progress-${taskId}`);
    return progress ? parseInt(progress, 10) : 0;
  }

  resetProgress(taskId: string): void {
    this.tasks.delete(taskId);
    localStorage.removeItem(`task-progress-${taskId}`);
  }
}
