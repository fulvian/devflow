import { Logger } from 'winston';

export class ToolWrapper {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public wrapTool(toolName: string, toolFunction: Function): Function {
    this.logger.debug(`Wrapping tool: ${toolName}`);
    
    return (...args: any[]) => {
      this.logger.debug(`Executing wrapped tool: ${toolName}`);
      return toolFunction(...args);
    };
  }
}