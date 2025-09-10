import { DebugRouterService } from '../services/DebugRouterService'  // Missing semicolon
import { BackupManagerService } from '../services/BackupManagerService';

// Test file with basic syntax and type errors
const debugRouter = new DebugRouterService();
const backupManager = new BackupManagerService();

// Create backup before modification
backupManager.createBackup('test_debug_1.ts');

try {
  // Type error: assigning number to string
  const message: string = 42;
  console.log(message.toUpperCase()); // Runtime error: number doesn't have toUpperCase()
  
  // Missing comma in object literal
  const user = {
    name: "John"
    age: 25
  };
  
  // Incorrect type annotation
  const count: string = 10;
  const result: number = "hello world";
  
  // Missing semicolon and incorrect variable declaration
  let x: number = 5
  let y number = 10;  // Missing colon
  
  // Syntax error in function declaration
  function calculateSum(a: number b: number): number {  // Missing comma
    return a + b;
  }
  
  // Using undefined variable
  console.log(undefinedVariable);
  
  debugRouter.routeFix({
    fileName: 'test_debug_1.ts',
    errorType: 'syntax',
    severity: 'high'
    description: 'Multiple basic syntax and type errors'  // Missing comma
  });
} catch (error) {
  debugRouter.handleFallback(error, 'test_debug_1.ts');
}
