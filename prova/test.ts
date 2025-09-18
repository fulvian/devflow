import { greet } from './utils';

// Test the greet function
const testName = "Alice";
const greeting = greet(testName);

console.log(greeting); // Output: Hello, Alice!

// Additional test cases
console.log(greet("Bob")); // Output: Hello, Bob!
console.log(greet("Charlie")); // Output: Hello, Charlie!