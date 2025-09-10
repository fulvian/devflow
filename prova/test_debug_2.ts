// Fixed logic errors: off-by-one loops, wrong formulas, infinite loop potential, 
// wrong operators, array bounds issues, wrong recursion

// Fixed off-by-one error in loop
function sumArray(arr: number[]): number {
  let sum: number = 0;
  for (let i: number = 0; i < arr.length; i++) {  // Corrected condition
    sum += arr[i];
  }
  return sum;
}

// Fixed wrong formula for factorial calculation
function factorial(n: number): number {
  if (n <= 1) return 1;  // Corrected base case
  return n * factorial(n - 1);
}

// Fixed potential infinite loop
function countdown(start: number): void {
  let current: number = start;
  while (current > 0) {  // Corrected condition
    console.log(current);
    current--;  // Decrement to avoid infinite loop
  }
}

// Fixed array bounds issue
function safeArrayAccess(arr: number[], index: number): number | undefined {
  if (index >= 0 && index < arr.length) {  // Corrected bounds check
    return arr[index];
  }
  return undefined;
}

// Test cases
const testArray: number[] = [1, 2, 3, 4, 5];
console.log(sumArray(testArray));  // Should be 15
console.log(factorial(5));  // Should be 120
console.log(safeArrayAccess(testArray, 2));  // Should be 3
console.log(safeArrayAccess(testArray, 10)); // Should be undefined
