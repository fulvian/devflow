/**
 * Test Code Examples - Mathematical Functions
 * Used in comprehensive verification tests to demonstrate formal verification
 */

// Example 1: Factorial Function (for mathematical property verification)
export function factorial(n: number): number {
  // Precondition: n >= 0
  if (n < 0) {
    throw new Error('Factorial is undefined for negative numbers');
  }
  
  // Base case
  if (n === 0 || n === 1) {
    return 1;
  }
  
  // Recursive case: n! = n * (n-1)!
  return n * factorial(n - 1);
}

// Example 2: GCD Function (Euclidean Algorithm)
export function gcd(a: number, b: number): number {
  // Precondition: a > 0 && b > 0
  if (a <= 0 || b <= 0) {
    throw new Error('GCD requires positive integers');
  }
  
  // Euclidean algorithm
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  
  return a;
}

// Example 3: Binary Search (for correctness verification)
export function binarySearch(arr: number[], target: number): number {
  // Precondition: arr is sorted in ascending order
  let left = 0;
  let right = arr.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    
    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return -1; // Not found
}

// Example 4: Fibonacci Function (for performance analysis)
export function fibonacci(n: number): number {
  // Precondition: n >= 0
  if (n < 0) {
    throw new Error('Fibonacci is undefined for negative numbers');
  }
  
  if (n === 0) return 0;
  if (n === 1) return 1;
  
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const temp = a + b;
    a = b;
    b = temp;
  }
  
  return b;
}

// Example 5: Prime Check (for algorithmic verification)
export function isPrime(n: number): boolean {
  // Precondition: n > 1
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  
  // Check for divisors from 5 to sqrt(n)
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) {
      return false;
    }
  }
  
  return true;
}

// Example 6: Sort Function (for correctness and complexity verification)
export function bubbleSort(arr: number[]): number[] {
  const result = [...arr]; // Don't modify original array
  const n = result.length;
  
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (result[j] > result[j + 1]) {
        // Swap elements
        const temp = result[j];
        result[j] = result[j + 1];
        result[j + 1] = temp;
      }
    }
  }
  
  return result;
}