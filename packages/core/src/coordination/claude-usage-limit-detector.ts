/**
 * Claude Pro Usage Limit Detector
 * 
 * This module detects Claude Pro usage limit messages using dual approaches:
 * 1. API Interception (Primary) - Intercepts HTTP requests/responses
 * 2. Console Hooking (Fallback) - Hooks into console.error messages
 * 
 * When a usage limit is detected, it extracts the reset time and emits events
 * to trigger CCR (Critical Capacity Response) activation.
 */

// Interfaces for type safety
interface ClaudeUsageLimitData {
  resetTime: string;
  resetTimestamp: number;
  rawMessage: string;
}

interface ApiErrorResponseBody {
  error?: {
    type?: string;
    message?: string;
  };
}

// Event emitter types
type ClaudeUsageLimitEventListener = (data: ClaudeUsageLimitData) => void;

class ClaudeUsageLimitDetector {
  private isMonitoring: boolean = false;
  private axiosInterceptors: number[] = [];
  private originalConsoleError: (...data: any[]) => void;
  private eventListeners: ClaudeUsageLimitEventListener[] = [];
  private regexPatterns: RegExp[];

  constructor() {
    // Initialize regex patterns for various time formats
    this.regexPatterns = [
      /Claude Pro usage limit reached\. Your limit will reset at (\d{1,2} ?(?:am|pm))/i,
      /Claude Pro usage limit reached\. Your limit will reset at (\d{1,2}:\d{2} ?(?:am|pm)?)/i,
      /Claude Pro usage limit reached\. Your limit will reset at ([0-2]?\d:[0-5]?\d)/i,
      /limit will reset at ([0-2]?\d:[0-5]?\d ?(?:am|pm)?)/i,
      /limit will reset at (\d{1,2} ?(?:am|pm))/i
    ];

    // Store original console.error method
    this.originalConsoleError = console.error;
  }

  /**
   * Start monitoring for Claude Pro usage limit messages
   */
  public start(): void {
    if (this.isMonitoring) {
      console.warn('ClaudeUsageLimitDetector is already monitoring');
      return;
    }

    try {
      this.setupApiInterception();
      this.setupConsoleHooking();
      this.isMonitoring = true;
      console.log('ClaudeUsageLimitDetector started monitoring');
    } catch (error) {
      console.error('Failed to start ClaudeUsageLimitDetector:', error);
    }
  }

  /**
   * Stop monitoring and clean up resources
   */
  public stop(): void {
    if (!this.isMonitoring) {
      console.warn('ClaudeUsageLimitDetector is not currently monitoring');
      return;
    }

    try {
      this.cleanupApiInterception();
      this.cleanupConsoleHooking();
      this.isMonitoring = false;
      console.log('ClaudeUsageLimitDetector stopped monitoring');
    } catch (error) {
      console.error('Error stopping ClaudeUsageLimitDetector:', error);
    }
  }

  /**
   * Add event listener for usage limit detection
   */
  public addEventListener(listener: ClaudeUsageLimitEventListener): void {
    if (!this.eventListeners.includes(listener)) {
      this.eventListeners.push(listener);
    }
  }

  /**
   * Remove event listener
   */
  public removeEventListener(listener: ClaudeUsageLimitEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Set up API interception using Axios and Fetch
   */
  private setupApiInterception(): void {
    // Axios interception (if available)
    if (typeof window !== 'undefined' && (window as any).axios) {
      try {
        const axios = (window as any).axios;
        const requestInterceptor = axios.interceptors.request.use(
          (config: any) => config,
          (error: any) => Promise.reject(error)
        );
        
        const responseInterceptor = axios.interceptors.response.use(
          (response: any) => response,
          (error: any) => {
            this.handleApiError(error);
            return Promise.reject(error);
          }
        );
        
        this.axiosInterceptors.push(requestInterceptor, responseInterceptor);
      } catch (error) {
        console.warn('Failed to set up axios interception:', error);
      }
    }

    // Fetch interception
    if (typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      window.fetch = this.createFetchInterceptor(originalFetch);
    }
  }

  /**
   * Create a fetch interceptor
   */
  private createFetchInterceptor(originalFetch: typeof fetch): typeof fetch {
    return async (...args: Parameters<typeof fetch>): Promise<Response> => {
      try {
        const response = await originalFetch(...args);
        
        // Clone response to avoid consuming the body
        const responseClone = response.clone();
        
        // Check if it's a Claude API response with error
        if (responseClone.url.includes('claude') && !responseClone.ok) {
          try {
            const responseBody = await responseClone.json();
            this.handleApiResponseBody(responseBody);
          } catch (e) {
            // If JSON parsing fails, try to parse as text
            try {
              const text = await responseClone.text();
              this.handleApiResponseText(text);
            } catch (textError) {
              // Ignore text parsing errors
            }
          }
        }
        
        return response;
      } catch (error) {
        this.handleApiError(error);
        throw error;
      }
    };
  }

  /**
   * Handle API error responses
   */
  private handleApiError(error: any): void {
    try {
      if (error && typeof error === 'object') {
        // Handle Axios error structure
        if (error.isAxiosError && error.response && error.response.data) {
          this.handleApiResponseBody(error.response.data);
        }
        // Handle generic error with message
        else if (error.message) {
          this.handleApiResponseText(error.message);
        }
      }
    } catch (handlerError) {
      console.warn('Error in API error handler:', handlerError);
    }
  }

  /**
   * Handle API response body
   */
  private handleApiResponseBody(body: ApiErrorResponseBody): void {
    try {
      if (body.error?.message) {
        this.checkForUsageLimitMessage(body.error.message);
      }
    } catch (error) {
      console.warn('Error handling API response body:', error);
    }
  }

  /**
   * Handle API response as text
   */
  private handleApiResponseText(text: string): void {
    try {
      this.checkForUsageLimitMessage(text);
    } catch (error) {
      console.warn('Error handling API response text:', error);
    }
  }

  /**
   * Set up console.error hooking
   */
  private setupConsoleHooking(): void {
    console.error = (...args: any[]) => {
      try {
        // Process all arguments as potential messages
        for (const arg of args) {
          if (typeof arg === 'string') {
            this.checkForUsageLimitMessage(arg);
          } else if (arg && typeof arg === 'object' && arg.message) {
            this.checkForUsageLimitMessage(arg.message);
          }
        }
      } catch (error) {
        console.warn('Error in console hook:', error);
      }
      
      // Call original console.error
      this.originalConsoleError.apply(console, args);
    };
  }

  /**
   * Check if a message contains usage limit information
   */
  private checkForUsageLimitMessage(message: string): void {
    if (!message || typeof message !== 'string') return;
    
    // Check if message contains Claude Pro usage limit keywords
    if (!message.toLowerCase().includes('claude pro') || 
        !message.toLowerCase().includes('usage limit')) {
      return;
    }

    // Try to match with regex patterns
    for (const pattern of this.regexPatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const resetTime = match[1].trim();
        this.emitUsageLimitDetected({
          resetTime,
          resetTimestamp: this.parseResetTimeToTimestamp(resetTime),
          rawMessage: message
        });
        break;
      }
    }
  }

