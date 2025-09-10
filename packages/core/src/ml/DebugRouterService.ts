import { Logger } from '../../utils/Logger';
import { GeminiService } from './GeminiService';
import { ClaudeService } from './ClaudeService';
import { SyntheticAutoService } from './SyntheticAutoService';

export interface DebugRoute {
  service: string;
  priority: number;
  reason: string;
}

export interface ErrorContext {
  error: Error;
  code: string;
  stack: string;
  timestamp: number;
  attempt: number;
}

export class DebugRouterService {
  private logger = new Logger('DebugRouterService');
  private geminiService: GeminiService;
  private claudeService: ClaudeService;
  private syntheticAutoService: SyntheticAutoService;

  constructor(
    geminiService: GeminiService,
    claudeService: ClaudeService,
    syntheticAutoService: SyntheticAutoService
  ) {
    this.geminiService = geminiService;
    this.claudeService = claudeService;
    this.syntheticAutoService = syntheticAutoService;
  }

  classifyError(errorContext: ErrorContext): DebugRoute[] {
    const routes: DebugRoute[] = [];
    const { error, code, stack } = errorContext;

    // Syntax errors - high priority for Gemini
    if (code.includes('SyntaxError') || error.message.includes('Unexpected token') || error.message.includes('Parse error')) {
      routes.push({
        service: 'gemini',
        priority: 1,
        reason: 'Syntax errors are best handled by Gemini'
      });
    }

    // Type errors - high priority for Claude
    if (code.includes('TypeError') || error.message.includes('undefined is not a function') || error.message.includes('Cannot read property')) {
      routes.push({
        service: 'claude',
        priority: 1,
        reason: 'Type errors are best handled by Claude'
      });
    }

    // Reference errors - medium priority for Gemini
    if (code.includes('ReferenceError') || error.message.includes('is not defined')) {
      routes.push({
        service: 'gemini',
        priority: 2,
        reason: 'Reference errors can be resolved by Gemini'
      });
    }

    // Async errors - medium priority for Claude
    if (stack.includes('async') || stack.includes('Promise') || error.message.includes('UnhandledPromiseRejection')) {
      routes.push({
        service: 'claude',
        priority: 2,
        reason: 'Async errors are best handled by Claude'
      });
    }

    // Add synthetic auto as final fallback
    routes.push({
      service: 'synthetic_auto',
      priority: 99,
      reason: 'Final fallback for all errors'
    });

    // Sort by priority
    return routes.sort((a, b) => a.priority - b.priority);
  }

  async routeDebugRequest(errorContext: ErrorContext): Promise<any> {
    const routes = this.classifyError(errorContext);
    this.logger.info(`Routing debug request with ${routes.length} possible routes`);

    for (const route of routes) {
      try {
        this.logger.info(`Attempting debug with ${route.service}: ${route.reason}`);
        
        switch (route.service) {
          case 'gemini':
            return await this.geminiService.debugCode(errorContext);
          case 'claude':
            return await this.claudeService.debugCode(errorContext);
          case 'synthetic_auto':
            return await this.syntheticAutoService.debugCode(errorContext);
          default:
            this.logger.warn(`Unknown service in route: ${route.service}`);
        }
      } catch (serviceError) {
        this.logger.warn(`Service ${route.service} failed: ${serviceError.message}`);
        // Continue to next route
      }
    }

    // If we get here, all services failed
    throw new Error('All debug services failed to resolve the error');
  }
}
