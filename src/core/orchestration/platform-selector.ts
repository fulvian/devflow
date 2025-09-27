// Platform Selector for Dream Team Orchestrator
export class PlatformSelector {
  private platforms: string[] = ['codex', 'gemini', 'qwen'];

  getSelectedPlatforms(): string[] {
    // Return all available platforms for now
    return this.platforms.slice();
  }

  isAvailable(platform: string): boolean {
    return this.platforms.includes(platform);
  }

  addPlatform(platform: string): void {
    if (!this.platforms.includes(platform)) {
      this.platforms.push(platform);
    }
  }
}