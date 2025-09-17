/**
 * HELLO-WORLD-001
 * 
 * A simple function that prints "Hello, World!" to the console.
 * This function demonstrates basic JavaScript syntax and console output.
 */

/**
 * Prints "Hello, World!" to the console
 * 
 * @returns {void}
 * 
 * @example
 * sayHelloWorld();
 * // Output: Hello, World!
 */
function sayHelloWorld() {
    console.log("Hello, World!");
}

// Export the function for use in other modules
module.exports = { sayHelloWorld };

// Example usage (uncomment to test)
// sayHelloWorld();