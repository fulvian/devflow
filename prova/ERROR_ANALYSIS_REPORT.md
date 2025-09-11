# Comprehensive Error Analysis Report

## File 1: debug_test_1.ts

### Syntax Errors:
1. **Line 6**: Missing colon in interface declaration
   ```typescript
   age number  // Should be: age: number
   ```

2. **Line 14**: Unclosed template literal
   ```typescript
   console.log(`Hello ${this.name`  // Should be: console.log(`Hello ${this.name}`)
   ```

3. **Line 15**: Missing closing brace for function `sayHello()`

4. **Line 20**: Missing closing parenthesis in function call
   ```typescript
   console.log('Result:', result  // Should be: console.log('Result:', result)
   ```

### Logic Errors:
1. **Lines 29-34**: Loop skips last element in `calculateAverage` function
   ```typescript
   for (let i = 0; i < numbers.length - 1; i++) {  // Should be: i < numbers.length
   ```
   Also, division by zero possible when numbers array is empty.

2. **Lines 38-39**: `isEven` function returns true for odd numbers
   ```typescript
   return n % 2 !== 0  // Should be: return n % 2 === 0
   ```

3. **Lines 46-47**: `deposit` method allows negative deposits (should validate amount > 0)

4. **Lines 51-53**: `withdraw` method has no balance check and always returns true

### Indentation Errors:
1. **Lines 62-65**: Mixed tabs and spaces in object declaration
2. **Lines 68-72**: Inconsistent indentation in `processUser` function:
   - Line 69: No indentation
   - Line 71: Inconsistent indentation
   - Line 72: Different indentation style
3. **Line 76**: Excessive and inconsistent indentation

## File 2: debug_test_2.ts

### Syntax Errors:
1. **Line 8**: Missing closing brace and semicolon for `multiply` function

2. **Line 15**: Missing `this.` reference in `calculateArea` method
   ```typescript
   return Math.PI * radius ** 2  // Should be: return Math.PI * this.radius ** 2
   ```

### Logic Errors:
1. **Lines 21-28**: Incorrect logic in `findMax` function:
   - Initialization with `Number.MIN_VALUE` instead of first element or `Number.NEGATIVE_INFINITY`
   - Wrong comparison operator (should be `num > max`)
   ```typescript
   if (num < max) {  // Should be: if (num > max) {
   ```

2. **Lines 32-33**: Incorrect string formatting in `formatName` function:
   ```typescript
   return `${last ? last + ', ' : ''}${first}`  // Logic error in conditional
   ```

3. **Lines 37-41**: Incorrect prime number check in `isPrime` function:
   - Doesn't handle case for 2 correctly
   - Loop condition should be `i <= Math.sqrt(n)`
   ```typescript
   for (let i = 2; i < Math.sqrt(n); i++) {  // Should be: i <= Math.sqrt(n)
   ```

4. **Lines 57-58**: Incorrect power calculation in `power` method:
   ```typescript
   return base * base  // Should be: return Math.pow(base, exp) or base ** exp
   ```

### Indentation Errors:
1. **Lines 45-47**: Mixed tabs and spaces in `Calculator` class
2. **Lines 50-53**: Inconsistent indentation in `divide` method
3. **Lines 55-59**: Inconsistent indentation in `power` method:
   - Line 57: Decreased indentation instead of increased
   - Line 58: Wrong indentation level
4. **Lines 63-67**: Inconsistent indentation in `nested` function

## File 3: debug_test_3.ts

### Syntax Errors:
1. **Line 6**: Missing comma in enum declaration
   ```typescript
   Green = 'GREEN'
   Blue = 'BLUE'  // Missing comma after 'GREEN'
   ```

2. **Line 16**: Missing type annotation for parameter
   ```typescript
   logMessage(message) {  // Should be: logMessage(message: string) {
   ```

3. **Lines 32-34**: Missing catch block in try statement

### Logic Errors:
1. **Lines 10-11**: Incorrect leap year calculation
   ```typescript
   return year % 4 == 0  // Missing checks for century years
   ```

2. **Lines 27-28**: `getEvens` function returns odd numbers instead of even numbers
   ```typescript
   return numbers.filter(n => n % 2 !== 0)  // Should be: n % 2 === 0
   ```

### Indentation Errors:
1. **Lines 15-18**: Extra spaces in `Logger` class
2. **Lines 17, 22**: Mixed indentation (tabs and spaces)
3. **Lines 21-23**: Inconsistent indentation in `errorMessage` method
4. **Lines 37-41**: Wildly inconsistent indentation in object declaration