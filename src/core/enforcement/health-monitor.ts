import { Logger } from '../utils/logger';

class HealthMonitor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  async checkHealth(): Promise<void> {
    this.logger.info('Checking system health');
  }
}

export default HealthMonitor;
