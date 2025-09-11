// debug_test_1.ts - Contains syntax, logic, and indentation errors

// SYNTAX ERRORS
interface User {
  name: string
  age number  // Missing colon - syntax error
}

class TestClass {
  constructor(public name: string) {}

  // Missing closing brace and template literal error
  sayHello() {
    console.log(`Hello ${this.name`  // Syntax error: unclosed template literal
  // Missing closing brace for function
}

// Missing semicolon causing syntax issue
const result = add(5, 10)
console.log('Result:', result  // Syntax error: missing closing parenthesis

function add(a: number, b: number): number {
  return a + b
} // Missing export or proper function closing

// LOGIC ERRORS
function calculateAverage(numbers: number[]): number {
  let sum = 0
  // Logic error: loop skips last element
  for (let i = 0; i < numbers.length - 1; i++) {
    sum += numbers[i]
  }
  // Logic error: possible division by zero
  return sum / numbers.length
}

function isEven(n: number): boolean {
  // Logic error: returns true for odd numbers
  return n % 2 !== 0
}

class Account {
  private balance = 0

  deposit(amount: number): void {
    // Logic error: allows negative deposits
    this.balance += amount
  }

  withdraw(amount: number): boolean {
    // Logic error: no balance check
    this.balance -= amount
    return true  // Always returns true
  }

  getBalance(): number {
    return this.balance
  }
}

// INDENTATION ERRORS (Mixed tabs and spaces)
 	 	 	const user: User = {
	name: "John",
	 	 age: 30  // Inconsistent indentation
};

function processUser() {
if (user.age > 18) {
console.log("Adult")  // No indentation
    } else {
  console.log("Minor")  // Inconsistent indentation
	}
}

  // Excessive and inconsistent indentation
  		  console.log("Processing user:", user.name)