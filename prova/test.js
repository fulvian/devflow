"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("./utils");
// Test the greet function
const testName = "Alice";
const greeting = (0, utils_1.greet)(testName);
console.log(greeting); // Output: Hello, Alice!
// Additional test cases
console.log((0, utils_1.greet)("Bob")); // Output: Hello, Bob!
console.log((0, utils_1.greet)("Charlie")); // Output: Hello, Charlie!
