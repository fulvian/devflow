export interface DAICMode {
  isActive: boolean;
}

export class DAICModeManager {
  private active: boolean = false;

  activate(): void {
    this.active = true;
  }

  deactivate(): void {
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }
}