// debug_test_2.ts - Contains syntax, logic, and indentation errors

// SYNTAX ERRORS
const numbers = [1, 2, 3, 4, 5]  // Missing semicolon

function multiply(a: number, b: number): number
{
    return a * b  // Missing closing brace and semicolon

class Circle {
    constructor(public radius: number) {}

    // Missing type annotation and closing parenthesis
    calculateArea() {
        return Math.PI * radius ** 2
    }
}

// LOGIC ERRORS
function findMax(nums: number[]): number {
    let max = Number.MIN_VALUE
    // Logic error: sets max to MIN_VALUE but never updates
    for (const num of nums) {
        if (num < max) {  // Wrong comparison
            max = num
        }
    }
    return max
}

function formatName(first: string, last: string): string {
    // Logic error: adds extra space when no middle name
    return `${last ? last + ', ' : ''}${first}`
}

function isPrime(n: number): boolean {
    // Logic error: 2 is prime but returns false
    for (let i = 2; i < Math.sqrt(n); i++) {
        if (n % i === 0) return false
    }
    return true
}

// INDENTATION ERRORS
	  class Calculator {
    add(x: number, y: number): number {
	return x + y  // Mixed tabs and spaces
    }

    divide(x: number,
	   y: number): number {  // Inconsistent indentation
            return x / y
  }

	power(base: number, exp: number): number {
		// Indentation decreases instead of increasing
	if (exp === 0) return 1
		return base * base  // Wrong calculation
    }
}

  // Deeply nested with inconsistent indentation
    function nested() {
	if (true) {
	console.log('Deep inside')
	}
    }