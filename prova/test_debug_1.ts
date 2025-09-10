// Fixed syntax errors: missing semicolons, commas, type annotations, undefined variables

function calculateArea(radius: number): number {
  const pi: number = 3.14159;
  return pi * radius * radius;
}

function greetUser(name: string): string {
  return `Hello, ${name}!`;
}

const userData: { name: string; age: number } = {
  name: "Alice",
  age: 30
};

const numbers: number[] = [1, 2, 3, 4, 5];
const processedNumbers: number[] = numbers.map((num: number) => num * 2);

console.log(calculateArea(5));
console.log(greetUser(userData.name));
console.log(processedNumbers);
