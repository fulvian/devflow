import { Task } from '../task/task';

export class ConventionalCommitGenerator {
  generateCommitMessage(task: Task, isBatch: boolean = false): string {
    const type = this.determineCommitType(task);
    const scope = task.category ? `(${task.category})` : '';
    const subject = this.formatSubject(task.title, isBatch);
    const body = this.generateCommitBody(task);
    const footer = this.generateCommitFooter(task);
    
    let commitMessage = `${type}${scope}: ${subject}`;
    
    if (body) {
      commitMessage += `\n\n${body}`;
    }
    
    if (footer) {
      commitMessage += `\n\n${footer}`;
    }
    
    return commitMessage;
  }

  generateMacroCommitMessage(tasks: Task[]): string {
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const type = 'feat'; // Default to feat for macro tasks
    const subject = `complete ${completedTasks.length} tasks in macro execution`;
    
    const body = `Completed tasks:\n${completedTasks.map(t => `- ${t.id}: ${t.title}`).join('\n')}`;
    
    const taskRefs = completedTasks.map(t => `Refs: ${t.id}`).join('\n');
    
    return `${type}: ${subject}\n\n${body}\n\n${taskRefs}`;
  }

  private determineCommitType(task: Task): string {
    // Map task types to conventional commit types
    switch (task.type) {
      case 'feature':
        return 'feat';
      case 'bug':
        return 'fix';
      case 'documentation':
        return 'docs';
      case 'maintenance':
        return 'chore';
      case 'refactor':
        return 'refactor';
      case 'test':
        return 'test';
      default:
        return 'chore';
    }
  }

  private formatSubject(title: string, isBatch: boolean): string {
    // Format subject according to conventional commit standards
    let subject = title.toLowerCase();
    
    // Remove trailing punctuation
    subject = subject.replace(/[.!]+$/, '');
    
    // Add batch indicator if applicable
    if (isBatch) {
      subject = `[batch] ${subject}`;
    }
    
    return subject;
  }

  private generateCommitBody(task: Task): string | null {
    if (!task.description) return null;
    
    // Format body with task description
    return task.description;
  }

  private generateCommitFooter(task: Task): string | null {
    const footers: string[] = [];
    
    // Add task reference
    footers.push(`Refs: ${task.id}`);
    
    // Add progress information if available
    if (task.progress !== undefined) {
      footers.push(`Progress: ${task.progress}%`);
    }
    
    return footers.length > 0 ? footers.join('\n') : null;
  }
}