  /**
   * Parse reset time string to timestamp
   */
  private parseResetTimeToTimestamp(timeString: string): number {
    try {
      // Handle various time formats
      const normalizedTime = timeString.toLowerCase().replace(/\s+/g, '');
      
      // Handle 12-hour format with am/pm
      if (normalizedTime.includes('am') || normalizedTime.includes('pm')) {
        const [time, modifier] = normalizedTime.split(/(am|pm)/);
        let [hours, minutes = '0'] = time.split(':');
        
        let hour = parseInt(hours, 10);
        const minute = parseInt(minutes, 10) || 0;
        
        if (modifier === 'pm' && hour !== 12) {
          hour += 12;
        } else if (modifier === 'am' && hour === 12) {
          hour = 0;
        }
        
        const now = new Date();
        const resetDate = new Date(now);
        resetDate.setHours(hour, minute, 0, 0);
        
        // If the time has already passed today, set it for tomorrow
        if (resetDate <= now) {
          resetDate.setDate(resetDate.getDate() + 1);
        }
        
        return resetDate.getTime();
      }
      // Handle 24-hour format
      else {
        const [hours, minutes = '0'] = normalizedTime.split(':');
        const hour = parseInt(hours, 10);
        const minute = parseInt(minutes, 10) || 0;
        
        const now = new Date();
        const resetDate = new Date(now);
        resetDate.setHours(hour, minute, 0, 0);
        
        // If the time has already passed today, set it for tomorrow
        if (resetDate <= now) {
          resetDate.setDate(resetDate.getDate() + 1);
        }
        
        return resetDate.getTime();
      }
    } catch (error) {
      console.warn('Failed to parse reset time:', timeString, error);
      return Date.now() + 24 * 60 * 60 * 1000; // Default to 24 hours from now
    }
  }

  /**
   * Emit usage limit detected event
   */
  private emitUsageLimitDetected(data: ClaudeUsageLimitData): void {
    // Create a copy of listeners to prevent issues if listeners are modified during execution
    const listeners = [...this.eventListeners];
    
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in ClaudeUsageLimitDetector event listener:', error);
      }
    }
  }

  /**
   * Clean up API interception
   */
  private cleanupApiInterception(): void {
    // Remove axios interceptors
    if (typeof window !== 'undefined' && (window as any).axios) {
      try {
        const axios = (window as any).axios;
        for (const id of this.axiosInterceptors) {
          axios.interceptors.request.eject(id);
          axios.interceptors.response.eject(id);
        }
        this.axiosInterceptors = [];
      } catch (error) {
        console.warn('Failed to clean up axios interceptors:', error);
      }
    }

    // Restore fetch if we intercepted it
    if (typeof window !== 'undefined' && (window as any).originalFetch) {
      window.fetch = (window as any).originalFetch;
    }
  }

  /**
   * Clean up console hooking
   */
  private cleanupConsoleHooking(): void {
    console.error = this.originalConsoleError;
  }

  /**
   * Get current monitoring status
   */
  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

// Export the class and interfaces
export { ClaudeUsageLimitDetector, ClaudeUsageLimitData };
export type { ClaudeUsageLimitEventListener };