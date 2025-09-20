import { Task } from '../task/task';
import { ConventionalCommitGenerator } from './conventional-commit-generator';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class GitHubAutomationService {
  private commitGenerator: ConventionalCommitGenerator;

  constructor() {
    this.commitGenerator = new ConventionalCommitGenerator();
  }

  async handleTaskCompletion(task: Task, isBatch: boolean = false): Promise<void> {
    try {
      // Generate commit message
      const commitMessage = this.commitGenerator.generateCommitMessage(task, isBatch);
      
      // Stage changes
      await execPromise('git add .');
      
      // Commit changes
      await execPromise(`git commit -m "${commitMessage}"`);
      
      // Push changes
      await execPromise('git push origin HEAD');
      
      console.log(`Successfully committed and pushed changes for task: ${task.id}`);
    } catch (error) {
      console.error(`Failed to commit and push for task ${task.id}:`, error);
      throw error;
    }
  }

  async handleMacroTaskCompletion(tasks: Task[]): Promise<void> {
    try {
      // Generate summary commit message for macro task
      const commitMessage = this.commitGenerator.generateMacroCommitMessage(tasks);
      
      // Stage changes
      await execPromise('git add .');
      
      // Commit changes
      await execPromise(`git commit -m "${commitMessage}"`);
      
      // Push changes
      await execPromise('git push origin HEAD');
      
      console.log(`Successfully committed and pushed changes for macro task with ${tasks.length} subtasks`);
    } catch (error) {
      console.error('Failed to commit and push for macro task:', error);
      throw error;
    }
  }

  async configure(triggerConditions: any): Promise<void> {
    // Configure automation based on trigger conditions
    console.log('Configuring GitHub automation with:', triggerConditions);
  }
}
