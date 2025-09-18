import fs from 'fs/promises';
import path from 'path';
import { ProjectType, ProjectInfo } from './validation-types';

export class ProjectDetector {
  private static readonly PROJECT_MARKERS: Record<string, ProjectType> = {
    'package.json': ProjectType.NPM,
    'yarn.lock': ProjectType.YARN,
    'pnpm-lock.yaml': ProjectType.PNPM,
    'Cargo.toml': ProjectType.CARGO,
    'Makefile': ProjectType.MAKE,
    'makefile': ProjectType.MAKE,
    'build.gradle': ProjectType.GRADLE,
    'pom.xml': ProjectType.MAVEN,
  };

  async detectProject(projectPath: string): Promise<ProjectInfo> {
    // Check for project markers
    for (const [marker, type] of Object.entries(ProjectDetector.PROJECT_MARKERS)) {
      try {
        await fs.access(path.join(projectPath, marker));
        return {
          path: projectPath,
          type,
          name: await this.getProjectName(projectPath, type),
          config: await this.getProjectConfig(projectPath, type)
        };
      } catch {
        // Marker not found, continue checking
      }
    }

    // Fallback: check for package.json (might be npm/yarn/pnpm)
    try {
      const packageJson = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
      const pkg = JSON.parse(packageJson);
      
      // Determine package manager by lockfile
      const lockfiles = await this.getLockfiles(projectPath);
      let type = ProjectType.NPM;
      
      if (lockfiles.has('yarn.lock')) type = ProjectType.YARN;
      else if (lockfiles.has('pnpm-lock.yaml')) type = ProjectType.PNPM;
      
      return {
        path: projectPath,
        type,
        name: pkg.name || path.basename(projectPath),
        config: pkg
      };
    } catch {
      // No package.json found
    }

    // Ultimate fallback
    return {
      path: projectPath,
      type: ProjectType.UNKNOWN,
      name: path.basename(projectPath),
      config: {}
    };
  }

  async findProjects(workspacePath: string): Promise<ProjectInfo[]> {
    const projects: ProjectInfo[] = [];
    const queue: string[] = [workspacePath];
    
    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        // Check if current directory is a project
        const projectInfo = await this.detectProject(currentPath);
        if (projectInfo.type !== ProjectType.UNKNOWN) {
          projects.push(projectInfo);
          continue; // Don't traverse deeper in project directories
        }
        
        // Add subdirectories to queue
        for (const entry of entries) {
          if (entry.isDirectory()) {
            // Skip common non-project directories
            if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
              queue.push(path.join(currentPath, entry.name));
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
        continue;
      }
    }
    
    return projects;
  }

  private async getProjectName(projectPath: string, type: ProjectType): Promise<string> {
    try {
      switch (type) {
        case ProjectType.NPM:
        case ProjectType.YARN:
        case ProjectType.PNPM:
          const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
          return pkg.name || path.basename(projectPath);
        case ProjectType.CARGO:
          const cargo = await fs.readFile(path.join(projectPath, 'Cargo.toml'), 'utf-8');
          const nameMatch = cargo.match(/name\s*=\s*["'](.+?)["']/);
          return nameMatch ? nameMatch[1] : path.basename(projectPath);
        default:
          return path.basename(projectPath);
      }
    } catch {
      return path.basename(projectPath);
    }
  }

  private async getProjectConfig(projectPath: string, type: ProjectType): Promise<any> {
    try {
      switch (type) {
        case ProjectType.NPM:
        case ProjectType.YARN:
        case ProjectType.PNPM:
          return JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
        case ProjectType.CARGO:
          return await fs.readFile(path.join(projectPath, 'Cargo.toml'), 'utf-8');
        case ProjectType.MAKE:
          return await fs.readFile(path.join(projectPath, 'Makefile'), 'utf-8');
        case ProjectType.GRADLE:
          return await fs.readFile(path.join(projectPath, 'build.gradle'), 'utf-8');
        case ProjectType.MAVEN:
          return await fs.readFile(path.join(projectPath, 'pom.xml'), 'utf-8');
        default:
          return {};
      }
    } catch {
      return {};
    }
  }

  private async getLockfiles(projectPath: string): Promise<Set<string>> {
    const lockfiles = new Set<string>();
    const possibleLockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    
    for (const lockfile of possibleLockfiles) {
      try {
        await fs.access(path.join(projectPath, lockfile));
        lockfiles.add(lockfile);
      } catch {
        // Lockfile doesn't exist
      }
    }
    
    return lockfiles;
  }
}
