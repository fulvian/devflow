import { DebugRouterService } from '../services/DebugRouterService';
import { BackupManagerService } from '../services/BackupManagerService';

// Original problematic code with logic errors
// function calculateArea(radius) {
//   return radius * radius; // Missing PI
// }

// Corrected version with proper logic
const debugRouter = new DebugRouterService();
const backupManager = new BackupManagerService();

// Create backup before modification
backupManager.createBackup('test_debug_2.ts');

try {
  function calculateArea(radius: number): number {
    // Added missing PI multiplier for circle area calculation
    return Math.PI * radius * radius;
  }
  
  const area = calculateArea(5);
  console.log(`Area of circle: ${area}`);
  
  // Apply debug routing for logic fixes
  debugRouter.routeFix({
    fileName: 'test_debug_2.ts',
    errorType: 'logic',
    severity: 'medium',
    description: 'Added PI multiplier for correct circle area calculation'
  });
} catch (error) {
  debugRouter.handleFallback(error, 'test_debug_2.ts');
}
