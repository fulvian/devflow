/**
 * Test Code Examples - Quality Issues
 * Used in comprehensive verification tests to demonstrate quality gates
 */

// Example 1: High Complexity Function (Cyclomatic Complexity > 10)
export function complexFunction(input: any): any {
  if (input === null) {
    return null;
  } else if (input === undefined) {
    return undefined;
  } else if (typeof input === 'string') {
    if (input.length === 0) {
      return 'empty';
    } else if (input.length < 5) {
      return 'short';
    } else if (input.length < 20) {
      return 'medium';
    } else {
      return 'long';
    }
  } else if (typeof input === 'number') {
    if (input === 0) {
      return 'zero';
    } else if (input > 0) {
      if (input < 10) {
        return 'small positive';
      } else if (input < 100) {
        return 'medium positive';
      } else {
        return 'large positive';
      }
    } else {
      if (input > -10) {
        return 'small negative';
      } else if (input > -100) {
        return 'medium negative';
      } else {
        return 'large negative';
      }
    }
  } else if (typeof input === 'boolean') {
    return input ? 'true value' : 'false value';
  } else if (Array.isArray(input)) {
    if (input.length === 0) {
      return 'empty array';
    } else if (input.length < 5) {
      return 'small array';
    } else {
      return 'large array';
    }
  } else {
    return 'unknown type';
  }
}

// Example 2: Poor Code Coverage (many untested branches)
export class UntestedClass {
  private data: any[] = [];

  public addItem(item: any): void {
    if (item === null) {
      throw new Error('Cannot add null item');
    }
    if (item === undefined) {
      throw new Error('Cannot add undefined item');
    }
    this.data.push(item);
  }

  public removeItem(index: number): any {
    if (index < 0) {
      throw new Error('Index cannot be negative');
    }
    if (index >= this.data.length) {
      throw new Error('Index out of bounds');
    }
    return this.data.splice(index, 1)[0];
  }

  public getItem(index: number): any {
    if (index < 0) {
      return null;
    }
    if (index >= this.data.length) {
      return null;
    }
    return this.data[index];
  }

  public processItems(processor: (item: any) => any): any[] {
    const results: any[] = [];
    for (const item of this.data) {
      try {
        const result = processor(item);
        if (result !== null && result !== undefined) {
          results.push(result);
        }
      } catch (error) {
        // Silently ignore errors - bad practice but for testing
        continue;
      }
    }
    return results;
  }
}

// Example 3: Poor Code Quality (long function, many parameters)
export function poorQualityFunction(
  param1: string,
  param2: number,
  param3: boolean,
  param4: any[],
  param5: { [key: string]: any },
  param6: Date,
  param7: RegExp,
  param8: Function,
  param9?: string,
  param10?: number
): { result: any; metadata: any; errors: string[] } {
  const errors: string[] = [];
  let result: any = null;
  const metadata: any = {
    timestamp: new Date(),
    processed: false,
    validations: []
  };

  // Validation logic (very long and nested)
  if (!param1 || param1.trim().length === 0) {
    errors.push('param1 is required');
  } else {
    if (param1.length > 100) {
      errors.push('param1 too long');
    }
    if (!param7.test(param1)) {
      errors.push('param1 format invalid');
    }
  }

  if (param2 === null || param2 === undefined) {
    errors.push('param2 is required');
  } else {
    if (param2 < 0) {
      errors.push('param2 must be positive');
    }
    if (param2 > 1000000) {
      errors.push('param2 too large');
    }
  }

  // Processing logic (should be extracted to separate functions)
  if (param3) {
    try {
      result = param8(param1, param2);
      if (param4 && param4.length > 0) {
        for (let i = 0; i < param4.length; i++) {
          if (param4[i] && typeof param4[i] === 'object') {
            if (param5 && param5[param4[i].key]) {
              result = param5[param4[i].key](result);
            }
          }
        }
      }
    } catch (error) {
      errors.push(`Processing error: ${error}`);
    }
  } else {
    result = param1 + param2.toString();
    if (param9) {
      result += param9;
    }
    if (param10) {
      result += param10.toString();
    }
  }

  metadata.processed = true;
  metadata.validations = errors.length === 0 ? ['all passed'] : errors;

  return { result, metadata, errors };
}

// Example 4: No Error Handling
export function noErrorHandling(data: string): object {
  // No try-catch, no validation
  const parsed = JSON.parse(data);
  const result = parsed.items.map((item: any) => item.value.toString().toUpperCase());
  return { processed: result.length, data: result };
}

// Example 5: Memory Leak Potential
export class MemoryLeakClass {
  private listeners: Function[] = [];
  private timers: NodeJS.Timeout[] = [];
  private cache: Map<string, any> = new Map();

  public addListener(fn: Function): void {
    this.listeners.push(fn);
    // Missing: removal mechanism
  }

  public startTimer(): void {
    const timer = setInterval(() => {
      this.cache.set(Date.now().toString(), new Array(1000).fill('data'));
    }, 100);
    this.timers.push(timer);
    // Missing: cleanup logic
  }

  public processData(key: string, data: any): void {
    // Unbounded cache growth
    this.cache.set(key, data);
    this.listeners.forEach(fn => fn(data));
  }
}