// debug_test_3.ts - Final error demonstration
// SYNTAX: Invalid enum syntax
enum Colors {
  Red = 'RED',
  Green = 'GREEN'
  Blue = 'BLUE'  // SYNTAX: Missing comma
}

// LOGIC: Wrong leap year calculation
function isLeapYear(year: number): boolean {
  return year % 4 == 0  // LOGIC: Missing 100 and 400 checks
}

class Logger {
      // INDENTATION: Extra spaces
  logMessage(message) {  // SYNTAX: Missing type annotation
		console.log(message)  // INDENTATION: Mixed
  }

	  // INDENTATION: Mixed
  errorMessage(msg: string): void {
      console.error('ERROR:', msg)  // INDENTATION: Inconsistent
	}
}

// LOGIC: Incorrect array filtering
function getEvens(numbers: number[]): number[] {
  return numbers.filter(n => n % 2 !== 0)  // LOGIC: Gets odds instead
}

// SYNTAX: Unfinished code block
try {
  const result = 10 / 0
  // Missing catch block

// INDENTATION: Wildly inconsistent
		const user = {
	name: 'Alice',
	  age: 30,
  isAdmin: false
		}