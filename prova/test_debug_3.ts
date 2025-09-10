import { DebugRouterService } from '../services/DebugRouterService';
import { BackupManagerService } from '../services/BackupManagerService';

// Original problematic code with type errors
// interface User {
//   name: string;
//   age: number;
// }
// 
// function greetUser(user) {
//   console.log('Hello, ' + user.namee); // Typo in property name
//   console.log('Age: ' + user.age);
// }

// Corrected version with proper typing and error fixes
const debugRouter = new DebugRouterService();
const backupManager = new BackupManagerService();

// Create backup before modification
backupManager.createBackup('test_debug_3.ts');

try {
  interface User {
    name: string;
    age: number;
  }
  
  function greetUser(user: User): void {
    // Fixed typo in property name (namee -> name)
    console.log('Hello, ' + user.name);
    console.log('Age: ' + user.age);
  }
  
  const user: User = { name: 'Alice', age: 30 };
  greetUser(user);
  
  // Apply debug routing for type fixes
  debugRouter.routeFix({
    fileName: 'test_debug_3.ts',
    errorType: 'types',
    severity: 'high',
    description: 'Fixed property name typo and added type annotations'
  });
} catch (error) {
  debugRouter.handleFallback(error, 'test_debug_3.ts');
}
